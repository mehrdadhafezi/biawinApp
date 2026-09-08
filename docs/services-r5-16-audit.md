# SERVICES-R5.16 — Repository Audit

Performed before any code change, per the stage's explicit instruction. Covers the six required areas plus one critical unplanned finding (§7) that materially scopes everything after it.

## 1. Current Frontend Services Implementation

Full route stack exists and is stable: `/services` (List) → `/services/[categoryId]` (Category) → `/services/[categoryId]/[serviceId]` (Detail) → `/services/[categoryId]/[serviceId]/[merchantId]` (Merchant). Components: `CategoryGrid`/`CategoryHero`/`Chip`/`MethodFilterChips`/`ServiceSearchInput`/`ServiceGrid`/`ServiceCard`/`ServiceHero`/`ServiceDetailCardSummary`/`Pricing`/`ServiceInfo`/`DisabledPurchaseCTA`/`MerchantHero`/`MerchantServicesList`/`MerchantLinkCTA`.

**Critical terminology finding — two unrelated things are both called "card":**
1. **The existing frontend `cardOnly` contract** (`app/services/[categoryId]/[serviceId]/page.tsx`, `ServiceDetailCardSummary.tsx`, established SERVICES-R1): every real Service detail page renders in a restricted mode — `DisabledPurchaseCTA` instead of the prototype's 4 selectable purchase-method plan cards. This is a **safety/scope-control convention**, not a schema field (grepped: zero backend references to `cardOnly`) — it exists purely to prevent the frontend from rendering an interactive purchase flow ahead of a real backend. **It has no relationship to this stage's "Card Product" concept** and must not be confused with it.
2. **This stage's "Card Product"** is a new backend commercial entity. Nothing in the current frontend or backend implements it today.

No `CardProduct`/`CustomerCardInstance`/`UsageTransaction` concept exists anywhere in `apps/web`.

## 2. Current Backend Services Models

`Category` → `Service` → `Order` (R1–R5.1), unchanged since the last commit (`1b4af9d`). `Service` conflates catalog presentation (title/badge/icon/gallery/FAQ) with commerce fields (`priceFrom`/`priceLabel`/`availableMethods`/`installmentMinMonths`/`installmentMaxMonths`) directly on one row — already flagged as a structural issue in `docs/services-r5-2-pricing-and-eligibility-domain.md` §2.

**A working precedent for exactly this stage's target shape already exists, for a different domain**: `MembershipPlan` → `Membership`. `MembershipPlan` (id, kind, tier, title, priceLabel, benefits, terms, `accessibleCategories: Category[]`) is structurally a "Card Product" for memberships; `Membership` (userId, planId, `status: MembershipStatus (active|pending|special|expired)`, `activatedAt`, `expiresAt`) is structurally a "Customer Card Instance" for memberships. **This stage's new entities should follow this proven pattern, not invent a new one** — same shape, applied to Service-purchased commercial cards instead of membership cards.

## 3. Existing Prisma Schema

