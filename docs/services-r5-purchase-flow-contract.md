# SERVICES-R5 — Purchase Flow Contract Analysis

**Status: ANALYSIS ONLY. No application code was changed to produce this
document.** Built on the verified SERVICES-R4 staging baseline (revision
`a2ad585`, API QA 54/0/0, browser QA 71/0/1 NOT_TESTED — the one
NOT_TESTED is the accepted Merchant-positive-path data gap, unrelated to
this stage).

---

## 1. Prototype Purchase Flow Inventory

Mined directly from `biawin_single_file_app_requested_edits_v15.html`
this stage (a dedicated deep pass on `#purchaseSheet`/`openPurchaseSheet`,
beyond what prior Services reports touched on in passing). The complete
inventory, with nothing omitted:

**`#purchaseSheet`'s entire DOM** (lines 8266–8273): a handle bar, a
header ("تأیید انتخاب" + `×` close), one info block with exactly two
text nodes (`#purchaseServiceName`, `#purchasePlanSummary`), and two
buttons (`#purchaseConfirm` "ادامه و ثبت خرید", `#purchaseCancel`
"انصراف"). **No form, no input, no amount field, no method
re-selection, no OTP step anywhere in it.**

**The complete `openPurchaseSheet()`/confirm/cancel JS** (lines
9474–9505 — the entire block, nothing more exists elsewhere): the sheet
reads only from the already-populated `detailState` object (no
parameters passed at open time). Confirm does exactly two things:
`closePurchaseSheet()` then `showDetailToast('درخواست خرید «' +
detailState.title + '» ثبت شد.')` — **no network call, no `fetch`, no
state mutation beyond closing the sheet, no navigation.** Cancel/close/
backdrop-click all just close the sheet. This is the complete confirm
handler; nothing was elided.

**Success/failure**: exactly one success surface (`#detailToast`,
auto-dismisses after 2600ms) and **zero failure/error state** for a
Services purchase attempt anywhere in the prototype (confirmed by grep:
"ناموفق" has zero matches in the whole 26MB file). The user never
leaves the Service Detail page — no receipt, no confirmation screen, no
order-record view exists or is navigated to (confirmed by tracing
`#purchaseConfirm`'s handler line-by-line: it never calls `openView()`
or touches `location.hash`/`detailState.sourceView`).

**No OTP step exists in the purchase path** — confirmed distinct from
the (already-documented) login OTP flow, which uses entirely different
DOM ids and is never referenced anywhere near `purchaseSheet`.

**No amount/installment-count input exists.** The 4 `.detail-plan`
cards are a fixed, non-editable choice; clicking one just swaps
`detailState.plan`/`price` to hardcoded strings from `data-plan`/
`data-price` attributes. `#purchaseSheet` has zero `<input>`/`<select>`/
`<textarea>` elements.

**A separate, structurally more complete purchase-like flow exists for
Rewards** (`#rewardModal`/`#rewardGateway`/`#rewardConfirmation`,
different module entirely, never calling or called by
`openPurchaseSheet`): item modal → wallet/gateway cost split → a fake
card-entry gateway screen (card number/CVV2/expiry inputs, entirely
unvalidated) → a fake 850ms delay → a real success screen with dynamic
copy. **This is documented for context, not adopted as a template** —
see §4's finding that the real backend's Rewards module has no more
business logic than Orders does (both are read-only catalogs today).
Also found: `showRewardToast()` (the Rewards module's one insufficient-
balance failure message) is declared but **never called anywhere** — a
real, confirmed dead failure-path signal, not a working example to copy.

## 2. Screen/State Transition Map

```
Service Detail (cardOnly OR full mode, either origin)
  │
  ├─ [cardOnly=false only] tap a .detail-plan card
  │    → inline state change only (detailState.plan/price updated,
  │      .selected class moves) — NOT a screen transition, no sheet
  │      opens yet. Inert (no-op) when cardOnly=true (line 9461 guard).
  │
  ├─ tap #detailBuyBtn (sticky buy bar, ALWAYS enabled, both modes)
  │    → opens #purchaseSheet (modal/sheet overlay, same DOM/CSS in
  │      both modes — the only difference is one summary line's text,
  │      quoted in §3)
  │
  #purchaseSheet
  │
  ├─ tap #purchaseSheetClose / #purchaseCancel / backdrop
  │    → closePurchaseSheet() — returns to Service Detail, unchanged
  │
  └─ tap #purchaseConfirm
       → closePurchaseSheet() + showDetailToast(...)
       → returns to the SAME Service Detail page (no navigation)
       → toast auto-dismisses after 2600ms
       → NO order record, NO receipt, NO success/failure screen beyond
         the toast, NO further state change of any kind
```

