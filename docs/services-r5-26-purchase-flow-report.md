# SERVICES-R5.26 — Card Product Purchase Flow — Final Report

Starting point: `26b0c1d` (SERVICES-R5.25, finalized customer Services experience). Full audit performed first: [`docs/services-r5-26-purchase-flow-audit.md`](./services-r5-26-purchase-flow-audit.md).

## 1. Summary

The backend purchase contract (`OrdersService.create()`, `CreateOrderDto`, `CardProductPricingService`) was built entirely in R5.19 and required **zero changes** — it already enforced everything this stage's brief asked for (server-derived price/userId/serviceId, idempotency, no client-controlled amount/status/merchantId, `status: 'pending'` unconditionally, no Payment/Wallet/Installment/CustomerCardInstance side effects). This stage's real work was frontend-only: a purchase confirmation sheet, CTA eligibility gating, a persisted "ready for payment" result page, and analytics wiring — plus closing one genuinely missing tampering-test gap and extending both QA scripts with real purchase-flow coverage.

No schema changes. No new backend modules, tables, or abstractions. No payment gateway, wallet debit, voucher issuance, or fulfillment logic was touched — that boundary held throughout, verified by both static reading and live QA.

## 2. Purchase Contract (Reused, Not Rebuilt)

- **Authoritative entity**: `CardProduct`, never a client-supplied amount/userId/serviceId/merchantId/status.
- **Price**: `CardProduct.priceAmount` exclusively (`CardProductPricingService.resolveAuthoritativePrice()` — `backend/src/modules/orders/pricing/card-product-pricing.service.ts` — never reads `priceLabel`/`valueAmount`).
- **Eligibility**: CardProduct exists, `status: 'ACTIVE'`, `journeyType: 'PURCHASE'`, positive price resolves, owning Service active, owning Category active, user authenticated — all enforced server-side in `OrdersService.create()` regardless of what the client sends.
- **Client request shape**: `{ cardProductId, idempotencyKey }` only (`CreateOrderDto`) — no field exists for the client to supply amount, userId, serviceId, merchantId, or status.
- **Order status**: `pending`, unconditional, never something this stage or the client can override.

## 3. Frontend Changes (New)

