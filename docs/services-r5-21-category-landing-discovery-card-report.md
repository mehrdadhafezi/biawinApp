# SERVICES-R5.21 — Category Landing & Discovery Card CMS Foundation — Report

See `docs/services-r5-21-category-landing-discovery-card-contract.md` for the pre-implementation audit and design contract this report confirms was built as planned (one deliberate scope note in §6 below).

## 1. Baseline

- Starting commit: `563d319` (`fix(qa): remove hardcoded category/service counts from browser QA`).
- Builds directly on the R5.20 audit (`docs/stage-5.20-category-experience-card-catalog-audit.md`), which found 14 real, unused discovery-card photo assets and concluded the missing piece was a `CategoryCard` model reusable across Category and Service — exactly this stage's scope.

## 2. Schema (additive only, verified)

Migration `20260910081853_category_card_landing_foundation`, generated via `prisma migrate diff` + a hand-written migration folder (`prisma migrate dev` refuses non-interactive execution, same fallback every prior stage used) and applied with `prisma migrate deploy`:

```sql
ALTER TABLE "categories" ADD COLUMN "slug" TEXT;
CREATE TABLE "category_cards" ( ... );
CREATE INDEX "category_cards_categoryId_active_sortOrder_idx" ...
CREATE INDEX "category_cards_targetServiceId_idx" ...
CREATE UNIQUE INDEX "categories_slug_key" ...
ALTER TABLE "category_cards" ADD CONSTRAINT ... FOREIGN KEY ("categoryId") ...
ALTER TABLE "category_cards" ADD CONSTRAINT ... FOREIGN KEY ("targetServiceId") ...
ALTER TABLE "category_cards" ADD CONSTRAINT ... FOREIGN KEY ("mediaAssetId") ...
ALTER TABLE "category_cards" ADD CONSTRAINT ... FOREIGN KEY ("createdBy") ...
ALTER TABLE "category_cards" ADD CONSTRAINT ... FOREIGN KEY ("updatedBy") ...
```

No existing column altered or dropped. `CategoryCard` has **no FK to `CardProduct` anywhere** — verified structurally (§5) and by a dedicated test.

## 3. Backend

New module `backend/src/modules/category-cards/` (service, public controller, admin controller, DTOs), mirroring `CategoriesAdminController`/`HomeServiceBannersService` exactly:

