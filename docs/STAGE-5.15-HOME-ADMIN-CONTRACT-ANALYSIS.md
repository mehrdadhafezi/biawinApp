# STAGE 5.15 — Home Admin Contract Analysis

Scope: read-only extraction of the Home Admin contract from the repository. Nothing was changed, deployed or mutated.

**Evidence rule.** Every statement cites executable source (`backend/src/...`, `backend/prisma/...`, `apps/...`). Where the source cannot prove something it is marked **UNKNOWN / NOT VERIFIED**. Where a document and code disagree, the code is the source of truth (see §2.5).

**What was executed for this stage**
- File reads/greps only.
- `jest src/modules/home src/modules/media src/modules/admin-audit-log src/common` → 15 suites / 71 tests passed (mock-based, no DB writes).
- Three unauthenticated read-only `GET`/`HEAD` requests to the public staging API (`/home/service-banners`, `/home/hero-cards?x=1`, `/admin/home/hero-cards` without a token) to observe headers and the 401 shape.
- NOT executed: Browser QA, deployment, `authenticated-qa-runner.ts` (it mutates staging), any DB write.

---

## 1. Executive Summary

- The Home backend is **already implemented** for all four entities (Hero Cards, Service Banners, Service Mosaic Tiles, News Articles): 4 public `GET` endpoints and 4 × 6 admin endpoints (list, get, create, update, delete, reorder), all under `HomeModule` (`home.module.ts`).
- An **Admin UI for Home already exists** in `apps/admin` (`src/app/home/**`, `src/features/home/**`, `src/app/media`). Its depth was inspected only at API-client/type level; screen behavior is UNKNOWN / NOT VERIFIED beyond that.
- The only publish control is the boolean `active`. There is no draft/published/archived/scheduled state anywhere.
- Ordering is a per-row integer `sortOrder`, changed through `PATCH .../reorder` (`{ items: [{id, sortOrder}] }`) or through `PUT` on a single row.
- Media is a central `MediaAsset` table (S3/MinIO object storage, `key` unique), referenced by nullable `mediaAssetId` FKs on Banners, Mosaic Tiles and News Articles. **Hero Cards have no media.**
- Audit uses `AdminAuditLog` (append-only, `record()` never throws). Only `SUPER_ADMIN` can read it, through `GET /admin/audit-logs` (no filters).
- Propagation is effectively immediate: public endpoints read the DB on every request and send **no `Cache-Control` header** (observed on staging). No server-side cache, revalidation hook or invalidation exists in the backend.
- Main contract weaknesses (all evidenced below):
  1. Prisma errors are not mapped. The global filter turns every non-`HttpException` into HTTP 500 `INTERNAL_ERROR` (`http-exception.filter.ts`). Duplicate `cardKey`, duplicate `bodySlug`, unknown `categoryId`, unknown `mediaAssetId`, and unknown ids in `reorder` therefore all become 500 by code inspection (not runtime-proven).
  2. Text fields accept empty strings and have no length limits.
  3. A soft-deleted `MediaAsset` is still linked and still resolved to a URL, but the media route 404s it.
  4. Public lists do not filter by `Category.active`.
  5. The customer app falls back to static mock content when a public list is empty, so an admin cannot blank a section.
- Stage 5.15 (analysis) is complete. Readiness per area is in §22.

---

## 2. Current Home Architecture

### 2.1 Layers (verified)
| Layer | Location |
|---|---|
| Module | `backend/src/modules/home/home.module.ts` (imports `AdminAuditLogModule`, `MediaModule`) |
| Public controllers | `home-hero-cards.controller.ts`, `home-service-banners.controller.ts`, `home-service-mosaic-tiles.controller.ts`, `home-news-articles.controller.ts` |
| Admin controllers | `home-*-admin.controller.ts` (4) |
| Services | `home-hero-cards.service.ts`, `home-service-banners.service.ts`, `home-service-mosaic-tiles.service.ts`, `home-news-articles.service.ts` (Prisma access is direct inside the services; there is no separate repository layer) |
| DTOs | `home/dto/` (4 create, 4 update, 1 shared `reorder-home-items.dto.ts`) |
| Media URL util | `home-media.util.ts` → `MediaStorageService.resolvePublicUrl()` |
| Schema | `backend/prisma/schema.prisma` lines ~1182–1340; migration `20260825152328_home_cms_foundation` (only migration touching `home_*`) |
| Seed | `backend/prisma/seed.ts` (hero, banners, mosaic, news), `seed-home-media.ts` |
| Customer consumer | `apps/web/src/lib/home-api.ts`, `components/home/useHomeCms.ts`, `homeCmsAdapter.ts`, `home.mock.ts` (static fallback) |
| Admin consumer | `apps/admin/src/features/home/**`, `apps/admin/src/app/home/**` |

