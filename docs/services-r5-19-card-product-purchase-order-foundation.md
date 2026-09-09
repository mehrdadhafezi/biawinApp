# SERVICES-R5.19 — Card Product Purchase & Order Foundation

## 1. Baseline

- Starting commit: `6b4d51e` (`SERVICES-R5.18 implement customer services card catalog UI`) — the customer could browse Categories → Services → CardProducts → Card Product Detail, with a visually disabled "خرید کارت" CTA. No purchase execution existed for CardProduct at all; `POST /orders` (R5.1) only knew how to purchase a `Service`.
- This stage reconciles R5.1's transaction foundation with the R5.16/R5.17 CardProduct domain and builds the safe, pending-only Order-creation path for purchasing a CardProduct. See `docs/services-r5-19-purchase-order-audit.md` for the full pre-implementation audit this stage is built on.

## 2. R5.1 Compatibility Audit

Full detail in the companion audit doc. Summary: every R5.1 safety mechanism (no client-trusted amount, JWT-derived ownership, DB+application idempotency, pending-only creation, live relationship re-validation, zero side-effect dependencies) is reused verbatim for the new path. The one genuinely obsolete assumption was "the purchasable entity is Service" — R5.16 already introduced `CardProduct` as the real purchasable object, and this stage is the first to give `Order` a way to say so. The audit also surfaced a real, pre-existing bug: R5.18's customer UI read `CardProduct.priceAmount` (the payable price) and rendered it as if it were the card's commercial value/credit ceiling. Fixed this stage (§6).

## 3. Purchasable Entity Decision

`CardProduct` is now a first-class purchasable entity alongside `Service`. `Order.serviceId` remains **always populated** for every Order regardless of path — for a CardProduct purchase it is derived server-side from `CardProduct.serviceId`, never supplied by the client and never left null. This means nothing that already depends on `Order.serviceId` being present (e.g. any future reporting/joins) needs to change; the new `Order.cardProductId` is purely additive information layered on top.

## 4. CardProduct → Order Contract

- `Order.cardProductId String?` — nullable (backward compatible with every pre-existing, Service-only Order; no historical row is backfilled with an invented CardProduct), `onDelete: Restrict` (a CardProduct with real Orders against it can never be silently orphaned).
- `Order.serviceId` — unchanged shape (`String`, required), always populated either directly (legacy shape) or derived from `CardProduct.serviceId` (new shape).
- `Order.method PurchaseMethod?` — relaxed from required to nullable. A CardProduct purchase has no `PurchaseMethod`-shaped concept yet (`CardProduct` has no `availableMethods` field, unlike `Service`), so this is `null` for every CardProduct-path Order; every Service-path Order still always sets a real value, unchanged from R5.1.
- `@@index([cardProductId])` added for lookup efficiency.

## 5. Price Authority

Two sibling, equally-scoped resolvers, not one renamed class:

- `ServicePricingService` (R5.1, **unchanged**) — still the sole price authority for the legacy Service-purchase path (`Service.priceFrom`, method-aware).
- `CardProductPricingService` (**new**, `backend/src/modules/orders/pricing/card-product-pricing.service.ts`) — the sole price authority for a CardProduct purchase: `CardProduct.priceAmount` if it's a positive integer, else throws `UnprocessableEntityException` (identical shape/behavior to `ServicePricingService`, just for the other entity).

**Why not rename `ServicePricingService`**: the Service path is still real, still tested (32 pre-existing R5.1 tests), and still needs Service-shaped, method-aware pricing exactly as before. Renaming it would either force it to also handle CardProduct (overloading one class with two unrelated purchasable-entity shapes) or require touching already-shipped, working code for zero functional gain. Two small, single-responsibility resolvers, injected side-by-side into `OrdersService`, was judged the lower-risk, clearer design.

## 6. Payable Price vs Card Value — The Critical Fix

This stage adds a **second, independent** pair of fields to `CardProduct`:

- `valueAmount Int?` — the card's own displayed commercial value/credit ceiling (e.g. "۳۰ میلیون تومان" or "تا سقف ۳۰ میلیون تومان اعتبار").
- `valueDisplayType CardValueDisplayType?` (new enum: `FIXED` | `UP_TO`) — how to present `valueAmount`.

