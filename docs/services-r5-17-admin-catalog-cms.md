# SERVICES-R5.17 — Admin CMS for Service/Card Catalog

## 1. Baseline

- Starting commit: `dfdc9a1` (`feat(services): SERVICES-R5.16 Services and Card Catalog Contract`) — the additive `CardProduct`/`CustomerCardInstance`/`UsageTransaction` foundation, read-only public/customer APIs only, zero Admin surface.
- This stage builds the internal Admin CMS for `Category`, `Service`, and `CardProduct` — the catalog data operators need to manage before any customer-facing purchase UI is built. It does **not** implement purchase execution, payment, gateway, wallet, or installment logic, matching R5.16's own explicit deferral.

## 2. Scope

Admin CRUD for:
1. **Categories** — list, create, update (incl. activate/deactivate), reorder.
2. **Services** — list, create, update (incl. activate/deactivate). No reorder (no `sortOrder` field exists on `Service`, and none was requested).
3. **Card Products** — list, create, update (incl. a 4-state `status` lifecycle). No reorder UI this stage (the `sortOrder` field already exists from R5.16 and is updatable via the API, but no dedicated reorder screen was built — not explicitly requested).

No delete endpoint exists for any of the three — not requested by the task, and all three have real FK-restricted dependents (`Service.orders`, `Category.services`, `CardProduct.cardInstances`, etc.) that would make a hard delete either fail loudly or need soft-delete semantics neither this task nor prior stages specified. `active`/`status` toggling is the supported way to remove something from customer visibility, matching the established Home CMS convention.

## 3. Schema Changes

One additive migration, `20260909130538_catalog_admin_management` (generated the same `prisma migrate diff` + `migrate deploy` way as every prior stage — `migrate dev` still refuses to run non-interactively):

- **`Category`**, **`Service`**: added `createdBy`/`updatedBy` (nullable FKs to `AdminUser`, two named relations each) — the exact ADR §5 content-ownership pattern Stage 5.19 established for Home CMS, applied here now that these become Admin-managed content for the first time. Purely additive; no existing column touched.
- **`CardProduct`**: R5.16's boolean `active` field was **replaced outright** (not added alongside) with a new `status: CardProductStatus` enum (`DRAFT | ACTIVE | INACTIVE | EXPIRED`, default `DRAFT`) — the exact 4-state lifecycle this stage's task specified. Safe to replace rather than migrate, because `card_products` had zero real rows (R5.16: "New tables start empty"). Also gained `createdBy`/`updatedBy`, matching the other two. A new `@@index([status])` was added alongside the existing `@@index([serviceId])`.
- **`AdminUser`**: 6 new reverse relations (`created`/`updatedCategories`, `created`/`updatedServices`, `created`/`updatedCardProducts`).

No existing table's existing columns were altered or dropped (other than `card_products.active`, which never held real data). No fictional data was seeded into any new column.

## 4. RBAC — a Documented Limitation, Not a Parallel System

The task asked for a "Service manager" (category/service) vs. "Commercial manager" (card products/pricing) vs. "Super admin" (all) permission split. **The existing `AdminRole` enum is `SUPER_ADMIN | CONTENT_EDITOR | SUPPORT_VIEWER` only — there is no per-domain role concept anywhere in this codebase's authorization system**, and adding one would mean extending the `AdminRole` enum and `AdminRolesGuard`'s decision logic, a change with real blast radius across every existing Admin CRUD surface (Home CMS, Media Library) that this stage's evidence does not justify inventing unilaterally.

Per the task's own explicit instruction ("If existing RBAC does not support granular permissions, document the limitation instead of creating a parallel authorization system"), this stage does exactly that: every mutation across Categories/Services/CardProducts requires `SUPER_ADMIN` or `CONTENT_EDITOR` — the identical split every other Admin CRUD controller in this codebase already uses (`HomeHeroCardsAdminController`, `MediaController`, etc.) — and every read is open to any authenticated admin, including `SUPPORT_VIEWER`. There is no way today to grant one admin write access to Categories/Services but not CardProduct pricing, or vice versa. If that separation becomes a real product requirement, it needs a deliberate `AdminRole` extension (or a separate permissions table) as its own reviewed change — not something this stage invents as a side effect of building catalog CRUD.

