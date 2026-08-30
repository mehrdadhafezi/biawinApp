# SERVICES-R5.2 — Pricing & Purchase Eligibility Domain

## 1. Baseline

- Application foundation: `847215b` (`feat(services): SERVICES-R5.1 transaction domain foundation`).
- QA tooling: `6c75d75` (`test(services): SERVICES-R5.1 staging transaction QA`).
- Real staging verification at the time this stage began: API 69 PASS / 0 FAIL / 1 NOT_TESTED, Browser 72 PASS / 0 FAIL / 1 NOT_TESTED. The two NOT_TESTED items (successful-Order idempotency replay; R4's Merchant positive path) are both accepted data-gap consequences of the same underlying fact this stage investigates: 0/108 real services have a usable price, and 0/108 have a real merchant.
- **This stage makes zero runtime code changes.** It is the audit and architecture-decision stage the R5.1 report's §22 ("Remaining blockers for R5.2") called for. See §14 for why, and §22 for what would unblock implementation.

## 2. Existing Catalog Semantics

Full model inventory confirmed directly from `backend/prisma/schema.prisma` (32 models, grepped for every `^model `/`^enum ` — no partial read): **no `Product`, `Offer`, `Price`, `Pricing`, `Discount`, `Campaign`, `Inventory`, or `Invoice` model exists anywhere in this codebase.** The catalog domain is exactly three models: `Category` (pure taxonomy: name/description/image/keywords/sortOrder/active, no commerce fields), `Merchant` (bare identity: name/description/logo/active, no pricing or commission fields), and `Service`.

`Service` carries, directly on itself: `categoryId` (required FK), `merchantId` (nullable FK, §4), `title`/`groupLabel`/`subtitle`/`badge`/`icon`/`imageKey` (presentation), `priceFrom`/`priceLabel` (pricing, both nullable — see §3/§4 of the R5.1 report: 0/108 real rows have a non-null `priceFrom`), `availableMethods` (`Json`, a `PurchaseMethod[]`), `installmentMinMonths`/`installmentMaxMonths`/`creditMultiplierLabel` (installment/credit *display* hints, not computed rules — see §11), `benefits`/`galleryKeys`/`faq`/`tags` (presentation), `active`.

**Answering the task's explicit question — is Service (A) a purchasable SKU, (B) a generic service definition, (C) a merchant-independent capability, (D) a merchant-specific commercial offer, or (E) something else?** The evidence points to **(B) with light, already-partially-realized SKU traits (a hybrid leaning B)**, not a clean (A) or (D):
- It is **not (D)** — merchant-specific commercial offer — because `merchantId` is nullable and 0/108 real rows have one; the model is fully usable, browsable, and (once pricing exists) purchasable with no merchant at all. A "commercial offer" model would make the merchant relationship load-bearing, not optional.
- It is **not a pure (C)** — merchant-independent capability — because the schema *does* carry a direct, singular merchant link when one exists, and `PurchaseMethod`/pricing fields live directly on it, i.e. it already models "this specific catalog row can be bought," not just "this kind of thing exists."
- It leans **(B)**: one row = one catalog/browsing entry (what R1–R4 render), carrying category-scoped presentation content (badge, benefits, gallery, FAQ) that reads as *editorial/catalog* content, not commerce metadata.
- But it already has **(A)-like traits bolted on**: `priceFrom`, `availableMethods`, `installmentMinMonths/MaxMonths` are commerce fields sitting directly on the catalog row, with no separation between "what this thing is" and "the commercial terms under which it's sold." This conflation is itself evidence for §3/§6's analysis below — Service today is catalog-and-commerce merged into one row, which is exactly why R5.1 had nowhere else to look for a price and found nothing.

## 3. Prototype Pricing Evidence

Re-mined `biawin_single_file_app_requested_edits_v15.html` directly this stage (same file used by every prior Services stage, per `docs/services-prototype-analysis.md` §2 — v15 is the file the original task named; a newer `v16_clean` exists in the same folder but was never adopted as the Services source and this stage does not change that), specifically for pricing/commerce evidence in the catalog data structures and the purchase flow's own JS:

**The catalog's `price` field is always a pre-formatted display string, never a structured number.** Every one of the ~90 seed-source catalog entries (lines 8977–9120) has a `price:` field like `'از ۱۲٬۹۰۰٬۰۰۰ تومان'` ("from 12,900,000 Toman") — and several are **not numeric at all**: `'قیمت روز'` ("today's price" — gold coins, produce, meat), `'قیمت روز طلا'` ("today's gold price" — jewelry), `'درخواست مشاوره'` ("request consultation" — B2B campaign services), `'قابل تنظیم'` ("adjustable" — organizational gift cards). `backend/prisma/seed.ts` copies these strings **verbatim** into `Service.priceLabel` and never sets `priceFrom` at all — not even to a parsed/derived value; the field is simply absent from every `service.create()` call in the seed file (confirmed by grep: zero matches for `priceFrom` in `seed.ts`). This is the direct, root cause of the R5.1 finding that 0/108 real services have a usable `priceFrom` — it was never a data-entry gap, the source data was never numeric to begin with.

**The service-detail page's own cash-purchase price is a literal placeholder, not a real value**: `<b id="detailCashPrice">قیمت روز خدمت</b>` (line 7740, "today's service price") is the *initial, unconditional* markup — and the JS that's supposed to fill it in (`const cashPrice = payload.price || 'قیمت روز خدمت';`, line 9324) falls back to that same placeholder whenever the item's own `price` isn't a real string. The prototype's own cash-purchase amount is, in the general case, never a committed number.

**The purchase confirmation sheet (`#purchaseSheet`) never handles an amount as data at all.** Its only two dynamic fields are `purchaseServiceName` (the service title) and `purchasePlanSummary` (built as `detailState.plan + ' — ' + detailState.price`, where `detailState.price` is read straight off `plan.dataset.price || plan.querySelector('b')?.textContent` — i.e. it just **re-echoes whatever string was already sitting in the DOM**, never parses or computes anything). Confirming purchase (`#purchaseConfirm` click handler, line ~9504) does exactly one thing: close the sheet and show a toast, `'درخواست خرید «...» ثبت شد.'` ("purchase request registered"). No amount, no method, no merchant, and no service identity is sent anywhere — there is no `fetch`/`XMLHttpRequest` call in this entire flow. **The prototype's purchase flow has no backend integration and no financial computation whatsoever; it is a pure client-side visual mock.**

**No merchant concept appears anywhere in the catalog's price data.** None of the ~90 catalog entries carry a merchant/seller field; "کارت‌های" (the four comparison cards shown per category — اعتباری/اقساطی/تخفیفی/ترکیبی, i.e. credit/installment/discount/mixed) are *purchase-method* framings, not per-merchant offers — `تخفیفی` ("discount") is the prototype's marketing name for a **method** (direct/discounted payment), matching the real `cash` enum value, not a structured discount-on-a-specific-item mechanism. This is consistent with R4's finding of zero real merchant linkage and gives no evidence for a multi-merchant marketplace UX ever having been designed.

**Conclusion, matching the R5/R5.1 framing this stage must not contradict**: the prototype is not merely *unhelpful* for financial rules — it actively demonstrates that commercial pricing was **never resolved even at the design/mock stage**. Converting any of these display strings into real business rules would not be "reproducing the prototype," it would be inventing a business decision the prototype's own authors never made either.

## 4. Price Ownership Options

Evaluated against the criteria the task specifies — current schema compatibility, multi-merchant-per-service, per-merchant pricing, discounts, campaigns, price changes, installment/credit eligibility, audit/history, Order snapshots, future Admin/Merchant portal needs, external provider integration, catalog/commerce separation:

| | **A. Service owns price** | **B. Merchant+Service relationship owns price** | **C. Separate Offer/ServiceOffer entity** | **D. External authoritative provider** | **E. Hybrid** |
|---|---|---|---|---|---|
| Current schema fit | Already the shape (`priceFrom`/`priceLabel` exist) | Requires `Service.merchantId` to become load-bearing (it's nullable, 0/108 set) | New model + migration | No integration exists anywhere in the codebase today (grepped: zero) | Depends which base is chosen |
| Multi-merchant-per-service | Cannot represent it (1 Service = at most 1 price) | Same limitation while `merchantId` stays a single scalar FK | **Only option that can represent it** (Offer = Merchant × Service) | Orthogonal — the *source*, not the *shape* | C's shape + D's source |
| Per-merchant pricing | No | Only if `merchantId` is real (0/108 today) | Yes, natively | Orthogonal | Same as C |
| Discounts/campaigns | Needs extra fields on Service (pollutes catalog row further) | Same problem | Can live on the Offer without touching Service | Depends entirely on the provider's shape | Same as C |
| Price changes over time | Direct mutation of Service — no history unless added | Same | Offer can be versioned/superseded independent of Service | Provider-side, opaque to us | Same as C |
| Installment/credit eligibility | Already partially modeled (`installmentMinMonths/MaxMonths` on Service) | No change from A | Could move onto Offer, but nothing today requires it | Orthogonal | Same as A/C mix |
| Audit/history | None today | None today | Natural home for it (append offers, never mutate) | Provider's own audit, not ours | Same as C |
| Order price snapshot | Already works — R5.1's `Order.amount` snapshots whatever `resolveAuthoritativePrice` returns, regardless of source | Same | Same | Same | Same |
| Catalog vs commerce separation | **Violates it** — Service already conflates the two (§2) | Same violation | **Cleanly separates them** | Cleanly separates them | Best of C+D if D ever exists |
| Evidence this is needed *today* | Matches 100% of real data (single/no merchant) | No real data to validate against (0 real merchants) | **Zero real data to validate against — would be built speculatively** | **No provider identified anywhere** — not Zibal/Zarinpal (those are payment gateways, not pricing sources), not an ERP, not a merchant feed | N/A — inherits C/D's lack of evidence |

**No option is selected for implementation in this stage** — see §14. The comparison exists so a future decision-maker isn't starting from zero, and so R5.3 doesn't have to redo this analysis.

## 5. Selected Architecture

Not selected — this is the central unresolved business decision (§14, §22). What the evidence *does* support, stated as a recommendation for whenever the decision is made, not as something built now: **start from Option A** (keep price directly on `Service`, using the fields that already exist) rather than building `ServiceOffer` speculatively, **because §6's own analysis shows the current 1:1-nullable `Service.merchantId` relationship doesn't justify a many-to-many model with zero real merchants to validate it against** (task's own instruction: "Do not migrate merely for theoretical purity"). Escalate to Option C only if/when a real requirement for "the same Service, multiple Merchants, different prices" actually materializes — which has no evidence today, in either the real catalog or the prototype (§3). This recommendation is explicitly *not* an implementation decision; it is guidance for whoever eventually resolves §14's blocker.

## 6. Merchant/Service Relationship Analysis

`Service.merchantId String?` is a single nullable scalar FK (confirmed directly from schema, §2) — **one Service can have at most one Merchant today, never many.** Can one Service logically be offered by multiple Merchants? Evaluated against every source available:
- **Real data**: no (0/108 services have any merchant at all — nothing to contradict or confirm a many-to-many need).
- **Prototype**: no (§3 — the catalog data has no merchant concept whatsoever; "purchase-method cards" are not per-merchant).
- **R4's own investigation** (`docs/services-r4-merchant-detail-report.md`): built exactly one canonical route, `/services/[categoryId]/[serviceId]/[merchantId]`, and one validation rule (`serviceReferencesMerchant`) — both assume a single merchant per service, not a marketplace comparison view.

**Conclusion**: the current relationship is structurally sufficient for everything evidenced so far. It would become insufficient the moment a real requirement for "compare this Service across multiple Merchants" appears — at which point the correct model is the `Merchant ↕ ServiceOffer ↕ Service` shape the task describes, with `ServiceOffer` (not `Service`) becoming the thing that actually gets purchased and priced. **No migration is justified now**; this is documented so R5.3+ doesn't have to re-derive it if that requirement ever appears.

## 7. Monetary Representation

No new decision needed — the project already has one canonical, documented convention (`docs/02-database.md`: *"همه‌ی مبالغ ... به‌صورت Int و بر حسب ریال ذخیره می‌شوند — هرگز float"* — "all amounts are stored as `Int`, in Rial, never float"), which R5.1's `Order.amount: Int` already follows and which any future pricing model must follow too: **integer, Rial, no floats, ever.** One display-layer nuance worth recording (not a backend decision): the prototype and its mined seed strings display amounts in **Toman** (÷10 of Rial) — an existing frontend concern (Toman↔Rial conversion for display), not something this stage's backend pricing model needs to solve or touches.

Discount representation, validity windows, price versioning: **not designed** — introducing them now would be inventing structure for a discount/campaign system with zero evidence it's needed at the individual-Service level (§3: the prototype's only "discount" concept is the `cash` purchase-method framing, not a per-item price reduction). Per the task's explicit instruction ("do not introduce discount complexity unless justified"), none is proposed.

## 8. Order Snapshot Contract

R5.1 already established `Order.amount: Int` as a single, server-resolved, immutable-at-creation snapshot (there is no update path to it — `OrdersService` never mutates an existing Order's `amount`). Re-evaluating what a *complete* snapshot needs, against the task's list:

| Field | Status today | Needed now? |
|---|---|---|
| Authoritative base amount | `Order.amount` (== payable amount, no separate base) | Already present |
| Final payable amount | Same field — no discount exists to make these differ | Not distinct — see below |
| Currency | Implicit (always Rial, project-wide convention) | Already sufficient — no multi-currency evidence anywhere |
| Selected purchase method | `Order.method` | Already present |
| Service identity | `Order.serviceId` (FK) | Already present |
| Merchant/Offer identity | `Order.merchantId` (server-derived snapshot, R5.1) | Already present for the Merchant case; no Offer entity exists to snapshot |
| Pricing version/source | **Absent** | Not addable meaningfully until a real source (§4/§14) exists to version |
| Discount, if applicable | **Absent** | Not addable — no discount model is justified (§7) |

**Conclusion: no Order schema change is proposed in this stage.** The two "absent" rows are not oversights — they can't be designed correctly without first knowing *which* pricing architecture (§4) is chosen, since a `pricingSource` field's valid values and a `discount` field's shape are entirely dependent on that unresolved decision. Adding them speculatively now risks the exact anti-pattern the task warns against (§14: "do not invent the missing business decision"). The one invariant that already holds and must keep holding: **an existing Order's `amount` must never change when catalog pricing later changes** — true today by construction (nothing ever writes to `Order.amount` after creation), and it must remain a hard requirement of whatever pricing model gets chosen later (i.e., the resolver must run once, at Order-creation time, and its result must be persisted — never re-derived live from the catalog for an existing Order).

## 9. Purchase Eligibility Contract

Pricing and eligibility are distinct, as the task notes — and evidence shows R5.1 already implements the price-*independent* half of eligibility correctly, in `OrdersService.validateAndPrice()`:

**Already enforced today** (server-side, for any `PurchaseMethod`): the Service must exist and be `active`; the requested method must appear in `Service.availableMethods`; if the Service has a Merchant, it must be the one supplied (if any) and must itself be `active`. This is real, tested (`orders.service.spec.ts`), and staging-QA-proven (R5.1.1) eligibility logic — not a gap.

**Not yet possible to enforce, because the underlying domain is itself unresolved (§10–§12)**: a *user-specific* eligibility check for `credit` and `installment` — e.g. "does this user have an active `CreditLine` with enough headroom for this amount?" — cannot be written today, for two independent reasons: (1) there is no amount to check headroom against (§14's blocker), and (2) even conceptually, no rule exists anywhere in the repo for how much of a `CreditLine`'s limit a given purchase should reserve, or whether `installmentMinMonths/MaxMonths` on the Service should gate `installment` eligibility at all (nothing reads those two fields anywhere in `backend/src`, confirmed by grep — they are pure display fields today, wired into the frontend's `Pricing`/`ServiceInfo` components, never into any backend check).

**Conceptual answer the task asks for** ("can this authenticated user start this type of purchase, and why?"), stated per method, honestly reflecting what's real vs. undecided:
- **cash**: eligible iff Service active + method supported + Merchant (if any) active. Fully real today; only blocked by the amount not existing (§14).
- **free**: same as cash, trivially always priced at 0 — but 0/108 services support it (R5.1 finding), so this path has never been exercised against real data.
- **credit**: the above, **plus** an unresolved user-side check (needs a real `CreditLine`, sufficient headroom, no reservation/concurrency semantics defined — §10).
- **installment**: the above, **plus** an unresolved user-side check (needs a `CreditLine`-equivalent or a separate approval concept — schema has no explicit link between `Installment` eligibility and `CreditLine` at all today — **plus** an unresolved *pricing* rule, since nothing computes `monthlyAmount` from a base price — §11).
- **wallet**: not a `PurchaseMethod` value at all today (`credit|installment|cash|free`) — see §12's finding that Wallet's role in a Service purchase (as opposed to a Rewards-shop redemption) has never been decided.

No financial execution logic is implemented here — this section is deliberately contract-only, per the task's instruction.

## 10. Credit Audit

`CreditLine` (schema, §2 of this doc / R5.1 report): one row per user (`userId` FK, not per-service/per-merchant), `limitAmount: Int`, `usedAmount: Int @default(0)`, `status: CreditLineStatus (active|suspended|closed)`, `expiresAt: DateTime?`. `CreditUsage`: an append-only audit row (`creditLineId`, optional `orderId`, `amount`, `description`) — **exists in the schema but is never written by any code today** (`CreditService` is confirmed read-only: `list()`/`findOneOrThrow()` only, grepped this stage and in the R5.1 session).

Findings, precisely:
- **What it represents**: a single, global-to-the-user revolving credit limit — not tied to any Service, Category, or Merchant. Nothing in the schema or code scopes credit per-service.
- **Available vs. used**: computable as `limitAmount - usedAmount`, but this subtraction happens nowhere in the codebase today — there is no `getAvailableCredit()` or equivalent.
- **Reservation/concurrency**: **does not exist.** `usedAmount` has no optimistic-lock column (no `version` field), and there is no code path that increments it at all, so there is also no evidence of how a real purchase would atomically check-and-reserve credit under concurrent requests. This is a genuine gap, not an oversight to fix casually — it needs the same care R5.1 gave Order idempotency (a real DB-level guarantee, not just an in-memory check) once it's built.
- **Global vs. merchant/service-specific**: global only, per the schema. No evidence anything else was ever intended (no `serviceId`/`merchantId`/`categoryId` field on `CreditLine`).
- **Authoritative eligibility logic**: **none exists.** No code anywhere checks a `CreditLine`'s status or headroom before allowing anything.

**Gap statement**: the schema shape (a global limit + audit trail) is a reasonable foundation and does not obviously need to change, but the entire *eligibility-checking service* — "does user X have enough active credit for amount Y right now, and can I safely reserve it" — does not exist and cannot be safely invented without a product decision on reservation semantics (hold-then-confirm vs. check-then-debit-atomically) that this stage does not have evidence to make.

## 11. Installment Audit

`Installment` (schema): one row per `Order` (`orderId String @unique` — 1:1, cannot exist without an Order), `userId`, `totalMonths: Int`, `monthlyAmount: Int`, `paidCount: Int @default(0)`, `status: InstallmentStatus (active|completed|defaulted|cancelled)`, `nextDueDate: DateTime?`. `InstallmentsService` is confirmed read-only (`list()`/`findOneOrThrow()` only).

Findings:
- **No principal/total-amount field distinct from `monthlyAmount × totalMonths`** — the schema assumes that product, but nothing computes or validates it.
- **No fees or interest field anywhere** — `monthlyAmount` is a bare integer with no derivation logic.
- **No calculator or rule engine exists** — confirmed by grep: no file in `backend/src` computes an installment schedule from a base amount.
- **The only pre-existing installment-eligibility-adjacent data is `Service.installmentMinMonths`/`installmentMaxMonths`** — a plausible per-service month range — but nothing reads these fields anywhere in the backend (confirmed by grep); they are wired only into the frontend's presentation components (`apps/web/src/components/services/Pricing.tsx` and related), purely for display.
- **Payment association**: `Payment.orderId` can reference the same Order an `Installment` belongs to, but nothing in the schema or code models "this Payment settles installment N of M" — a Payment and an Installment's `paidCount` are not linked to each other at all today.

**Gap statement**: this is not a schema-shape problem so much as a **completely absent business rule**. Whether Biawin charges interest/fees, what month-range is actually allowed, and how a base price becomes a monthly figure are unanswered product questions with zero evidence in this repository (the prototype's own installment-plan cards show only headline numbers per category, e.g. "پلن‌های ۱۰، ۳۰ و ۵۰ میلیون تومانی" — plan tiers, not a formula). No installment creation logic should be built until this is resolved, matching the task's explicit instruction for this section.

## 12. Wallet Audit

`Wallet`: `kind: WalletKind (main|reward)`, `balance: Int`, unique per `(userId, kind)` — every user gets **both** on signup (`WalletService.initializeWalletsForUser()` creates both unconditionally). `WalletTransaction`: audit row with `type: WalletTxType (topup|spend|refund|gateway_settlement)`, `amount`, `balanceAfter` (a point-in-time snapshot for auditability), optional `relatedOrderId`/`relatedRewardClaimId`.

**What the two kinds represent, based on real evidence**:
- **`reward`**: confirmed, via the prototype's own Rewards flow (`کیف پول جایزه` — "reward wallet", §3's mining also surfaced the reward-shop's real wallet+gateway split-payment modal, `rewardWalletContribution`/`rewardGatewayAmount`), to be a promotional/gamification balance spent exclusively in the Rewards shop — a domain explicitly out of scope for Services (established since R1).
- **`main`**: no Services-specific evidence either way. It is provisioned for every user identically to `reward`, and `WalletService.debit()`'s signature (`type: 'spend' | 'gateway_settlement'`, plus an optional `relatedOrderId` parameter) shows the **plumbing was clearly built with an Order-linked debit in mind** — but it has zero real callers (confirmed this session and in R5.1: grepped, nothing calls `WalletService.debit()` or `.credit()` anywhere in `backend/src` outside its own module). The prototype's cash-purchase copy ("پرداخت کامل: خرید سریع با **پرداخت مستقیم**" — "direct payment") reads as gateway-oriented language, not wallet language, which is the only textual hint either way — not a decision.

**Conclusion**: `Wallet.debit()` existing does **not** mean "purchase with wallet" is an approved rule — it means the atomic-debit *mechanism* was built defensively (with audit logging and balance-sufficiency checking) in anticipation of a future caller, exactly the way `PaymentProvider` was built in anticipation of a future gateway integration. Whether a Service purchase should ever be payable from the `main` wallet — and if so, whether that's a *distinct* `PurchaseMethod` from `cash`/`credit`, or `cash`'s actual implementation — is an open product question (§22), not something this audit can resolve from the evidence available.

## 13. Payment Gateway Boundary

Re-inspected `payment-provider.interface.ts`, `payments.service.ts`, `zibal.provider.ts`, `zarinpal.provider.ts` directly (all previously confirmed to have zero real callers; unchanged this stage).

**The boundary, as the interface already defines it**:
```
Order (pending, real amount known)
  → CreatePaymentInput { amount, callbackUrl, description?, orderId? }
  → gateway.createPayment() → CreatePaymentResult { gatewayUrl, trackId }
  → redirect user to gatewayUrl
  → user completes/cancels payment on the gateway's own site
  → gateway calls our callbackUrl
  → VerifyPaymentInput { trackId, amount } → gateway.verifyPayment() → VerifyPaymentResult { success, refNumber?, rawStatus? }
  → on success: PaymentsService.record({ orderId, provider, amount, status: 'succeeded', gatewayRef }) + Order transitions pending → awaiting_payment → paid (via `assertOrderTransition`, R5.1)
```

**Idempotency, analyzed at each step — this is the single most important finding of this section**: R5.1 gave `Order` creation real, DB-level idempotency (`@@unique([userId, idempotencyKey])`). **The Payment/gateway boundary has none of that today.** `CreatePaymentInput` and `VerifyPaymentInput` carry no idempotency key of any kind; `PaymentsService.record()` has no uniqueness constraint preventing two `Payment` rows for the same order+attempt; nothing in `Payment`'s schema prevents a duplicate `succeeded` row if a gateway ever retries its own callback (a well-known real-world gateway behavior — Zibal/Zarinpal callbacks are not guaranteed exactly-once). **This is a concrete, specific gap for whoever builds R5.3+'s gateway wiring to close, analogous to what R5.1 closed for Order creation** — not a hypothetical concern.

No gateway call is made in this stage (per the task's explicit prohibition); this section is analysis only.

## 14. Staging QA Fixture Strategy

Recommendation, evaluated carefully rather than assumed: **a deterministic, unmistakably test-only purchasable catalog row is the right eventual mechanism — but it cannot be built yet, for two independent, compounding reasons, both already surfaced by this audit:**

1. It needs a real pricing/eligibility resolution path to exercise — creating a QA fixture with an invented price would mean testing against fabricated data, exactly what R5.1/R5.1.1 have consistently refused to do. The fixture only becomes meaningful *after* §14's business decision resolves.
2. Independently of pricing, it needs a **"visible to QA by ID, invisible to real users in listings" mechanism that does not exist today** — `GET /api/v1/services` has no visibility/scope filter; `active` only means "purchasable," not "hidden from the public catalog." Building the fixture safely requires either a new field (e.g. `internalOnly: Boolean`) filtered out of the public list endpoint, or an entirely separate QA-only creation path — itself a small schema/API decision this stage has no evidence to make in isolation from §4's larger pricing-ownership decision.

When both are resolved, the fixture should satisfy every constraint the task lists (unmistakably test-only in its title/copy, never production-seeded, no real gateway call, tied to `STAGING_TEST_AUTH` where possible, disposable or deterministically managed) — but implementing it now, ahead of either blocker, would mean building throwaway plumbing against a pricing shape that doesn't exist yet.

## 15. Admin/Merchant Ownership Boundary

Who can plausibly manage commercial Service offers, prices, availability, purchase methods, and merchant association, based on what exists in this codebase today (not speculation):
- **Biawin Admin**: the only real, evidenced candidate. `AdminRole` is `SUPER_ADMIN | CONTENT_EDITOR | SUPPORT_VIEWER` — an internal-staff role model with a working CRUD/RBAC/audit-log pattern already proven for Home CMS (Stage 5.19+). Extending that same pattern to Services pricing (once §4 is resolved) is the path of least new infrastructure.
- **A future Merchant Portal**: plausible only if the marketplace/multi-merchant model (§6's escalation case) ever becomes real — and even then, it requires an entirely new identity/auth system (there is no `MERCHANT` role, no merchant-scoped login, no merchant-facing API surface anywhere today). Zero evidence this is planned.
- **An external ERP/API feed**: no integration, config key, or documentation reference to one exists anywhere in this repository (grepped as part of §4's Option D evaluation).

**Conclusion**: ownership of *managing* commercial data, once it exists, belongs to Biawin Admin (a future R6+ concern) under today's evidence — not a Merchant Portal or an external system. This stage does not build any management screen; SERVICES-R6 remains the correct home for that, once §14's foundation exists for it to manage.

## 16. Schema Changes

**None.** No migration is included with this stage. See §14 for why, and §8 for the specific reasoning on why `Order`'s snapshot shape is also left untouched.

## 17. API Changes

**None.** `POST/GET /orders`, `GET /services`, `GET /services/:id` are unchanged from their R5.1 shape.

## 18. Tests

**None added.** No implementation occurred to test. R5.1's full security-test suite (33 tests, `orders.service.spec.ts` / `orders.controller.spec.ts` / `order-state-machine.spec.ts` / `service-pricing.service.spec.ts`) remains untouched and green — re-run as part of this stage's quality gates (§19) purely as a regression check, not because anything changed.

## 19. Migration Strategy

Not applicable — no schema change.

## 20. Backward Compatibility

Nothing changed. The 108-service catalog, SERVICES-R1–R4 browsing flows, R5.1's blocked-purchase safety behavior, Home CMS, the Admin portal, and every existing read API are all untouched by this stage, by construction (zero code changes).

## 21. Risks

- **Risk of premature schema commitment**: had this stage picked an option in §4 without evidence (e.g. building `ServiceOffer` against zero real merchants), it would very likely need to be redesigned once real commercial requirements appear — worse than the cost of waiting.
- **Risk of an indefinitely blocked purchase flow**: every real Service purchase attempt will keep returning `422` until §14's business decision is made and implemented. This is the *correct* safe state (per R5.1's explicit design goal), but it is a real product/business risk if pricing ownership isn't resolved soon — this document exists specifically to make that decision easy to make and cheap to act on once made.
- **Newly identified risk this stage surfaces**: the Payment/gateway boundary's complete lack of idempotency (§13) is a real defect-in-waiting for whoever builds R5.3's gateway wiring — flagged now so it isn't rediscovered the hard way later, the way R3.1's race condition was.

## 22. Open Business Decisions

These are the actual blockers — none of them can be resolved by more repository archaeology, and none should be invented:

1. **Who sets a Service's price, and how?** (Admin manual entry / a future Merchant Portal / an external ERP feed / some hybrid) — the root decision everything else in this document is downstream of.
2. **Does the current 1-Service-1-Merchant model stay correct, or will Biawin need multiple Merchants competing on the same Service** (which would trigger the `ServiceOffer` escalation in §5/§6)?
3. **What does the `main` Wallet's balance represent for a Service purchase**, if anything — is `cash` gateway-only, or can/should wallet-funded purchases exist as a real path (§12)?
4. **What are Biawin's actual credit-eligibility rules** — limit-checking semantics, reservation vs. atomic-debit, whether credit is ever service/merchant-scoped (§10)?
5. **What are Biawin's actual installment rules** — interest/fees (if any), allowed month ranges enforcement, how a base price becomes a monthly figure (§11)?
6. **Should discounts/campaigns exist at the individual-Service level at all**, or does "تخفیفی" remain purely a purchase-method framing as the prototype models it (§3/§7)?

## 23. R5.3 Readiness

**Not ready to implement financial execution.** R5.3 (or whatever stage follows) becomes viable the moment **any one** of §22's decision #1 answers is made concrete enough to implement — at that point, the recommended first step is exactly the narrow slice R5.1 already built for: wire `ServicePricingService.resolveAuthoritativePrice()` to the real source (Admin-entered field, external feed, whatever's decided), leaving everything else in this document (`ServiceOffer` escalation, Wallet's role, Credit/Installment eligibility, gateway idempotency) as explicitly separate, later decisions — each already scoped and gapped out above so they don't block each other or get bundled into one oversized stage.