There is no branch for a failed purchase, no branch for insufficient
credit/wallet balance, and no branch that leads anywhere other than back
to the same Service Detail screen. This is the complete map — nothing
was simplified out of it.

## 3. Services-origin vs Home-origin behavior

Re-checked against the prototype directly, not carried forward from
memory:

- **A)** From Services-origin Service Detail, a user can: view the
  `cardOnly` card-summary content (SERVICES-R3), tap the real, always-
  enabled `#detailBuyBtn`, and reach `#purchaseSheet`.
- **B)** **Yes** — Services-origin *does* reach the purchase sheet in
  the prototype. `cardOnly` and `sourceView` are two independent,
  unrelated state flags; `cardOnly` does not block `#detailBuyBtn` or
  `openPurchaseSheet()` at all — only the 4-method **chooser** is inert
  in cardOnly mode (line 9461), never the buy button or the sheet
  itself.
- **C)** Through the exact same `#detailBuyBtn` → `#purchaseSheet` →
  `#purchaseConfirm` path as full mode — there is no separate cardOnly-
  specific purchase entry point.
- **D)** It remains cardOnly for the chooser the whole time — the
  purchase sheet's only cardOnly-aware behavior is cosmetic (§1's quoted
  one-line ternary: `'خرید کارت — ' + price` vs `plan + ' — ' + price`).
  Purchasing never "exits" cardOnly mode or reveals the 4-method
  chooser.
- **E)** Nothing — Home-origin and Services-origin populate the
  identical `detailState`/`#purchaseSheet` machinery; the only thing
  `sourceView` (which encodes origin) affects anywhere in the purchase
  path is where the **Back** button returns to. It has zero effect on
  what the purchase sheet shows or does.
- **F)** **Re-confirmed from SERVICES-R3's own grep, not re-litigated
  here**: no real `router.push` anywhere in `apps/web/src` navigates
  Home into `/services/[categoryId]/[serviceId]`. A real Home-origin
  Service Detail visit is not a reachable code path in the current
  application today — this was already true before R5 and R5 does not
  change it.

**Consequence for the real backend/frontend contract**: the prototype's
own evidence does **not** support "cardOnly blocks purchasing" — it
only ever blocked the chooser UI. `DisabledPurchaseCTA` (SERVICES-R1)
is therefore a **deliberate, stricter product decision** (no live buy
button anywhere until the backend can actually transact), not a direct
reproduction of the prototype's own permissiveness — worth stating
explicitly since R5 should not assume the prototype itself justifies
gating purchase by origin; the real gating reason is the backend gap in
§4, unrelated to `cardOnly`/`sourceView`.

## 4. Existing Backend Transaction Domain

Read directly from `backend/prisma/schema.prisma` and every relevant
module's actual controller/service code this stage — not assumed
unchanged from earlier reports.

**Schema is materially more complete than the service layer** — a
consistent pattern across every financial model:

