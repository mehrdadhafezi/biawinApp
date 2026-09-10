# SERVICES-R5.21 — Category Landing & Discovery Card CMS Foundation — Contract

## 1. Audit Summary (pre-implementation)

Verified directly against the real schema/source before writing this contract:

- **Category** (`backend/prisma/schema.prisma`): `id, name (unique), description, imageKey (raw string, no resolver), keywords (Json), sortOrder, active, createdBy/updatedBy → AdminUser`. No `slug` field exists. Admin-managed since R5.17 (`CategoriesAdminController`/`CategoriesService`, RBAC: any admin reads, `SUPER_ADMIN`/`CONTENT_EDITOR` write).
- **Service**: `id, categoryId → Category, merchantId?, title, ..., imageKey (raw, no resolver), active, createdBy/updatedBy`. Admin-managed since R5.17, identical RBAC shape.
- **CardProduct** (R5.16–R5.19): purchasable object, `serviceId → Service`, `priceAmount`/`valueAmount` (payable price vs. displayed value — R5.19's resolved distinction), `status: CardProductStatus`. Purchase path (`OrdersService`) fully built R5.19, disabled customer CTA per R5.18.
- **MediaAsset** (Stage 5.18) + `MediaStorageService.resolvePublicUrl()` + `resolveMediaUrl()` helper (`backend/src/modules/home/home-media.util.ts`): the ONLY real, working image-serving mechanism in this codebase. `Category`/`Service`/`CardProduct` still use the old raw-`imageKey`-with-no-resolver shape; only Home CMS's 4 models (`HomeHeroCard`, `HomeServiceBanner`, `HomeServiceMosaicTile`, `HomeNewsArticle`) have been migrated to real `mediaAssetId` FKs.
- **Admin CMS pattern** (`CategoriesAdminController`/`CategoriesService`, `HomeServiceBannersService`, `CardProductsAdminController`): `@Public() @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)` on the controller; list/detail open to any authenticated admin; `@AdminRoles(SUPER_ADMIN, CONTENT_EDITOR)` on every mutation; every create/update/reorder calls `AdminAuditLogService.record()` (append-only, never throws, `resourceType` + before/after JSON snapshot); `createdBy`/`updatedBy` stamped from `@CurrentAdminUser()`. No hard-delete exists anywhere in the catalog domain — `active` is the sole removal mechanism (R5.17's own documented convention).
- **Admin frontend pattern**: `CatalogListTable` (shared table chrome, `renderStatus` slot) + `ActiveToggle`/reorder-arrows (from `features/home/logic.ts`, reused cross-feature) for Category/Service; `MediaPickerField` (`features/home/components/`, already proven in `ServiceBannerForm.tsx`) is the real, working image-upload UI — cross-feature imports from `features/home/**` into `features/catalog/**` are an established convention (`CategorySelect`, `FormField`, `HomeFormShell`, `performSave` are already imported this way by `ServiceForm.tsx`).
- **Frontend Services module**: `/services`, `/services/[categoryId]`, `/services/[categoryId]/[serviceId]`, `.../cards/[cardProductId]` all exist and work (R1–R5.20). `useServiceCatalog()` fetches all Categories/Services client-side. No analytics/tracking infrastructure exists anywhere in `apps/web` today (verified — zero matches for `analytics`/`trackEvent`/`gtag` etc.).
- **R5.20 finding this stage directly answers**: `docs/stage-5.20-category-experience-card-catalog-audit.md` found 14 real, unused photo-card assets (`/categories/*.jpeg`) mapping to a mix of real Categories and real Services, and concluded a "spotlight/discovery card" concept — reusable across Category and Service — was the missing piece, needing a `mediaAssetId` FK + short marketing copy neither model has today. `CategoryCard` (this stage) is exactly that missing model, scoped and named per this stage's explicit spec.

## 2. Domain Model

```
Category
   |
CategoryCard  (discovery/marketing card — NOT purchasable)
   |
Service
   |
CardProduct   (the only purchasable object — R5.16–R5.19, unchanged)
```

`CategoryCard` is a **presentation-layer pointer**: it belongs to one `Category` and points at one `Service` within that same Category (an "ownership" relationship enforced server-side, not just implied). It carries no price, no purchase state, and **no FK to `CardProduct` at all** — clicking a CategoryCard navigates to Service Detail (where the real, already-built CardProduct purchase flow lives), it never short-circuits into a purchase itself.

### Schema (additive only)

```prisma
model Category {
  // ...unchanged fields...
  /// SERVICES-R5.21 — public, human-readable URL identifier for the new
  /// Category Landing route (/categories/[slug]). Nullable + unique:
  /// nullable because no fabricated slug is backfilled onto the 19 real
  /// existing rows (same "no fictional data" discipline as `priceFrom`/
  /// `priceAmount` elsewhere) — Admin sets it per-Category, same as any
  /// other content field. A Category with no slug set simply has no
  /// Landing route yet; its existing /services/[categoryId] page is
  /// completely unaffected either way.
  slug String? @unique
  categoryCards CategoryCard[]
}

model Service {
  // ...unchanged fields...
  categoryCardTargets CategoryCard[] @relation("CategoryCardTargetService")
}

model CategoryCard {
  id              String   @id @default(uuid())
  categoryId      String
  category        Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  targetServiceId String
  targetService   Service  @relation("CategoryCardTargetService", fields: [targetServiceId], references: [id], onDelete: Restrict)
  title           String
  subtitle        String?
  badge           String?
  mediaAssetId    String?
  mediaAsset      MediaAsset? @relation(fields: [mediaAssetId], references: [id], onDelete: SetNull)
  /// Short marketing bullets (R5.20 finding: real cards use exactly 2,
  /// hand-written, never templated) — Json string[], capped at 2 by the
  /// Admin form, not the database (room to change the count later with no
  /// migration, matching `Service.benefits`'s own precedent).
  highlights      Json     @default("[]")
  sortOrder       Int      @default(0)
  active          Boolean  @default(true)

  createdBy      String?
  createdByAdmin AdminUser? @relation("CategoryCardCreatedBy", fields: [createdBy], references: [id], onDelete: SetNull)
  updatedBy      String?
  updatedByAdmin AdminUser? @relation("CategoryCardUpdatedBy", fields: [updatedBy], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([categoryId, active, sortOrder])
  @@index([targetServiceId])
  @@map("category_cards")
}

model MediaAsset { /* + categoryCards CategoryCard[] */ }
model AdminUser  { /* + createdCategoryCards/updatedCategoryCards CategoryCard[] */ }
```

No existing column is altered or dropped. `card_products`/`orders`/every other table is untouched — this stage adds exactly one new table and one new nullable+unique column.

## 3. Backend

- **New module** `backend/src/modules/category-cards/` mirroring `cards/` module shape exactly: `category-cards.service.ts`, `category-cards.controller.ts` (public), `category-cards-admin.controller.ts` (admin), `dto/{create,update,list-query,list-admin-query}.ts`, `category-cards.module.ts`.
- **Ownership validation** (the task's explicit "validate category/service ownership"): on `create`/`update`, the service re-fetches the real `Category` and `Service` rows (never trusts client-supplied relationship data — same discipline as `OrdersService`/`CardProductsService`) and asserts `targetService.categoryId === categoryId`, else `422 UnprocessableEntityException` with a Persian message — a genuine, server-enforced relationship check, not a UI-only constraint.
- **Public API**:
  - `GET /category-cards?categoryId=X&limit=100` — `status`-equivalent filter is `active: true` only (mirrors `GET /cards?serviceId=X`'s `status: 'ACTIVE'`-only filtering — no client-side re-filtering needed downstream).
  - `GET /categories/slug/:slug` (new route on the existing `CategoriesController`, additive — `GET /categories/:id` is completely untouched) — 404 for any Category with no slug set, same not-found discipline as everywhere else in this domain.
- **Admin API** (`/admin/category-cards`) — exact `CategoriesAdminController` shape: `GET` (list/detail, any admin), `POST`/`PUT`/`PATCH reorder` (`SUPER_ADMIN`/`CONTENT_EDITOR` only). No `DELETE` — matches the zero-hard-delete convention already established for `Category`/`Service`/`CardProduct`; `active` is the removal mechanism.
- **Audit logging**: every mutation calls `AdminAuditLogService.record()` with `resourceType: 'CategoryCard'`, before/after JSON of `{title, categoryId, targetServiceId, active}` — identical shape to `CategoriesService`.
- **RBAC**: identical to every other catalog controller — no new role, no parallel authorization system (same documented limitation R5.17 already accepted).
- **Image resolution**: `CategoryCardsService` reuses `MediaStorageService` + `resolveMediaUrl()` verbatim (the exact Home CMS mechanism) — this is the **first catalog-domain model** to get a real, working image URL (Category/Service/CardProduct's own `imageKey` gap is explicitly NOT retrofitted this stage — out of scope, unrelated to CategoryCard's own correctness).

## 4. Admin CMS

- New nav item under **Catalog**: "کارت‌های دسته‌بندی" → `/catalog/category-cards`, positioned directly after "دسته‌بندی‌ها" in `AdminSidebar.tsx` (task: "under Catalog > Categories").
- `CategoryCardsListContent.tsx` — mirrors `CategoriesListContent.tsx` exactly (`CatalogListTable` + `ActiveToggle` + move-up/down reorder), not `CardProductsListContent`'s status-select shape (`CategoryCard.active` is boolean, not a 4-state enum).
- `CategoryCardForm.tsx` — mirrors `ServiceBannerForm.tsx`'s exact shape (the only existing catalog-adjacent form already wired to `MediaPickerField`): `CategorySelect` (existing, reused) for `categoryId`, a **category-scoped** `ServiceSelect` (extended with an optional `categoryId` prop — re-queries `servicesAdminApi.list(categoryId)`, which already supports this filter server-side) for `targetServiceId`, plain inputs for `title`/`subtitle`/`badge`, a small capped-at-2 repeatable string input for `highlights`, `MediaPickerField` for the image, `ActiveToggle`-equivalent checkbox, `sortOrder`.
- **What Content Editor can/cannot do** (task's explicit RBAC boundary) is enforced structurally, not by convention: `CategoryCardInput`/`CreateCategoryCardDto`/`UpdateCategoryCardDto` contain ONLY `categoryId, targetServiceId, title, subtitle, badge, mediaAssetId, highlights, sortOrder, active` — no field shaped like `priceAmount`/`valueAmount`/`status` (CardProduct's own fields) exists anywhere on this DTO, so a Content Editor **cannot** touch Service pricing or CardProduct data through this surface even in principle — there is no code path connecting them. This is verified by a dedicated test (§8).

## 5. Frontend

- **New route** `apps/web/src/app/categories/[slug]/page.tsx`. Deliberately a **new** route, not a replacement for `/services/[categoryId]` — the existing Services module (browse-all-categories, search, method filters, full Service grid) is completely unaffected; this is a separate, focused "landing" entry point (e.g. for a marketing link into one specific category), consistent with the task calling it a distinct "Category Landing experience."
- **Composition**: `CategoryHero` (existing component, reused verbatim — it already takes `category: CategoryDto` + a count) → `CategoryCardGrid` (new, mirrors `CardProductGrid.tsx`'s loading/error/empty/populated states and its "trust server-side active filtering" discipline) → `CategoryCard` (new, the rich Discovery Card — photo via the newly-real `image` URL with an icon/emoji fallback when unset, title, subtitle/badge, highlights bullets — visually informed by the R5.20-audited real asset template, but never fabricating an image where none is set, same discipline as every other card in this codebase).
- **Click behavior**: `CategoryCard` → `router.push('/services/${categoryCard.categoryId}/${categoryCard.targetServiceId}')` — the **existing, already-built** Service Detail route. No new route is invented for this; the task's own diagram ("CategoryCard ↓ Service Detail") is satisfied by reusing what's already there.
- **Relationship validation**: a `categoryCardBelongsToCategory()` pure function (mirrors `cardProductBelongsToService`/`belongsToCategory` exactly) guards against a CategoryCard id resolved standalone but not actually belonging to the URL's category — same "never trust a bare ID lookup" discipline used everywhere else.

## 6. Analytics Foundation

**No analytics vendor/backend exists anywhere in this codebase today** — building a real integration (GA4/Segment/Mixpanel/a custom events table) is out of scope and would mean fabricating a connection with no real credentials or destination behind it. This stage builds exactly what "foundation" means: a typed, testable event contract and the two real call sites wired to it — swappable for a real sink later with no call-site changes.

- `apps/web/src/lib/analytics.ts` — a typed `AnalyticsEvent` union (`CategoryCardViewed`, `CategoryCardClicked`, each carrying `categoryId, categoryCardId, targetServiceId, position`) and a `trackEvent()` function. The sink is `console.info` in non-production only, explicitly documented as a placeholder, not a real vendor call.
- `CategoryCardGrid` fires `CategoryCardViewed` once per card on mount (a simple, honest "rendered" signal — true viewport-intersection tracking is a real future enhancement, not built here, and the doc comment says so instead of pretending this is impression-accurate).
- `CategoryCard`'s click handler fires `CategoryCardClicked` before navigating.

## 7. Explicitly Out of Scope (per the task)

No payment/purchase logic, no `CustomerCardInstance` issuance, no `Order` creation, no CardProduct FK on `CategoryCard`, no real analytics vendor, no bulk-fabricated `Category.slug` values (only genuinely set ones resolve), no retrofit of `Category`/`Service`/`CardProduct`'s own separate `imageKey` gap.

## 8. Tests

- **Backend unit**: `CategoryCardsService` — ownership validation (target Service must belong to the given Category, else 422), nonexistent Category/Service rejected, public list filters to `active: true` only, image resolves via `resolveMediaUrl`, audit log called on create/update/reorder with correct `resourceType`.
- **Admin RBAC**: extends the existing `catalog-admin-permissions.spec.ts` pattern — every `CategoryCard` mutation requires `SUPER_ADMIN`/`CONTENT_EDITOR`, denies `SUPPORT_VIEWER`; every read is open to any authenticated admin. A dedicated test asserts the DTO shape itself contains no pricing/CardProduct/purchase-logic field.
- **Frontend rendering**: `CategoryCard` (title/subtitle/badge/highlights/image-or-fallback), `CategoryCardGrid` (loading/error/empty/populated, no client re-filtering), Category Landing page composition (hero + grid + not-found for an unresolvable slug).
- **Navigation**: `CategoryCard` click navigates to the correct `/services/[categoryId]/[serviceId]`; `categoryCardBelongsToCategory` relationship-validation tests.

## 9. Quality Gates

Backend (`prisma validate`/`generate`, `tsc`, `eslint`, `jest`), Customer Web (`tsc`, `eslint`, `jest`, `build`), Admin (`tsc`, `jest`, no regression), workspace `build` — all required green before commit, matching every prior stage's gate.

---

**This document describes the plan. Implementation follows immediately after.**