- **Public**: `GET /category-cards?categoryId=X` (`active: true`-only, matches `GET /cards`'s filtering discipline), `GET /categories/slug/:slug` (new, additive route on the existing `CategoriesController` — `GET /categories/:id` untouched).
- **Admin** (`/admin/category-cards`): list/detail open to any admin; `POST`/`PUT`/`PATCH reorder` require `SUPER_ADMIN`/`CONTENT_EDITOR`. No `DELETE` — `active` is the removal mechanism, matching Category/Service/CardProduct's own convention.
- **Ownership validation**: `CategoryCardsService.assertOwnership()` re-fetches the real Category and Service rows and rejects (422) a `targetServiceId` that doesn't belong to the given `categoryId` — verified live (curl) and by 6 dedicated unit tests, including re-validation on partial updates.
- **Audit logging**: every mutation calls `AdminAuditLogService.record()` with `resourceType: 'CategoryCard'`.
- **Image resolution**: reuses `MediaStorageService`/`resolveMediaUrl()` verbatim — the first catalog-domain model (Category/Service/CardProduct's own `imageKey` gap is untouched, out of scope) to get a real, resolved image URL.

## 4. Admin CMS

- New nav item "کارت‌های دسته‌بندی" under Catalog, positioned directly after "دسته‌بندی‌ها" (`AdminSidebar.tsx`), plus a `CatalogOverview` summary card.
- `CategoryCardsListContent.tsx` (reorder + boolean `ActiveToggle`, mirrors `CategoriesListContent.tsx`) and `CategoryCardForm.tsx` (mirrors `ServiceBannerForm.tsx`'s `MediaPickerField` wiring) at `/catalog/category-cards`, `/new`, `/[id]`.
- `ServiceSelect` extended with an optional `categoryId` prop (backward-compatible — `ServiceForm.tsx`'s existing usage is unaffected) so the target-Service dropdown only ever offers Services from the currently-selected Category — a UI convenience; the real rule is still enforced server-side regardless.
- **RBAC boundary verified structurally, not just by convention**: `CreateCategoryCardDto`/`UpdateCategoryCardDto` contain only `categoryId, targetServiceId, title, subtitle, badge, mediaAssetId, highlights, sortOrder, active` — a dedicated test (`category-card-dto-shape.spec.ts`) introspects the DTO classes' real `class-validator` metadata and asserts none of `priceAmount/valueAmount/priceLabel/status/cardType/journeyType/cardProductId/validityDays/providerConfig` exist on either.

## 5. Frontend (Category Landing)

- New route `apps/web/src/app/categories/[slug]/page.tsx` — additive, does not touch `/services/[categoryId]` (still the full browse/search/filter experience, completely unaffected).
- `CategoryHero` (existing component) reused verbatim; new `CategoryCardGrid` (mirrors `CardProductGrid`'s loading/error/empty/populated states, trusts server-side `active`-filtering) and `CategoryCard` (the Discovery Card — real resolved photo or an honest 🔎 fallback, never a fabricated image, badge/title/subtitle/up-to-2-highlights, no price, no purchase CTA).
- Click → `categoryCardServiceDetailHref()` (a new pure function in `serviceValidation.ts`, same pattern as `belongsToCategory`/`cardProductBelongsToService`) → the **existing** `/services/[categoryId]/[serviceId]` route. No new route invented for the destination.

## 6. Deliberate Adjustment From the Contract

The contract (§5) anticipated a `categoryCardBelongsToCategory()` relationship-validation helper mirroring `cardProductBelongsToService`. On implementation, no standalone "fetch one CategoryCard by id" customer-facing endpoint exists or was needed — the Landing page only ever fetches the server-filtered list (`categoryId`-scoped, same trust model as `CardProductGrid`). Adding an unused validation function would have been a premature abstraction with no real caller, so it was not built — noted here rather than silently dropped.

## 7. Analytics Foundation

`apps/web/src/lib/analytics.ts` — typed `AnalyticsEvent` union (`CategoryCardViewed`, `CategoryCardClicked`) + `trackEvent()`. No real vendor connected (none exists anywhere in this codebase); the sink is a `console.info` placeholder in non-production, explicitly documented as such. Real call sites: `CategoryCardGrid` fires `CategoryCardViewed` once per card on mount; the Landing page's click handler fires `CategoryCardClicked` before navigating.

## 8. Tests

- **Backend**: 234/234 passing (44→46 suites, +24 net new tests) — `category-cards.service.spec.ts` (20 tests: public filtering, image resolution, ownership validation incl. re-validation on update, audit logging, reorder), `category-card-dto-shape.spec.ts` (3 tests), `categories.service.spec.ts` (+2, slug resolution), `catalog-admin-permissions.spec.ts` (extended with `CategoryCardsAdminController`).
- **Admin**: 83/83 passing (+13) — `CategoryCardForm.test.tsx`, `CategoryCardsListContent.test.tsx` (RBAC wiring), `CategoryForm.test.tsx` (+2, slug field).
- **Web**: 122/122 passing (+19) — `CategoryCard.test.tsx`, `CategoryCardGrid.test.tsx`, `CategoryLandingComposition.test.tsx`, `analytics.test.ts`, `serviceValidation.test.ts` (+2, navigation target).

## 9. Quality Gates

Backend (`prisma validate`/`generate` ✓, `tsc` ✓, `eslint` ✓ 0 errors, `jest` 234/234), Admin (`tsc` ✓, `jest` 83/83, no regression), Web (`tsc` ✓, `eslint` ✓ 0 errors — 11 pre-existing/consistent `<img>` warnings, `jest` 122/122), workspace `build` ✓ (all 3 apps compiled, new routes present: `/categories/[slug]`, `/catalog/category-cards[/new][/[id]]`).

## 10. Live Verification (local backend + real Postgres, not staging)

Full real flow exercised end-to-end, not just unit-tested:
1. Set a real slug (`poushak`) on the real `پوشاک` Category via the real Admin API.
2. Created a real `CategoryCard` ("کیف و کفش" → target Service "کفش", both real rows) via the real Admin API.
3. Confirmed ownership rejection live: a cross-category Service → real `422`.
4. Confirmed `GET /categories/slug/poushak` → 200 with the real Category; `GET /categories/slug/does-not-exist` → real `404`.
5. Confirmed `GET /category-cards?categoryId=...` returns the correctly-shaped public payload (no admin fields leaked).
6. **Admin CMS in the browser**: logged in as the real seeded SUPER_ADMIN, the Category Cards list correctly showed the real card with resolved Category/Service names and the reorder/active controls; the edit form correctly pre-filled every field, with the target-Service dropdown correctly scoped to `پوشاک`'s real Services only.
7. **Customer app in the browser**: logged in via the real dev-mode OTP bypass, navigated to `/categories/poushak` — the real Category Hero and the real Discovery Card (badge, title, subtitle, both highlights, 🔎 fallback icon since no image was uploaded) rendered correctly; clicking the card navigated to the real `/services/{categoryId}/{serviceId}` Service Detail page for "کفش", showing correct real data throughout. No console errors or failed requests associated with any new endpoint (all 200s, verified via network log).

## 11. Backward Compatibility

`/services/[categoryId]` and every other pre-existing Services route/component are untouched. `ServiceSelect`'s new `categoryId` prop is optional and backward-compatible with its existing `ServiceForm.tsx` usage. No existing DTO/endpoint behavior changed — every addition is a new field, new table, or new route.

## 12. Known Gaps / Next Decisions

- No real Category has a slug set except the one created for this verification (`poushak`) — every other real Category's Landing route 404s until Admin sets one, an honest reflection of real state, not a bug.
- `Category`/`Service`/`CardProduct`'s own `imageKey`→URL gap is untouched — only the new `CategoryCard` model has a working image pipeline this stage.
- Analytics events are logged locally only (no real vendor) — swapping `trackEvent`'s sink is a one-function change whenever a vendor is chosen.

## 13. Staging Deployment

Additive migration — the existing staging deploy pipeline already runs `prisma migrate deploy`:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
```

No automatic deployment was performed as part of this stage.
