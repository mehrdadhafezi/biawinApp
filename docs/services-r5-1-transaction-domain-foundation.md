# SERVICES-R5.1 — Transaction Domain Foundation

## 1. Baseline

- Starting commit: `72f369b` (`docs(services): SERVICES-R5 purchase flow contract analysis`).
- SERVICES-R1 through R4 are the last stages with real staging QA (R4: API 54/0/0, Browser 71/0/1 NOT_TESTED — the one NOT_TESTED being the accepted merchant-positive-path data gap since 0 real merchants exist).
- SERVICES-R5 was analysis/contract-only (zero code changes) and established the baseline this stage builds on: `docs/services-r5-purchase-flow-contract.md`.
- This stage is backend-only. No frontend files were touched. No customer Purchase UI exists or was built.

## 2. Re-verified identity boundary

Re-traced directly from source (not repeated from R5's memo):

- `JwtStrategy.validate()` (`backend/src/modules/auth/strategies/jwt.strategy.ts`) returns `{ userId: payload.sub, phone: payload.phone }` straight from the JWT `sub` claim — no intermediate identity lookup.
- `CurrentUser()` (`backend/src/common/decorators/current-user.decorator.ts`) exposes that object to controllers as `AuthenticatedUser`.
- No `Customer` model exists anywhere in `schema.prisma` or the codebase (grepped: zero matches for a `Customer`/`customerId` concept).
- Every financial model keys directly off `User.id`: `Wallet.userId`, `CreditLine.userId`, `Installment.userId`, `Order.userId`, `Membership.userId`, `RewardClaim.userId` — all are direct FKs to `User.id`, not to any intermediate identity.
- Conclusion: `identity.users.id` **is** `Order.userId` — there is no place in the codebase where a different "customer id" could be silently substituted. `OrdersService` uses `currentUser.userId` (from the JWT) as the sole ownership key for every operation.

## 3. Existing transaction-model audit

| Model | Ownership | Real write path before R5.1 | Notes |
|---|---|---|---|
| `Order` | `userId` | `OrdersService.create()` — unsafe (see §5) | Now hardened (§6). |
| `Payment` | via `Order.userId` | None (0 real callers) | `PaymentsService.record()` exists but nothing calls it. |
| `Wallet` / `WalletTransaction` | `userId` | None (0 real callers) | `WalletService.credit()`/`.debit()` are real, atomic (`$transaction`), balance-checked, audit-logged — but dead code today. |
| `CreditLine` / `CreditUsage` | `userId` | None | `CreditService` is read-only (`list`/`findOneOrThrow`). |
| `Installment` | `userId` | None | `InstallmentsService` is read-only. |
| `RewardClaim` | `userId` | None | `RewardsService` is read-only. |

Payment-gateway abstraction (`PaymentProvider` interface, `ZibalProvider`, `ZarinpalProvider`, `payment-provider.factory.ts`) is real, HTTP-capable code with zero real callers anywhere — confirmed again this stage by grep.

## 4. Authoritative pricing-source finding

This is the most important finding of R5.1. Verified live, read-only, against the real staging public API (`GET /api/v1/services`, both pages, all 108 real services):

- **0 / 108** real services have a non-null `priceFrom`.
- **0 / 108** real services support the `free` purchase method (distribution: `credit`:40, `installment`:38, `cash`:30, `free`:0).

**Conclusion: no authoritative amount source exists today for `credit` / `installment` / `cash` purchases.** `free` would be tautologically authoritative at amount `0`, but no real service currently offers it.

Per the task's explicit instruction, this stage does **not** invent, hardcode, or derive a fallback price. `ServicePricingService.resolveAuthoritativePrice()` (`backend/src/modules/orders/pricing/service-pricing.service.ts`) implements the honest rule — `free` → `0`; else a positive `service.priceFrom` → that value; else throw `UnprocessableEntityException` — which today always throws for every real service and every non-`free` method. This is intentional: **a safely blocked checkout is preferred over an unsafe working one.** The logic itself is written to be forward-compatible — once a real pricing source is decided (R5.2+), only this one method needs to change.

## 5. Existing unsafe-endpoint findings

Before this stage, `OrdersService.create()` did:

```ts
this.prisma.order.create({
  data: { orderNumber, userId, serviceId: dto.serviceId, method: dto.method, amount: dto.amount, status: 'pending' },
});
```

`CreateOrderDto.amount` was a client-supplied, client-trusted integer — the confirmed critical vulnerability. There was no service-active check, no method-eligibility check, no merchant validation, and no idempotency.

**Reachability audit**: grepped `web/`, `admin/`, and `mobile/` for any caller of `POST /orders` — zero real callers found (only unrelated comment-string matches, e.g. "reorders"). Zero existing tests for `orders`, `wallet`, `payments`, or `transactions` existed before this stage.

**Disposition**: hardened the existing endpoint in place rather than adding a parallel one, per the "least disruptive safe option" instruction — there was no real consumer to keep compatible with, and leaving a known-unsafe path live alongside a new safe one was explicitly disallowed.

## 6. Transaction architecture

`OrdersService.create(userId, dto)` is the single server-side purchase command:

1. Idempotency pre-check by `(userId, idempotencyKey)`.
2. If found: validate the retry matches the original request (§8); return the existing order (safe retry) or reject (conflict).
3. If not found: validate domain relationships and resolve price (§7).
4. Insert the `Order` row (single atomic `create()`), catching a unique-constraint race (§8).

`CreateOrderDto` no longer has an `amount` field at all — the server cannot be tricked into trusting one because there is nowhere for the client to put it. `merchantId` is optional and is used only to *validate* the request against the service's real merchant relationship; it never determines what is actually stored.

## 7. Schema changes

`backend/prisma/schema.prisma`:

- `Order.merchantId String?` + relation to `Merchant` (`onDelete: SetNull`) — a server-derived **snapshot** of `Service.merchantId` at order-creation time, kept separate from a live join so a later merchant re-link on the Service can never silently rewrite what an existing Order actually transacted with.
- `Order.idempotencyKey String?` — nullable so no backfill is required for legacy rows; every new order created through `OrdersService.create()` always sets a real value (enforced at the application boundary, not the database).
- `@@unique([userId, idempotencyKey])` on `Order` — compound, not globally unique, so two different users can coincidentally pick the same key.
- `Merchant.orders Order[]` — reverse relation for the above.

Migration: `backend/prisma/migrations/20260830205109_order_merchant_snapshot_and_idempotency/migration.sql`. Generated via `prisma migrate diff` (the interactive `migrate dev` command refuses to run in this non-interactive shell) against the local, isolated dev Postgres container (`docker-compose.dev-infra.yml`, port 55433 — never staging), then applied with `prisma migrate deploy` and verified with `prisma migrate status` ("Database schema is up to date"). The SQL is purely additive: two nullable columns, one unique index, one FK with `ON DELETE SET NULL` — no data loss, no backfill needed.

## 8. Idempotency design

- Client sends a required `idempotencyKey` (string, 1–128 chars) with every `POST /orders`.
- Lookup by the compound key `(userId, idempotencyKey)` happens **before** any domain validation.
- **Exact retry** (same `serviceId` + `method`, and if `merchantId` was supplied, it matches the stored value): returns the original order, no new row, `prisma.order.create` never called.
- **Conflicting reuse** (same key, different `serviceId`/`method`/`merchantId`): `ConflictException` — the key cannot be reused for a different purchase intent.
- **Race condition**: two concurrent requests with the same new key can both pass the pre-check; the DB-level `@@unique([userId, idempotencyKey])` constraint rejects the loser with a `P2002` error, which is caught, the row is re-fetched, and the same match-or-conflict logic is applied — so the race resolves to either a safe replay or a `ConflictException`, never a silent double-charge and never an unhandled 500. This is real database-level protection, not just an in-memory check.

## 9. Order state machine

`backend/src/modules/orders/order-state-machine.ts` defines `ORDER_STATUS_TRANSITIONS` and `assertOrderTransition(from, to)` against the existing `OrderStatus` enum (`pending → processing → awaiting_payment → paid → delivered → cancelled`) without inventing any new meaning for a status this stage doesn't use. R5.1 only ever creates orders in `pending` — there is no status-mutation endpoint yet, so the caller cannot set status at all (it isn't a DTO field). The helper is unit-tested directly (`order-state-machine.spec.ts`) so the enforcement point exists and is proven correct before any later stage wires a real transition into it.

