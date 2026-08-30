# SERVICES-R5.2.1 — Pricing Ownership Business Decision

## 1. Current Verified State

From `93c139f` (`docs(services): SERVICES-R5.2 pricing and eligibility contract`), re-stated here only as the fixed ground every model below is evaluated against — no new audit was performed for this document:

- **No authoritative pricing source exists anywhere** — 0/108 real Services have a usable `priceFrom`; the prototype itself never computed or persisted a real purchase amount (its "price" field is always a display string, several literally non-numeric — "امروز" / "امروز طلا" / "درخواست مشاوره" / "قابل تنظیم").
- **No `ServiceOffer`/`Price`/`Discount`/`Campaign`/`Invoice`/`Product` model exists.** `Service.priceFrom`/`priceLabel` are the only pricing-shaped fields, both nullable, both currently unpopulated for real data.
- **`Service.merchantId` is a single nullable scalar FK** — one Service can have at most one Merchant today, never many. 0/108 real Services have one.
- **No Merchant identity/auth system exists.** `AdminRole` is `SUPER_ADMIN | CONTENT_EDITOR | SUPPORT_VIEWER` only — internal Biawin staff, not merchants.
- **No external pricing/ERP integration exists anywhere in the codebase** — no config key, client, or reference to one.
- **`Order.amount` is already a server-resolved, immutable-at-creation snapshot** (R5.1) — nothing ever writes to it after creation, regardless of what eventually supplies the number.
- **`Payment`/gateway boundary has zero idempotency protection** (R5.2 §13) — an existing, separate gap, orthogonal to which pricing model gets chosen.

This document does not re-derive any of the above; see `docs/services-r5-2-pricing-and-eligibility-domain.md` for the full evidence trail.

## 2. Model A — Biawin-owned Pricing

Biawin centrally sets the payable price for each purchasable Service.

| # | Question | Answer under Model A |
|---|---|---|
| 1 | Who creates the price | Biawin staff (Admin) |
| 2 | Who can edit the price | Biawin staff (Admin) |
| 3 | Where authoritative price lives | Directly on `Service.priceFrom` — no new entity |
| 4 | Multiple prices per Service? | No — one Service, one price |
| 5 | Multiple Merchants per Service? | Still possible for *fulfillment*, but price never varies by Merchant |
| 6 | Order snapshot | `Order.amount` = `Service.priceFrom` at creation time — exactly what `ServicePricingService` already does structurally |
| 7 | Future discounts | A second Admin-editable field on `Service` (e.g. a sale price) — stays single-owner, simple |
| 8 | Installment eligibility | Computed from the one fixed base price + existing `installmentMinMonths/MaxMonths` |
| 9 | Credit eligibility | Checked against the one fixed amount — no ambiguity |
| 10 | Wallet usage | Orthogonal to pricing source — unresolved either way (R5.2 §12) |
| 11 | Admin manages | Price entry per Service, same CMS pattern already proven for Home CMS |
| 12 | Future Merchant Portal manages | Nothing — merchants have no commercial input under this model |
| 13 | External ERP sync needed? | No |
| 14 | Staging/testing implications | Easiest — one Admin-set test-only price satisfies QA once a visibility flag exists |
| 15 | Migration complexity | None — `priceFrom` already exists; this is a data-entry change, not a schema change |
| 16 | Operational complexity | Low, but doesn't scale to fast-changing markets (manual updates) |
| 17 | Stale-price risk | Medium–High for volatile categories (gold, groceries) — manual updates lag reality |
| 18 | Conflicting-price risk | None — single writer, single value |
| 19 | Effect on `Service.merchantId` | Unaffected — stays a fulfillment/branding link, never a pricing key |
| 20 | Effect on 108-Service catalog | Fully compatible today — purely additive, needs only real data entry |

## 3. Model B — Merchant-owned Pricing

Each Merchant sets the price of the Service they supply.