### 2.2 Global pipeline (verified from `main.ts`, `app.module.ts`)
- Global prefix `api`, URI versioning default `1` → all paths are `/api/v1/...`.
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } })`.
- `helmet()` default, `enableCors` from `CORS_ORIGINS` with `credentials: true`.
- Global guards: `ThrottlerGuard` (100 req / 60 s per IP, Redis storage) then `JwtAuthGuard` (customer).
- Global `HttpExceptionFilter`, global `ResponseInterceptor`.
- Success envelope: `{ "success": true, "data": <payload> }`.
- Error envelope: `{ "success": false, "error": { "code": "<HttpStatus name | INTERNAL_ERROR>", "message": "<string; array messages joined with '; '>", "details"?: ... } }`.

### 2.3 Auth wiring
Admin controllers carry `@Public()` (opts out of the *customer* global guard) plus `@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)`. Public controllers carry `@Public()` only.

### 2.4 Existing Admin UI (inspected at API-client/type level)
`apps/admin/src/features/home/api/home-resource-api.ts` calls, per resource, `GET ?limit=100`, `GET /:id`, `POST`, `PUT /:id` (partial body), `DELETE /:id`, `PATCH /reorder` with `{ items }`. `logic.ts` re-fetches the admin list after reorder and rewrites every row's `sortOrder` to its index. `rbac.ts` shows controls only for `SUPER_ADMIN`/`CONTENT_EDITOR` (UX only). Category options come from the public `GET /categories?limit=100`, filtered `active` client-side.

### 2.5 Documentation vs. code
`docs/home-admin-contract.md` (planning doc) disagrees with the implementation. Code wins.
| Topic | Planning doc | Executable code |
|---|---|---|
| Media field | `imageKey` on each Home table; `POST .../:id/image` upload endpoints | `mediaAssetId` FK to `MediaAsset`; no `/image` endpoints; one shared `POST /admin/media/upload` |
| Reorder body | `[{ id, sortOrder }, ...]` (array) | `{ "items": [{ "id", "sortOrder" }] }` |
| Mosaic | two separate arrays | one table, `slotType` discriminator |

---

## 3. Entity Inventory

| Entity | Prisma model / table | Public endpoint | Admin base path | Media | Category FK |
|---|---|---|---|---|---|
| Hero Cards | `HomeHeroCard` / `home_hero_cards` | `GET /home/hero-cards` | `/admin/home/hero-cards` | none | none |
| Service Banners | `HomeServiceBanner` / `home_service_banners` | `GET /home/service-banners` | `/admin/home/service-banners` | `mediaAssetId?` | `categoryId` (Restrict) |
| Service Mosaic Tiles | `HomeServiceMosaicTile` / `home_service_mosaic_tiles` | `GET /home/service-mosaic-tiles` | `/admin/home/service-mosaic-tiles` | `mediaAssetId?` | `categoryId` (Restrict) |
| News Articles | `HomeNewsArticle` / `home_news_articles` | `GET /home/news-articles` | `/admin/home/news-articles` | `mediaAssetId?` | none (`category` is a free-text label) |

Supporting entities required by Home: `MediaAsset` (`media_assets`), `Category` (read-only via public `GET /categories`), `AdminUser`/`AdminAuditLog`, admin auth (`/admin/auth/*`).

There is no aggregate `/home` endpoint. The customer app calls four independent public endpoints (`home-api.ts`).

---

## Common contract (applies to §4–§7 unless overridden)

### C.1 Public endpoint
- `GET /api/v1/home/<resource>`, `@Public()`, no auth, no query DTO (extra query params are ignored: `GET /home/hero-cards?x=1` → 200, observed).
- Response `data`: a **bare array** (no pagination envelope), `where: { active: true }`, `orderBy: { sortOrder: 'asc' }`. There is no limit.
- Throttle: global 100 / 60 s / IP (headers `X-RateLimit-*` observed).

### C.2 Admin endpoints (per resource, base `/api/v1/admin/home/<resource>`)
| Operation | Method + path | Auth | Roles | Body | Success |
|---|---|---|---|---|---|
| List | `GET /` | admin JWT | any authenticated admin | — (query: `page`≥1 default 1, `limit` 1–100 default 20) | 200 `{ items, total, skip, take }` |
| Get | `GET /:id` | admin JWT | any | — | 200 admin object, 404 if missing |
| Create | `POST /` | admin JWT | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create DTO | 201 (Nest POST default; no `@HttpCode` override) admin object |
| Update | `PUT /:id` | admin JWT | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update DTO (all optional; **merge semantics**, not replace) | 200 admin object |
| Delete | `DELETE /:id` | admin JWT | `SUPER_ADMIN`, `CONTENT_EDITOR` | — | 200 `{ id }` (**hard delete**) |
| Reorder | `PATCH /reorder` | admin JWT | `SUPER_ADMIN`, `CONTENT_EDITOR` | `ReorderHomeItemsDto` | 200 **public-shaped active-only list** (not the admin list) |

Notes:
- List query: `skip` is not accepted as input (`forbidNonWhitelisted` → 400), it is derived from `page`/`limit` (`pagination.dto.ts`). The response echoes `skip`/`take`, **not** `page`/`limit`. Ordering is `sortOrder asc` only, with no tiebreaker.
- Request headers: `Authorization: Bearer <admin access token>`; `Content-Type: application/json`.
- There is **no PATCH `/:id`**; `PATCH` is only used by `/reorder`. There is **no dedicated active-toggle endpoint**: toggling is `PUT /:id` with `{ "active": boolean }`. There is no publish/unpublish operation and no restore/undelete.
- Route order: `PATCH /reorder` and `PUT /:id` use different methods, so no path collision.
- `updatedBy` is set on create, update and reorder; `createdBy` only on create.

### C.3 Reorder DTO (`reorder-home-items.dto.ts`, shared by all four)
```
{ "items": [ { "id": string, "sortOrder": int >= 0 }, ... ] }   // items: array, min 1 element, each validated
```
Behavior (service code, identical in all four):
- Runs `prisma.$transaction([update each id → sortOrder, updatedBy])`, then writes a `REORDER` audit row, then returns `listPublic()`.
- Not validated: duplicate ids in the payload; duplicate `sortOrder` values; ids that do not exist (Prisma `P2025` → uncaught → **500 by inspection**, whole transaction rolled back); completeness (rows not listed keep their old `sortOrder`); active vs. inactive (inactive rows may be reordered).
- Upper bound on `sortOrder`: none in the DTO; the DB column is `Int`.

### C.4 Common column facts
`id` uuid PK (default `uuid()`); `sortOrder Int @default(0)`; `active Boolean @default(true)`; `createdBy`/`updatedBy` nullable FK → `admin_users.id` `ON DELETE SET NULL`; `createdAt @default(now())`; `updatedAt @updatedAt`. Index `(active, sortOrder)` on hero, banners, news; `(active, slotType, sortOrder)` on mosaic.

---

## 4. Hero Cards Contract

**Table `home_hero_cards`** (schema `HomeHeroCard`)
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | uuid() | PK |
| cardKey | enum `HeroCardKey` {`earn`,`biawin`,`reward`} | no | — | **UNIQUE** (`home_hero_cards_cardKey_key`) |
| label, title, subtitle, displayNumber, ownerLabel | text | no | — | `displayNumber` is decorative, never a real card number |
| colorPreset | enum `HeroCardColor` {`blue`,`sky`,`white`} | no | `blue` | |
| sortOrder, active, createdBy, updatedBy, createdAt, updatedAt | see C.4 | | | |

**Create DTO**: required `cardKey` (enum), `label`, `title`, `subtitle`, `displayNumber`, `ownerLabel` (strings); optional `colorPreset`, `sortOrder` (int), `active` (bool).
**Update DTO**: all fields optional, including `cardKey`.
**Public item**: `id, cardKey, label, title, subtitle, displayNumber, ownerLabel, colorPreset, sortOrder`.
**Admin item**: public fields + `active, createdBy, updatedBy, createdAt, updatedAt`.

| Operation | Supported |
|---|---|
| List / Get / Create / Update / Delete / Reorder | yes (C.2) |
| Active toggle | via `PUT { active }` |
| Media operations | **not supported** (no media relation) |
| Publish/unpublish | not present (`active` only) |

Constraints and consequences:
- `cardKey` is unique across exactly three values, so at most 3 rows can exist. Create is possible only after a delete. Update of `cardKey` to an existing key raises Prisma `P2002` → 500 by inspection (unmapped).
- The QA runner treats hero cards specially for this reason (`authenticated-qa-runner.ts` comments near `heroCardExistingRowCheck`).
- Audit: CREATE `after {cardKey,title}`; UPDATE `before/after {title,active}`; DELETE `before {cardKey,title}`; REORDER `after {items}` (`resourceId` null).
- Unit tests: `home-hero-cards.service.spec.ts` covers listPublic, create, remove, findOneAdmin-404 only (no update/reorder test for hero).

---

## 5. Service Banners Contract

**Table `home_service_banners`**
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| categoryId | text | no | — | FK → `categories.id` **ON DELETE RESTRICT** |
| mediaAssetId | text | **yes** | null | FK → `media_assets.id` ON DELETE SET NULL |
| kicker | text | no | — | |
| theme | enum `BannerTheme` {`auto`,`home`,`fashion`,`gold`,`travel`} | no | `auto` | |
| wide | boolean | no | `false` | |

**Create DTO**: required `categoryId` (string), `kicker` (string); optional `mediaAssetId` (string), `theme`, `wide`, `sortOrder`, `active`.
**Update DTO**: all optional; `mediaAssetId` may be `null` to clear (doc-commented, `string | null`).
**Public item**: `id, categoryId, categoryName (joined), image (URL|null), kicker, theme, wide, sortOrder`.
**Admin item**: public + `mediaAssetId, active, createdBy, updatedBy, createdAt, updatedAt`.

| Operation | Supported |
|---|---|
| CRUD + reorder | yes (C.2) |
| Active toggle | via `PUT { active }` |
| Media | set/clear `mediaAssetId` through create/update; no dedicated endpoint |
| Publish/unpublish | not present |

Behaviors:
- `categoryId` and `mediaAssetId` are only `@IsString()`. Existence is enforced by the DB FK, so an unknown id gives Prisma `P2003` → 500 by inspection. An empty string also passes DTO validation.
- The service does not check `Category.active` or `MediaAsset.active`.
- Public list: `where {active:true}`, no category filter. A banner whose Category is inactive is still returned.
- Audit: CREATE `after {categoryId,kicker}`; UPDATE `before/after {kicker,active}`; DELETE `before {categoryId,kicker}`; REORDER.
- Unit tests: `home-service-banners.service.spec.ts` is the most complete (public shape, active-only/order, media resolution/null, admin fields, 404, create, update+audit, remove+audit, reorder transaction+audit).

---

## 6. Service Mosaic Tiles Contract

**Table `home_service_mosaic_tiles`**
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| categoryId | text | no | — | FK → categories, RESTRICT |
| mediaAssetId | text | yes | null | FK → media_assets, SET NULL |
| slotType | enum `MosaicSlot` {`half`,`wide`} | no | — | discriminator |
| kicker | text | no | — | |
| title, lead | text | **yes** | null | populated only for `wide` (schema comment); **not enforced anywhere** |
| theme | enum `MosaicTheme` {`beauty`,`insurance`,`home`,`digital`} | no | `home` | |

**Create DTO**: required `categoryId`, `slotType`, `kicker`; optional `mediaAssetId`, `title`, `lead`, `theme`, `sortOrder`, `active`.
**Update DTO**: all optional; `mediaAssetId`, `title`, `lead` accept `null`.
**Public item**: `id, categoryId, categoryName, image, slotType, kicker, title, lead, theme, sortOrder`. The public list returns `half` and `wide` mixed in one array ordered by `sortOrder`. The customer adapter splits them client-side (`homeCmsAdapter.ts:145` filters `slotType === "half"`).

Operations/behaviors are otherwise identical to §5 (FK failures → 500 by inspection; no active checks on Category/Media).
Rules **not** enforced by the backend: `title`/`lead` required for `wide`; `title`/`lead` empty for `half`; a maximum number of tiles per slot type.
Audit: CREATE `after {categoryId,slotType}`; UPDATE `before/after {kicker,active}`; DELETE `before {categoryId,slotType}`; REORDER.
Index `(active, slotType, sortOrder)` exists, but queries filter only `active` and order by `sortOrder`, so the index is only partially relevant.
Unit tests: `home-service-mosaic-tiles.service.spec.ts` covers listPublic (both slot types), categoryName join, create+audit, reorder+audit.

---

## 7. News Articles Contract

**Table `home_news_articles`**
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| category | text | no | — | editorial label, not an FK |
| mediaAssetId | text | yes | null | FK → media_assets, SET NULL |
| kicker, title, lead | text | no | — | |
| bodySlug | text | **yes** | null | **UNIQUE** (`home_news_articles_bodySlug_key`); "reserved, unused today" (schema comment) |

**Create DTO**: required `category`, `kicker`, `title`, `lead`; optional `mediaAssetId`, `bodySlug`, `sortOrder`, `active`.
**Update DTO**: all optional; `mediaAssetId`, `bodySlug` accept `null`.
**Public item**: `id, category, image, kicker, title, lead, sortOrder` (no `bodySlug`).
**Admin item**: public + `mediaAssetId, bodySlug, active, createdBy, updatedBy, createdAt, updatedAt`.

Behaviors:
- A duplicate `bodySlug` raises `P2002` → 500 by inspection. No format validation on `bodySlug`.
- There is no article body, detail endpoint or public-by-slug endpoint. "مشاهده مقاله" is described as a disabled control (schema comment).
- No publish date, author or expiry fields exist.
- Audit: CREATE `after {title,category}`; UPDATE `before/after {title,active}`; DELETE `before {title}`; REORDER.
- Unit tests: `home-news-articles.service.spec.ts` (listPublic, create+audit, remove+audit).

---

## 8. Media Contract

Verified from `media.controller.ts`, `media.service.ts`, `media-storage.service.ts`, `media-files.controller.ts`, `media-validation.constants.ts`, `schema.prisma` `MediaAsset`.

| Aspect | Actual behavior |
|---|---|
| Storage | Object storage via `StorageService` (S3/MinIO-compatible; env `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, ...). Metadata in Postgres `media_assets`. Nothing is stored in the DB blob. |
| Upload | `POST /api/v1/admin/media/upload`, multipart field **`file`**, optional text field `altText` (string, max 300). Roles `SUPER_ADMIN`/`CONTENT_EDITOR`. |
| MIME allow-list | `image/jpeg`, `image/png`, `image/webp`, `image/gif` (SVG explicitly excluded). |
| Content check | Magic-byte sniff must equal the declared mimetype, otherwise 400. Stored `mimeType` is the sniffed one. |
| Size | Business limit `MEDIA_MAX_FILE_SIZE_BYTES` (default 5,242,880 = 5 MB) → 400 with a Persian message. Multer backstop 10 MB (`limits.fileSize`) rejects earlier. |
| Empty/missing file | 400 "فایلی برای آپلود ارسال نشده است." |
| Dimensions | `width`/`height` parsed server-side from the file header; null if not extractable. |
| Media ID | `MediaAsset.id` (uuid). Home rows reference it via `mediaAssetId`. |
| Key / URL | `key` = `media/<uuid>.<ext>` (unique). Public URL = `PUBLIC_API_ORIGIN + /api/v1/media/<filename>` (absolute). Observed on staging: `https://api-staging.biawin.ir/api/v1/media/<uuid>.webp`. |
| Serving | `GET /api/v1/media/:filename`, public, sets `Cross-Origin-Resource-Policy: cross-origin` first, looks up `MediaAsset` by `key` with `active: true` (else 404), sends stored `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`. |
| Thumbnails | **None.** Original file only. |
| Alt text | Stored on `MediaAsset.altText`, returned by admin media endpoints. **Not** included in any Home public/admin response, and there is no endpoint to edit it after upload. |
| Replacement | No replace-in-place. A new upload gets a new id/URL; the Home row is re-pointed via `PUT { mediaAssetId }`. |
| Deletion | `DELETE /admin/media/:id` is a **soft delete** (`active=false`, `deletedAt`); the storage object stays. No usage/reference check. |
| Existing-media selection | `GET /admin/media?page&limit` (active only, `createdAt desc`, response `{items,total,skip,take}`); `GET /admin/media/:id` (404 if inactive). The existing admin picker requests `?limit=50` and shows only the first page (`apps/admin/src/lib/media/media-api.ts`). |
| Audit | Upload → CREATE, delete → DELETE (`resourceType: MediaAsset`). |

Media-related gaps observed in code:
1. Soft-deleting a `MediaAsset` still referenced by a Home row: the FK is untouched (soft delete does not trigger `SET NULL`), and the Home services `include: { mediaAsset: true }` without an `active` filter, so the public response still contains the URL while `GET /media/:filename` returns 404. Broken image (by inspection; not runtime-tested).
2. Home create/update do not verify the referenced `MediaAsset` is active.
3. No alt-text edit and no alt text in Home responses.
4. Other read-only endpoints do not expose which Home rows use an asset.

---

## 9. Ordering Contract

| Entity | Field | Public order | Admin list order | Reorder endpoint | Scope |
|---|---|---|---|---|---|
| Hero Cards | `sortOrder` | `sortOrder asc` on active rows | `sortOrder asc` (all rows) | `PATCH /admin/home/hero-cards/reorder` | whole table (max 3 rows) |
| Service Banners | `sortOrder` | same | same | `PATCH .../service-banners/reorder` | whole table |
| Service Mosaic Tiles | `sortOrder` | one list, `half` and `wide` interleaved by `sortOrder` | same | `PATCH .../service-mosaic-tiles/reorder` | whole table (not per `slotType`) |
| News Articles | `sortOrder` | same | same | `PATCH .../news-articles/reorder` | whole table |

- Payload/validation/duplicates/missing/inactive/persistence: see C.3. Persistence is immediate in Postgres, in one transaction.
- Default `sortOrder` on create is `0`, so several new rows tie at 0. There is no tiebreaker in `orderBy`, so tie order is unspecified.
- Create/update accept any int for `sortOrder` (negative included), while reorder requires `>= 0`.
- The reorder response is the *public* list (active only). Inactive rows are reordered but never appear in that response.
- Public propagation: next public `GET` reflects the new order (no cache, §15).
- Customer app: the adapter maps in API order; no client re-sort was found in the inspected adapter lines (full adapter not read in detail: UNKNOWN for sections other than mosaic).
- Tests: reorder covered by unit tests for banners, mosaic (and by the staging QA runner). Hero/news have no reorder unit test. No test covers unknown ids, duplicates or ties.

---

## 10. Active/Inactive/Status Contract

States that actually exist for Home entities: **`active: true | false` only.**
Not present: draft, published, archived, scheduled, publish date, expiry, soft-delete (Home rows are hard-deleted). `MediaAsset` has its own `active` + `deletedAt` (soft delete).

| State | Public Home API effect | Admin API effect |
|---|---|---|
| `active = true` | row returned (if ordering allows) | listed |
| `active = false` | row omitted from `GET /home/*` | still listed/gettable; can be edited, reordered, re-activated |
| Row deleted | gone from both | `GET /:id` → 404 |
| Related `Category.active = false` | **still returned** (no category filter in `listPublic`) | — |
| Related `MediaAsset` soft-deleted | row returned with URL that 404s | admin object still has `mediaAssetId` and `image` URL |
| Section with 0 active rows | returns `[]` | customer app shows **static fallback** content instead (`useHomeCms.ts` lines 65, 107, 159, 200 skip CMS state when empty) |

Kill switch on customer side: `NEXT_PUBLIC_HOME_CMS_ENABLED=false` forces static content (build-time env; deploy required). Admin cannot see or change it.

---

## 11. Validation Contract

Verified from the DTOs (class-validator) and the global pipe.

| Rule | Behavior |
|---|---|
| Unknown body/query properties | 400 (`forbidNonWhitelisted`) |
| Missing required field | 400 |
| Strings (`@IsString`) | accepted when empty; **no `MaxLength`**, no `IsNotEmpty`, no trimming |
| Enums (`cardKey`, `colorPreset`, `theme`, `slotType`) | `@IsEnum` → 400 on invalid value |
| `wide` / `active` | `@IsBoolean` (with `enableImplicitConversion`, non-boolean coercion behavior is UNKNOWN / NOT VERIFIED at runtime) |
| `sortOrder` | `@IsInt`; create/update: no min/max; reorder: `>= 0` |
| `categoryId`, `mediaAssetId` | `@IsString` only; no `@IsUUID`; existence enforced by DB FK only |
| `null` on create optionals | `@IsOptional` ignores `null`/`undefined`, so `null` passes DTO validation |
| Reorder `items` | array, min 1, nested validation; no dedupe/existence check |
| Cross-field rules | none (e.g. `title`/`lead` vs `slotType`) |
| `id` path params | no `ParseUUIDPipe`; a malformed id yields 404 (Prisma `findUnique` on a string id), UNKNOWN at runtime for non-uuid strings |
| Persian messages | present for 404 (`کارت یافت نشد.`, `بنر یافت نشد.`, ...); validation messages are class-validator English defaults joined by `; ` (no custom messages found in Home DTOs) |

The 404 messages for tiles and articles were not individually read; they follow the same `findOrThrow` pattern (UNKNOWN / NOT VERIFIED for exact text).

---

## 12. Error Contract

Envelope: `{ success:false, error:{ code, message, details? } }`. `code` = `HttpStatus[status]` name (e.g. `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `TOO_MANY_REQUESTS`) or `INTERNAL_ERROR`. `details` is only set if the exception payload has `details` (none of the Home code sets it).

| Status | Where it is produced (verified) | Notes |
|---|---|---|
| 400 | `ValidationPipe`; media upload checks (`BadRequestException`) | message = joined validation messages |
| 401 | `AdminJwtAuthGuard` (missing/invalid/expired token, inactive/missing admin via strategy) | observed on staging: `{"code":"UNAUTHORIZED","message":"احراز هویت ادمین نامعتبر است."}` |
| 403 | `AdminRolesGuard` returns `false` for a `SUPPORT_VIEWER` on mutations | Nest default `ForbiddenException` body; message text not read from a runtime response (UNKNOWN) |
| 404 | `findOrThrow` (`NotFoundException`) for get/update/delete on a missing id; media routes | |
| 409 | **Not used by Home code.** No `ConflictException` and no Prisma `P2002` mapping in Home/media (only `orders.service.ts` maps `P2002`) | duplicate `cardKey`/`bodySlug` therefore do **not** return 409 |
| 422 | **Not used** | |
| 429 | `ThrottlerGuard` global 100/min/IP; admin login `10 / 10 min / IP` | |
| 500 | Any non-`HttpException`: Prisma `P2002`, `P2003`, `P2025` from create/update/delete/reorder | derived from `http-exception.filter.ts` + absence of mapping; **not reproduced at runtime** because reproducing needs staging mutations |

---

## 13. Authentication & Authorization

| Item | Fact |
|---|---|
| Public Home reads | no auth (`@Public()`) |
| Admin auth | `POST /admin/auth/login` `{ email (IsEmail), password (min 8) }`, throttled 10 / 10 min / IP; `POST /admin/auth/refresh` `{ refreshToken }`; `POST /admin/auth/logout` (204); `GET /admin/auth/me` (guarded) |
| Token verification | passport strategy `admin-jwt`, secret `ADMIN_JWT_ACCESS_SECRET`, `audience: 'admin'`, `issuer: 'biawin-admin'`, `ignoreExpiration: false`; loads `AdminUser` on **every** request and rejects if missing/inactive |
| Lockout | account lock after failed logins (`ADMIN_LOGIN_MAX_ATTEMPTS`, `ADMIN_LOGIN_LOCK_MINUTES`; `lockedUntil`) |
| Roles (`AdminRole`) | `SUPER_ADMIN`, `CONTENT_EDITOR`, `SUPPORT_VIEWER` |
| Home reads (admin) | any authenticated admin, including `SUPPORT_VIEWER` |
| Home mutations | `SUPER_ADMIN`, `CONTENT_EDITOR` only (`home-admin-permissions.spec.ts` asserts this for create/update/remove/reorder on all 4 controllers) |
| Media upload/delete | `SUPER_ADMIN`, `CONTENT_EDITOR`; media list/get: any admin |
| Audit log read | `SUPER_ADMIN` only |
| Token TTLs | access 10m, refresh 7d in the dev `.env` example; production values UNKNOWN / NOT VERIFIED |

---

## 14. Audit Contract

Model `AdminAuditLog` (`admin_audit_logs`): `id, adminUserId? (FK SET NULL), action (enum), resourceType (string), resourceId?, beforeJson?, afterJson?, ip?, userAgent?, createdAt`; indexes `(adminUserId, createdAt)`, `(resourceType, resourceId)`.
`AdminAuditAction`: `LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, CREATE, UPDATE, DELETE, REORDER`.

| Aspect | Actual behavior |
|---|---|
| Actor | `adminUserId` from the JWT; `ip` = `req.ip`, `userAgent` header |
| Actions written for Home | `CREATE`, `UPDATE`, `DELETE`, `REORDER`; resourceType `HomeHeroCard`, `HomeServiceBanner`, `HomeServiceMosaicTile`, `HomeNewsArticle` |
| Before/after | **Partial snapshots only**: UPDATE stores just `{title|kicker, active}` before/after, so changes to other fields (theme, category, media, sortOrder, body) are not captured. CREATE stores 2 fields. DELETE stores 2 fields. |
| REORDER | `resourceId` null; `afterJson: { items }`; no before-state |
| Media | upload/delete are audited (`MediaAsset`) |
| Write semantics | `record()` swallows errors (logs only) and runs **after** the data change, outside its transaction: a mutation can succeed without an audit row |
| Read API | `GET /api/v1/admin/audit-logs?page&limit`, `SUPER_ADMIN` only, `createdAt desc`, response `{ items, total, skip, take }` with raw rows (`adminUserId`, not the admin email; includes `ip`, `userAgent`). **No filters** by resourceType/resourceId/action/date/admin. |
| Immutability | service exposes no update/delete (append-only by code); DB-level protection UNKNOWN |
| Retention | **No retention/purge logic found** in `backend/src` or the schema (grep for retention/purge/prune returned nothing) → unbounded growth; policy UNKNOWN |

---

## 15. Public Propagation Contract

Trace: Admin UI → `PUT/POST/DELETE/PATCH /api/v1/admin/home/*` → service → Prisma/Postgres → `GET /api/v1/home/*` → customer `homeApi` → `useHomeCms` → `homeCmsAdapter` → components.

| Question | Finding |
|---|---|
| Immediate? | Yes at the API level: each public `GET` runs a fresh Prisma query. |
| Server cache | None found (no `CacheModule`, `CacheInterceptor`, Redis cache of Home data; Redis is used for throttling/OTP only). |
| HTTP cache headers | None on JSON: observed staging `HEAD /home/service-banners` shows no `Cache-Control`, no `ETag`. |
| Revalidation/invalidation | None exists (nothing to invalidate). |
| Deploy needed? | No for content changes. Yes only for the `NEXT_PUBLIC_HOME_CMS_ENABLED` switch or for changing the static fallback (`home.mock.ts`). |
| Refresh needed? | The customer loads the four lists in a `useEffect` on mount (`useHomeCms.ts`); an open page shows new data on its next mount/reload. No polling or push. Browser-level caching of the JSON with no `Cache-Control` was not runtime-tested (UNKNOWN). |
| Stale data possible? | Only client-side, on already-open pages. |
| Media propagation | Uploaded file gets a new uuid URL, so no stale-cache problem; the media route sends `max-age=31536000, immutable`. Changing a Home row's `mediaAssetId` changes the URL. Soft-deleting an asset does not update the Home row (§8). |
| Fallback | On error or an **empty** list, the customer app renders static mock content (`home.mock.ts`), so deactivating everything does not empty the section. |
| Category link | Public rows include `categoryId` + `categoryName` from the join, so a category rename propagates immediately; an inactive category does not remove the row. |

---

## 16. Admin UI Requirements (derived from the contract; not a redesign)

Common to all four entities:
- **Permissions**: reads for any admin; create/edit/delete/reorder/toggle/upload only for `SUPER_ADMIN`/`CONTENT_EDITOR`; the backend is the authority (UI hiding is convenience). Handle 401 (refresh once, else login) and 403 (show "no permission").
- **List**: call `GET ?page&limit` (max 100; existing UI uses `limit=100`); show inactive rows distinctly; show `sortOrder`, `active`, image when present; read `total`/`skip`/`take` (not `page`/`limit`).
- **Empty state**: show a state that warns the customer app will show static fallback content while there are no active rows.
- **Loading/error states**: independent per list/form; surface `error.message` from the envelope; treat 500 as "unexpected" (see §17: duplicate-key and FK failures arrive as 500).
- **Edit**: `PUT` with a partial body; send `null` to clear nullable media/text fields.
- **Delete**: hard delete, irreversible → confirmation required (the existing UI has `ConfirmDialog`); audit records it.
- **Active toggle**: `PUT { active }`; refresh from server response.
- **Reorder**: send the full list as `{ items:[{id, sortOrder}] }` with sequential unique values ≥ 0; then re-fetch the admin list (response is the public list); block the UI while in flight; no drag limits from backend, so the UI must prevent duplicates/gaps.
- **Media UI**: upload via `POST /admin/media/upload` (JPEG/PNG/WebP/GIF, ≤ 5 MB), optional alt text ≤ 300; select existing asset by `id` (paged; list is active-only); show `url`; provide clear/replace (re-point `mediaAssetId`); warn that deleting a media asset does not unlink it from Home rows.
- **Validation messages**: backend gives English class-validator text joined with `;`, so the UI needs its own Persian field-level validation (required fields, enum values, `wide` slots' `title`/`lead`).

Per entity:
| Entity | List screen | Create/edit form fields | Specific requirements |
|---|---|---|---|
| Hero Cards | ≤ 3 rows, columns cardKey/label/title/active/sortOrder | `cardKey` (enum), `label`, `title`, `subtitle`, `displayNumber`, `ownerLabel`, `colorPreset`, `active` | no media; create only for a missing `cardKey`; disable `cardKey` choices already in use; explain that `displayNumber` is decorative |
| Service Banners | category name, kicker, theme, wide, image thumb, active | `categoryId` (select by id), `kicker`, `theme`, `wide`, media picker, `active` | select only active categories (backend does not enforce); media optional |
| Service Mosaic Tiles | category, slotType, kicker, title, theme, image, active | `categoryId`, `slotType`, `kicker`, `title`, `lead`, `theme`, media, `active` | show `title`/`lead` only for `wide`; note that reorder spans both slot types |
| News Articles | category label, title, kicker, image, active | `category` (free text), `kicker`, `title`, `lead`, `bodySlug` (optional, unique), media, `active` | `bodySlug` unused by the customer app; surface unique-conflict as a generic failure since the backend returns 500 |

Existing Admin UI status: implemented in `apps/admin` for all four entities plus media. Screen-level conformance to the list above is UNKNOWN / NOT VERIFIED (only API clients, types, logic and rbac were read; its own tests were not run in this stage).

---

## 17. API Gaps
1. No mapping of Prisma `P2002`/`P2003`/`P2025` to 409/400/404 → 500 for duplicate `cardKey`, duplicate `bodySlug`, unknown `categoryId`/`mediaAssetId`, unknown reorder ids (by inspection).
2. No 409 or 422 anywhere in Home.
3. Reorder validates neither duplicates nor existence nor completeness; reorder response is the public list, not the admin list.
4. No list filters (`active`, `slotType`, `q`) on Home admin lists; admin list max `limit` 100.
5. No dedicated active-toggle/publish endpoint (only `PUT`).
6. No `PATCH /admin/media/:id` (alt text cannot be edited); no media usage lookup.
7. Audit log endpoint has no filters and no per-resource query.
8. Response shape inconsistency: list returns `{items,total,skip,take}` although input is `page`/`limit`.
9. Public Home endpoints are not paginated and have no `Cache-Control`/`ETag`.
10. Doc mismatch: `docs/home-admin-contract.md` §6 endpoints (`/:id/image`, array reorder body) do not exist.

## 18. Backend Gaps
1. Empty strings and unbounded lengths accepted for all text fields; no `@IsUUID`, no `@IsNotEmpty`, no `@MaxLength`.
2. No cross-field rule for mosaic `wide` (`title`/`lead`).
3. Public lists do not exclude rows whose `Category.active = false` or whose `MediaAsset` is inactive.
4. `MediaAsset` soft delete has no reference check and does not clear `mediaAssetId`.
5. Home create/update do not verify `Category`/`MediaAsset` state.
6. Audit snapshots are partial, are written outside the mutation transaction and can be silently lost; no retention policy.
7. No tiebreaker in `orderBy` (unspecified order for equal `sortOrder`).
8. Test gaps: no tests for update/reorder on hero and news, unknown-id/duplicate reorder, 409/500 mappings, cross-role runtime 403 responses, media-inactive propagation.
9. Runtime error responses for the 500 cases were not reproduced (would need mutating staging data, out of scope by the rules).

## 19. Data Model Gaps
1. No draft/published/scheduled/archived state, no publish window, no author/editor display fields.
2. `HeroCardKey` unique + 3-value enum hard-caps Hero Cards at 3 rows and makes new keys a schema change.
3. `HomeServiceMosaicTile.title/lead` are nullable with no DB constraint tying them to `slotType`.
4. No DB constraint on `sortOrder` uniqueness or range.
5. `HomeNewsArticle.bodySlug` exists but has no body/detail model behind it.
6. `MediaAsset` has no thumbnail/variant columns and no reference tracking (Home tables reference it, but `MediaAsset` has no usage view/relation to prevent unsafe delete).
7. `AdminAuditLog.resourceType` is a free string, not an enum.
8. No `deletedAt`/soft delete on Home rows (hard delete only).

## 20. Recommended Admin Implementation Order
Given that an Admin UI already exists, the order below is for closing contract gaps and verifying it, not for greenfield build.
1. Backend hardening (contract-preserving): map Prisma errors to 409/400/404; validate reorder payload; add `@IsUUID`/`@IsNotEmpty`/`@MaxLength` (needs an explicit decision, as it changes behavior).
2. Public correctness: filter inactive `Category`/`MediaAsset` from public lists (needs a product decision).
3. Media: alt-text update and media usage check before delete.
4. Audit: fuller snapshots, filter parameters on `GET /admin/audit-logs`.
5. Verify the existing Admin UI screen by screen against §16 (run its tests, then browser QA in a separate stage).
6. Hero Cards then Banners, Mosaic, News, media picker paging, then audit viewer.

## 21. Explicit Non-Goals
- No backend redesign or new endpoints in this stage.
- No Admin UI change or implementation.
- No Browser QA, no deployment, no staging/production mutation, no fake data.
- No decision on scheduling/draft workflows, page-builder, hero-card key expansion, article body pages, or customer fallback removal.

## 22. Final Readiness Assessment

Classification: READY / PARTIAL / BLOCKED / UNKNOWN. Nothing is BLOCKED: every backend endpoint exists and the existing Admin UI can call it.

| Area | Current Implementation | Admin Ready | Gap |
|------|------------------------|-------------|-----|
| Hero Cards | full CRUD + reorder, public list, no media (`home-hero-cards.*`) | PARTIAL | max 3 rows via unique `cardKey`; duplicate key → 500; no update/reorder unit tests |
| Service Banners | full CRUD + reorder + category join + `mediaAssetId` | PARTIAL | unknown category/media → 500; inactive category/media still public; no length/empty validation |
| Service Mosaic Tiles | full CRUD + reorder, one table with `slotType` | PARTIAL | same as Banners plus unenforced `wide` `title`/`lead` rule |
| News Articles | full CRUD + reorder, `bodySlug` unique | PARTIAL | duplicate `bodySlug` → 500; `bodySlug` unused; no publish date |
| Media | central `MediaAsset`, upload/list/get/soft-delete, public serving route | PARTIAL | no alt-text edit, no usage check on delete, soft-deleted asset stays linked (broken image), no thumbnails |
| Ordering | `sortOrder` + `PATCH /reorder` in a transaction, audited | PARTIAL | no dedupe/existence/completeness validation, unknown id → 500, no tiebreaker, mixed slot types in mosaic |
| Active/Status | `active` boolean only; public filters on it | PARTIAL | only one state; inactive `Category` not filtered; empty section falls back to static content on the customer app |
| Audit | `AdminAuditLog`, CREATE/UPDATE/DELETE/REORDER, `SUPER_ADMIN` read API | PARTIAL | partial snapshots, best-effort write outside the transaction, no filters, no retention policy (UNKNOWN whether required) |

Additional UNKNOWN items: production token TTLs; runtime text of 403 and validation responses; runtime status for Prisma-error cases; behavior of the existing Admin UI screens; browser-level caching of public JSON.

**Stage 5.15 analysis: complete.**