## 10. Relationship validations (server-side, in `OrdersService.validateAndPrice`)

- Service must exist (`NotFoundException` otherwise) and be `active` (`UnprocessableEntityException` otherwise).
- `dto.method` must appear in the service's real `availableMethods` (never trusted from the frontend).
- If the service has a `merchantId`: a client-supplied `merchantId` must match it exactly; the merchant must exist and be `active`. The **stored** `merchantId` is always `service.merchantId`, never the client's value.
- If the service has no merchant, supplying any `merchantId` is rejected — there is nothing for it to validate against.

## 11. Error contract

Standard NestJS exceptions, matching the existing global `HttpExceptionFilter` envelope (`{success:false, error:{code, message, details}}`) — no new exception hierarchy introduced:

| Condition | Exception |
|---|---|
| Service not found | `NotFoundException` (404) |
| Service inactive | `UnprocessableEntityException` (422) |
| Method not supported by service | `UnprocessableEntityException` (422) |
| Merchant mismatch / nonexistent / inactive | `UnprocessableEntityException` (422) |
| Authoritative price unavailable | `UnprocessableEntityException` (422) |
| Idempotency key reused with different parameters | `ConflictException` (409) |
| Invalid order status transition | `ConflictException` (409) |
| Order not found / not owned by caller | `NotFoundException` (404) |

