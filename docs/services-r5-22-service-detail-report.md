# SERVICES-R5.22 — Service Detail Experience Finalization & Unified Media CMS — Report

Contract: [docs/services-r5-22-service-detail-contract.md](./services-r5-22-service-detail-contract.md). This report describes what was actually built, verified against the contract's plan.

## 1. Summary

Service is now a fully CMS-managed content entity: Admin can attach a main image, an optional gallery, a full description, benefits, tags, a usage guide, terms, and FAQ — all through the Media Library (never a raw storage key) and dedicated form fields (never a hand-typed JSON blob). The customer Service Detail page renders every one of those fields when present, and nothing when absent. Category and CardProduct gained the same Media Picker image relation. Analytics events now cover the full Category → Service → CardProduct discovery funnel. Verified end-to-end in a real browser session against a live Postgres/Redis backend, not just unit tests.

## 2. Files Changed

**Backend** (`backend/`):
- `prisma/schema.prisma` — additive fields on `Category`, `Service`, `CardProduct`, `MediaAsset` (see §3).
- `prisma/migrations/20260910131650_service_detail_media_unification/migration.sql` — the migration (additive only, applied via `prisma migrate deploy`).
- `src/modules/services/dto/service-faq-item.dto.ts` — new, validates `{question, answer}`.
- `src/modules/services/dto/create-service.dto.ts`, `update-service.dto.ts` — new fields: `mediaAssetId`, `galleryMediaAssetIds`, `description`, `faq` (`ServiceFaqItemDto[]`), `usageGuide`, `terms`.
- `src/modules/services/services.service.ts` — `MediaStorageService` injection, `withMedia()` resolves `image`/`gallery`; `create()`/`update()` stop dropping `faq`.
- `src/modules/categories/dto/create-category.dto.ts`, `update-category.dto.ts` — `mediaAssetId`.
- `src/modules/categories/categories.service.ts` — `withImage()` resolves `image` on every public/admin read.
- `src/modules/cards/dto/create-card-product.dto.ts`, `update-card-product.dto.ts` — `mediaAssetId`.
- `src/modules/cards/card-products.service.ts` — `withImage()`, same pattern.
- `src/modules/{categories,services,cards}.module.ts` — import `MediaModule`.
- Spec files updated for the new `MediaStorageService` dependency and new fixture fields; new media-resolution and `faq` CRUD test blocks added to `services.service.spec.ts`, `categories.service.spec.ts`, `card-products.service.spec.ts`.

**Admin** (`apps/admin/`):
- `src/features/catalog/types.ts` — `mediaAssetId`/`image` on `CategoryAdmin`/`CardProductAdmin`; `mediaAssetId`/`image`/`galleryMediaAssetIds`/`gallery`/`description`/`benefits`/`tags`/`usageGuide`/`terms`/`faq` on `ServiceAdmin`; matching `*Input` types; new `ServiceFaqItem` type.
- `src/features/catalog/categories/CategoryForm.tsx` — `MediaPickerField` replaces the plain `imageKey` input.
- `src/features/catalog/card-products/CardProductForm.tsx` — same.
- `src/features/catalog/services/ServiceForm.tsx` — `MediaPickerField` for the main image, a repeatable gallery section (each slot its own `MediaPickerField`), a `description` textarea, comma-joined inputs for benefits/tags/usage guide/terms, and a repeatable question/answer FAQ list.
- Matching `*.test.tsx` fixture/assertion updates.

**Web** (`apps/web/`):
- `src/lib/services-api.ts` — `ServiceDto` gains `image`/`gallery`/`description`/`usageGuide`/`terms`; `CardProductDto` gains `image`.
- `src/lib/home-api.ts` — `CategoryDto` gains `image`.
- `src/components/services/ServiceHero.tsx`, `CardProductHero.tsx` — render the real image when set, fall back to the existing icon otherwise.
- `src/components/services/CategoryHero.tsx` — renders a full-bleed photo with a dark scrim (matching the original prototype) when `category.image` is set; unchanged icon treatment otherwise.
- `src/components/services/ServiceDescription.tsx`, `ServiceUsageGuide.tsx`, `ServiceTerms.tsx` — new, each returns `null` when its field is empty.
- `src/app/services/[categoryId]/[serviceId]/page.tsx` — composes the three new sections between `ServiceInfo` and the CardProduct grid; fires `ServiceViewed` once the validated Service resolves.
- `src/app/categories/[slug]/page.tsx` — fires `CategoryViewed` once the Category resolves.
- `src/components/services/CardProductGrid.tsx` — fires `CardProductViewed` per card on mount (mirrors `CategoryCardGrid`).
- `src/lib/analytics.ts` — `AnalyticsEvent` union extended (see §6).
- New test files: `ServiceHero.test.tsx`, `CardProductHero.test.tsx`, `ServiceDescription.test.tsx`, `ServiceUsageGuide.test.tsx`, `ServiceTerms.test.tsx`; existing fixture files updated for the new DTO fields.