| File | Purpose |
|---|---|
| [`apps/web/src/lib/orders-api.ts`](../apps/web/src/lib/orders-api.ts) | Thin API client — `ordersApi.createCardProductOrder()`, `ordersApi.getOrder()`. |
| [`apps/web/src/components/services/PurchaseSheet.tsx`](../apps/web/src/components/services/PurchaseSheet.tsx) | Purchase confirmation — `BottomSheet`-based (prototype's `#purchaseSheet` pattern), shows "مبلغ پرداختی" (payable price) and "ارزش کارت" (card value) side by side and visually distinct, calls the real `POST /orders`, routes to `/purchase/[orderId]` on success. |
| [`apps/web/src/components/services/CardProductPurchaseCTA.tsx`](../apps/web/src/components/services/CardProductPurchaseCTA.tsx) | Eligibility gate — renders the real enabled CTA only when `isCardProductPurchasable()` is true, otherwise the existing `DisabledCardPurchaseCTA` (unchanged). |
| [`apps/web/src/app/purchase/[orderId]/page.tsx`](../apps/web/src/app/purchase/[orderId]/page.tsx) | Persisted "ready for payment" handoff state — real, ownership-scoped `GET /orders/:id`, honest "سفارش شما ثبت شد و آماده پرداخت است" copy, no gateway call, no fabricated payment status. |

**Modified**: [`cardProductPresentation.ts`](../apps/web/src/components/services/cardProductPresentation.ts) (added `isCardProductPurchasable()`, mirroring the backend's eligibility rule exactly — UX gating only, never the security boundary); the CardProduct Detail page (swapped in the new gated CTA); [`analytics.ts`](../apps/web/src/lib/analytics.ts) (added `OrderCreated` event type; `PurchaseCTAClicked` now has a real call site in `PurchaseSheet.tsx`).

Client-side eligibility gating is explicitly documented (in code) as UX-only — the server independently re-validates everything regardless.

## 4. Backend Changes

**None.** Confirmed by reading `orders.service.ts`, `orders.controller.ts`, `create-order.dto.ts`, and `card-product-pricing.service.ts` in full before writing any code, and by re-running the authenticated QA suite live before and after — unchanged, all green.

## 5. Admin CMS

**None required, confirmed by inspection.** `CardProductForm.tsx` already exposes `serviceId` (via `ServiceSelect`), `journeyType`, `priceAmount`, `valueAmount`/`valueDisplayType`, and `status` clearly and editably (established R5.17/R5.19/R5.25). Grepped the entire `apps/admin/src/features/catalog` and `apps/admin/src/lib` trees for any `Order`/`Payment` reference: zero hits beyond the unrelated `sortOrder` display field. Admin content forms structurally cannot touch order or payment state — they only ever write to `CardProduct`/`Service`/`Category`.

## 6. Schema / Migrations

**None.** The `Order` model already had every field this stage needed (`cardProductId`, `amount`, `status`, `idempotencyKey` with its `@@unique([userId, idempotencyKey])` constraint) since R5.19.

## 7. Idempotency

Client generates one UUID (`useState(() => crypto.randomUUID())`) per sheet-open, sent as `idempotencyKey` on every submit attempt from that sheet instance. Server enforces uniqueness at the DB level (`@@unique([userId, idempotencyKey])`) plus a `P2002` race-catch-and-refetch in `OrdersService.create()`.

Verified empirically this session, live in the browser: **5 rapid-fire clicks** on the confirm button (fired via direct JS `.click()` calls, faster than React's own `disabled={submitting}` guard could react) produced **exactly one** Order. Also verified at the API layer: exact-key retry returns the identical Order id; a different key against a different CardProduct while the first key is still in use returns a deterministic `409 Conflict`.

## 8. Security Validation

All of the following are real HTTP-level tests in `backend/scripts/staging-qa/authenticated-qa-runner.ts`, each asserting a real `POST /orders` response, not DTO-shape reasoning alone:

- `SERVICES-R5.19 client-supplied amount rejected (CardProduct shape)` — 400
- `SERVICES-R5.19 client-supplied merchantId rejected (CardProduct shape forbids it outright)` — 400
- `SERVICES-R5.19 client-supplied status rejected (CardProduct shape)` — 400
- `SERVICES-R5.26 client-supplied userId/ownerId rejected (CardProduct shape)` — **new this stage**, 400
- `SERVICES-R5.19 providing both serviceId and cardProductId rejected` — 400 (proves `serviceId` cannot be smuggled in alongside a CardProduct purchase; no dedicated `serviceId`-tampering test was needed beyond this)
- `SERVICES-R5.19 nonexistent cardProductId rejected` — 404
- `SERVICES-R5.19 non-ACTIVE CardProduct purchase rejected with 422` (unit-test level; no non-ACTIVE CardProduct exists in this environment's real data today — honestly reported as NOT_TESTED at the QA-runner level, covered in `orders.service.spec.ts`)
- `SERVICES-R5.19 unauthenticated POST /orders (CardProduct shape) rejected`

Only one genuinely missing tampering vector was found on audit (userId/ownerId, CardProduct shape specifically — the existing R5.1 test for this only exercised the Service-path shape) and was added; everything else was already covered by R5.19's own section.

## 9. Analytics

- `PurchaseCTAClicked` — fires in `PurchaseSheet.tsx` on the confirm-button click, before the request is sent.
- `OrderCreated` — fires on a successful `POST /orders` response (new event type added to `analytics.ts`'s `AnalyticsEvent` union).
- Never wired: `PaymentSucceeded`, `PaymentFailed`, `VoucherIssued`, `CardRedeemed` — none of these states exist yet; this stage does not fabricate them.

## 10. Local QA — Authenticated API Layer

Run against a real local Postgres/Redis/backend (`QA_API_ORIGIN=http://localhost:4000`), twice — once before the `userId`/`ownerId` test addition (baseline re-verification, see audit §6) and once after:

```
Totals: 95 PASS, 0 FAIL, 2 NOT_TESTED
Cleanup: OK — staging restored to its approved state
```

The 2 NOT_TESTED are both honest, pre-existing, real-data gaps (no non-ACTIVE CardProduct exists to discover today; no Service has authoritative pricing for the Service-path positive-idempotency test) — each unit-tested instead and explicitly labeled, never fabricated.

Direct DB verification (via the QA runner's own Prisma queries) of the created Order: `status: 'pending'`, `amount === CardProduct.priceAmount`, `cardProductId` correct, `method: null`. Side-effect deltas for the same run: `Orders +1`, `Payments +0`, `Installments +0`, `CustomerCardInstance +0`, `UsageTransaction +0`, `Wallet` balances unchanged. The disposable Order created by the positive-path test is deleted in the runner's own cleanup phase.

## 11. Local QA — Browser Layer

Ran `deploy/staging/qa/browser/browser-qa.ts` locally (`QA_CUSTOMER_ORIGIN=http://localhost:3000`, `QA_API_ORIGIN=http://localhost:4000`), extended this stage with:

- `fetchCardProductSnapshot()` now prefers a genuinely purchasable CardProduct (real `journeyType === 'PURCHASE'` + positive `priceAmount`) over the first ACTIVE one, so the real flow is exercised whenever such data exists (it does, locally).
- CardProduct Detail assertion branches on purchasability: real enabled "خرید کارت" CTA (no "به‌زودی") for a purchasable card, the pre-existing disabled-CTA assertions otherwise.
- New: clicking the real CTA opens the Purchase Sheet (`role=dialog`, verified header "تأیید خرید", both "مبلغ پرداختی" and "ارزش کارت" labels present and visually distinct).
- New: confirming navigates to `/purchase/[orderId]`, and the page shows the real "سفارش شما ثبت شد و آماده پرداخت است" copy and "مبلغ قابل پرداخت" — asserted to explicitly **never** contain a fabricated "پرداخت با موفقیت" (payment succeeded) string.

First run surfaced a real bug in the new test itself (not the app): the assertion read `page.content()` immediately after `waitForLoadState('networkidle')`, racing ahead of the result page's client-side `GET /orders/:id` fetch, which briefly renders a loading skeleton first — confirmed by screenshot showing the correct final state despite the FAIL. Fixed by waiting for the actual result heading (`page.getByText(...).waitFor()`) before reading content, matching this file's own established pattern elsewhere. Re-run (after waiting out the real 10-minute OTP-request throttle window, 5/10min/IP, consumed by repeated runs in the same session) confirmed clean:

```
Totals: 84 PASS, 0 FAIL, 2 NOT_TESTED
```

Both new R5.26 steps passed (`clicking the real CTA opens the Purchase confirmation sheet with the correct amount`; `confirming the purchase creates a real Order and lands on the ready-for-payment page — no gateway, no fake payment-success state`), plus every pre-existing check unaffected. The 2 NOT_TESTED are the pre-existing, honestly-labeled `SERVICES-R4 — Merchant link positive-path render` (no real Service has a `merchantId` today) and the admin-login skip (no `ADMIN_SEED_EMAIL`/`PASSWORD` in this local shell) — both unrelated to this stage.

**Known, accepted side effect**: this creates one real, persisted, harmless `pending` Order per run (no `Order`-delete endpoint exists, same accepted limitation as this file's own disposable CategoryCard rows, which are deactivated rather than deleted). A `pending` Order has zero financial/fulfillment side effects of its own — exhaustively proven by the API-layer runner's delta checks in §10.

## 12. Quality Gates

Full workspace, run locally, all clean:

- **Backend**: `prisma validate` ✅, `tsc --noEmit` ✅ (0 errors), `eslint` ✅ (0 errors), `jest` — 47 suites / 249 tests passed, `nest build` ✅.
- **Web**: `tsc --noEmit` ✅, `eslint` — 0 errors (14 pre-existing `<img>`-vs-`next/image` warnings, unrelated to this stage), `jest` — 31 suites / 152 tests passed, `next build` ✅ (`/purchase/[orderId]` route present, dynamic as expected).
- **Admin**: `tsc --noEmit` ✅, `eslint` — 0 errors (4 pre-existing `<img>` warnings), `jest` — 25 suites / 84 tests passed, `next build` ✅.
- **`packages/ui`**: `tsc --noEmit` ✅ (no test runner configured for this package — consistent with prior stages; it's tested through the consuming apps).
- **Workspace**: `pnpm/turbo run typecheck lint test build` — 18/18 tasks successful.

## 13. Frontend Test Coverage & Constraint

`apps/web/jest.config.js` uses `testEnvironment: "node"` (no jsdom) workspace-wide — components calling `useRouter()` from `next/navigation` throw under `renderToStaticMarkup` (`"invariant expected app router to be mounted"`, empirically confirmed via a temporary probe test, deleted after confirming). `PurchaseSheet.tsx` and the purchasable branch of `CardProductPurchaseCTA.tsx` both call `useRouter()` and hit this — the same reason `AuthModal.tsx` (the closest prior-art `useRouter()` consumer) has no unit test either. Strategy: extracted the pure eligibility decision (`isCardProductPurchasable()`) into a fully unit-tested function (5 new tests in `cardProductPresentation.test.ts`); `CardProductPurchaseCTA.test.tsx` covers only the not-purchasable branch (3 tests); the purchasable branch and `PurchaseSheet.tsx` are proven live in the browser instead (§11).

## 14. Staging Deploy / Staging QA

`/srv/biawin-staging` does not exist in this environment (`ls /srv` → "No such file or directory") — confirmed again this stage, consistent with every prior stage (R5.22–R5.25). Staging deploy, staging authenticated QA, and staging browser QA were **not executed** — there is no reachable staging environment from this development environment. All QA evidence in §10–§11 above is from a real local Postgres/Redis/backend/web stack instead, honestly labeled as local, not staging.

## 15. Git

Commit: `<filled in after commit — see below>`
Branch: `main`, pushed after review.

## 16. Remaining Limitations

- Staging deploy/QA not executed (environment unreachable — §14).
- 2 NOT_TESTED items in the authenticated QA suite are real content-data gaps (no non-ACTIVE CardProduct, no priced Service exists today), each covered at the unit-test level instead — not defects.
- `PurchaseSheet.tsx`'s and the CTA's purchasable-branch rendering is not unit-tested (workspace-wide `useRouter()`/jsdom constraint, §13) — proven live in the browser instead.
- Browser-QA's new purchase click-through leaves one harmless `pending` Order per run in whatever database it's pointed at (no delete endpoint exists) — accepted, same pattern as existing disposable CategoryCard rows in the same file.
- R5.27 (Payment/Gateway) is explicitly out of scope and was not implemented, per this stage's own instruction.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