No internal stack traces or DB error details are ever leaked — the global filter already strips those for every route.

## 12. Security invariants

- Every route on `OrdersController` requires authentication (verified: no `@Public()` metadata on the controller or any handler — global `JwtAuthGuard` applies).
- `amount` cannot be supplied by the client — the field doesn't exist in `CreateOrderDto`.
- All queries (`list`, `findOneOrThrow`) are scoped to `currentUser.userId`; a caller cannot read or reference another user's order.
- `merchantId`, `serviceId`, and `method` are all independently re-validated against live data; nothing from the frontend (including category-derived data) is treated as financial authority.
- No wallet debit, gateway call, or installment creation happens anywhere in this code path.

## 13. Transaction boundaries

The only mutation is a single `prisma.order.create()` call — one row insert that atomically sets `amount`, `method`, `merchantId`, and `idempotencyKey` together. A single Prisma `create()` is already atomic, so no explicit `$transaction()` wrapper is needed for it. The idempotency race is handled by catching the DB unique-constraint violation and re-fetching (§8), not by wrapping the check-then-act sequence in a transaction — that pattern is the more correct fit here since "read, then conditionally insert" across two round-trips can't be made atomic by a transaction alone without added locking complexity this stage doesn't need. No external HTTP call (gateway) is embedded in any DB operation.

## 14. What R5.1 deliberately does NOT do

- No payment-gateway invocation (Zibal/Zarinpal exist but are not called).
- No wallet debit (`WalletService.debit()` exists but is not called).
- No installment schedule creation (no month counts, schedules, fees, due dates).
- No customer Purchase UI of any kind (no Purchase Sheet, checkout form, success/failure page, receipt, redirect, OTP, or payment callback).
- No change to the Services `cardOnly` contract.
- No status-mutation endpoint (orders are only ever created in `pending`).

## 15. Wallet decision

Not wired. Before any real debit can happen, an actual product decision is needed on: what wallet balance represents, which `PurchaseMethod` values should debit it (if any), whether credit eligibility is a separate concept from wallet balance, what "insufficient funds" behavior should be, and whether a reservation/hold semantic is required between order creation and payment confirmation. None of this is authoritative in the repo today. `WalletService.credit()`/`.debit()` remain real, tested-adjacent, atomic code — but R5.1 does not call them.

## 16. Installment decision

Not wired. `InstallmentsService` remains read-only scaffolding. No month counts, schedules, fees, due dates, interest, or monthly payment values are computed or stored by this stage.

## 17. Gateway decision

Not wired. `PaymentProvider`/`ZibalProvider`/`ZarinpalProvider`/`payment-provider.factory.ts` are untouched. No production payment attempt, no mock pretending to be a completed purchase, is introduced.

## 18. Tests

New files, using the established mocked-`PrismaService` convention (no real DB in unit tests):

- `backend/src/modules/orders/orders.service.spec.ts` — 20 scenarios covering: nonexistent/inactive service rejection, unsupported method rejection, merchant mismatch/nonexistent/inactive rejection, merchant-supplied-for-merchantless-service rejection, pricing-unavailable blocking, amount-tampering immunity, exact idempotent retry (no duplicate created), conflicting-key-reuse rejection, concurrent-insert race handled safely, genuine race conflict propagated, ownership scoping on `list`/`findOneOrThrow`, no-wallet-debit, no-installment-creation, no-gateway-dependency (constructor param-type assertion).
- `backend/src/modules/orders/orders.controller.spec.ts` — no route opts out of the global auth guard (`@Public()` metadata check on the controller and every handler), and all three handlers pass the authenticated `userId` through untouched.
- `backend/src/modules/orders/pricing/service-pricing.service.spec.ts` — `free` → 0, positive `priceFrom` → that value, `null`/`0` `priceFrom` → blocked.
- `backend/src/modules/orders/order-state-machine.spec.ts` — valid transitions allowed, invalid/skipped/terminal-state transitions rejected.