`priceAmount` (already existed, R5.17) is now unambiguously and exclusively **the amount the customer pays Biawin**, resolved by `CardProductPricingService` into `Order.amount`. It is never read by any customer-facing value display.

**The bug this fixes**: R5.18's `formatCardProductPrice()` read `priceAmount` and rendered it, for `CREDIT_CARD`s, as `"تا سقف <amount> تومان اعتبار"` — i.e. it presented the payable price as if it were the credit ceiling. Renamed to `formatCardProductValue()` and re-sourced from `valueAmount`/`valueDisplayType` exclusively; `CardProductCard`/`CardProductHero` (customer UI) and `CardProductForm` (Admin CMS) were all updated accordingly. Verified live: a local CardProduct with `priceAmount=1,000,000` Rial and `valueAmount=30,000,000` Rial now correctly displays **"تا سقف 3,000,000 تومان اعتبار"** (the value) on the catalog pages, while a real purchase attempt against it correctly creates an Order with **`amount=1,000,000`** (the price) — proving the two are genuinely decoupled end-to-end, not just in name.

Neither field is ever inferred from the other, anywhere in this stage's code.

## 7. Purchase Eligibility

`OrdersService.validateAndPriceCardProduct()` enforces, in order:

1. CardProduct exists (else 404).
2. CardProduct `status === 'ACTIVE'` (else 422) — covers DRAFT/INACTIVE/EXPIRED uniformly.
3. CardProduct `journeyType === 'PURCHASE'` (else 422) — the only journey this stage's purchase path recognizes; `CREDIT_REQUEST`/`LEAD`/`EXTERNAL_REDIRECT`/`QUOTE_REQUEST`/`FREE_SERVICE` represent conceptually different flows (credit applications, leads, external redirects, quote requests, free-service claims) that this stage deliberately does not build — a narrow, explicit, evidence-grounded scope decision, not an oversight.
4. Parent Service exists and is `active` (else 422/404).
5. Parent Category exists and is `active` (else 422) — the schema supports this check (`Service.categoryId → Category.active`), so it is performed.
6. `CardProductPricingService.resolveAuthoritativePrice()` — a positive `priceAmount` (else 422). No free-CardProduct-purchase path exists — no repository evidence supports one, so none was invented.

No KYC, credit-limit, installment, geographic, merchant, or quantity-limit rule was added — all explicitly out of scope per this stage's task.

## 8. API Contract

`POST /orders` (reused, not duplicated) now accepts two mutually-exclusive request shapes:

**Legacy (R5.1, unchanged behavior)**:
```json
{ "serviceId": "...", "method": "cash", "idempotencyKey": "...", "merchantId": "..." }
```

**New (R5.19)**:
```json
{ "cardProductId": "...", "idempotencyKey": "..." }
```