| # | Question | Answer under Model B |
|---|---|---|
| 1 | Who creates the price | The owning Merchant |
| 2 | Who can edit the price | The Merchant (via a future Merchant Portal), or Admin on their behalf until one exists |
| 3 | Where authoritative price lives | On a Merchant×Service relationship — **not safely on `Service` directly** once more than one Merchant can supply the same Service |
| 4 | Multiple prices per Service? | Yes, structurally — this is the model's whole premise |
| 5 | Multiple Merchants per Service? | Yes — the natural fit for this model |
| 6 | Order snapshot | `Order.amount` = the specific chosen offer's price; `Order.merchantId` (already exists) records *which* Merchant/offer was used |
| 7 | Future discounts | Merchant-specific promotions on their own offer — natural fit |
| 8 | Installment eligibility | Must consider the specific Merchant's own terms — more complex than Model A (a Merchant might not accept every method) |
| 9 | Credit eligibility | Same complexity as installment — per-offer, not per-Service |
| 10 | Wallet usage | Same open question as elsewhere, plus a new one: does Biawin ever need to settle/pay out to the Merchant? |
| 11 | Admin manages | Merchant accounts, approval/moderation of their offers — not prices directly |
| 12 | Future Merchant Portal manages | Price entry, availability, method support — **becomes necessary infrastructure**, doesn't exist today |
| 13 | External ERP sync needed? | Not required, but a Merchant-facing auth/API surface is — and none exists today |
| 14 | Staging/testing implications | Hardest of A/B — needs a real or fixture Merchant account and a way for it to set a price, neither of which exists |
| 15 | Migration complexity | High — new `ServiceOffer` model, a Merchant identity/auth system, and re-scoping `Service.merchantId`'s role |
| 16 | Operational complexity | Higher — onboarding, vetting, and supporting self-service Merchants |
| 17 | Stale-price risk | Lower per Merchant (each maintains their own), but introduces price *variance* as a new dynamic |
| 18 | Conflicting-price risk | Real and structural by design — the UX must make unambiguous which Merchant/offer is being purchased |
| 19 | Effect on `Service.merchantId` | Becomes largely redundant — a Service could have zero, one, or many offers instead of one nullable FK |
| 20 | Effect on 108-Service catalog | Requires real Merchant recruitment first — 0/108 have one today, so this model produces no real price until that changes |

## 4. Model C — External-source Pricing

An ERP/provider/external API is authoritative for price.