Result: **33/33 new tests passing**; **137/137 backend tests passing** overall (no regressions).

## 19. Files changed

```
M  backend/prisma/schema.prisma
M  backend/src/modules/orders/dto/create-order.dto.ts
M  backend/src/modules/orders/orders.module.ts
M  backend/src/modules/orders/orders.service.ts
A  backend/prisma/migrations/20260830205109_order_merchant_snapshot_and_idempotency/migration.sql
A  backend/src/modules/orders/order-state-machine.ts
A  backend/src/modules/orders/order-state-machine.spec.ts
A  backend/src/modules/orders/orders.controller.spec.ts
A  backend/src/modules/orders/orders.service.spec.ts
A  backend/src/modules/orders/pricing/service-pricing.service.ts
A  backend/src/modules/orders/pricing/service-pricing.service.spec.ts
A  docs/services-r5-1-transaction-domain-foundation.md
```

## 20. Migration details

Additive only: two nullable columns (`orders.idempotencyKey`, `orders.merchantId`), one unique index (`orders_userId_idempotencyKey_key`), one FK (`orders_merchantId_fkey`, `ON DELETE SET NULL`). No existing column was altered or dropped. No historical `Order` rows need a value for either new column — `merchantId` stays `null` for pre-R5.1 orders (accurate: it was never known before), and `idempotencyKey` stays `null` for them (they predate the idempotency feature). All *new* orders are required to set a real `idempotencyKey` — enforced by `CreateOrderDto` validation at the application boundary, not a `NOT NULL` database constraint, precisely so legacy rows never need a fabricated backfill value.

## 21. Compatibility notes

`POST /orders` changes shape: `amount` is removed, `idempotencyKey` becomes required, `merchantId` becomes optional. Since this endpoint had zero real callers (grepped across web/admin/mobile) and zero prior tests, this is not a breaking change to any live consumer. `GET /orders` and `GET /orders/:id` are unchanged. No R1–R4 Services routes, components, or contracts (`cardOnly`, relationship validation, Home CMS) were touched.

## 22. Remaining blockers for R5.2

- **Product decision required**: what the authoritative price source for `credit`/`installment`/`cash` purchases should be (a new `priceFrom`-equivalent data source, an admin-entered price, a merchant-supplied price feed, etc.). Until this exists, every real purchase attempt will be blocked by `ServicePricingService` — by design.
- Wallet-debit business rules (§15) need to be defined before any real money movement can be wired in.
- Installment schedule rules (§16) need to be defined before any schedule can be created.
- Gateway integration (§17) needs a live merchant account and a defined success/failure/callback flow before it can be exercised for real.
- No customer-facing Purchase UI exists yet — that is explicitly out of scope for R5.1 and remains for a future stage once the above are resolved.

## 23. Staging QA plan

No application behavior visible to any real user or existing integration changed (the only endpoint touched had zero real callers), so there is no user-facing regression surface to QA in a browser. The staging-relevant verification for this stage is: (1) apply the migration to the staging database and confirm it applies cleanly and additively (no data loss, matches the local dry run in §7), (2) confirm `prisma migrate status` reports "up to date" against staging afterward, (3) optionally issue one authenticated `POST /orders` request with a disposable, clearly-tagged test idempotency key against a real service to confirm it returns the expected `422 Purchase unavailable` response (proving the pricing gate is live), then discard/ignore that no-op verification request — no order row is created when pricing resolution fails, so no cleanup is needed. No fictional or production-like financial records are created at any point.

## 24. Real Staging Transaction QA (SERVICES-R5.1.1)

§23's plan was executed and formalized as a permanent, repeatable section of the existing authenticated staging QA runner (`backend/scripts/staging-qa/authenticated-qa-runner.ts`, `docs/stage-5.22-authenticated-qa-runner.md`) rather than a one-off manual `curl`, so this proof re-runs every time that runner does — not just once at ship time.

**Real-data constraints this QA operates under**: as of this stage, staging carries 108 real Services, of which 0 have a usable `priceFrom` and 0 support the `free` method — meaning the R5.1 authoritative-pricing gate is expected to block *every* real purchase attempt today. The QA discovers a real Service meeting exactly that condition from the public `GET /api/v1/services` catalog (`discoverPricingBlockedService()`) rather than hardcoding a UUID or fabricating one, and explicitly asserts the discovered Service really has no usable price before using it — so the QA fails loudly, rather than silently passing, if the catalog ever changes underneath it.