| Model | Real fields | Status enum | Service-layer logic |
|---|---|---|---|
| `Order` | `orderNumber` (unique), `userId`, `serviceId`, `method: PurchaseMethod`, `amount: Int`, `status` | `pending→processing→awaiting_payment→paid→delivered→cancelled` | **`create()` only inserts a bare `pending` row.** No credit check, no wallet debit, no installment creation, no service/merchant validation, no server-side amount calculation — `amount` is accepted verbatim from the client (`CreateOrderDto`, `@IsInt() @IsPositive() amount: number`) |
| `Payment` | `orderId`/`rewardClaimId` (either), `provider: wallet\|gateway`, `amount`, `status: pending\|succeeded\|failed\|refunded`, `gatewayRef` | Full lifecycle | `PaymentsService.record()` exists, with an explicit "Module Boundary Rule" comment (Orders/rewards should call this, never write Payment rows directly) — **but has zero real callers anywhere in the codebase** (grepped) |
| `CreditLine`/`CreditUsage` | `limitAmount`, `usedAmount`, `status: active\|suspended\|closed` | — | `CreditService` is list/findOne only — **no method exists anywhere to check eligibility or increment `usedAmount`**; confirmed zero cross-references between `orders`/`credit` modules |
| `Installment` | `totalMonths`, `monthlyAmount`, `paidCount`, `status`, `nextDueDate` | `active\|completed\|defaulted\|cancelled` | `InstallmentsService` is list/findOne only — **no creation method exists at all** |
| `Wallet`/`WalletTransaction` | `balance` (Rial, Int), `type: topup\|spend\|refund\|gateway_settlement` | — | **The one financial module with real, atomic business logic already built**: `WalletService.credit()`/`.debit()` run inside `prisma.$transaction`, `debit()` throws `BadRequestException` if it would go negative, both write an audit `WalletTransaction` row with a `balanceAfter` snapshot. Genuinely production-shaped code, just with **zero real callers** anywhere (Orders never calls it) |
| Payment gateway abstraction | `PaymentProvider` interface + `ZibalProvider`/`ZarinpalProvider` (real HTTP clients against Zibal's/Zarinpal's actual documented REST APIs) + a config-driven factory | — | Explicit code comment: **"Not wired into any business flow yet — Feature-stage."** `ZibalProvider`'s own comment: "Not exercised against a live merchant account in this environment." Real code, unused, unverified against a live gateway |
| `RewardClaim` | `cost`, `paidFromWallet`, `paidFromGateway` (a wallet+gateway split, schema-ready) | `pending_payment→...` | `RewardsService` is list/findOne only — **no claim-creation method exists**. The prototype's more elaborate Rewards *UI* has no corresponding backend completeness to borrow from; both Orders and Rewards are equally scaffolding today |
| `transactions` module | N/A (read-model only) | — | Explicitly a **read-only aggregator** over `WalletService.listTransactions()` (its own doc comment: "intentionally a read-model module, not a table owner") — not a write path, not relevant to purchase execution |

**Existing tests**: zero test files exist for `orders`, `wallet`,
`payments`, or `transactions` — only `credit.controller.spec.ts` and
`installments.controller.spec.ts` exist, and (matching the read-only
service code) almost certainly cover only `list`/`findOne`.

**Authorization**: `JwtAuthGuard` is globally applied (`APP_GUARD` in
`app.module.ts`) — every controller requires a valid JWT by default
unless explicitly `@Public()`. None of `orders`/`payments`/`credit`/
`installments`/`transactions` opt out — confirmed correct, re-verified
live against real staging this stage (all 5 return `401` with no
token).

## 5. Real Staging Data Findings

**Read-only only — nothing was mutated.** Public, unauthenticated
endpoints were queried directly (already covered by SERVICES-R1–R4's
own established pattern); all 5 transactional endpoints
(`/orders`, `/payments`, `/credit`, `/installments`, `/transactions`)
correctly returned `401` with no token, confirmed live this stage.

**What could not be checked, and why, stated honestly rather than
worked around**: real per-user `Order`/`Payment`/`CreditLine`/
`Installment` record counts require an authenticated request. This
session's fixed operating constraint against interactive/credentialed
authentication on any system — including via the same
`STAGING_TEST_AUTH` bypass the QA runner uses server-side — was
maintained consistently here, the same way it was maintained through
every prior Services stage rather than making a one-off exception for
this analysis. If a real count is needed, the existing
`authenticated-qa-runner.ts` pattern (running server-side, per SERVICES-
R1.2 onward) is the established, correct mechanism to extend for it —
not a workaround from this session's own environment.

**What is known from the code with certainty regardless**: since
`OrdersService.create()` is never called by any real UI (`DisabledPurchaseCTA`
does nothing when tapped, confirmed SERVICES-R1/R3), and no other
mechanism creates an `Order` except a direct authenticated `POST
/orders` call, it is architecturally very unlikely any real `Order`/
`Payment`/`CreditUsage`/`Installment` row exists on staging outside of
whatever the (currently non-existent) orders test suite might have
created and cleaned up — but this is inference from code, not a
verified count, and is presented as such.