| # | Question | Answer under Model C |
|---|---|---|
| 1 | Who creates the price | The external system/provider |
| 2 | Who can edit the price | Nobody at Biawin directly — it's synced, not entered (an override/exception path may exist but wouldn't be authoritative) |
| 3 | Where authoritative price lives | Externally — Biawin should only cache/mirror it with a clear sync timestamp, never treat the local copy as the source of truth |
| 4 | Multiple prices per Service? | Possibly, if the provider tracks SKUs/variants more finely than Biawin's own `Service` rows — a mapping problem this document cannot resolve from the repository alone |
| 5 | Multiple Merchants per Service? | Orthogonal to pricing source — e.g. gold's daily price is Merchant-independent even if a Merchant fulfills the sale |
| 6 | Order snapshot | Fetch the provider's current value at resolution time, then persist the result on `Order.amount` — the same "resolve-once-then-persist" invariant R5.1 already enforces, just sourced externally |
| 7 | Future discounts | Either the provider supplies them, or Biawin layers a local markup/markdown on top of the fetched base — needs explicit design |
| 8 | Installment eligibility | A real design challenge: a base amount must be committed at plan-start even though the "market price" keeps moving afterward |
| 9 | Credit eligibility | Same challenge as installment — needs a commitment point distinct from the live feed |
| 10 | Wallet usage | Orthogonal, same open question as every other model |
| 11 | Admin manages | Which categories are externally-priced, and sync health monitoring — no direct price-editing power |
| 12 | Future Merchant Portal manages | Not directly relevant unless the "external provider" effectively *is* a Merchant's own system |
| 13 | External ERP sync needed? | Yes — this model's entire premise. No such integration exists anywhere today |
| 14 | Staging/testing implications | Hardest overall — needs a mocked/sandboxed provider or a frozen fixture value; staging must never call a real live feed for QA |
| 15 | Migration complexity | Highest — new integration layer, credentials, sync job, caching/staleness strategy, provider-downtime handling |
| 16 | Operational complexity | High — an ongoing vendor relationship plus monitoring and fallback behavior |
| 17 | Stale-price risk | This model exists specifically to *minimize* it, but introduces a new risk if Biawin's own sync/cache lags |
| 18 | Conflicting-price risk | Low with one true external source; real if different categories use different, overlapping providers |
| 19 | Effect on `Service.merchantId` | Unaffected — orthogonal |
| 20 | Effect on 108-Service catalog | Only relevant to the subset where it makes sense (gold, groceries, per the prototype's own "امروز" placeholders) — not a universal fit for all 108 |

## 5. Model D — Hybrid Pricing

Different Service types use different authoritative pricing sources.

| # | Question | Answer under Model D |
|---|---|---|
| 1 | Who creates the price | Varies per Service/category — Admin for most, an external feed for volatile commodities, a Merchant for merchant-fulfilled ones |
| 2 | Who can edit the price | Whoever "creates" it under that Service's own rule |
| 3 | Where authoritative price lives | Varies per Service — requires a `pricingSource`/`pricingStrategy` discriminator so a resolver knows which rule applies |
| 4 | Multiple prices per Service? | Depends per Service — matches Scenario mix in §6 almost exactly |
| 5 | Multiple Merchants per Service? | Depends per Service — only for the Model-B-shaped subset |
| 6 | Order snapshot | Still `Order.amount`, produced by whichever resolver applies — the snapshot invariant holds regardless of which sub-model ran |
| 7–10 | Discounts / installment / credit / wallet | Each sub-model's own answer applies, per Service, under one shared Order/eligibility contract |
| 11 | Admin manages | The majority of Services directly (the Model-A-shaped subset), plus which Services are flagged Merchant- or externally-priced |
| 12 | Future Merchant Portal manages | Only the Merchant-priced subset |
| 13 | External ERP sync needed? | Yes, but only for the flagged subset — not universal |
| 14 | Staging/testing implications | Needs a fixture per pricing-strategy type — most total testing surface, but each piece individually no harder than its own model |
| 15 | Migration complexity | A superset of A+B+C's needs — the discriminator field is cheap, but the B/C infrastructure behind it is not |
| 16 | Operational complexity | Highest — three different processes/owners to coordinate |
| 17 | Stale-price risk | Varies per Service, inherited from whichever sub-model applies to it |
| 18 | Conflicting-price risk | Only within whichever sub-model applies per Service — not possible across sub-models if each Service has exactly one strategy |
| 19 | Effect on `Service.merchantId` | Same nuance as Model B, but conditional — only load-bearing for the Merchant-priced subset |
| 20 | Effect on 108-Service catalog | **Most consistent with what the real catalog already implies** — the prototype's own data already shows category-dependent price *behavior* (numeric vs. "امروز" vs. "درخواست مشاوره"), not one uniform shape |

## 6. Concrete Scenario Analysis

| Scenario | Best-fitting model(s) | Notes |
|---|---|---|
| **1 — One fixed Biawin price regardless of Merchant** | **A** | Clean fit; `Service.merchantId` stays fulfillment-only, never a pricing key |
| **2 — Same Service, several Merchants, different prices** | **B** | Requires a `ServiceOffer` join entity — `Service.merchantId`'s single-FK shape cannot represent this |
| **3 — Price changes frequently, comes from an external provider** | **C** | Requires the "fetch fresh, snapshot on Order" pattern; no local field should be treated as authority |
| **4 — No fixed price at all; quote / current-market required** | **C, or arguably not an Order at all** | Some of these (the prototype's "درخواست مشاوره" — "request consultation" — entries) may not be *purchases* in the Order sense at all; they may need a lead/inquiry flow instead of a price. This is a genuinely different product shape than "price is missing," worth separating explicitly rather than forcing into the pricing decision |
| **5 — Base price, but different commercial terms per payment method** | **A or D, with a per-method modifier** | `Service.creditMultiplierLabel` (already in the schema, presentation-only today) is direct evidence this was anticipated in the product design — a per-method markup/discount on top of one base price, not a separate price system |

**Explicitly not assumed**: no single model is required to cover all 108 Services uniformly. Scenario 4 in particular suggests at least one category-shaped exception (quote/consultation-based items) may sit outside the Order-and-price model entirely, regardless of which ownership model is chosen for everything else.

## 7. Current Schema Implications

Direct answers to the task's domain questions, given the state in §1:

- **Is `Service.merchantId` compatible with each model?** A: yes, unaffected. B: only for the single-Merchant case; a real multi-Merchant need requires `ServiceOffer`. C: yes, orthogonal. D: yes for the A/C-shaped subset, needs the same B escalation for its Merchant-priced subset.
- **Under which model does `ServiceOffer` become necessary?** B — and D's Merchant-priced subset — and only once more than one real Merchant can supply the same Service. Not needed for A or C.
- **Under which model can price safely remain directly on `Service`?** A, cleanly. D, for its A/C-shaped subset.
- **Under which model should price NOT be persisted locally as authority?** C — and D's externally-sourced subset. Local storage should be a timestamped cache, never the source of truth, or it will silently drift from the real provider.
- **Can `priceFrom` remain presentation-only?** Only under models where it isn't the authority. Under A it graduates from presentation-only to authoritative once Admin populates it for real. Under C it stays a cache/mirror, not authority. Under B it's likely superseded by an offer-level field entirely.
- **Should `Order.amount` remain the immutable transaction snapshot regardless of source?** **Yes, unconditionally, under all four models.** This is the one architectural invariant that survives every version of this decision — already established by R5.1, reaffirmed here as independent of which ownership model gets chosen.

## 8. Decision Matrix

| Criterion | A — Biawin-owned | B — Merchant-owned | C — External-source | D — Hybrid |
|---|---|---|---|---|
| Schema impact | None (populate existing field) | High (new `ServiceOffer` + Merchant identity) | Medium–High (sync/cache layer) | High (superset of A+B+C) |
| Operational ownership | Biawin Admin only | Merchants (needs onboarding/support) | External vendor + Biawin monitoring | Split three ways |
| Merchant scalability | Low (Merchants can't price) | High (scales with Merchant growth) | Not applicable / orthogonal | Medium (only for its Merchant subset) |
| External integration need | None | None (unless Merchants bring their own feeds) | Required | Required for a subset |
| Pricing flexibility | Low (single central price) | High (market-driven per Merchant) | High (live market accuracy) | Highest (right fit per Service type) |
| Auditability | High (single writer, existing Admin audit log applies) | Medium (depends on future Portal's own audit) | Medium (depends on provider data quality) | Mixed, inherited per subset |
| Stale-price risk | Medium–High | Low–Medium | Low if synced often, High if not | Varies per subset |
| Implementation complexity | Low | High | High | Highest |
| Fit with current Biawin architecture | **Best** — matches the existing Admin/CMS/RBAC pattern with zero new infrastructure | Poor today — no Merchant identity system exists | Poor today — no integration layer exists | Moderate — inherits A's good fit for its subset, B/C's poor fit for theirs |
| Future Merchant Portal impact | None needed | **Required** — becomes core infrastructure | Not directly relevant | Required, but only for the Merchant-priced subset |

**No model is ruled out by evidence, and none is selected as a winner.** What the evidence *does* show plainly: Model A is the only one requiring zero new infrastructure against today's real architecture, while B and C both require building systems (Merchant identity/Portal; external integration) that do not exist in any form today — that is a complexity/timeline fact, not a business-fit judgment, and it does not by itself prove A is the "right" answer if the business genuinely needs multi-Merchant pricing or live market rates.

## 9. Human Business Questions

The minimum set that must be answered before any implementation can begin — each one gates a different part of the matrix above:

1. Who is commercially/legally responsible for setting the final sale price shown to a customer — Biawin, the Merchant, or a third-party feed?
2. Can two different Merchants sell the exact same Service at two different prices, or must a Service always have exactly one price regardless of who fulfills it?
3. Are there specific categories (e.g. gold, groceries) where Biawin needs a live, frequently-changing market price rather than a fixed one?
4. Are there categories where no fixed price should exist at all — where a "request a quote" or lead-generation flow is more appropriate than a purchase Order?
5. Should different purchase methods (cash / credit / installment) carry different commercial terms — a markup, fee, or discount — on top of one shared base price?
6. Will Biawin build a self-service Merchant Portal on any foreseeable roadmap, or does Admin remain the sole price-entry point for the foreseeable future?
7. If an external pricing provider is ever used, does Biawin already have — or plan to acquire — a vendor relationship/API for it, or is this purely hypothetical today?

## 10. Implementation Consequence of Each Decision

- **If Model A**: R5.3 wires `ServicePricingService.resolveAuthoritativePrice()` to read `Service.priceFrom` for real (already structurally ready for this — no interface change needed), and Admin gains a price-entry field on the Service edit surface (a new but small Admin API extension, following the exact CRUD/RBAC/audit pattern Home CMS already proved). No `Order` or eligibility contract changes. Lowest-risk, fastest path.
- **If Model B**: requires, before any pricing can go live: a new `ServiceOffer` model and migration, a Merchant identity/auth system (a new domain, not an extension of `AdminRole`), and a Merchant Portal application — realistically its own multi-stage initiative comparable in scope to the Admin portal's own build history, not a single R5.3 sub-stage.
- **If Model C**: requires a provider-integration module, a sync/cache job with explicit staleness handling, and provider-downtime fallback behavior — all new. Pricing resolution follows R5.1's existing "resolve fresh, then snapshot" shape, just sourced externally instead of from `Service.priceFrom`.
- **If Model D**: the lowest-risk way to start is *not* building all three sub-systems at once — add a small, additive `pricingStrategy` discriminator to `Service` now, implement only Model A's resolver behind it first (since it needs no new infrastructure), and add the B/C resolvers later, per category, only once that category's own business case is confirmed. Under this sequencing, Hybrid's day-one cost is effectively identical to Model A's, with the discriminator field bought cheaply up front for future optionality.

In every case, R5.1's core invariants (`Order.amount` immutable-at-creation, server-side eligibility validation, DB-level idempotency) remain unchanged and do not need to be revisited regardless of which model — or mix — is ultimately chosen.

---

**No application/runtime code, schema, or business rule was added or modified to produce this document.**