## 3. Schema Changes (additive only)

```
categories.mediaAssetId    TEXT NULL, FK -> media_assets(id) ON DELETE SET NULL
services.mediaAssetId      TEXT NULL, FK -> media_assets(id) ON DELETE SET NULL
services.galleryMediaAssetIds JSONB NOT NULL DEFAULT '[]'
services.description       TEXT NULL
services.usageGuide        JSONB NOT NULL DEFAULT '[]'
services.terms             JSONB NOT NULL DEFAULT '[]'
card_products.mediaAssetId TEXT NULL, FK -> media_assets(id) ON DELETE SET NULL
```

No existing column altered, dropped, or backfilled. `Service.faq` already existed on the schema (R1) — no schema change there, only its write path. `imageKey` on all three models stays, deprecated in place (still read by the legacy `CATEGORY_ICON` fallback and any pre-existing raw-key rows). Migration created via the established `prisma migrate diff` → hand-placed migration folder → `prisma migrate deploy` workflow (interactive `migrate dev` is not available in this environment) and verified applied.

## 4. API Changes

- `POST/PUT /admin/services`, `/admin/categories`, `/admin/cards` — DTOs accept the new fields (see §2). All backward compatible; nothing existing was removed or renamed.
- `GET /services`, `GET /services/:id`, `GET /categories`, `GET /categories/:id`, `GET /categories/slug/:slug`, `GET /cards`, `GET /cards/:id` (public and admin) — response objects gain `image` (and `gallery` for Service) as a real, backend-resolved public URL or `null`. Every previously-returned field is unchanged; the raw `mediaAsset` join object is stripped before the response leaves the service (never leaks a storage key). This is an additive response change, not a breaking one.

## 5. Admin Changes