**Tests added** (new "SERVICES-R5.1 …" checks in the API-layer report, using the existing `STAGING_TEST_AUTH` customer fixture):

| Check | Real HTTP contract proven |
|---|---|
| Unauthenticated `POST /orders` rejected | `401` |
| Real service discovered / has no usable price | n/a (setup + assertion) |
| Authoritative pricing unavailable | `422` |
| Client `amount` cannot control the transaction | `400` (rejected outright by the deployed `ValidationPipe`'s `whitelist: true, forbidNonWhitelisted: true` — see `backend/src/main.ts` — i.e. outcome **A** from the task's two allowed outcomes, not "stripped and ignored") |
| Unsupported purchase method rejected | `422`, and shown to fire independently of the pricing gate since method-eligibility is validated before price resolution (`OrdersService.validateAndPrice`) |
| Nonexistent service rejected | `404` |
| Unrelated/nonexistent merchant rejected | `422` (exercises the "merchant supplied for a merchantless service" branch, since 0/108 real services currently have a real merchant — the same branch would apply to the mismatch case if a merchant-linked service existed) |
| Repeated identical blocked request is deterministic, no duplicate | `422` both times; no `Order` row exists to duplicate, since the row is never inserted while pricing is unavailable |
| Client `userId`/`ownerId` cannot influence ownership | `400`, same whitelist mechanism as the amount-tampering check |

**Database side-effect proof**: `Order`/`Payment`/`Installment` row counts for the `STAGING_TEST_AUTH` user, and that user's `Wallet` row(s) (by id, matched individually so a swap wouldn't hide as a no-op), are snapshotted via direct Prisma access (the QA runner already has this — see the runner's Admin-account-provisioning use of Prisma) immediately before the first `POST /orders` attempt and re-read immediately after the last one. All four deltas are asserted to be exactly zero. If the `STAGING_TEST_AUTH` user has no `Wallet` row at all (the real, current state), the QA asserts none was created as a side effect, rather than skipping the check.

**Idempotency coverage achieved**: a blocked (pricing-unavailable) request sent twice with the same `idempotencyKey` is proven deterministic — both attempts return `422`, no partial state or duplicate is left behind. This exercises the idempotency pre-check path (`OrdersService.create()`'s `findUnique` by `(userId, idempotencyKey)`) up to the point where it correctly finds nothing and proceeds to re-validate.

**Idempotency coverage blocked by absent pricing** (explicitly not faked): the *positive* idempotency path — retrying a request that produced a real, successful `Order` and getting the same `Order` back — cannot be reached on real staging today, because no real Service can produce a successful `Order` at all. The QA records this one specific path as `NOT_TESTED — BLOCKED BY REAL PRICING DATA` rather than fabricating a priced Service to force it green. That positive path is already covered at the unit level (`backend/src/modules/orders/orders.service.spec.ts`, the "returns the existing order on an exact retry" and race-condition tests), which is real coverage of the same code path, just not through the live HTTP+Postgres boundary — a gap that closes naturally once R5.2 supplies a real price source.

**Gateway non-invocation proof strength — stated honestly**: no live HTTP call to Zibal/Zarinpal was made or intercepted (making one is explicitly out of scope). What *is* proven at the real-staging level is that no `Payment` row was created by any of these attempts (a gateway call in this codebase's design would always produce or reference a `Payment` row — see `PaymentsService`/`payments.module.ts`), which is strong circumstantial evidence but not a network-level guarantee. The stronger, structural guarantee — that `OrdersService` has no `PaymentsService`/gateway dependency injected into it at all — is unit-test-only (`orders.service.spec.ts`'s constructor param-type assertion) and is not re-proven against the live deployment by this QA; both are cited together in the report rather than overstating either alone.

**Cleanup behavior**: because every real purchase attempt is expected to be blocked before any `Order` row is inserted, the intended steady state is zero disposable records and nothing to clean up. If a bug ever caused an `Order` to be created despite an expected block, the QA fails loudly first (`FAIL SERVICES-R5.1 CRITICAL: an Order was created despite pricing being unavailable`, naming the real defect) and only then registers a cleanup task that deletes that *exact* `Order` id — never a broad or pattern-based delete, and never touching any other user's data. This mirrors the runner's existing register-then-run cleanup guarantee used for Home CMS propagation checks.

**What remains for R5.2**: identical to §22 — this QA proves the *safe-blocked* state is real and stable, not that a purchase can succeed. Once a real pricing source exists, the currently-`NOT_TESTED` successful-idempotent-replay path (and, implicitly, a first real end-to-end successful `Order`) becomes reachable and should be added to this same section rather than a new one.
