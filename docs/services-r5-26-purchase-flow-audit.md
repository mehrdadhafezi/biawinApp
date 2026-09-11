# SERVICES-R5.26 — Card Product Purchase Flow — Audit

**Read-only audit. No application code was modified to produce this document.** Every claim below was verified directly against the real schema, the real source, and (where noted) a live local backend — not assumed.

## 1. What Already Exists — Backend (Reuse As-Is, Do Not Touch)

The entire server-side purchase contract R5.26 asks for was **already built in R5.19** and remains correct, unchanged, and fully tested:

- **`Order` model** (`backend/prisma/schema.prisma`) already has `cardProductId` (nullable, for backward-compat with the pre-existing Service-purchase path), `serviceId` (always populated, derived server-side for either path), `amount` (Int, always server-resolved), `status` (`OrderStatus`, defaults to `pending`), `userId`, and `idempotencyKey` with a `@@unique([userId, idempotencyKey])` constraint. `OrderStatus` enum: `pending | processing | awaiting_payment | paid | delivered | cancelled`.
- **`CreateOrderDto`** (`backend/src/modules/orders/dto/create-order.dto.ts`) already accepts the exact minimal CardProduct-purchase shape this stage asks for: `{ cardProductId, idempotencyKey }` — no `amount`, no `userId`, no `serviceId`, no `merchantId` (explicitly rejected outright for this shape, with a dedicated `BadRequestException` if supplied).
- **`OrdersService.create()`** (`backend/src/modules/orders/orders.service.ts`) already:
  - Derives `userId` exclusively from the JWT (`@CurrentUser()` in the controller — the DTO has no `userId` field at all, so there is nothing to tamper).
  - Re-fetches the real `CardProduct` row and validates: exists, `status === 'ACTIVE'`, `journeyType === 'PURCHASE'`, owning `Service` exists and `active`, owning `Category` exists and `active`.
  - Resolves the authoritative price via `CardProductPricingService.resolveAuthoritativePrice()` — reads **only** `priceAmount`, throws `UnprocessableEntityException` if null/non-positive, never reads `valueAmount`.
  - Idempotency: exact retry (same user + same key) returns the original `Order`, verified via `assertReplayMatchesRequest()` which branches on what the **original** Order actually recorded, not what shape the retry happens to send; a retry reusing the key for a **different** `cardProductId` throws `ConflictException` (409). A `P2002` unique-constraint race (two concurrent requests with the same key) is caught and re-resolved to the same winning row rather than crashing.
  - Creates the `Order` with `status: 'pending'` only — no `Payment`, no `Installment`, no `CustomerCardInstance`, no wallet mutation, anywhere in this code path (confirmed by reading the whole file — zero references to any of those models or services).
- **`OrdersController`** (`backend/src/modules/orders/orders.controller.ts`) — `POST /orders` (JWT-required, no `@Public()`), `GET /orders` (own orders only), `GET /orders/:id` (`findOneOrThrow(id, userId)` — ownership-scoped, a real order belonging to another user 404s, never leaks).
- **Test coverage already exists and already passes** for nearly the entire Step 12/20 checklist: `backend/src/modules/orders/orders.service.spec.ts`, `backend/src/modules/orders/pricing/card-product-pricing.service.spec.ts`, and the authenticated-QA `servicesR519CardProductPurchaseFoundationCheck()` section (`backend/scripts/staging-qa/authenticated-qa-runner.ts`) — re-run live this session (see §6) and confirmed still green, covering: unauthenticated rejection, nonexistent-cardProductId rejection, client-supplied `amount`/`merchantId`/`status` all rejected by the DTO shape itself (no such fields exist to accept), `serviceId`+`cardProductId` both supplied rejected, non-ACTIVE CardProduct purchase rejected (unit-test level), exact idempotent retry, conflicting-key reuse, zero Payment/Installment/CustomerCardInstance/UsageTransaction/Wallet side effects.

**Conclusion: no backend changes are required or made for this stage.** The entire "Purchase Order Foundation" R5.19 built already **is** R5.26's backend contract, verbatim.

## 2. What Is Genuinely Missing — Frontend

`grep -rln "ordersApi\|/orders"` across `apps/web/src` returns **zero matches** — no customer-facing API client for `POST /orders` or `GET /orders/:id` exists anywhere. The CardProduct Detail page's only purchase-adjacent control is `DisabledCardPurchaseCTA` — a genuine, native `disabled` `<button>` that cannot fire `onClick` at all (R5.18's deliberate placeholder, re-confirmed correct-and-unchanged through every stage since, including R5.25's own audit). **This is the real, entire scope of R5.26**: build the customer-facing purchase flow that calls the already-complete backend.

