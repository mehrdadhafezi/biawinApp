# SERVICES-R5.22 — Service Detail Experience Finalization & Unified Media CMS — Contract

## 1. Audit — Frontend (`apps/web/src/app/services/[categoryId]/[serviceId]`)

Read in full, plus every component it composes (`ServiceHero`, `ServiceDetailCardSummary`, `Pricing`, `ServiceInfo`, `CardProductGrid`/`CardProductCard`, `MerchantLinkCTA`, `DisabledPurchaseCTA`, and the CardProduct Detail sub-route's `CardProductHero`/`CardProductInfo`).

**Already correct, not touched this stage:**
- Relationship validation (`belongsToCategory`), independent per-section loading/error state (R3/R3.1 discipline), CardProduct grid already wired to the real `GET /cards?serviceId=` (R5.18), the disabled purchase CTA pattern (real `disabled` button + visible caption, never a silently-dead live-looking button).
- `ServiceInfo.tsx` **already renders** `Service.benefits` ("مزایا") and `Service.faq` ("سوالات متداول") from real schema fields — these are not new UI, only a new **Admin write path** is missing (below).
- `CardProductInfo.tsx`'s own doc comment already correctly documents that no `usageGuide`/`terms` field exists on `CardProduct` — confirmed still true; this stage does not add one to `CardProduct` (see §3, that content moves to `Service`).

**Real, confirmed gaps:**
- No real image renders anywhere in this page tree. `ServiceHero`/`CardProductHero`'s own doc comments both say so explicitly: *"No `imageUrl` resolution exists for `Service.imageKey` yet... this shows the icon emoji as a large fallback."* Same for `CardProductCard`/`CardProductHero`. `CategoryHero` (Services-module, R1) shows one of 6 **generic, reused, static prototype icons** (`CATEGORY_ICON` map), never a real per-category photo — its own doc comment explicitly names this as a deferred decision, pending real photography (R5.20 sourced 14 real candidate photos; still unused).
- No long-form `description` field exists on `Service` — only `subtitle` (short). Confirmed by `ServiceDetailCardSummary`'s own comment: *"the DTO has no separate long-form description field."*
- No "usage guide" or "terms" field exists on `Service` OR `CardProduct` anywhere in the schema.
- `Service.faq` **exists on the schema and is rendered**, but has **no admin write path at all** — confirmed by reading `CreateServiceDto`/`UpdateServiceDto` (neither declares `faq`) and `ServicesService.create()` (hardcodes `faq: []` unconditionally). A Content Editor cannot set FAQ today through any UI or documented API.
- `Service.benefits`/`galleryKeys`/`tags` **are** already accepted by the backend DTOs (`CreateServiceDto`/`UpdateServiceDto`) — but `ServiceForm.tsx` (Admin) has **no fields for any of them**. Same class of gap as FAQ, one layer higher: the backend is ready, the Admin UI simply never asks for it.

## 2. Audit — Admin CMS

`CategoryForm.tsx`, `ServiceForm.tsx`, `CardProductForm.tsx`, `CategoryCardForm.tsx` read in full.

| Field | Category | Service | CardProduct | CategoryCard |
|---|---|---|---|---|
| Image | plain `imageKey` text input | plain `imageKey` text input | plain `imageKey` text input | **`MediaPickerField` (R5.21)** ✅ |
| Benefits/highlights | — | ❌ not in form (backend ready) | n/a (has its own `benefits`, already in form since R5.17) | ✅ (R5.21) |
| FAQ | n/a | ❌ not in form, **not in backend DTO either** | n/a | n/a |
| Description (long) | n/a | ❌ field doesn't exist | has `description` already (R5.17) | n/a |
| Usage guide / Terms | n/a | ❌ field doesn't exist | ❌ field doesn't exist | n/a |

**Conclusion**: `CategoryCardForm.tsx` (R5.21) is the only form in this codebase already fully aligned with this stage's "no raw storage keys, use the Media Picker" requirement. Every other catalog form still exposes a raw `imageKey` text box — this is the concrete, per-form work item for Phase 2.

## 3. Audit — Media System

`MediaAsset` (Stage 5.18), `MediaStorageService.resolvePublicUrl()`, `resolveMediaUrl()` helper, `MediaPickerField`/`MediaPickerModal` (Admin) — all real, proven, already used by 4 Home CMS models and `CategoryCard` (R5.21). This is the **only** real image pipeline in the codebase; nothing new needs to be invented, only **extended** to three more models: `Category`, `Service`, `CardProduct`.

`Service.galleryKeys: Json` already exists (raw string-key array) but is **rendered nowhere** — confirmed by `ServiceHero`'s own comment ("no image gallery is rendered... this stage's component tree doesn't include one either"). This stage's "optional gallery" requirement is genuinely new UI, not a hidden pre-existing feature.

## 4. Decisions

### 4.1 Schema (additive only)

- `Category.mediaAssetId: String?` (+ FK) — hero image. `Category.imageKey` (raw) stays, deprecated in place (same caution R5.21 used for `Category.imageKey` vs `.slug` — never remove a field with a caller unless verified unused; here it's genuinely still read by the old `CATEGORY_ICON` fallback path in `serviceCategoryVisual.ts`, so it stays).
- `Service.mediaAssetId: String?` (+ FK) — main image.
- `Service.galleryMediaAssetIds: Json @default("[]")` — an array of `MediaAsset` ids (not a new join table — mirrors the existing `benefits`/`tags`/`CategoryCard.highlights` "flexible short list as JSON" convention already used throughout this schema, avoiding a new relational model for a feature with zero real content today).
- `Service.description: String?` — the "Full Description" the task asks for; `subtitle` remains the short description (already labeled as such in the Admin form: "زیرعنوان (توضیح کوتاه)"), unrenamed, zero blast radius to existing callers.
- `Service.usageGuide: Json @default("[]")` — array of strings (repeatable steps, e.g. "۱. خرید کارت", "۲. ورود به سایت مقصد" — the Admin form supplies the numbering visually, the stored data is a plain ordered string array, matching `benefits`' own shape).
- `Service.terms: Json @default("[]")` — array of strings, same shape as `MembershipPlan.terms` (an existing, real precedent for exactly this field name/shape on a different model).
- `CardProduct.mediaAssetId: String?` (+ FK) — product/card image. `CardProduct.imageKey` stays, deprecated in place, same reasoning.
- `Service.faq` — **no schema change** (already exists); only the DTO/service-layer write path is added (§4.2).

No existing column is alted or removed. Every addition is nullable or defaults to an empty array — zero backfill, zero risk to the real 108-service/19-category/~1-CategoryCard seeded data.

### 4.2 Backend

- `CreateServiceDto`/`UpdateServiceDto` gain: `mediaAssetId`, `galleryMediaAssetIds` (validated as an array of strings), `description`, `usageGuide` (array of strings), `terms` (array of strings), and — closing the confirmed gap — `faq` (validated as an array of `{question, answer}` objects, matching the shape `ServiceInfo.tsx` already renders).
- `ServicesService.create()`/`.update()` stop hardcoding `faq: []` and pass every new field through, mirroring `CategoryCardsService`'s established `{...dto}` spread pattern.
- `ServicesService`'s public `list()`/`findOneOrThrow()` responses gain resolved `image`/`gallery` URLs (via `MediaStorageService`, same as `CategoryCardsService`) — `imageKey`/`mediaAssetId` themselves are never sent to the customer app; only the resolved URL is (matching R5.21's public-vs-admin response-shape split).
- Same `image` resolution pattern added to `CategoriesService` (public `list()`/`findOneOrThrow()`/`findBySlugOrThrow()`) and `CardProductsService` (public `list()`/`findOneOrThrow()`).
- `CategoriesAdminController`/`ServicesAdminController`/`CardProductsAdminController` gain no new routes — only their existing DTOs grow, same RBAC (`SUPER_ADMIN`/`CONTENT_EDITOR` write, any admin read) already in place.

### 4.3 Admin CMS

- `CategoryForm.tsx`, `ServiceForm.tsx`, `CardProductForm.tsx` each get a `MediaPickerField` (imported cross-feature from `features/home/components/`, the exact `CategoryCardForm.tsx` precedent), **replacing** the visible plain-text `imageKey` input (the raw field is dropped from the form, not the schema — an Admin who already set a raw key keeps it working via the still-live fallback path, but cannot set a new one through the UI, matching this stage's explicit "never show imageKey/storageKey" requirement).
- `ServiceForm.tsx` gains: a gallery variant of the Media Picker (multi-select, reusing `MediaPickerModal`'s selection UI — see §7 for the minimal extension needed), a `description` textarea, repeatable-string inputs for `benefits`/`tags`/`usageGuide`/`terms` (same comma-joined-textarea convention `CategoryForm.tsx`'s `keywords` field already uses), and a repeatable question/answer pair list for `faq`.
- No new nav items — `CategoryForm`/`ServiceForm`/`CardProductForm` already have their own pages; this is content added to existing forms, not new routes.

### 4.4 Frontend (Customer)

- `ServiceHero` renders the real resolved image when `image` is set, falling back to the existing `icon` emoji otherwise (never fabricated) — same for `CardProductHero`/`CategoryHero` (the last one finally answering its own R1-era deferred-decision comment, only for a Category that actually has a real image set — every Category without one keeps the existing icon system unchanged).
- New `ServiceDescription`, `ServiceUsageGuide`, `ServiceTerms` presentational components (each returns `null` when its field is empty — same "no content, no section" discipline `ServiceInfo` already follows), inserted into the existing Service Detail composition between `ServiceInfo` and `DisabledPurchaseCTA`.
- `Service.faq` already renders via `ServiceInfo` — unchanged.
- No new routes. No change to the CardProduct Detail sub-route's own scope (still correctly has no `usageGuide`/`terms` — that content lives on `Service`, per §4.1's decision).

### 4.5 Validation Helpers (Phase 5)

Category → CategoryCard → Service and Service → CardProduct ownership checks are **already fully built** (R3's `belongsToCategory`, R5.18's `cardProductBelongsToService`, R5.21's `categoryCardServiceDetailHref` + `CategoryCardsService.assertOwnership` server-side). This phase is a verification pass, not new code — confirmed no orphan-navigation gap exists today; documented as re-confirmed in the final report rather than re-implemented.

### 4.6 Analytics (Phase 6)

R5.21 already built the foundation (`apps/web/src/lib/analytics.ts`, typed `AnalyticsEvent` union, placeholder console sink, no vendor). This stage **extends the union**, not the mechanism: adds `CategoryViewed`, `ServiceViewed`, `CardProductViewed`, `PurchaseCTAClicked` alongside the existing `CategoryCardViewed`/`CategoryCardClicked`. Renamed to `trackEvent()` call sites added at: Category Landing mount (`CategoryViewed`), Service Detail mount (`ServiceViewed`), `CardProductGrid` mount per card (`CardProductViewed`, mirrors `CategoryCardGrid`'s existing pattern exactly), and both disabled-CTA components' click handlers (`PurchaseCTAClicked` — fired even though the button is disabled-in-appearance-only is wrong; **fired only where a real tap can reach the handler**, i.e. never on a truly `disabled` HTML button, which cannot fire `onClick` at all — see the report for how this is resolved without lying about what was clicked).

## 5. What This Stage Deliberately Does Not Do

No payment/purchase logic (unchanged, explicit non-goal). No real analytics vendor. No CardProduct gallery (not requested — only Service has one). No removal of any existing `imageKey` column or fallback path. No change to `cardOnly` vs. full-mode (flagged as an open, unresolved product decision since R1 — still not this stage's to resolve).

## 6. Tests (planned)

Backend: media-relation resolution (image URL present/absent), `Service` CRUD with all new fields (incl. `faq`), permission checks (existing RBAC pattern, extended DTO shape), audit log content, ownership validation (re-confirmed, not re-built). Admin: Media Picker wiring per form, repeatable-field persistence, RBAC. Web: Service Detail rendering (image/description/usage-guide/terms/FAQ present and absent), CardProduct loading unchanged, navigation validation re-confirmed, analytics event call sites.

## 7. Quality Gates

Backend/Admin/Web: `typecheck`, `lint`, `test`, `build` each, plus a full workspace `build` — identical bar to every prior stage.

---

**This document describes the plan. Implementation follows immediately after.**