## 6. Customer Identity / Ownership Boundary

Traced directly: `JwtStrategy.validate()` (`modules/auth/strategies/jwt.strategy.ts`)
returns `{ userId: payload.sub, phone }` straight from the JWT's `sub`
claim — no lookup, no indirection. `CurrentUser()` (the param decorator
every controller uses) just returns that object. **There is no separate
`Customer` model anywhere in the schema** — `User` itself is the single
identity/ownership root every financial model already keys off of
directly (`Wallet.userId`, `CreditLine.userId`, `Installment.userId`,
`Order.userId`, `Membership.userId`, `RewardClaim.userId` — all `User`
FKs, all already correctly scoped in every existing `findOneOrThrow`/
`list` method, e.g. `OrdersService.findOneOrThrow(id, userId)` filters
by both).

**Explicit answer to the task's own question**: there is no place in
this codebase where `identity.users.id` could be confused with a
different `customer.id`, because **no such distinction exists in this
domain** — `User.id` *is* the customer id, everywhere, consistently.
This is a genuinely sound existing foundation; R5 should **continue
using `currentUser.userId` exactly as every existing module already
does**, not introduce a new ownership concept or shortcut.

## 7. Domain Gaps

Consolidated from §4, stated as gaps rather than repeated as findings:

1. `Order.amount` is entirely client-supplied and trusted — no
   server-side price calculation from `Service.priceFrom`/`priceLabel`
   exists anywhere.
2. No validation that `Order.method` is actually one of
   `Service.availableMethods` for the given `serviceId`.
3. No validation that `serviceId` refers to an active `Service`.
4. No credit-limit check (`CreditLine.limitAmount` vs `usedAmount`) —
   `CreditService` has no method to perform one.
5. No installment creation — `InstallmentsService` has no creation
   method; `CreateOrderDto` has no `installmentMonths` field at all.
6. No wallet debit on order creation — `WalletService.debit()` exists
   and is transaction-safe, but nothing calls it from `orders`.
7. No `Payment` row is ever created for a real order —
   `PaymentsService.record()` exists and is never called.
8. No payment-gateway invocation — `ZibalProvider`/`ZarinpalProvider`
   exist, are real HTTP clients, and are never called.
9. No idempotency protection on `POST /orders` — a retried/duplicated
   request creates a second full `Order` row with a new
   `orderNumber`, no dedup key anywhere.
10. No merchant-eligibility check — a `Service.merchantId` is never
    read anywhere in the purchase path (moot until SERVICES-R4's own
    finding resolves — 0 real services have one today anyway).

None of these were invented for this report — every one is directly
observable in the current, real source files cited in §4.

## 8. Proposed Purchase Architecture

Answering the task's explicit questions, grounded only in §1–§7's
evidence:

- **Attempted purchase entity**: `Order` (already exists, already the
  right shape — `status: pending` is exactly "attempted, not yet
  settled"). No new "attempt" model is needed.
- **Completed purchase entity**: also `Order`, once its `status`
  reaches `paid`/`delivered` — the schema's own status enum already
  models this lifecycle correctly. No second "completed purchase"
  model is needed.
- **Is a new Order model needed?** No — the existing one is
  well-designed; it needs a real service-layer implementation, not a
  schema change.
- **Is a PaymentIntent-like model needed?** No — `Payment` (provider +
  amount + status + `gatewayRef`) already fulfills that role; it just
  needs to actually be written via `PaymentsService.record()` from
  `OrdersService`, per that service's own already-stated module
  boundary.
- **Does `Invoice` already fulfill part of this responsibility?**
  There is no `Invoice` model in the schema at all (confirmed by the
  full model list, §3's grep of `^model `) — `Order` + `Payment`
  together already cover what an "invoice" would represent (what was
  bought, for how much, has it been paid). No new model needed here
  either.
- **Where should installment selection live?** Server-side, inside
  `OrdersService.create()` (or a dedicated method it calls) — the
  prototype itself never lets a user pick a month count (§1/§7 of the
  prototype inventory: the "۳ تا ۲۴ ماه" text is static display copy),
  so there is no UI precedent requiring client-side month selection
  either. If installment-month choice is ever added, `CreateOrderDto`
  needs a validated `installmentMonths` field, and the server must
  clamp it against `Service.installmentMinMonths`/`installmentMaxMonths`
  — never trust a client-sent month count as-is.
- **Where should credit eligibility be checked?** Server-side, inside
  `OrdersService.create()`, calling a new `CreditService.useCredit()`-
  shaped method mirroring `WalletService.debit()`'s exact pattern
  (atomic `$transaction`, throw on insufficient limit, write an audit
  `CreditUsage` row).
- **Where should monetary totals be calculated?** Server-side, from
  `Service.priceFrom`/`priceLabel` (or a future authoritative price
  field) — never accepted from the client. This directly closes gap
  §7#1.
- **Which calculations MUST happen server-side?** All of them: final
  amount, credit-limit check, installment monthly amount, wallet
  balance sufficiency. None should be computed client-side and merely
  "confirmed" server-side — computed *only* server-side, full stop.
- **Which state transitions must be transactional?** Every write that
  touches more than one table atomically: `Order` creation +
  `CreditUsage`/`Installment`/`WalletTransaction` write must be one
  `prisma.$transaction`, exactly matching the pattern `WalletService`
  already proves out today.
- **What needs idempotency protection?** `POST /orders` itself — a
  client-generated idempotency key (header or body field), stored and
  checked before creating a second `Order`, closing gap §7#9.
- **What needs audit logging?** Every credit/wallet mutation already
  gets one via the existing `WalletTransaction`/`CreditUsage` audit-row
  pattern — R5 should extend that same pattern, not invent a separate
  audit mechanism (`AdminAuditLog` is a *different*, Admin-only concept
  and is not the right fit for customer-initiated purchases).
- **What should never be trusted from the frontend?** `amount`,
  `method`-eligibility, `installmentMonths` bounds, and any
  merchant/service "active" status — all four are exactly the fields
  `CreateOrderDto` either accepts verbatim today or doesn't validate at
  all (§7).

## 9. Security & Financial Invariants

Every invariant below is either already violated by the current
`OrdersService.create()` (marked **VIOLATED TODAY**) or already correctly
enforced elsewhere and must simply be preserved (marked **OK TODAY**):

| Invariant | Status | Note |
|---|---|---|
| Authenticated ownership | **OK TODAY** | `JwtAuthGuard` global + `currentUser.userId` used consistently (§6) |
| Amount tampering | **VIOLATED TODAY** | Client-supplied `amount` accepted as-is (§7#1) |
| serviceId tampering | **VIOLATED TODAY** | No check the service exists/is active (§7#3) |
| merchantId tampering | **N/A today** | Purchase path never reads `merchantId` at all; moot until a real one exists (SERVICES-R4) |
| Category/service relationship | **OK TODAY, unrelated to Orders** | SERVICES-R3's `belongsToCategory` — a read-path guarantee, not consulted by `POST /orders` at all currently, and doesn't need to be: the order only needs a real, active `serviceId` |
| Service/merchant relationship | **OK TODAY, unrelated to Orders** | SERVICES-R4's `serviceReferencesMerchant` — same as above |
| Payment-method eligibility | **VIOLATED TODAY** | No check `method` is in `Service.availableMethods` (§7#2) |
| Credit limit validation | **VIOLATED TODAY** | No check exists at all (§7#4) |
| Installment eligibility | **VIOLATED TODAY** | No field, no check (§7#5) |
| Duplicate submission / replay | **VIOLATED TODAY** | No idempotency key (§7#9) |
| Stale price/amount | **VIOLATED TODAY** | There is no server-computed price to go stale against — client value is used directly |
| Concurrency (e.g. two orders draining one credit line at once) | **VIOLATED TODAY (by omission)** | No credit-limit logic exists yet to race against; must be designed with `$transaction`-level row locking from day one, matching `WalletService.debit()`'s existing pattern |
| Double purchase | **VIOLATED TODAY** | Same as duplicate submission — no idempotency, no "already purchased this service" check either |
| Transaction rollback | **OK TODAY where it matters** (`WalletService`) | Must be extended to Orders' own multi-table writes identically |
| Failed payment state | **Partially modeled, not implemented** | `PaymentStatus.failed` exists in the schema; no code path ever sets it |
| Partial success (e.g. Order created, Payment gateway call fails) | **Not designed yet** | Needs an explicit state machine (§11) — must never leave an `Order` in `paid` without a corresponding successful `Payment` |
| Auditability | **OK TODAY where it matters** (`WalletTransaction`/`CreditUsage`) | Extend the same pattern to Orders' own writes |

## 10. Idempotency Strategy

Proposed, not implemented: `CreateOrderDto` gains a required
client-generated `idempotencyKey` (UUID). `OrdersService.create()` first
checks for an existing `Order` with that key for that `userId`
(requires a new indexed column, e.g. `Order.idempotencyKey String? @unique`)
— if found, returns the existing order instead of creating a new one
(safe retry semantics, matching standard payment-API idempotency
convention, e.g. Stripe's own `Idempotency-Key` header pattern). This is
a genuinely new, small, additive schema field — not a redesign.

## 11. Transaction State Machine

Proposed, mapped onto the **existing, unmodified** `OrderStatus` enum
(no new statuses needed — it already models exactly this):

```
pending            — Order row created, nothing charged yet
  │  (server validates: service active, method eligible, amount computed server-side)
  ▼
processing         — credit/wallet/installment-eligibility check in flight
  │
  ├─ (cash/free, or credit/installment eligibility passes)
  ▼
awaiting_payment    — for `provider: gateway` methods only, waiting on
  │                   the payment gateway's own callback/verify step
  │  (wallet/credit/free/installment-via-wallet can skip straight through
  │   this state in the same transaction, since no external gateway
  │   round-trip is needed)
  ▼
paid                — Payment.status = succeeded recorded, CreditUsage/
  │                   Installment/WalletTransaction rows written
  ▼
delivered           — service considered fulfilled (what "delivered"
                       means for a digital/financial service needs a
                       product decision — out of this analysis's scope)

  (from pending/processing/awaiting_payment) → cancelled
    — validation failure, insufficient credit/wallet, gateway failure,
      or explicit user cancellation
```

**Never-valid transitions** (must be enforced, not just assumed):
`pending → paid` directly (skipping validation), `cancelled → anything`,
`paid → pending`. This should be enforced by a single, explicit
transition-guard function, not scattered inline `status` assignments.

## 12. API Contract Proposal

Proposed only — not implemented. Extends the existing `POST /orders`
contract rather than replacing it:

```ts
// CreateOrderDto — proposed additions, existing fields unchanged in shape
{
  serviceId: string;          // existing — server re-validates active+exists
  method: PurchaseMethod;     // existing — server re-validates against Service.availableMethods
  idempotencyKey: string;     // NEW — required, UUID
  installmentMonths?: number; // NEW — only when method === "installment"; server clamps to Service's real min/max
  // "amount" is REMOVED from client input — computed server-side from
  // the real Service row, never trusted from the request body (closes §7#1/#9 gap)
}
```

`GET /orders`/`GET /orders/:id` — unchanged, already correctly scoped
and read-only. No new endpoint is proposed for "cancel" or "retry" in
this analysis — those are R5-sub-stage implementation decisions, not
prerequisites for the contract itself.

## 13. Frontend Route/State Proposal

**No new route is proposed for the purchase action itself** — matching
the prototype's own evidence (§1/§2: the prototype never navigates away
from Service Detail for a purchase, only opens/closes a sheet). A
`PurchaseSheet`-equivalent component (a `packages/ui` `BottomSheet`
already exists, per `docs/services-ui-contract.md` §9 — "exists,
unused so far — the natural fit for a future Purchase Sheet") should be
built on Service Detail, replacing `DisabledPurchaseCTA`'s disabled
state only once the backend contract in §12 is real. This preserves
every SERVICES-R1–R4 route/URL/relationship-validation contract
unchanged — Purchase Flow is additive UI on an existing page, not a new
page.

## 14. Error/Failure States

**The prototype defines none to reproduce** (§1/§3) — this must be a
genuine, new IMPLEMENTATION DECISION, not a fidelity gap. At minimum:
insufficient credit, insufficient wallet balance, service no longer
active/available, payment-gateway failure, and a generic retry-safe
error must each have distinct, honest copy — never silently downgraded
to a generic "something went wrong," and never presented as if the
purchase succeeded when it didn't (directly informed by §9's "partial
success" invariant).

## 15. Implementation Sub-stages

Proposed split, based on the evidence above (not a default 5-stage
template) — each stage independently shippable and testable:

**R5.1 — Transaction Domain Foundation (backend only)**
- Scope: `OrdersService.create()` rewritten to compute `amount`
  server-side, validate service/method eligibility, add
  `idempotencyKey` (schema migration: `Order.idempotencyKey String?
  @unique`), wire a new `CreditService.useCredit()` method (mirroring
  `WalletService.debit()`'s exact transactional pattern), wire
  `WalletService.debit()` for cash/wallet-eligible methods, wire
  `PaymentsService.record()` for every settled order.
- Migration: yes — one additive column + index.
- APIs: `POST /orders` contract change (§12); no new routes.
- Frontend: **none**.
- Tests: new `orders.service.spec.ts`/`orders.controller.spec.ts` (none
  exist today) covering every §9 invariant explicitly; extend
  `credit`/`wallet` specs for the new methods.
- Staging verification: API-layer QA only (no UI exists yet to click).
- Rollback risk: **low** — additive schema change, no existing consumer
  of `POST /orders` to break (confirmed §1/R3: no real UI calls it
  today).

**R5.2 — Installment & Gateway Wiring (backend only)**
- Scope: `InstallmentsService` creation method; `PaymentProvider`
  (Zibal/Zarinpal) actually invoked for `provider: gateway` orders,
  verified against a real (or explicitly-mocked, if no live merchant
  account exists yet) sandbox; `awaiting_payment`/`paid`/`cancelled`
  transitions implemented per §11.
- Migration: possibly none (schema already supports this).
- APIs: a gateway callback/verify endpoint (`POST
  /orders/:id/payment-callback` or similar — exact shape needs its own
  short design pass given gateway-specific callback contracts, not
  fully specified here).
- Frontend: **none**.
- Tests: gateway provider mocked in tests (already isolated behind
  `PaymentProvider` interface, per its own doc comment — genuinely easy
  to mock).
- Staging verification: requires a real or sandbox merchant account —
  flagged as a real external dependency, not purely an engineering task.
- Rollback risk: **medium** — real money movement risk if a sandbox/live
  credential is misconfigured; must be gated behind a config flag,
  never default-on.

**R5.3 — Customer Purchase UI**
- Scope: replace `DisabledPurchaseCTA` with a real, enabled purchase
  entry once R5.1 (at minimum) is live; build the `BottomSheet`-based
  purchase UI on Service Detail, preserving `cardOnly` exactly as §3
  concluded (cardOnly never blocked purchasing in the prototype —
  purchasing is orthogonal to it).
- Migration: none.
- APIs: consumes R5.1/R5.2's contract, adds none of its own.
- Frontend: new `PurchaseSheet` component + wiring on
  `app/services/[categoryId]/[serviceId]/page.tsx` only — no new route.
- Tests: component tests (existing `renderToStaticMarkup` convention),
  plus a regression test that `cardOnly`'s chooser-suppression guarantee
  (SERVICES-R1/R3) is unaffected.
- Staging verification: full authenticated browser QA extension.
- Rollback risk: **low-medium** — real UI change on an already-shipped
  page; must not regress the R1–R4 cardOnly/relationship-validation
  contracts (§10 of the R5 task, reaffirmed §16 below).

**R5.4 — Confirmation / Result States**
- Scope: the error/failure states §14 requires, plus (if a product
  decision approves it) a real post-purchase destination — R3-era docs
  already identified "Profile → خریدها" as the most plausible real
  destination (`docs/prototype-to-production-mapping.md` J9), though
  that page doesn't exist yet either and building it may be its own
  scoping decision.
- Migration: none expected.
- APIs: none new, beyond possibly surfacing `Order.status` more
  explicitly for a result screen to poll/read.
- Frontend: new result/confirmation UI only.
- Tests: every failure copy path in §14, component-level.
- Staging verification: browser QA, including at least one deliberately
  induced failure (e.g. a request with an invalid idempotency replay).
- Rollback risk: **low** — purely additive UI.

**R5.5 — Transaction QA Closure**
- Scope: extend `authenticated-qa-runner.ts`/`browser-qa.ts` with a
  full real-money-free purchase-attempt cycle (cash/free methods first,
  since they need no gateway), asserting every §9 invariant live
  against real staging.
- Migration: none.
- APIs: none new.
- Frontend: none new.
- Tests: end-to-end only, no unit tests of their own.
- Staging verification: this **is** the staging verification stage.
- Rollback risk: **none** (QA-only).

## 16. Preserve Completed Services Contracts

Explicitly reaffirmed, not just asserted: nothing in §8–§15's proposal
requires touching `/services`, Category View, Service Detail's existing
composition, or Merchant Detail's routing/relationship validation.
`cardOnly` remains exactly as SERVICES-R1/R3 defined it — §3 of this
document is direct prototype evidence that purchasing was never gated
by `cardOnly` in the first place, so no change to that contract is
needed *or* justified by anything found this stage. Real Category/
Service/Merchant IDs, `belongsToCategory`, and `serviceReferencesMerchant`
all remain untouched — `POST /orders` only ever needs a real, valid
`serviceId`, which those existing checks already guarantee is
meaningful by the time a user reaches a buy button. Home CMS
architecture, the Category/Service-as-domain-not-CMS boundary, and
Merchant Admin management are all outside every sub-stage proposed
above.

## 17. Explicit Non-goals (this stage and near-term)

- No application/runtime code was changed to produce this document.
- No Order/Payment/Credit/Installment logic was implemented.
- No schema migration was created (one is *proposed*, in §10, for a
  future sub-stage).
- No fictional financial data — real or seeded — was created anywhere.
- No production deployment, no production data access.
- No SERVICES-R6 (Admin-managed content) work.
- No Home CMS change.

## 18. Test Strategy (for future R5 sub-stages, not this one)

Every §9 invariant should have a direct, named test before any
sub-stage is considered done — not incidentally covered by a happy-path
test. Given zero tests exist today for `orders`/`wallet`/`payments`,
R5.1 should establish the pattern (arrange real Prisma test fixtures,
assert the transactional rollback behavior explicitly, assert the
idempotency replay returns the *same* order, not a new one) that later
sub-stages then extend, rather than each sub-stage inventing its own
testing convention.

## 19. Risks / Open Decisions

Genuinely unresolved, requiring a product/business decision before
R5.1 can start, not something this analysis can resolve unilaterally:

1. **Is a real payment gateway account (Zibal or Zarinpal) actually
   available for staging/production, or does R5.2 need a mocked/sandbox
   provider indefinitely?** `ZibalProvider`'s own code comment says
   "not exercised against a live merchant account in this environment"
   — unresolved today, and this analysis cannot determine it without a
   business-side answer.
2. **What does `OrderStatus.delivered` actually mean for a Biawin
   "service" (a financial/membership product, not a physical good)?**
   Needs a product definition before the state machine's terminal state
   is meaningful.
3. **Is "Profile → خریدها" (order history) the approved post-purchase
   destination, or does R5.4 need a dedicated confirmation screen?**
   R3-era docs flagged this as the most plausible destination but it
   was never confirmed as an approved decision, and the Profile page
   itself doesn't exist yet.
4. **Should `installmentMonths` be user-selectable at all**, given the
   prototype itself never lets a user choose it (§1/§7)? Building a
   selector would be going beyond prototype fidelity into new product
   design — worth an explicit decision rather than assuming R5 should
   add UI the prototype never had.
5. **Sequencing of R5.1 vs R5.2**: R5.1 (wallet/credit/cash paths) can
   ship real money-moving logic without any external gateway dependency
   at all; R5.2 (gateway-backed purchases) depends on an external
   business relationship (#1) that may not be resolved on the same
   timeline. Recommend treating R5.1 as independently shippable and not
   blocking on gateway availability.

---

## Application code changed this stage

**None.** This is a pure analysis/documentation stage, per the task's
explicit instruction. `git status` before writing this document showed
a clean tree with zero pending changes; the only file this stage
produces is this document itself.

## Quality gates

Not applicable in the usual sense — no application code was touched.
No `typecheck`/`lint`/`test`/`build` run was needed or performed, and
none is claimed.