- The client never submits `amount`, `userId`, `ownerId`, `price`, or `status` for either shape (unchanged — R5.1 already made this impossible via the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`).
- The client must never submit `merchantId` alongside `cardProductId` — rejected with 400 at the application boundary (stricter than the legacy shape, which still allows an optional merchant *hint* purely for cross-validation).
- Submitting both `serviceId` and `cardProductId`, or neither, is rejected with 400.
- Server derives `serviceId`, `merchantId` from the CardProduct's parent Service; derives `amount` from `CardProductPricingService`; derives ownership from the JWT.

`OrdersController` needed **zero changes** — it already forwarded the DTO verbatim to `OrdersService.create()`.

## 9. Ownership Contract

Unchanged from R5.1: `@CurrentUser()` (JWT-derived) is the only source of `userId`, for both shapes. `list()`/`findOneOrThrow()` remain scoped to the authenticated user exactly as before.

## 10. Idempotency Contract

Same DB-level guarantee (`@@unique([userId, idempotencyKey])`) and P2002-catch-and-refetch race handling, extended at the application level:

- **Exact retry** (same user + key + `cardProductId`) → returns the original Order.
- **Conflicting reuse** (same user + key + a *different* `cardProductId`) → deterministic `409 Conflict`.
- **A subtle correctness fix found during implementation**: `assertReplayMatchesRequest()` now branches on what the **original** Order actually recorded (`existing.cardProductId`), not on what shape the retry request happens to send. An earlier draft compared the retry's own `serviceId`/`method` fields when the retry omitted `cardProductId` — which could spuriously "match" a CardProduct-purchase original just because its server-derived `serviceId` happened to equal the retry's `serviceId`, even though the retry never mentioned the original CardProduct at all. Directly tested (`orders.service.spec.ts`: "does not treat a serviceId-shaped retry as matching a CardProduct-original just because the derived serviceId happens to match").
- Concurrent duplicate protection (the P2002 race path) verified for both shapes.

## 11. Order Snapshot Contract

A CardProduct-purchase Order records: authenticated user identity (`userId`), CardProduct identity (`cardProductId`), Service identity (`serviceId`, always present), payable amount (`amount`, Rial, from `CardProductPricingService`), merchant snapshot (`merchantId`, informational only — see §13), status (`pending`), and `createdAt`. `method` is `null` (no `PurchaseMethod` concept applies yet). `currency`/unit convention is unchanged — Rial, integer, same as every other monetary field in this schema.

**Deliberately NOT snapshotted this stage**: `valueAmount`/`valueDisplayType` (the catalog's displayed value at the time of purchase). This is a documented, intentional gap — see the audit doc §7 for the reasoning and the explicit follow-up recommendation for the next stage (§20 below).

**Verified**: changing `CardProduct.priceAmount` after an Order is created never changes `Order.amount` — proven both by construction (no `update()` method touches `Order.amount` anywhere) and by a direct test (`orders.service.spec.ts`: "an idempotent replay never re-resolves price — it returns the amount frozen at creation, even if CardProduct.priceAmount has since changed").

## 12. Order State Contract

Unchanged. Every CardProduct-purchase Order is created `pending`, exactly like every Service-purchase Order. `ORDER_STATUS_TRANSITIONS`/`assertOrderTransition()` (R5.1's state machine) are untouched and still unused by any real transition endpoint — no status label was repurposed, no new transition was invented.

## 13. Side-Effect Boundary

`OrdersService`'s constructor is now `(PrismaService, ServicePricingService, CardProductPricingService)` — still zero wallet/gateway/payment/card-issuance dependencies, re-asserted directly by test (`orders.service.spec.ts`: "has no payment-gateway or wallet dependency injected at all"). Creating a CardProduct-purchase Order creates no `Payment`, `Installment`, `WalletTransaction`, `CustomerCardInstance`, or `UsageTransaction` row — asserted directly in unit tests and in the staging QA runner's before/after `FinancialSnapshot` deltas (extended this stage to include `cardInstances`/`usageTransactions` counts).

`Order.merchantId` is still populated (derived from the CardProduct's parent Service, exactly as R5.1 already did for the Service path) — this is informational only, never a settlement relationship (confirmed consistent with business rules #5/#6: Biawin has no merchant settlement relationship for a CardProduct purchase; this field never implied one).

## 14. Security Controls

All tested (unit + live smoke-tested against a real local backend + Postgres):

| Control | Result |
|---|---|
| Unauthenticated `POST /orders` | 401 |
| Client-supplied `amount` | 400 (whitelist rejection) |
| Client-supplied `merchantId` alongside `cardProductId` | 400 (explicit application check) |
| Client-supplied `status` | 400 (whitelist rejection) |
| Both `serviceId` and `cardProductId` supplied | 400 |
| Neither supplied | 400 |
| Nonexistent `cardProductId` | 404 |
| Inactive/DRAFT/EXPIRED CardProduct | 422 |
| Non-`PURCHASE` journeyType | 422 |
| Inactive parent Service | 422 |
| Inactive parent Category | 422 |
| Ownership | always JWT-derived, never client-supplied |

## 15. Schema Changes

Migration `20260909194209_card_product_order_purchase_foundation` (purely additive):

- New enum `CardValueDisplayType` (`FIXED` | `UP_TO`).
- `CardProduct.valueAmount Int?`, `CardProduct.valueDisplayType CardValueDisplayType?` (both nullable, zero real data affected).
- `Order.cardProductId String?` + FK to `CardProduct` (`onDelete: Restrict`) + `@@index([cardProductId])`.
- `Order.method` relaxed from `PurchaseMethod` (NOT NULL) to `PurchaseMethod?` (nullable) — a `DROP NOT NULL`, no data rewritten, no existing row's value touched.

Generated SQL (verified, reproduced in full):
```sql
CREATE TYPE "CardValueDisplayType" AS ENUM ('FIXED', 'UP_TO');
ALTER TABLE "card_products" ADD COLUMN "valueAmount" INTEGER, ADD COLUMN "valueDisplayType" "CardValueDisplayType";
ALTER TABLE "orders" ADD COLUMN "cardProductId" TEXT, ALTER COLUMN "method" DROP NOT NULL;
CREATE INDEX "orders_cardProductId_idx" ON "orders"("cardProductId");
ALTER TABLE "orders" ADD CONSTRAINT "orders_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

## 16. Migration Strategy

Applied locally via `prisma migrate dev` (same process every prior stage used for local dev); staging/production apply the generated `migration.sql` via `prisma migrate deploy` (the established convention — `migrate dev` refuses to run non-interactively there). No backfill of any kind: every pre-existing Order keeps `cardProductId = NULL` and its already-set `method` value untouched.

## 17. Tests

**Backend** — 210/210 passing (up from R5.17's 187; +23 net new):
- `card-product-pricing.service.spec.ts` (new) — mirrors `service-pricing.service.spec.ts`; includes an explicit "never treats valueAmount as a substitute for priceAmount" test.
- `orders.service.spec.ts` (extended, all pre-existing R5.1 tests preserved verbatim) — request-shape validation (both/neither shapes, merchantId injection), CardProduct eligibility (nonexistent/DRAFT/EXPIRED/wrong-journey/no-price/inactive-Service/inactive-Category), client amount-tampering rejected, pending-Order creation with `method=null`, merchant derivation, CardProduct-path idempotency (exact retry / conflicting reuse / the serviceId-shaped-retry correctness fix / concurrent race), and the `Order.amount` immutability-after-price-change test.
- `card-products.service.spec.ts` (extended) — `valueAmount`/`valueDisplayType` persist independently of `priceAmount` through `create()`.

**Frontend (apps/web)** — 103/103 passing:
- `cardProductPresentation.test.ts` — renamed to `formatCardProductValue`, re-sourced from `valueAmount`/`valueDisplayType`, plus a dedicated "NEVER reads priceAmount" test.
- `CardProductCard.test.tsx`, `CardProductDetailComposition.test.tsx`, `CardProductGrid.test.tsx`, `serviceValidation.test.ts` — fixtures updated for the new fields; each gained (or already had) an explicit "never derives the value from priceAmount" assertion.

**Frontend (apps/admin)** — 76/76 passing:
- `CardProductForm.test.tsx` — extended with a test proving `valueAmount`/`valueDisplayType` pre-fill independently of `priceAmount`.

## 18. Staging QA Strategy

`backend/scripts/staging-qa/authenticated-qa-runner.ts` gained a new §13 section, `servicesR519CardProductPurchaseFoundationCheck()`, mirroring §12's (R5.1) established conventions exactly:

- `discoverPurchasableCardProduct()` — paginates the real public `GET /cards`, looking for `journeyType: 'PURCHASE'` with a positive `priceAmount`. **Never fabricates one.**
- `discoverNonActiveCardProduct(admin)` — uses the real SUPER_ADMIN session to look for a real DRAFT/INACTIVE/EXPIRED CardProduct (the public endpoint never returns one to discover from).
- Unconditional checks (need no real CardProduct): unauthenticated rejection, client `amount`/`merchantId`/`status` injection rejection, nonexistent-id rejection, both-shapes-supplied rejection.
- Conditional checks: inactive-CardProduct rejection (`NOT_TESTED` if none discoverable), and the full positive path — real purchase creates a pending Order with the server-resolved price, exact idempotent retry, conflicting-reuse 409, and `FinancialSnapshot` before/after deltas (Orders +1 exactly, Payments/Installments/CustomerCardInstance/UsageTransaction/Wallets all +0) — **`NOT_TESTED`, never `FAIL`, if staging has no real purchasable CardProduct today** (per this stage's explicit instruction; no fictional data was seeded to force a PASS).
- Disposable Orders created by the positive path are registered for cleanup in the runner's existing `finally`-block restore mechanism, same as R5.1's own pattern.

`FinancialSnapshot`/`snapshotFinancialState()` (shared with the R5.1 section) were extended with `cardInstances`/`usageTransactions` counts — additive, does not change the R5.1 section's own assertions.

## 19. Backward Compatibility

- Every pre-existing Order (R5.1–R5.18, all Service-path) is untouched: `cardProductId` stays `NULL`, `method` keeps its already-set real value. Nothing was backfilled or invented.
- `OrdersController`, `list()`, `findOneOrThrow()` — unchanged.
- `ServicePricingService`, the entire legacy Service-purchase path, and all 32 of its pre-existing R5.1 tests — unchanged and still passing verbatim.
- R5.17's Admin CMS and R5.18's customer catalog browsing — unaffected except the deliberate, documented value-display fix (§6); every other R5.18 screen, route, and test (loading/empty/error states, relationship validation, the disabled Service-level CTA) is untouched.
- Full workspace build (`backend`, `apps/web`, `apps/admin`) succeeds; the existing `/services/[categoryId]/[serviceId]/cards/[cardProductId]` route still compiles identically.

## 20. Known Business Gaps

Carried forward, explicitly, none invented-around:

- **No value snapshot on Order/CustomerCardInstance yet** (audit doc §7): if `CardProduct.valueAmount` changes after a real purchase, nothing today freezes what was shown to the customer at purchase time. Recommended home for this: `CustomerCardInstance` (the thing the customer actually ends up holding), once that entity is real — not `Order` itself.
- **No `PurchaseMethod` concept for CardProduct purchases**: `Order.method` is `null` for this path. If Biawin later needs to know *how* a CardProduct purchase was intended to be paid before a real payment stage exists, that needs its own explicit field/decision — not inferred from `PurchaseMethod`, which is Service-shaped.
- **Non-PURCHASE journeys remain entirely unbuilt**: `CREDIT_REQUEST`/`LEAD`/`EXTERNAL_REDIRECT`/`QUOTE_REQUEST`/`FREE_SERVICE` CardProducts exist in the schema/Admin CMS but have no customer-facing flow of any kind — this was true before this stage and remains true after it; only `PURCHASE` was ever in scope here.
- **Staging catalog data**: as of this report, staging may have zero real ACTIVE+PURCHASE+priced CardProducts (same situation R5.1 found for Service pricing) — the QA runner handles this via `NOT_TESTED`, but the positive path won't show a real `PASS` on staging until Admin populates at least one real card with both `status=ACTIVE` and a positive `priceAmount`.

## 21. Next Stage Readiness

This stage's Order now has everything a real payment stage needs to act on: a specific CardProduct identity, an immutable server-resolved payable amount, and a `pending` status ready to transition. The next stage can safely build payment-gateway invocation / wallet debit / installment creation against `Order.cardProductId` without needing any further Order-schema change — it only needs to decide (a) how `Order.status` transitions from `pending` onward for this path (the existing state machine already allows `pending → processing/awaiting_payment/paid → delivered`, unused so far), and (b) whether/how `CustomerCardInstance` issuance is triggered once an Order reaches `paid`.

## 22. Quality Gates

- **Backend**: `prisma validate` ✓, `prisma generate` ✓, `tsc --noEmit` ✓ clean, `eslint` ✓ 0 errors, `jest` — 210/210 tests, 44/44 suites.
- **Customer Web**: `tsc --noEmit` ✓ clean, `eslint` ✓ 0 errors (10 pre-existing unrelated `<img>` warnings), `jest` — 103/103 tests, 21/21 suites.
- **Admin**: `tsc --noEmit` ✓ clean, `jest` — 76/76 tests, 23/23 suites (R5.17's own suite, unregressed).
- **Workspace**: `npm run build` — backend + web + admin all succeed; the new `/orders` request shape needs no new route (reused `POST /orders`).
- **Live smoke test** (local backend + real Postgres, not staging): full purchase flow exercised end-to-end via `curl` — order creation, idempotent retry, amount/merchantId injection rejection, nonexistent-CardProduct 404, unauthenticated 401 — every result matched the unit tests exactly. The disposable test Order was deleted afterward.

## 23. Staging Deployment

Additive migration — apply before or as part of the same deploy as the code:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
```

(The staging deploy script already runs `prisma migrate deploy` as part of its pipeline, per every prior stage's precedent — no manual migration step is needed beyond the normal deploy.)

No automatic deployment was performed as part of this stage.

---

**SERVICES-R5.19: READY FOR STAGING DEPLOYMENT**