`CategoryForm`, `ServiceForm`, `CardProductForm` each replaced their plain-text `imageKey` input with `MediaPickerField` (upload/browse/preview/remove, backed by the existing Media Library). `ServiceForm` additionally gained: a repeatable gallery of `MediaPickerField` slots, a full-description textarea, comma-joined fields for benefits/tags/usage-guide/terms (matching `CategoryForm`'s existing `keywords` convention), and a repeatable question/answer FAQ list. No admin-facing field anywhere shows `mediaAssetId`/`imageKey`/a storage key — only the resolved preview image.

**Verified live**: logged into Admin, created a real Service ("خرید پوشاک") with an image selected from the Media Library, three benefits, one FAQ pair, a description, and a three-step usage guide. `POST /admin/services` returned `201`; re-fetching the same record confirmed every field persisted exactly as entered, including `faq` — the field that was previously silently discarded.

## 6. Customer UI Changes

`ServiceHero`/`CardProductHero` render the real image when set, the existing icon otherwise. `CategoryHero` renders a full-bleed photo under a dark gradient scrim (matching the original prototype's design, deferred since R1) when a Category has one, and is visually unchanged for every Category without one. Three new sections — description, usage guide, terms — sit between `ServiceInfo` and the CardProduct grid on Service Detail, each rendering nothing when its field is empty.

**Verified live**: logged in as a real customer (OTP), navigated to the Service created above, and confirmed the rendered page showed the real image (loaded, `200 OK`), the three benefits, the FAQ question, the description text, and the three-step numbered usage guide — with no terms section, correctly, since none were set. The CardProduct grid correctly showed its real empty state (no cards registered yet for that Service).

## 7. Media Architecture

Every visual entity now follows the identical pipeline already proven for Home CMS and `CategoryCard`: `Entity.mediaAssetId → MediaAsset → MediaStorageService.resolvePublicUrl(key)`, resolved server-side, never a raw key sent to a client. `Service.galleryMediaAssetIds` is a plain JSON array of `MediaAsset` ids (not a join table), resolved with one extra `MediaAsset.findMany` per read since it isn't a real Prisma relation; a gallery id whose `MediaAsset` no longer exists is silently dropped from the resolved list rather than producing a broken image URL. No admin form anywhere in the catalog still exposes a raw storage key for editing.

## 8. Analytics Implementation

`AnalyticsEvent` (still a placeholder `console.info` sink in non-production, no real vendor — unchanged mechanism) gained: `CategoryViewed` (fires once, Category Landing mount), `ServiceViewed` (fires once, Service Detail mount — only after the Service is confirmed to belong to the URL's Category), `CardProductViewed` (fires per card, `CardProductGrid` mount, mirroring `CategoryCardGrid`'s existing `CategoryCardViewed` pattern exactly). `PurchaseCTAClicked` is declared in the type union for a future real purchase button but has **no call site today**: the app's only purchase-adjacent controls (`DisabledPurchaseCTA`, `DisabledCardPurchaseCTA`) are genuine, native `disabled` HTML buttons, which never fire `onClick` — wiring the event to a wrapping element or the caption text would misrepresent what the user actually clicked. This is a deliberate, documented gap, not an oversight.

## 9. Validation Helpers (Phase 5) — Re-confirmed, Not Rebuilt

`belongsToCategory` (R3), `cardProductBelongsToService` (R5.18), `categoryCardServiceDetailHref` + `CategoryCardsService.assertOwnership` (R5.21) were re-read this stage and confirmed still correctly enforce Category → CategoryCard → Service → CardProduct ownership, both client-side (never renders a mismatched entity) and server-side (the real, unbypassable check). No orphan-navigation gap was found. No new code was needed or written for this phase.

## 10. Tests

- **Backend**: 245 tests passing (up from 234 before this stage), including new coverage for image/gallery resolution on `Category`/`Service`/`CardProduct` (present and absent), and `Service.faq` CRUD through `create()`/`update()` — proving the previously-hardcoded `faq: []` gap is genuinely closed, and that `update()` never clears `faq` when a client omits it from the payload.
- **Admin**: 84 tests passing, including updated `ServiceForm`/`CategoryForm`/`CardProductForm` fixtures and new assertions on the media picker preview, description, comma-joined lists, and FAQ rows.
- **Web**: 138 tests passing (up from 134), including new dedicated tests for `ServiceHero`/`CardProductHero`'s image-vs-fallback branches, and `ServiceDescription`/`ServiceUsageGuide`/`ServiceTerms`'s present/absent rendering.
- **Manual/browser verification**: full Admin create → persist → re-fetch round trip, and full Customer Service Detail render, both against a live backend/Postgres/Redis stack (see §5/§6).

## 11. Quality Gates

All green — backend, admin, web (`typecheck`/`lint`/`test`/`build` each), plus the full workspace `pnpm test`/`pnpm build`/`pnpm lint`/`pnpm typecheck` via Turbo. No errors anywhere; only pre-existing `@next/next/no-img-element` warnings (this codebase's established plain-`<img>` convention throughout, unchanged by this stage).

## 12. Known Limitations

- No lightbox/carousel exists for `Service.gallery` yet — the resolved URLs are available on the DTO, but nothing renders them beyond the single main image, since `packages/ui` has no such primitive and no real Service has more than one gallery image today. Deferred, not fabricated.
- `PurchaseCTAClicked` has no real call site (see §8) — correctly incomplete until a real, enabled purchase control exists.
- Two Categories (via the untracked `categories/` folder of sourced photos from R5.20) still have no `mediaAssetId` set — Admin can now set one through the Media Picker, but none was set as part of this stage's own work (out of scope: this stage built the capability, not a data-entry pass).
- No real analytics vendor — unchanged from R5.21, explicitly out of scope.

## 13. Next Recommended Stage

Payment/purchase implementation (the explicit non-goal of this stage) is now the natural next step: `Order → payment → CardInstance` issuance, replacing `DisabledPurchaseCTA`/`DisabledCardPurchaseCTA` with a real, enabled control — which is also the first point where `PurchaseCTAClicked` can be honestly wired to a real click.

---

**Deployment**: not run automatically per instruction. To deploy to staging after review:

```bash
cd /srv/biawin-staging && ./deploy/staging/deploy.sh
```