Full model/enum inventory unchanged from R5.2 §2 (32 models, re-verified this stage). Relevant to this stage specifically: `Order.amount`/`Order.status`/`assertOrderTransition` (R5.1, immutable snapshot + enforced transitions — the pattern this stage's `CustomerCardInstance` lifecycle should reuse); `CreditLine`/`Installment`/`Wallet` (all real gaps already documented in R5.2 §10–§12, unchanged); no `CardProduct`/`CustomerCardInstance`/`UsageTransaction` exists.

## 4. Existing APIs

`GET/POST /orders`, `GET /orders/:id` (R5.1). `GET /services`, `GET /services/:id` (public). `GET /categories`, `GET /categories/:id` (public). `GET /merchants/:id` (public, R4). No card/product endpoints exist.

## 5. Existing Admin Capabilities

`AdminRole = SUPER_ADMIN | CONTENT_EDITOR | SUPPORT_VIEWER`. Real, proven CRUD+RBAC+audit-log pattern exists for Home CMS (`home-hero-cards`, `home-service-banners`, `home-service-mosaic-tiles`, `home-news-articles`) — this is the template to reuse for any future Card Product admin surface, per R5.2.1 §10's own conclusion. **No admin surface for Services/Category/Merchant pricing or card management exists today** — Category/Service/Merchant are all seed-only, unmanaged by Admin.

## 6. Prototype Implementation

Two prototype files exist locally: the original `biawin_single_file_app_requested_edits_v15.html` (the file every prior Services stage was instructed to use) and a new `biawin_single_file_app_internal_service_cards_fixed_v19.html` found this stage in the same reference folder. Mining v19's `cardType`/card-related structures confirms it is a variant of the **same** underlying JS (`detailState.cardType`, `کارت‌های من` profile accordion, the same per-category purchase-method "card" generator already mined in R5.2 §3) — **not a different app**, and not evidence of a resolved commercial-card system; it reinforces R5.2's existing finding that the prototype's "cards" are purchase-*method* framings (اعتباری/اقساطی/تخفیفی/ترکیبی), never structured commercial products with a real price, type, or lifecycle. Nothing in either prototype file models `CREATED→PURCHASED→ACTIVE→...→EXPIRED` or usage tracking — that lifecycle is new to this stage, not mined from the UI.

The prototype's profile page already has a `کارت‌های من` ("My Cards") accordion, structurally distinct from `سفارش‌ها` ("Orders") — real, if thin, evidence that the product design already anticipated customers viewing owned "cards" separately from raw orders, supporting `CustomerCardInstance` as a real customer-facing concept (not merely a backend bookkeeping row).

## 7. Critical Finding: The Business's Own Open-Questions Document

Found alongside this stage's task file, in the same reference folder: `کاربر داخل Biawin دقیقاً چه چیزی خریداری می‌کند؟1.docx` ("What exactly does a user purchase inside Biawin?"). This is not a decision document — it is an extensive, unanswered questionnaire, written from the same business perspective, covering nearly every dimension of this exact domain: what is actually delivered after purchase (code / digital card / destination-site wallet credit / dedicated link / account creation / CRM record / just an Order); whether a Biawin purchase is the final transaction or the first step of a larger one; the exact ratio between what's paid in Biawin and what's spent at the destination; whether amounts are fixed options or user-entered; the full `Order` status lifecycle and what "delivered" actually means; refund model (full/partial, where the money returns to); what happens if payment succeeds but destination-card issuance fails; whether a voucher/card supports partial use, has an expiry, is transferable, is single- or multi-merchant; the exact meaning of "Merchant" (service owner / real seller / credit acceptor / supplier — possibly different roles); the settlement model and commission calculation; Credit ownership/reservation/concurrency semantics; who sets installment terms; Wallet's exact role and whether split payment is needed; invoicing; unified customer identity across CRM; availability/inventory/quota limits; discount/campaign funding; SSO to the destination site and webhook/API/batch reporting of usage; CRM event points; workflow configurability and roles; and financial-data immutability/retention/idempotency requirements.

**This directly bounds what this stage may safely build.** The task's six stated "Current business decisions" answer a real subset of these questions (Biawin owns pricing; Biawin does not settle with merchants; Biawin is responsible for issuing and tracking redemption). Everything else the docx asks — the exact `CustomerCardInstance` status set beyond what the task itself already specifies, refund/cancellation rules, credit reservation, split payment, SSO, webhook idempotency, financial-data immutability specifics, retention — **remains genuinely open**, in the business's own words, not something this audit can resolve or should guess at. Per this engagement's established discipline (R5.1 §2, R5.2 §14: never invent a missing business decision), this stage's implementation is scoped to exactly what the task's six decisions plus already-existing patterns (Order/Membership) can support safely — and no further.

## Audit Conclusions

- **What exists today**: `Category`/`Service`/`Merchant`/`Order` (catalog + blocked transaction foundation), `MembershipPlan`/`Membership` (a proven, directly analogous Card-Product/Customer-Card-Instance pattern for a different domain), Admin CRUD/RBAC/audit-log pattern (Home CMS).
- **What is missing**: any commercial-card entity, any customer-owned-card entity, any usage-tracking entity, any journey-type concept, any card-management Admin surface, any card-facing customer API.
- **What should be reused**: the `MembershipPlan`/`Membership` shape (fields, lifecycle pattern) as the direct template for `CardProduct`/`CustomerCardInstance`; the `assertOrderTransition`-style state-machine helper pattern for `CustomerCardInstance`'s lifecycle; the Home-CMS Admin CRUD/RBAC/audit-log pattern for any future card-management surface (not built this stage — see the R5.16 contract doc §"Admin Requirements").
- **What conflicts with the new domain model**: nothing structurally — this is additive. The one real risk is scope: the business's own open-questions document (§7) proves that wiring `CustomerCardInstance` creation to a real completed purchase, or building usage-tracking webhooks/CRM integration, would require inventing answers to genuinely unresolved questions. This stage's implementation therefore stops at a safe, additive catalog+ownership foundation — matching exactly how R5.1 stopped short of wallet/gateway/installment execution.