## 5. `journeyType` Stays on `CardProduct`, Not `Service`

The task's Service field list included `journeyType`. **This stage does not add it to `Service`.** SERVICES-R5.16 already resolved this exact question with real reasoning (`docs/services-r5-16-services-card-catalog-contract.md` §1): a single Service can offer several journeys at once (e.g. a direct-purchase card and a quote-request card for the same Service), which a single `journeyType` field on `Service` cannot represent — `CardProduct.journeyType` (one value per card) already solves it correctly. Duplicating the field onto `Service` would directly contradict that decision and create two disagreeing sources of truth. `Service.active` already serves the task's "purchasable flag" role (exactly what R5.1's `OrdersService` already gates purchase eligibility on); no identity/KYC concept exists anywhere in this schema, so none was added.

## 6. Audit Logging

Every mutation (`create`, `update` — including activate/deactivate and `CardProduct.priceAmount`/`status` changes, since both go through the same `update()` path) records an `AdminAuditLog` entry via the existing, unmodified `AdminAuditLogService`: actor (`adminUserId`), action (`CREATE`/`UPDATE`/`REORDER` — the existing `AdminAuditAction` enum already covers everything needed; no new value was added), resource type/id, before/after JSON snapshots of the meaningful fields, IP, and user agent. This is the same append-only, never-throws-on-failure service every other Admin surface already uses — nothing about it was changed.

## 7. API Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/admin/categories` | any admin | |
| GET | `/api/v1/admin/categories/:id` | any admin | |
| POST | `/api/v1/admin/categories` | SUPER_ADMIN/CONTENT_EDITOR | |
| PUT | `/api/v1/admin/categories/:id` | SUPER_ADMIN/CONTENT_EDITOR | covers activate/deactivate |
| PATCH | `/api/v1/admin/categories/reorder` | SUPER_ADMIN/CONTENT_EDITOR | |
| GET | `/api/v1/admin/services`, `?categoryId=` | any admin | |
| GET | `/api/v1/admin/services/:id` | any admin | |
| POST | `/api/v1/admin/services` | SUPER_ADMIN/CONTENT_EDITOR | validates `categoryId` (and `merchantId`, if supplied) against real rows |
| PUT | `/api/v1/admin/services/:id` | SUPER_ADMIN/CONTENT_EDITOR | |
| GET | `/api/v1/admin/card-products`, `?serviceId=` | any admin | shows all 4 statuses |
| GET | `/api/v1/admin/card-products/:id` | any admin | |
| POST | `/api/v1/admin/card-products` | SUPER_ADMIN/CONTENT_EDITOR | validates `serviceId` against a real row; `priceAmount` is Admin-set here |
| PUT | `/api/v1/admin/card-products/:id` | SUPER_ADMIN/CONTENT_EDITOR | status transitions go through this, unrestricted (see schema comment) |

The existing public endpoints (`GET /categories`, `GET /services`, `GET /cards`) are **unchanged** — `CardProductsService.list()`/`findOneOrThrow()` were updated to filter on `status: 'ACTIVE'` instead of the removed `active` boolean (same customer-facing guarantee: DRAFT/INACTIVE/EXPIRED card products are never visible publicly), and `Category`/`Service`'s public methods were not touched at all.

## 8. Frontend Admin

New `apps/admin/src/features/catalog/` feature, following the exact Home CMS conventions rather than inventing new UI patterns: `HomeFormShell`, `FormField`, `ActiveToggle`, `ReorderControls`, `plainFieldStyles`, and the pure `performSave`/`performToggleActive`/`performReorder`/`moveItem` logic helpers are reused directly from `features/home/**` (all already fully generic, zero Home-specific coupling). A new `CatalogListTable` component (not a reuse of `ResourceListPage`) provides the shared list-table chrome without a delete column (none of the three resources has one) and with a `renderStatus` slot instead of a hardcoded boolean toggle — needed because `CardProduct`'s 4-state status can't be expressed by `ResourceListPage`'s boolean-only `ActiveToggle`. `CategorySelect` is reused as-is (public endpoint, unaffected by this stage); a new `ServiceSelect` (same shape, hitting the new admin Services endpoint) was added for the CardProduct form.

New nav group in `AdminSidebar`: "کاتالوگ" → دسته‌بندی‌ها / خدمات / کارت‌های محصول, plus a `/catalog` overview page (navigation + counts only, no analytics, matching `HomeOverview`'s own scope discipline).

**Known simplification**: `Service`'s `faq` field and `Category`/`Service`'s `benefits`/`galleryKeys`/`tags` JSON-array fields beyond what's exposed are settable via the API but not yet exposed in the admin form UI — kept out to bound this stage's scope; nothing about the schema or backend prevents adding them later. `imageKey`/`icon` are plain text (Storage key) inputs, not a full media-picker upload flow — `Category`/`Service`/`CardProduct` store a raw `imageKey: String?` (unlike Home CMS's `mediaAssetId` FK to `MediaAsset`), so Home's `MediaPickerField` (built for that different relationship shape) wasn't a fit; wiring a real upload flow for this different field shape is not built this stage.

## 9. Tests

**Backend** (all against the established mocked-`PrismaService` convention):
- `categories.service.spec.ts`, `services.service.spec.ts` (new) — validation (nonexistent category/merchant rejected), relation checks, activate/deactivate-via-update, audit-entry assertions, reorder.
- `card-products.service.spec.ts` (extended) — public list/findOne inactive-filtering fixed for `status` (was `active`), plus new admin create/update tests: Service-relation validation, DRAFT default, priceAmount/status audit before/after.
- `catalog-admin-permissions.spec.ts` (new, mirrors `home-admin-permissions.spec.ts` exactly) — every mutation across all 3 controllers declared `[SUPER_ADMIN, CONTENT_EDITOR]` and denies `SUPPORT_VIEWER`; every read is open to any authenticated admin.
- `categories.controller.spec.ts`/`services.controller.spec.ts`/`card-products.controller.spec.ts`/`card-products.service.spec.ts` (pre-existing) — updated to provide the newly-required `AdminAuditLogService` mock.
- `service-pricing.service.spec.ts` (R5.1, pre-existing) — its `Service` mock fixture updated for the new `createdBy`/`updatedBy` fields (type-only fix, no behavior change).

**Frontend**: rendering tests for all 3 forms (required fields, pre-fill in edit mode, readOnly disables the fieldset/hides submit — matching the existing `renderToStaticMarkup`-based convention, since no test in this codebase uses an interactive DOM-event testing library) and RBAC-wiring tests for all 3 list views (`CONTENT_EDITOR` sees the "new" control, `SUPPORT_VIEWER` doesn't) — mirroring `HeroCardsListContent.test.tsx` exactly. A pure-function test for `canManageCatalog`, mirroring `rbac.test.ts`.

## 10. Migration Details

Additive except for one column replacement with zero real data at risk (`card_products.active` → `card_products.status`, see §3). No historical `Category`/`Service` row needs a value for its new `createdBy`/`updatedBy` columns — both stay `NULL` for pre-existing (seed-origin) rows, exactly the same pattern R5.1's `Order.idempotencyKey` and Stage 5.19's Home CMS columns already established for this codebase.

## 11. Backward Compatibility

- The 108-service real catalog, R1–R5.1 browsing flows, and R5.1's server-side purchase-blocking behavior are untouched — no public API shape changed except `CardProduct`'s (§7), and that endpoint has no real callers yet (R5.16: zero customer UI exists for it).
- Home CMS and the Media Library are untouched.
- `Order.amount`'s immutable-at-creation invariant (R5.1) is unaffected — this stage never writes to `Order`.

## 12. What This Stage Deliberately Does Not Do

Matches the task's explicit constraints: no payment, gateway, wallet debit, installment creation, discount logic, external pricing provider, Merchant Portal, or customer-facing purchase flow. `CardProduct.priceAmount` is a plain Admin-managed integer field — populating it here does not make a real purchase possible; `ServicePricingService` (R5.1) still resolves price from `Service.priceFrom`/`priceLabel`, not from `CardProduct` — connecting the two remains a separate, later decision (R5.16 §7 already flagged this).

## 13. Staging

No live payment/financial behavior changed, so this stage carries the same low deployment risk as R5.16 — the migration is additive (modulo the zero-data `active`→`status` swap) and the new Admin surface is opt-in (operators must navigate to it; nothing auto-populates real catalog rows). See the final report for the exact staging migration/deploy command.
