# SERVICES-R5.18 — Customer Services & Card Product Catalog UI

## 1. Baseline

- Starting commit: `abd5219` (`SERVICES-R5.17 implement admin CMS for service card catalog`) — Categories/Services/CardProducts are now fully manageable by Admin operators, but there was still zero customer-facing UI for the CardProduct layer R5.16 introduced.
- This stage builds the customer-facing catalog browsing UI on top of R5.16/R5.17's existing, unmodified backend. **No schema changes, no new backend endpoints, no backend code touched at all this stage.**

## 2. Scope

**Catalog browsing only**, exactly as specified: Services Landing → Category → Service Detail → Card Product List → Card Product Detail → a visual-only "خرید کارت" CTA. No payment, order creation, wallet, credit, voucher issuance, merchant integration, or purchase execution was implemented — the CTA is a disabled button, matching the pattern already established for the Service-level purchase CTA (`DisabledPurchaseCTA`, R3).

## 3. The Core Domain Rule

*"The customer does NOT buy a Service. The customer buys a CardProduct. Service is only the parent/group."*

This is enforced by construction, not by convention: the only enabled-looking, CardProduct-scoped purchase affordance anywhere in this stage's new work is on the new Card Product Detail page (`DisabledCardPurchaseCTA`), and every price shown in the new `CardProductCard`/`CardProductHero` components is derived from the real `CardProduct` row (`priceAmount`/`priceLabel`/`cardType`), never from `Service`.

**Deliberate exception, explained**: the pre-existing Service Detail page already had its own `DisabledPurchaseCTA` from R3, regression-tested by `ServiceDetailCardOnly.test.tsx`. That test manually re-composes the page's pieces rather than rendering the actual page, so it would not have caught its removal — but removing already-shipped, tested UI with no explicit instruction to do so was judged out of scope for this stage. It was left in place, unmodified, and the new CardProduct section was **added** alongside it. Functionally this fully satisfies the task ("all UI purchase CTAs and details must be based on CardProduct" — the real card-scoped CTA is on the new Card Product Detail page); the old Service-level CTA remains exactly as inert as it always was.

## 4. Screens

1. **Services Landing** (`/services`) and **Category Page** (`/services/[categoryId]`) — both already existed in full from R1/R2 (category listing, loading/empty/error states) and needed no changes. Confirmed by reading both route files before starting; nothing was rebuilt.
2. **Service Detail** (`/services/[categoryId]/[serviceId]`) — extended with a new "محصولات این خدمت" section rendering the Service's real, ACTIVE CardProducts via a new `CardProductGrid`. This fetch is fully independent (own `useEffect`, own loading/error state) of the page's existing `service`/`categories` fetches — the same "each async section owns its own state" shape R3.1 already established for this exact page, so a slow/failed CardProduct fetch never blocks or blanks the rest of the page.
3. **Card Product List** — `CardProductGrid`/`CardProductCard`: reusable tile with cardType icon (no image resolution exists on this domain, see §6), title, `description || subtitle` fallback, a dynamically derived price string, a badge, and a "مشاهده جزئیات ←" CTA affordance. Whole-card click navigates to the detail route.
4. **Card Product Detail** (`/services/[categoryId]/[serviceId]/cards/[cardProductId]`, new route) — fetches the Service (for relationship validation) then the CardProduct, renders `CardProductHero` (title/image-icon/description/badge/price) + `CardProductInfo` (benefits, validity) + `DisabledCardPurchaseCTA` ("خرید کارت" + "به‌زودی" caption, does nothing when tapped).

## 5. Price Formatting — No Hardcoded Text

`cardProductPresentation.ts`'s `formatCardProductPrice()` is the single source for every price string rendered anywhere in this stage's UI:

```ts
if (card.priceLabel) return card.priceLabel;
if (card.priceAmount == null) return "قیمت اعلام نشده";
const amount = formatToman(card.priceAmount); // existing helper, ÷10 Rial→Toman + digit grouping
return card.cardType === "CREDIT_CARD" ? `تا سقف ${amount} اعتبار` : amount;
```

