# SERVICES-R5.19 — Purchase/Order Domain Audit

Read-only audit. No application/runtime code, schema, or business rule was added or modified to produce this document. Written before any STEP 2+ implementation, per this stage's explicit instruction.

## 1. What Was Read

- Schema: `Order`, `Payment`, `CreditUsage`, `Installment`, `CardProduct`, `CustomerCardInstance`, `UsageTransaction`, `Service`, `Category`, `Merchant` (`backend/prisma/schema.prisma`).
- `backend/src/modules/orders/{orders.service.ts, orders.controller.ts, orders.module.ts, order-state-machine.ts, dto/create-order.dto.ts, dto/list-orders-query.dto.ts, orders.service.spec.ts, orders.controller.spec.ts, order-state-machine.spec.ts}`.
- `backend/src/modules/orders/pricing/{service-pricing.service.ts, service-pricing.service.spec.ts}`.
- `backend/src/modules/cards/{card-products.service.ts, customer-cards.service.ts, customer-cards.service.spec.ts, dto/create-card-product.dto.ts, dto/update-card-product.dto.ts}`.
- `apps/web/src/components/services/{cardProductPresentation.ts, CardProductCard.tsx, CardProductHero.tsx, DisabledCardPurchaseCTA.tsx}` and `apps/web/src/lib/services-api.ts`.
- `apps/admin/src/features/catalog/{types.ts, card-products/CardProductForm.tsx}`.
- `docs/services-r5-2-pricing-and-eligibility-domain.md`, `docs/services-r5-2-1-pricing-ownership-business-decision.md` (the resolved "Model A: Biawin owns pricing" decision this stage's task explicitly assumes).
- `backend/scripts/staging-qa/authenticated-qa-runner.ts` (§12, the existing `servicesR511TransactionFoundationCheck` section, to model the new QA section on).

## 2. Which R5.1 Assumptions Are Now Obsolete?

- **"The purchasable entity is `Service`."** `CreateOrderDto` only has `serviceId`; `Order.serviceId` is the only FK to the catalog. This is the entire premise R5.19's business rules override: *"The customer does NOT buy Service. The customer buys CardProduct. Service is only the parent/grouping concept."* R5.1 predates `CardProduct` (R5.16) entirely — it could not have modeled this.
- **"`PurchaseMethod` (`credit`/`installment`/`cash`/`free`) is mandatory for every purchase."** `Order.method` is `PurchaseMethod` (NOT NULL). The new CardProduct purchase contract (task §6) has no `method` field at all — CardProduct has no `availableMethods`-shaped concept. This assumption does not transfer.
- **"`ServicePricingService.resolveAuthoritativePrice(service, method)` is the pricing authority."** Still true for the Service path, but no longer *sufficient* — it has no way to price a `CardProduct`, and it must never be asked to (see §5 below on why it is not renamed).

Everything else in R5.1 — ownership-from-JWT, idempotency, no-client-amount, Order-only-created-pending, no wallet/gateway dependency — is still architecturally sound and is reused, not replaced (see §3).

## 3. Which R5.1 Safety Mechanisms Should Be Reused?

All of them, verbatim where the code allows it:

1. **Never trust the client for `amount`.** `CreateOrderDto` has never had an `amount` field; the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (`backend/src/main.ts`) rejects any unknown field with 400. This is reused unchanged.
2. **Ownership derived from JWT.** `OrdersController.create()` reads `@CurrentUser()`, never a client-supplied `userId`. Reused unchanged.
3. **Idempotency**: DB-level `@@unique([userId, idempotencyKey])` + application-level `assertReplayMatchesRequest()` + a P2002-catch-and-refetch race handler. Reused, but `assertReplayMatchesRequest()` must learn a second "core identity" shape (CardProduct-based) alongside the existing Service-based one — see §7 in the companion contract doc.
4. **Orders are only ever created `pending`.** No status-mutating endpoint exists anywhere in `OrdersService`. Reused unchanged — the new CardProduct path also only ever creates `pending` Orders.
5. **Relationship validation before trusting any relationship.** R5.1's `validateAndPrice()` re-fetches the real `Service`/`Merchant` rows and never trusts a client-supplied relationship. The same discipline is applied to the new CardProduct path (re-fetch `CardProduct` → `Service` → `Category`, never trust a client hint).
6. **No side-effect dependencies.** `OrdersService`'s constructor has exactly `(PrismaService, ServicePricingService)` — no `WalletService`/`PaymentsService`/gateway client exists to accidentally call. `orders.service.spec.ts` asserts this directly via `Reflect.getMetadata('design:paramtypes', ...)`. The CardProduct path adds one more constructor param (`CardProductPricingService`, itself dependency-free) and nothing else — the same absence-of-side-effect-capable-dependencies proof still holds and is re-asserted by an updated version of that exact test.

## 4. Does Order Currently Identify Service Only?

Yes. `Order.serviceId String` (required FK, `onDelete: Restrict`) is the only catalog identity on `Order`. There is no `cardProductId` column, index, or relation anywhere on `Order` today.

## 5. Does Order Need CardProduct Identity?

Yes — this is the whole point of the reconciliation. See the companion contract doc (`docs/services-r5-19-card-product-purchase-order-foundation.md` §4) for the exact additive shape chosen: a new nullable `Order.cardProductId`, with `Order.serviceId` **still always populated** (derived server-side from `CardProduct.serviceId` for the new path) so every existing invariant that assumes `Order.serviceId` is always present keeps holding for every Order, old or new.

## 6. Does Order.amount Already Function as the Immutable Payable-Price Snapshot?

Yes, and this is true by simple absence: **no method on `OrdersService` ever writes to `Order.amount` after `create()`.** There is no `update()`/`updateStatus()`/`markPaid()` method at all yet. The immutability is structural, not enforced by a guard — and this stage preserves that structure exactly: the new CardProduct path also only ever *creates* an Order once, with `amount` resolved once at creation time from `CardProduct.priceAmount`, never re-read or re-resolved afterward (including on an idempotent replay, which returns the stored `existing` row as-is — see the contract doc §10 for the direct test of this).

## 7. Does Order Need an Additional Commercial-Value Snapshot?

**No, not this stage — and this is a deliberate, documented gap, not an oversight.** The task's "card value" concept (§4, `valueAmount`/`valueDisplayType`, added to `CardProduct` this stage — see the contract doc §6) is a **catalog presentation fact**: what a customer is shown before they ever click "خرید کارت". It is not itself a financial transaction fact the way `Order.amount` is. This stage does not snapshot `valueAmount`/`valueDisplayType` onto `Order` at purchase time, because:
- Nothing in the task's explicit Order-snapshot list (§8) asks for it.
- No real purchase-completion flow exists yet for a changed catalog value to actually mislead a customer about (the CTA stays disabled — §10 companion doc).

**Known follow-up, explicitly flagged for the next stage**: once a real post-purchase view exists (e.g. "what I bought"), if `CardProduct.valueAmount` can change after purchase (Admin edits it), a customer could see a different value on their purchased-card history than what was displayed when they bought it. This is the same class of problem `Order.merchantId` already solves for the merchant relationship (a frozen snapshot, not a live join) — a `valueAmount`/`valueDisplayType` snapshot on `Order` (or on the eventual `CustomerCardInstance`, which is arguably the more correct home for it, since that is the thing the customer actually ends up holding) is a legitimate candidate for that later stage. Not invented here.

## 8. Is Order.merchantId Still Relevant to This Purchase Path?

Yes, unchanged in shape and meaning. Business rules #5/#6 ("Biawin has NO merchant settlement relationship... external merchants/providers settle through their own reference platform") mean `Order.merchantId` was never a settlement obligation to begin with — its own doc comment already says it is a server-derived *snapshot*, "never client-trusted." For a CardProduct purchase, the same snapshot is taken the same way: derived from the CardProduct's parent `Service.merchantId`, never from a client-supplied value (and the new contract explicitly forbids the client from supplying one at all — see the contract doc §8). Nothing about R5.19's business rules contradicts continuing to record this informational relationship; they only clarify that it never implied settlement, which was already true.

## 9. Are Any Client-Provided Monetary Fields Still Accepted?

No. `CreateOrderDto` has never accepted `amount`. The new CardProduct-purchase shape of the same DTO does not add one either, and explicitly must reject a client-supplied `merchantId` too (task §6's forbidden-fields list is stricter for the new contract than the legacy one, which still allows an optional `merchantId` *hint* purely for cross-validation — see the contract doc §8 for exactly how this is enforced at the application boundary, since the shared-DTO's field-level whitelist alone cannot express "forbidden only in this branch").

## 10. The CRITICAL MONETARY RULE — A Real, Pre-Existing Bug Found by This Audit

This audit's most important finding is not about `Order` at all — it is that **the R5.18 customer-facing UI already conflates `CardProduct.priceAmount` with the card's commercial value**, exactly the confusion this stage's task is written to prevent.

`apps/web/src/components/services/cardProductPresentation.ts`'s `formatCardProductPrice()` (R5.18) reads `CardProduct.priceAmount` and, for `cardType === 'CREDIT_CARD'`, renders it as `"تا سقف <amount> تومان اعتبار"` — i.e., it presents `priceAmount` **as if it were the card's credit ceiling (its commercial value)**. But `CreateCardProductDto`'s own doc comment (R5.17) is unambiguous about what `priceAmount` actually is: *"Rial, integer. Admin-set — [...] priceAmount is stored and managed by Admin directly"* under R5.2.1's resolved **Model A: Biawin owns pricing** decision — i.e., `priceAmount` is, and was always meant to be, **the amount the customer pays Biawin**, not the card's face value.

Today this bug has zero real-world impact (R5.16/R5.17: `card_products` had zero real rows as of R5.17's migration; the one row that exists anywhere is a local-dev QA fixture created during R5.18's manual verification). This is the correct, cheapest possible time to fix it — before any real CardProduct data or any real purchase flow depends on the wrong interpretation. The contract doc (§6) specifies the fix: a new, separate `CardProduct.valueAmount`/`valueDisplayType` pair becomes the sole source for the customer-facing "card value" display; `priceAmount` is reserved exclusively for the payable-price resolver this stage builds. R5.18's presentation function and its tests are corrected as part of this stage's implementation, not left to conflate the two any further.

## 11. Summary Table

| Question | Answer |
|---|---|
| R5.1 assumptions now obsolete | Service-is-the-purchasable-entity; `method` mandatory for every purchase |
| R5.1 mechanisms reused | No-client-amount, JWT ownership, idempotency (extended), pending-only creation, relationship re-validation, no side-effect dependencies |
| Order identifies Service only today? | Yes |
| Order needs CardProduct identity? | Yes — new nullable `cardProductId`, `serviceId` stays always-populated (derived) |
| Order.amount already immutable-snapshot? | Yes, structurally (no update path exists) — preserved |
| Order needs a value snapshot too? | No, not this stage — documented follow-up for the next stage (§7) |
| Order.merchantId still relevant? | Yes, informational snapshot only, unchanged meaning |
| Client-provided monetary fields accepted? | No — and the new contract is stricter (also forbids client `merchantId`) |
| Pre-existing bug found | R5.18's price display already conflates `priceAmount` with card value — fixed this stage |

See `docs/services-r5-19-card-product-purchase-order-foundation.md` for the resulting design and its full rationale.