## 3. Prototype Reference — Purchase Sheet

`docs/services-prototype-analysis.md` (mined directly from the original prototype, re-read this session) documents the exact pattern:

- **`#purchaseSheet`** — a MODAL bottom sheet, triggered from the CardProduct/Service Detail's buy button. Close via `#purchaseSheetClose` / `#purchaseCancel` / backdrop tap — "all 3 equivalent," no navigation.
- **`#purchaseConfirm`** — in the prototype (no backend existed then), this was a dead end: closed the sheet and showed a toast "درخواست خرید ثبت شد" ("purchase request registered"), created nothing, persisted nothing.
- The doc explicitly flags `packages/ui`'s `BottomSheet` component as "exists, unused so far — the natural fit for a future Purchase Sheet," and `Toast` as the `#detailToast`/membership-toast-derived transient message primitive.

**Confirmed this session**: `BottomSheet` (`packages/ui/src/components/BottomSheet.tsx`) and `Toast` (`packages/ui/src/components/Toast.tsx`) both already exist, are both already exported from `@biawin/ui`, and — confirmed by grep — **neither is used anywhere in `apps/web` or `apps/admin` today**. This will be `BottomSheet`'s first real consumer.

**Step 23's instruction is therefore concrete and actionable**: reuse the prototype's *visual* pattern (bottom sheet, close/cancel/backdrop, confirm button) via the already-built `BottomSheet` primitive, but replace the prototype's fake dead-end confirm with a real `POST /orders` call and a real, persisted "ready for payment" result — not another toast-then-nothing.

## 4. Existing Async-Flow Convention To Mirror

`apps/web/src/components/auth/AuthModal.tsx` (a real, working, already-shipped example of an async multi-step flow inside an overlay) establishes the exact convention this stage should reuse: `submitting`/`errorMessage` local state, a `withErrorHandling()` wrapper that catches `ApiError` and falls back to a generic Persian message, and `Toast` for surfacing the error. No new state-management pattern needs to be invented.

## 5. What Is Safe To Reuse vs. What Must Change

| Item | Status | Action |
|---|---|---|
| `Order` schema, `OrdersService`, `OrdersController`, `CreateOrderDto`, `CardProductPricingService` | Complete, correct, tested | **Reuse verbatim — zero backend changes** |
| `CardProductDto` (`apps/web/src/lib/services-api.ts`) | Already has `status`/`journeyType`/`priceAmount`/`priceLabel` | Reuse — no change needed |
| `DisabledCardPurchaseCTA` | Correct for any CardProduct that is genuinely NOT purchasable (wrong `journeyType`, no price) | **Keep for those cases** — only replaced when `journeyType === 'PURCHASE'` **and** a positive price actually resolves |
| `BottomSheet`/`Toast`/`Button`/`Card`/`Badge` (`@biawin/ui`) | Exist, unused/underused | Reuse as-is, no new primitive |
| `AuthModal.tsx`'s submitting/error convention | Proven pattern | Mirror, don't reinvent |
| `formatCardProductPrice`/`formatCardProductValue` (R5.25) | Correct, already distinct | Reuse verbatim in the confirmation sheet |
| Customer `ordersApi` client | **Does not exist** | **Build** — thin wrapper, same shape as `cardProductsApi`/`servicesApi` |
| Purchase confirmation UI | **Does not exist** | **Build** — `BottomSheet`-based, per §3 |
| "Ready for payment" persisted state | **Does not exist** | **Build** — one new route, `/purchase/[orderId]`, reusing the already-built `GET /orders/:id` |
| Analytics `PurchaseCTAClicked` | Declared in the type union (R5.22), never wired anywhere (no real button existed to click) | **Wire it** — now that a real, enabled button exists |

## 6. Live Re-Verification This Session

Ran `backend/scripts/staging-qa/authenticated-qa-runner.ts` against a real local Postgres/Redis/backend before writing any new code, to confirm §1's claims are current, not stale memory of a past stage:

```
PASS  SERVICES-R5.19 real purchasable CardProduct discovered
PASS  SERVICES-R5.19 purchasing a real ACTIVE CardProduct creates a pending Order with the server-resolved price
PASS  SERVICES-R5.19 exact idempotent retry returns the original Order (no duplicate)
PASS  SERVICES-R5.19 conflicting idempotency reuse (different CardProduct) returns a deterministic conflict
PASS  SERVICES-R5.19 Orders delta = exactly 1
PASS  SERVICES-R5.19 Payments/Installments/CustomerCardInstance/UsageTransaction delta = 0, Wallet unchanged
```