- `cardType === 'CREDIT_CARD'` → "تا سقف X تومان اعتبار" (a credit card's amount is a ceiling, matching `CreditLine.limitAmount`'s real meaning from the R5.2 pricing-domain work).
- Any other `cardType` → plain "X تومان".
- An Admin-set `priceLabel` always wins verbatim (matches R5.17's own admin-settable field).
- No `priceAmount`/`priceLabel` → "قیمت اعلام نشده", never a blank or fabricated figure.

Tested directly, including a "two different real amounts must produce two different output strings" assertion, ruling out an accidentally hardcoded literal.

## 6. Known, Documented Gaps (Not Fabricated)

- **No `imageKey → imageUrl` resolution exists anywhere in this codebase** for `Category`/`Service`/`CardProduct` (all three store a raw Storage key string only). This stage does not invent one — `CardProductCard`/`CardProductHero` render a `cardType` icon/emoji instead of an `<img>`, and this is explicitly tested (`expect(html).not.toContain("<img")`).
- **No `usageGuide`/`terms` field exists on the real `CardProduct` Prisma model** — only `benefits: Json` (string array) and `validityDays: Int?` are real, schema-backed "if available" fields. `CardProductInfo` renders only those two; a doc comment in the component and an explicit test (`CardProductDetailComposition.test.tsx`) assert neither "راهنمای استفاده" nor "شرایط و ضوابط" ever renders anywhere.

## 7. API

**No new backend endpoints were needed.** R5.16/R5.17 already expose the required public, read-only surface:
- `GET /api/v1/cards?serviceId=:id&limit=100` — server-side filtered to `status: 'ACTIVE'` only (confirmed in R5.17's `CardProductsService.list()`), so **no client-side re-filtering happens** in `CardProductGrid` — it trusts the server-provided list, and this trust is directly tested.
- `GET /api/v1/cards/:id` — used by the Card Product Detail route.

Both are called with `{ public: true }` via a new `cardProductsApi` object in `services-api.ts`, mirroring the existing `servicesApi`/`merchantsApi` shape exactly. No Admin endpoint is exposed or reachable from customer code.

## 8. Relationship Validation

A resource fetched by ID alone proves nothing about its URL ancestors (the same lesson R3/R4 established for `belongsToCategory`/`serviceReferencesMerchant`). A new `cardProductBelongsToService(cardProduct, serviceId)` check is applied identically: a real CardProduct that doesn't actually belong to the URL's `serviceId` is treated exactly like a 404, never rendered as if correctly related.

## 9. Tests

**Frontend only** (no backend changes this stage):
- `cardProductPresentation.test.ts` — 5 tests: `priceLabel` verbatim, fixed-amount phrasing, credit-max phrasing, "قیمت اعلام نشده" fallback, never-a-hardcoded-literal.
- `CardProductCard.test.tsx` — title/description/price/CTA rendering, no `<img>`, credit-vs-fixed phrasing, badge fallback.
- `CardProductGrid.test.tsx` — loading/error/empty/populated states, plus an explicit "trusts the server as already ACTIVE-only, no client re-filter" test.
- `CardProductDetailComposition.test.tsx` — full detail-page composition rendering (title/description/benefits/validity/price/disabled CTA), plus explicit negative assertions that no usage-guide/terms text ever appears, plus an all-empty-fields case rendering nothing.
- `serviceValidation.test.ts` (extended) — 2 new tests for `cardProductBelongsToService`.
- `cardProductsApi.test.ts` — proves `listByService`/`getCardProduct` call the real endpoints with the real query params, marked public.

**Results**: 21 suites / 100 tests passed (apps/web). No backend tests were affected — 187/187 unchanged from R5.17.

## 10. Quality Gates

- **Frontend**: `npm run typecheck` clean; `npm run lint` — 0 errors (10 pre-existing `<img>`-usage warnings in files this stage never touched, e.g. `CategoriesSection.tsx`, `ServiceMosaic.tsx`); `npm test` — 21/21 suites, 100/100 tests.
- **Backend**: unchanged, no files modified — R5.17's 187/187 tests and clean lint/typecheck still apply.
- **Workspace**: `npm run build` succeeded across all three apps; the new route `/services/[categoryId]/[serviceId]/cards/[cardProductId]` compiled as a dynamic (`ƒ`) page alongside the existing three `/services/**` routes.

## 11. Live Verification

Verified against a local dev stack (isolated local Postgres + Redis, real seeded catalog data — 108 services) using the existing dev-mode OTP auth bypass (`NODE_ENV=development`, fixed test phone/code) to log in as a real customer session, then navigating the actual rendered UI:
- Service Detail page's new "محصولات این خدمت" section rendered a real, seeded `CREDIT_CARD` CardProduct with correct Persian text and `"تا سقف 5,000,000 تومان اعتبار"` price formatting (50,000,000 Rial → 5,000,000 Toman, correct digit grouping, correct CREDIT_CARD phrasing).
- Clicking the card navigated to the real Card Product Detail route, which rendered title, description, price, both benefits, `"180 روز از فعال‌سازی"` validity, and the disabled `"خرید کارت"` CTA with its `"به‌زودی"` caption — doing nothing when tapped.
- No console errors or failed requests associated with any of the new routes/components; all `GET /cards`, `GET /cards/:id` calls returned 200 OK.
- No `usageGuide`/`terms` section rendered anywhere, confirming §6 visually as well as in tests.

## 12. What This Stage Deliberately Does Not Do

Matches the task's explicit constraints: no payment, order creation, wallet, credit issuance, installment logic, voucher issuance, merchant integration, or purchase execution. The "خرید کارت" CTA is inert by construction (a disabled `<Button>`), identical in spirit to every other visual-only CTA this engagement has shipped since R3.

## 13. Staging

No backend or schema changes this stage — nothing to migrate. The new frontend routes ship via the existing staging deploy process:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
```

No automatic deployment was performed as part of this stage, per the task's explicit instruction.