All green, unmodified from R5.19/R5.24. This is the concrete evidence behind §1's "reuse verbatim" conclusion — not an assumption carried over from a prior stage's memory.

## 7. Business Rules — What Is Known vs. What Must Not Be Guessed

- **Known, real, already-enforced**: ACTIVE status, PURCHASE journey, active Service, active Category, positive resolved price, one order per idempotency key per user. All enforced server-side today.
- **Not invented this stage**: no credit-limit check, no purchase-method selection for the CardProduct path (it has no `availableMethods`-shaped concept — confirmed absent from the schema), no per-user purchase-quantity limit, no minimum/maximum order value business rule beyond "must be positive." None of these are implemented anywhere in the current domain; this audit does not guess new ones into existence, per this stage's own explicit instruction.
- **`method` field on Order stays `null`** for the CardProduct path (already true, R5.19) — a CardProduct purchase has no `PurchaseMethod` concept; not something this stage invents a value for.

## 8. What Must Explicitly Remain Untouched

Per this stage's own critical boundary, confirmed by reading the relevant modules — none of the following are invoked anywhere in `OrdersService.create()` or will be touched by this stage's frontend work: `PaymentsModule`/any gateway provider, `WalletModule`, `CreditModule`, `InstallmentsModule`, `CustomerCardInstance` issuance, `UsageTransaction` creation. `AppModule` imports `PaymentsModule` but nothing in the Order-creation path calls into it.

## 9. Plan

1. **Backend**: none.
2. **Web**: `lib/orders-api.ts` (new, thin client); `PurchaseSheet.tsx` (new, `BottomSheet`-based confirmation, mirrors `AuthModal`'s state convention); wire the real CTA into CardProduct Detail (conditionally, only when `journeyType === 'PURCHASE'` and price resolves — `DisabledCardPurchaseCTA` stays for everything else); new route `apps/web/src/app/purchase/[orderId]/page.tsx` (the "ready for payment" persisted handoff state for R5.27, reusing `GET /orders/:id`); analytics `PurchaseCTAClicked` wired at the real click site.
3. **Admin**: none required — `CardProductForm.tsx` already exposes `priceAmount`/`valueAmount`/`valueDisplayType`/`status`/`journeyType` clearly (re-confirmed R5.25).
4. **Tests**: new frontend tests for the sheet/CTA/result page; no new backend tests needed (§1's coverage already proves the contract) beyond re-confirming it stays green.
5. **QA scripts**: extend `authenticated-qa-runner.ts` with a dedicated, small R5.26 section covering only what R5.19's section doesn't already (client-tampering attempts against `amount`/`userId`/`serviceId`/`status` — already implicitly proven by the DTO shape itself having no such fields, but proven explicitly and directly this stage per Step 12/21's request); extend `browser-qa.ts` with the real click-through purchase flow.

## 10. Post-Implementation Correction — §1's Tampering-Coverage Claim

§1 above said `amount`/`merchantId`/`status` tampering on the CardProduct shape was "rejected by the DTO shape itself (no such fields exist to accept)" — directionally correct (that IS why they're rejected) but understated: re-reading `authenticated-qa-runner.ts` confirmed these three are already exercised as real HTTP-level tests (`SERVICES-R5.19 client-supplied amount/merchantId/status rejected (CardProduct shape)`, each a real `POST /orders` asserting `res.status === 400`), not just reasoned about from the DTO's shape. The one vector genuinely NOT yet covered for the CardProduct path specifically was `userId`/`ownerId` — R5.1's existing test for this only exercises the Service-path shape. Added one new test, `SERVICES-R5.26 client-supplied userId/ownerId rejected (CardProduct shape)`, immediately after the existing three — same pattern, same assertions. No `serviceId`-tampering test was needed: `CreateOrderDto` has no separate `serviceId` field to smuggle in alongside `cardProductId` (the existing `both serviceId and cardProductId rejected` test already proves this combination is a deterministic 400).

Re-run locally after the addition: **95 PASS, 0 FAIL, 2 NOT_TESTED** (up from the 94/0/2 in §6 — the one new test), cleanup OK.

---

**Implementation follows this plan. No code was changed before this document was written.**
