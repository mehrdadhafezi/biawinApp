# STAGE 5.16-A — Home Backend Contract Hardening: Decision & Implementation Plan

Status: PLAN / DECISION ONLY. No code, schema, migration, data, deployment or browser QA was changed or run in this stage.

**How evidence was gathered (read-only)**
- Source reads under `backend/`, `apps/admin/`, `apps/web/`, `docs/`.
- **Data inspection:** `SELECT` queries only, against the *local dev* Postgres (`biawin-postgres-1`; I started that stopped container and stopped it again afterwards). The dev DB is not the staging DB. For staging I used only unauthenticated public `GET` requests, which show **active rows only**. Inactive rows and non-public columns on staging are therefore **UNKNOWN**, and §12 requires a pre-flight query on the real database before B ships.
- Nothing was written. `authenticated-qa-runner.ts` was not run. No Browser QA. No deploy.

**Terminology.** "Technical recommendation" (TR) = what engineering advises. "Business decision" (BD) = a product/policy choice that engineering must not make silently. They are kept in separate rows and paragraphs throughout.

---

## 1. Executive Summary

Stage 5.15 found that Home writes are unguarded at the edges: Prisma errors surface as HTTP 500, text fields are unvalidated, reorder trusts its payload, and Home/media dependencies are never checked. This plan defines the exact contract to close those gaps in Stage 5.16-B.

Key findings from this stage that change the plan:

1. **The repository already has a convention** for the error classes we need. Catalog services return `422 UnprocessableEntityException` with a Persian message when a referenced entity is invalid (`services.service.ts:199`, `category-cards.service.ts:284`, `card-products.service.ts:193`), `ConflictException` (409) exists in `orders`, and `orders.service.ts:93` already catches Prisma `P2002`. Stage 5.16-B should reuse these, not invent a new scheme.
2. **Reorder is currently *partial*, and the existing QA depends on that.** The service updates only the listed ids. The Stage 5.22 API QA sends single-item payloads (`{ items: [{ id, sortOrder: 9998 }] }`, `authenticated-qa-runner.ts:1007`) and two-item swaps. A "complete replacement" contract would fail that QA and would change the 114-PASS baseline.
3. **A real staging row would be affected by the inactive-category decision.** The public staging API lists 5 banners; the first (`اتومبیل`) belongs to a category the public categories endpoint reports as `active: false`. Public-Home "Option B" would hide that banner on the live Customer Home. This must be a business decision.
4. **Media deletion is the largest visual-asset risk in the repo, and it is not limited to Home.** `MediaAsset` is referenced by 3 Home tables plus `categories`, `services` (`mediaAssetId` and a JSON `galleryMediaAssetIds` with no FK), `card_products` and `category_cards`. `DELETE /admin/media/:id` soft-deletes without any reference check; the public media route then 404s the file. The comment in `media.service.ts:159` ("Nothing references `MediaAsset.id` yet") is stale.
5. **Existing Admin app is compatible** with the proposed hardening if four constraints are honored (§10): keep `mediaAssetId: null` and `title/lead: null` accepted, keep partial reorder, keep the `{items,total,skip,take}` list shape, and keep `PUT` partial-merge.
6. **Card artwork preservation:** none of the Stage 5.16-B changes need to touch any `mediaAssetId` value. A read-only before/after checksum is specified as a release gate (§11.3).

Nothing in this plan needs a schema migration, except one *optional* item (media usage tracking for `galleryMediaAssetIds`, §7) which is presented as an option, not a requirement.

---

## 2. Current Problems Confirmed by Stage 5.15

Re-verified in code during this stage:

| # | Problem | Evidence |
|---|---|---|
| P1 | All non-`HttpException` errors → `500 INTERNAL_ERROR` | `common/filters/http-exception.filter.ts` |
| P2 | Prisma error handling exists in one place only (`P2002`, orders) | `grep P20xx src` → only `orders.service.ts:93` |
| P3 | Home DTOs: `@IsString()` only, no `MaxLength`, no `IsNotEmpty`, no `IsUUID`, no trim | `home/dto/*.ts` |
| P4 | `categoryId` / `mediaAssetId` existence enforced only by DB FK | `home-service-banners.service.ts` create/update |
| P5 | `cardKey` and `bodySlug` uniqueness enforced only by DB unique index | `schema.prisma`, migration `20260825152328` |
| P6 | Reorder: no dup-id, dup-position, existence or uuid checks; unknown id → Prisma throw → 500 (by inspection, not reproduced) | `*.service.ts` `reorder()` |
| P7 | `listPublic` filters only `Home.active`; ignores `Category.active` and `MediaAsset.active` | `home-*.service.ts` |
| P8 | `MediaAsset` soft delete has no reference check | `media.service.ts:remove` |
| P9 | Audit: best-effort, after the mutation, outside its transaction; partial snapshots; no filter; no retention | `admin-audit-log.service.ts`, `home-*.service.ts` |
| P10 | Order ties are unspecified (`orderBy sortOrder` only) | `home-*.service.ts` |

New in this stage:

| # | Finding | Evidence |
|---|---|---|
| N1 | Public `GET /categories` on staging returns inactive categories too (24 returned, 14 active). Not in scope to change; noted because the Customer Home banner for an inactive category is currently visible. | staging public GET |
| N2 | `PUT /admin/card-products/:id` and the Category/CategoryCard/Service admin PUTs accept `mediaAssetId`; `null` passes `@IsOptional()` and writes NULL. | `card-products.service.ts:151` (`data: { ...dto }`), DTO `@IsOptional() @IsString()` |
| N3 | Same partial-reorder weakness exists in `category-cards`, `categories`, `orbit-items`. | `category-cards.service.ts:241`, `orbit-items.service.ts:77` |
| N4 | `services.service.ts` silently drops gallery ids whose `MediaAsset` row does not exist (`findMany` with no `active` filter, so soft-deleted assets *do* resolve to a URL that 404s). | `services.service.ts:242` |

---

## 3. Error Mapping Contract

### 3.1 Prisma/database errors actually present
- Repository code references **only `P2002`** (`orders.service.ts:93`).
- Failure modes found in Stage 5.15 that Prisma raises as `PrismaClientKnownRequestError`: unique violation (`P2002`), FK violation (`P2003`), record-not-found on `update`/`delete` (`P2025`). `P2003`/`P2025` are **not referenced anywhere in the repo yet**. They are Prisma's documented codes; Stage 5.16-B must assert them with a real `PrismaClientKnownRequestError` in unit tests against the installed Prisma **6.19.3** and must not rely on this document.
- `meta.target` content for a unique violation (constraint name vs. field list) is **UNKNOWN / NOT VERIFIED** for this Prisma/driver combination; hence the plan uses **pre-check queries (primary) + `P2002` catch (race safety net)**, so the response never depends on `meta`.

### 3.2 Target behavior (Home write endpoints and Home reorder)
| HTTP | Meaning | Home cases | Mechanism |
|---|---|---|---|
| 400 | malformed request | unknown/extra property, wrong type, missing required field, empty/whitespace-only required string, over max length, invalid enum, non-integer/negative/too-large `sortOrder`, malformed uuid (path `:id`, `categoryId`, `mediaAssetId`, reorder ids), empty `items`, duplicate ids/positions inside a reorder payload, `bodySlug` format | `ValidationPipe` + DTO decorators (`ParseUUIDPipe` on `:id`) |
| 401 / 403 | unchanged | | unchanged |
| 404 | resource not found | `GET/PUT/DELETE /:id` for a missing id (unchanged); `P2025` race (row deleted between read and write) | `findOrThrow` (existing) + `P2025` catch |
| 409 | unique conflict | create/update `cardKey` already used; `bodySlug` already used | pre-check + `P2002` catch → `ConflictException` (Persian message) |
| 422 | semantic validation failure | `categoryId` does not exist; `mediaAssetId` does not exist or is soft-deleted; reorder contains an id that does not exist; (BD-dependent) `wide` mosaic tile without `title`/`lead` | `UnprocessableEntityException`, same style as `assertCategoryExists()` |
| 429 | unchanged (global throttler) | | |
| 500 | unexpected | anything else (DB down, bug); still logged with stack | unchanged filter |

Persian message convention follows the repo: e.g. `دسته‌بندی انتخاب‌شده معتبر نیست.` (existing string, reuse verbatim), `رسانه انتخاب‌شده معتبر نیست.` (new), `این کلید کارت قبلاً استفاده شده است.` (new).

### 3.3 Scope of the fix
- **TR:** implement mapping **locally in the four Home services** via one small Home-scoped helper (pre-check + Prisma catch). Do **not** change the global `HttpExceptionFilter` in 5.16-B: that would change error behavior of every module (orders, wallet, payments…) and belongs in its own, separately tested stage.
- No new error `code` values are needed; the existing filter derives `code` from the HTTP status name (`CONFLICT`, `UNPROCESSABLE_ENTITY`, ...).

---

## 4. Validation Contract

### 4.1 Data inspected before proposing limits
Local dev DB (read-only `SELECT`), all figures are observed maxima:

| Column | Observed (dev) | Proposed max |
|---|---|---|
| hero `label` / `title` / `ownerLabel` / `displayNumber` | 10 / 14 / 13 / 19 | 100 / 200 / 100 / 50 |
| hero `subtitle` | 55 | 500 |
| banner `kicker` | 28 | 200 |
| mosaic `kicker` / `title` / `lead` | 15 / 18 / 31 | 200 / 200 / 500 |
| news `category` / `kicker` / `title` / `lead` | 15 / 15 / 59 / 124 | 100 / 200 / 300 / 1000 |
| news `bodySlug` | 0 rows set | 100, `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `sortOrder` (all four) | 0…4, no negatives, no duplicates | `>= 0`, `<= 100000` |
| ids (Home, categories, media) | 0 non-uuid | `@IsUUID()` |
| empty-string text values | 0 | reject after trim |
| `wide` mosaic rows missing `title` or `lead` | 0 | see BD-5 |
| `half` mosaic rows with `title`/`lead` | 0 | not enforced |

Public staging (active rows only): 3 hero, 5 banners, 4 mosaic, 8 news; `sortOrder` banners `0..4`, mosaic `0..3`. Every proposed limit is ≥ 2× the largest observed value, and `sortOrder <= 100000` is above the `9999` the Stage 5.22 QA runner uses.
**UNKNOWN:** inactive rows and non-public columns on the real staging/production DB. §12 makes a read-only pre-flight check a hard prerequisite.

### 4.2 Field rules (Create / Update)
Update DTOs keep "all optional" and merge semantics (`PUT` partial). Rules below apply when the field is present. `trim` = `@Transform` trimming before validation.

**Hero Cards**
| Field | Create | Update | Null | Empty | Max | Other |
|---|---|---|---|---|---|---|
| `cardKey` | required | optional | no | n/a | | `@IsEnum(HeroCardKey)`; unique → 409 |
| `label`,`title`,`subtitle`,`displayNumber`,`ownerLabel` | required | optional | no | rejected (400) | per table | trim |
| `colorPreset` | optional (`blue`) | optional | no | | | `@IsEnum` |
| `sortOrder` | optional (0) | optional | no | | 0…100000 | `@IsInt` |
| `active` | optional (true) | optional | no | | | `@IsBoolean` |

**Service Banners**: `categoryId` required, `@IsUUID`, must exist → 422 (see §6 for active-ness); `mediaAssetId` optional, **nullable** (`null` clears), `@IsUUID`, must exist and be active → 422; `kicker` required, trimmed, non-empty, ≤200; `theme` enum; `wide` boolean; `sortOrder`, `active` as above.

**Service Mosaic Tiles**: as banners plus `slotType` required enum; `title`/`lead` optional **nullable**; empty string is *normalized to* `null` (the Admin form already sends `title || null`, so this is what it intends); `wide` requirement per BD-5.

**News Articles**: `category`, `kicker`, `title`, `lead` required, trimmed, non-empty, per-field max; `mediaAssetId` optional nullable uuid (as above); `bodySlug` optional nullable (`null`/empty → `null`), format regex, unique → 409; `sortOrder`, `active`.

### 4.3 What must NOT become stricter
- `mediaAssetId: null` on **create** must still succeed (Admin forms send it, `ServiceBannerForm.tsx:50`).
- `title: null`, `lead: null` on mosaic create/update must still succeed (`ServiceMosaicForm.tsx:58`).
- Unknown extra properties are already rejected today (`forbidNonWhitelisted`); no change.
- `PUT` must stay partial-merge.
- Public `GET /home/*` query parameters remain ignored.

### 4.4 Foreign-key validation
Pre-check `category.findUnique` and `mediaAsset.findFirst({ id, active: true })` before write → 422. FK `ON DELETE RESTRICT`/`SET NULL` in the DB are kept. Category *active-ness* on write is BD-1-dependent (§6); **TR: do not require an active Category on write** (Admin may prepare a banner for a category that is not yet active).

---

## 5. Reorder Contract

### 5.1 Current semantics (derived, not assumed)
- **Partial reorder.** Service code updates exactly the ids in `items` and leaves all other rows untouched; DTO requires `items.length >= 1`.
- Unit tests (`*.service.spec.ts`) assert "updates sortOrder for every entry" for the listed entries only.
- The Stage 5.22 API QA relies on it: single-item reorder (`runner:1007`), a no-op single hero reorder (`:1119-1128`), and a two-row swap (`:1375-1376`).
- Admin UI always sends the **full displayed list** (`moveItem()` rewrites every row to `0..n-1`, list `limit=100`) — so the UI *behaves* as complete replacement, but the API does not require it.

### 5.2 Target contract (**TR: keep partial, make it strict**)
| Case | Response | Notes |
|---|---|---|
| empty `items` / `items` missing / not an array | 400 | already true (`ArrayMinSize(1)`) |
| item without `id` or `sortOrder`, non-integer | 400 | already true |
| negative `sortOrder` | 400 | already true (`@Min(0)`); add `@Max(100000)` |
| malformed id (not a uuid) | 400 | new `@IsUUID()` on entry `id` |
| duplicate `id` in payload | 400 | new; `"شناسه تکراری در فهرست ترتیب"` |
| duplicate `sortOrder` in payload | 400 | new |
| unknown id (not in this resource's table) | **422**, nothing written | pre-check `findMany({ id: { in } })` and compare counts, *before* the transaction; `P2025` still caught → 404/422 as a race safety net |
| ids of another Home resource | 422 (same as unknown) | tables are separate |
| inactive row id | **accepted** | admin needs to reorder inactive rows (current behavior, and UI sends them) |
| ids missing from the payload (partial) | accepted | rows keep their `sortOrder` |
| `sortOrder` equal to an *unlisted* row's | accepted | ties resolved deterministically (below) |
| valid payload | 200, same body as today (public active list) | Admin ignores this body |

Determinism: change `orderBy` to `[{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]` on public and admin lists (fixes P10; does not alter order of rows that have unique `sortOrder`, which is every row in inspected data).

### 5.3 Alternative (needs BD-3): complete replacement
Require `items` to equal the full current id set (else 422). Cleaner, but (a) breaks the existing QA runner's single-item and swap payloads (QA changes required), (b) rejects a reorder made from a stale admin list when another admin created a row meanwhile, (c) caps usable size to the admin list `limit` of 100. **Not recommended.**

Mosaic note: `half` and `wide` share one `sortOrder` space (public list is one array). Unchanged; the customer adapter splits by `slotType`.

---

## 6. Public Dependency Contract

### 6.1 Current behavior (code + data)
| Situation | Public `GET /home/*` today | Customer effect today (`ServiceBannerGrid.tsx:72`, `NewsCarousel.tsx:75`, `ServiceMosaic.tsx:62`) |
|---|---|---|
| Home row inactive | omitted | not shown |
| Category inactive | **row returned** | banner shown normally |
| Category does not exist | impossible: FK `RESTRICT` blocks category delete; create/update with a bad id fails at DB → 500 today | — |
| `MediaAsset` soft-deleted | row returned **with a URL** (`resolveMediaUrl` ignores `active`); media route 404s | `<img>` element renders broken (alt text) |
| `MediaAsset` does not exist | impossible via FK; `SET NULL` if hard-removed; bad id on write → 500 today | `image: null` → themed gradient fallback |
| `mediaAssetId` null | `image: null` | themed gradient/emoji fallback (no `<img>`) |

**Observed data:** dev DB has 1 banner (`اتومبیل`) attached to an inactive category, 0 Home rows with a soft-deleted asset. **Real staging (public):** the first banner `اتومبیل` is returned and its category is `active: false` in `GET /categories`; the 4 other banners and all 4 mosaic tiles have active categories.

### 6.2 Option A — Public Home checks only the Home row
- **API:** unchanged. `where: { active: true }`.
- **Customer:** an inactive category's banner keeps showing (and links to a category the Services journey may not show); a soft-deleted image renders broken unless media deletion is prevented (§7).
- **Admin:** no visible change; nothing warns that a row points at an inactive category/deleted media.
- **Compatibility:** 100% backward compatible.
- **Data:** none.

### 6.3 Option B — Public Home also requires active/non-deleted dependencies
Two independently choosable sub-rules:
- **B-category:** `where: { active: true, category: { active: true } }` for banners and mosaic tiles.
- **B-media:** for a soft-deleted asset either **B-media-1** return `image: null` (customer falls back to the themed gradient; row stays), or **B-media-2** hide the row.
- **API:** public lists can become shorter/different from the admin lists; admin count ≠ public count.
- **Customer:** B-category **would remove the `اتومبیل` banner from the live staging Home today** (5 → 4 banners). If a section drops to 0 items the customer app falls back to *static mock content* (`useHomeCms.ts:107`), which is a larger visible change than one missing tile. B-media-1 turns a broken image into a clean fallback.
- **Admin:** admin list still shows the row; needs an indicator ("hidden: category inactive / media deleted"). That would require **additive** admin response fields (e.g. `categoryActive`) or a computed flag — an *additive* contract change, not made in 5.16 unless approved. Existing Admin UI would ignore unknown fields (TypeScript interfaces are structural).
- **Compatibility:** behavior change for current live content; no schema change.
- **Data/migration:** no migration. Before enabling, list rows that would change visibility (the pre-flight query in §12) and let the business either activate the category or accept the change.

### 6.4 Recommendation (TR only, not a business decision)
- Ship **B-media-1** (`image: null` instead of a dead URL) — it can only turn a broken image into the existing designed fallback and changes no row's presence. *Still counts as a BD because it changes customer-visible output; listed as BD-2.*
- For category: **Option A now, with an admin-side visibility signal deferred** — because Option B-category changes what is live on staging today and the product intent for `اتومبیل` is unknown. Revisit once the business confirms whether `اتومبیل` should be visible.

---

## 7. Media Deletion Contract

### 7.1 Current behavior (verified)
- `DELETE /admin/media/:id` → `active=false`, `deletedAt=now()`; storage object kept; audited. No reference check (`media.service.ts:remove`).
- The public serving route returns 404 for `active=false` (`media-files.controller.ts`), so **every** reference to that asset breaks on the Customer App at once.
- References that exist in the schema: `home_service_banners`, `home_service_mosaic_tiles`, `home_news_articles`, `categories`, `services` (`mediaAssetId`), `card_products`, `category_cards` (all FK `SET NULL`, not triggered by a soft delete), plus **`services.galleryMediaAssetIds` (JSON id array, no FK)**.
- Dev data: 101 assets (48 active); references from non-Home tables: categories 14, services 1, card_products 1, category_cards 14; **0 assets shared between Home and non-Home**, 0 references to a soft-deleted asset.
- The Admin media grid calls `mediaApi.remove(id)` (`MediaLibraryGrid.tsx:36`) with no usage warning found by grep.

### 7.2 Options
| Option | API | Database | Admin UX | Compatibility | Risk |
|---|---|---|---|---|---|
| **A. Block when referenced** | `DELETE` → **409** with a Persian message + list of referrers (type, id) | none (read-only usage query across the 7 FK columns + JSON gallery) | delete disabled/explained for in-use assets; must show 409 message (existing `ApiError` already surfaces `error.message`) | Unused-asset deletes unchanged; in-use deletes now fail (behavior change) | Lowest visual risk; gallery JSON needs a `jsonb` contains query; race between check and delete (mitigate in one transaction) |
| **B. Soft-delete, keep references** *(today)* | 200 | `active=false`, references remain | none | as-is | Broken images on every referrer (Home, Category, Service, Card, CategoryCard) |
| **C. Allow delete, accept broken refs** | 200 | as B (or hard-delete) | none | as-is | Same as B; hard delete additionally makes recovery impossible |
| **D. Soft-delete + detach** | 200 | in one transaction set every referrer's `mediaAssetId` to NULL | warning "N places will lose their image" | Rewrites `mediaAssetId` on **card_products/categories/etc.** → violates the card-image preservation guarantee | **Rejected for 5.16** (mutates card/category image references) |
| **E. Force flag** (block by default, `?force=true` = B) | 409 unless forced | as B when forced | confirm dialog | additive | Allows the same breakage deliberately |

### 7.3 Recommendation (TR only)
**Option A**, scoped to `DELETE /admin/media/:id`, counting *all* referrers (not only Home), with the check and the update in one transaction. It is the only option that guarantees no existing card, category or Home image is broken by a deletion, and it modifies no `mediaAssetId`. Whether to block, warn or allow is **BD-4**. If the business chooses B/C, the mitigation is B-media-1 from §6 plus an admin warning.
Optional (not required): index-free `jsonb` search on `galleryMediaAssetIds`; no schema change needed.

---

## 8. Active State Contract

- **Confirmed:** `active: boolean` is the only content state on the four Home tables (`schema.prisma`, migration `20260825152328`). No `status`, `publishedAt`, schedule or archive column exists for Home.
- It is **intentional**: the schema comment on the Home block says "no scheduling/publish-later workflow (ADR §7 already decided against one — `active` is the only publish control, same as every other admin-managed model in this codebase)". Category/Category-card/Orbit follow the same model.
- **Repository evidence that does *not* support adding states to Home:** `CardProductStatus {DRAFT, ACTIVE, INACTIVE, EXPIRED}` exists only for `CardProduct` (a purchasable product with a lifecycle), not for content. `MediaAsset` has `active` + `deletedAt` (soft delete), not a publish state.
- **Decision:** Stage 5.16 introduces **no** new state. **BD:** none required, unless the business explicitly asks for scheduling.
- Behavior to *document* (no change): admin sees inactive rows; public omits them; a section with zero active rows shows customer-side static fallback content (`useHomeCms.ts`).

---

## 9. Audit Contract

| Current | 5.16-B action | Reason |
|---|---|---|
| Best-effort (`record()` swallows errors) | **Keep** | ADR §8 rationale (a failed audit write must not block an admin action) is intentional; changing it changes availability semantics. |
| Written after the mutation, outside its transaction | **Keep** | Consequence of the above; making it transactional would make audit failure block content edits. |
| Partial snapshots (UPDATE stores 2 fields; CREATE 2; DELETE 2) | **Harden (additive)**: extend `beforeJson`/`afterJson` to include the fields the endpoint can actually change — `mediaAssetId`, `categoryId`, `theme`, `wide`, `sortOrder`, `slotType`, `cardKey`, `bodySlug`, and text fields. Keep existing keys (`title`/`kicker`/`active`) so any reader of old rows keeps working. | Makes media re-pointing traceable; no schema change (`Json`). |
| REORDER stores only `afterJson.items` | **Harden**: also store `beforeJson.items` (previous `sortOrder` of each listed id) | Small, additive; the before-state is read anyway by the new existence pre-check. |
| New: rejected writes | **Add** (optional): none | Not needed; out of scope. |
| No filters on `GET /admin/audit-logs` | **Leave unchanged** in 5.16-B | Read API, `SUPER_ADMIN`-only, not part of the Home write hardening; add in a later stage if the audit viewer is built. |
| No retention policy | **Leave unchanged; report only** | Retention is an operational/legal policy decision, not backend hardening. **BD-7** if required. |
| Audit for media delete | Extend `beforeJson` with the referrer summary *only if* Option A/E is chosen | consistency |

Dev audit table already holds ~1,100 Home/Media rows (e.g. 156 `HomeHeroCard` UPDATE, 29 REORDER), i.e. historical rows keep the old shape — readers must tolerate both.

---

## 10. Existing Admin Compatibility

Inspected (no browser run): `apps/admin/src/features/home/{api,logic.ts,types.ts,rbac.ts}`, the four forms, `lib/api-client.ts`, `lib/media/media-api.ts`, `components/media/MediaLibraryGrid.tsx`, `features/catalog/*` forms.

### 10.1 Calls and payloads
| Call | Payload actually generated | Response shape expected |
|---|---|---|
| `GET /admin/home/<r>?limit=100` | none | `{items,total,skip,take}` (`Paginated<T>`) |
| `GET /admin/home/<r>/:id` | | admin object |
| `POST /admin/home/<r>` | full form state. Banner: `{categoryId, mediaAssetId (string\|null), kicker, theme, wide, active}`; Mosaic: `{categoryId, mediaAssetId, slotType, kicker, title: string\|null, lead: string\|null, theme, active}`; Hero: `{cardKey,label,title,subtitle,displayNumber,ownerLabel,colorPreset,active}`; News per `NewsArticleForm.tsx:47` | admin object |
| `PUT /admin/home/<r>/:id` | same full object, or `{active}` alone (toggle) | admin object |
| `DELETE /admin/home/<r>/:id` | | `{id}` |
| `PATCH /admin/home/<r>/reorder` | `{items:[{id,sortOrder}]}` for the **full displayed list**, `sortOrder` = `0..n-1` | response typed `unknown`, **never used**; list is re-fetched |
| `GET /categories?limit=100` (public) | | `{items}`; filters `active` client-side |
| `GET /admin/media?limit=50`, `POST /admin/media/upload`, `DELETE /admin/media/:id` | multipart `file` (+`altText`) | `MediaAsset` shape |

Error handling: `ApiError(message, code, status)` built from `{success:false,error:{code,message}}`; UI shows `message`; no code branches on `status` values other than 401 refresh (`api-client.ts:75`, grep `.status ===` returns only that).

### 10.2 Would Stage 5.16-B break it?
| Change | Effect on Admin | Verdict |
|---|---|---|
| 409 / 422 instead of 500 with Persian messages | shown through the existing message path | **Improves**, no break |
| Trim/non-empty on required text | forms already use HTML `required`, but whitespace-only passes today and would now 400 | Safe; message displayed; recommend (not required) matching client validation later |
| `sortOrder` 0…100000 | UI sends `0..n-1` | Safe |
| `@IsUUID` on ids | all ids inspected are uuids | Safe |
| `mediaAssetId` must exist & be active (422) | picker lists active assets only (`GET /admin/media` filters `active`) | Safe; only fails for a stale picker state |
| Reorder strictness | UI sends unique ids, unique positions, existing ids | Safe |
| Reorder must stay partial | UI sends full list, QA sends partial | Keep partial |
| Response of reorder unchanged | UI ignores it | Safe |
| Deterministic `orderBy` | none | Safe |
| Media delete → 409 when referenced (Option A) | `MediaLibraryGrid.remove` would surface the error; **no in-use warning exists in the UI**, so the message text matters | Minor UI/UX follow-up, not a break |
| Public Option B (if chosen) | Admin list unchanged; no built-in "hidden" indicator | Not a break; UX gap |
| `PUT` merge semantics | Admin toggle sends `{active}` alone | **Must remain** |

No UI redesign is proposed or required.

### 10.3 Card / category image edit paths (documented separately, **not modified**)
These pre-existing capabilities can change or clear an individual card's or category's media reference; they are **outside Home** and unchanged by this plan:
1. `PUT /admin/card-products/:id` accepts `mediaAssetId`. The admin `CardProductForm.tsx` submits the whole form state including `mediaAssetId` (initialized from the loaded record, `null` if none) — so a normal edit re-sends the *existing* value; changing/clearing it is possible only by deliberately using the picker. `null` is accepted at runtime by `@IsOptional()`.
2. Same for `PUT /admin/categories/:id`, `/admin/category-cards/:id`, `/admin/services/:id` (+ `galleryMediaAssetIds`).
3. `DELETE /admin/media/:id` (see §7) — **the only path where a Home/Media admin action can break a card's or category's image without touching that card's record.**
4. **No Home endpoint (`/admin/home/*`) writes to `card_products`, `categories`, `category_cards` or `services`.** Verified: the four Home services write only their own tables and `admin_audit_logs`.

---

## 11. Backward Compatibility

### 11.1 Response shapes
Unchanged: public arrays, admin object shapes, `{items,total,skip,take}`, reorder response, error envelope. New: only additional error statuses (409/422) where 500 or an unhandled 400/404 existed.

### 11.2 Behaviors that change (and who could notice)
| Change | Who |
|---|---|
| bad `categoryId`/`mediaAssetId`/duplicate key/unknown reorder id: 500 → 409/422 | API clients; strictly an improvement |
| whitespace-only / over-length / bad `bodySlug` strings now 400 | admins entering such values (none exist in inspected data) |
| tie ordering becomes deterministic | rows with equal `sortOrder` (none in inspected data) |
| media delete blocked when referenced (if BD-4 = block) | admins |
| public Home dependency filtering (if BD-1/2 ≠ Option A) | Customer App |

### 11.3 Card image preservation guarantee (release gate)
Stage 5.16-B **must not** modify, migrate, regenerate, remap or delete any existing image reference. Concretely:
1. No migration and no data write is in scope; no seed is touched (`seed.ts`, `seed-home-media.ts` unchanged).
2. New `mediaAssetId` validation applies only to **Home DTOs on write**; it never rewrites stored values and never runs at read time on `card_products`, `categories`, `category_cards`, `services`.
3. Public Home read changes (BD-2 B-media-1) touch only Home responses, not the Cards/Categories APIs.
4. Media deletion hardening is *blocking-only* (Option A); Option D (detach/rewrite references) is explicitly rejected.
5. **Gate:** before and after deploying 5.16-B run one read-only query on the real DB and require identical output:
   `SELECT md5(string_agg(id||':'||coalesce("mediaAssetId",'-'), ',' ORDER BY id)) FROM card_products;` — and the same for `categories`, `category_cards`, `services`, `home_service_banners`, `home_service_mosaic_tiles`, `home_news_articles`; plus `SELECT md5(string_agg(id||':'||active::text, ',' ORDER BY id)) FROM media_assets;`.
6. **Observation to confirm with product:** on real staging, the 5 ACTIVE CardProducts return `image: null` (public `GET /cards`), and the customer card tile falls back to the rendered finance-card artwork (`CardProductTile.tsx`); the dev DB has 1 CardProduct with a `mediaAssetId` (the INACTIVE legacy card) and 14 CategoryCards with media. So the "approved image of an individual card" visible today is either that rendered card artwork, a `CategoryCard` image, or a `Category` image — **I could not determine which from the repository alone**. The guarantee above covers all three, because it covers every `mediaAssetId` column.
7. A category banner and an individual card visual are stored separately (`Category.mediaAssetId` / Home `mediaAssetId` vs `CardProduct.mediaAssetId`); the plan never reads one for the other.

---

## 12. Database / Data Migration Requirements

- **Schema migrations: none required.** Optional only if BD-4 chooses reference tracking beyond queries (not proposed).
- **Data migrations: none.**
- **Pre-flight (read-only, run on the *real* staging DB by someone with DB access before B merges to a deploy):**
  1. Home rows with empty/whitespace strings, or strings longer than the §4.1 maxima.
  2. Home rows with `bodySlug` not matching the regex.
  3. Duplicate `sortOrder` within a resource; negative `sortOrder`; `sortOrder > 100000`.
  4. Wide mosaic rows missing `title`/`lead`.
  5. Home rows whose Category is inactive / whose MediaAsset is soft-deleted (feeds BD-1/BD-2).
  6. Non-uuid ids.
  7. The checksum queries of §11.3 (baseline).
- Dev-DB result of these checks: all clean except item 5 (1 banner with an inactive category).
- **If the pre-flight finds violations:** loosen the proposed constraint for that field (e.g. raise the max) rather than migrating data. No constraint is enforced on *reads*, so existing rows keep serving; a violating row can only fail when an admin re-saves it.

---

## 13. Implementation Plan (Stage 5.16-B scope)

Home module + media delete only. Order:

1. **Pre-flight** (§12) and baseline checksums (§11.3). *Blocks steps 2+ if it reveals violations.*
2. **Shared Home helpers** (new file, e.g. `home/home-write.util.ts`): `assertCategoryExists`, `assertMediaAssetUsable`, `mapPrismaWriteError` (`P2002`→409, `P2025`→404, others rethrown), `normalizeOptionalText` (`''`→`null`).
3. **DTOs** (create + update ×4, reorder): `@Transform` trim, `@IsNotEmpty`, `@MaxLength`, `@IsUUID`, `@Max`; slug regex; keep nullable fields nullable (`@ValidateIf` / `@IsOptional`).
4. **Services** (×4): pre-check FKs/uniques (422/409) before write; wrap write in `mapPrismaWriteError`; extend audit snapshots; `orderBy` tiebreak.
5. **Reorder** (×4): payload validation (dup ids/positions → 400 via DTO/custom validator), existence pre-check (422), unchanged transaction, add `beforeJson` in audit.
6. **Path ids**: `ParseUUIDPipe` on `:id` for the 4 admin controllers (400 on malformed id; today a non-uuid id yields 404 — **behavior change; TR: apply**).
7. **Media delete** (per BD-4): usage query across the seven FK columns + `galleryMediaAssetIds`; 409; no rewrite of any reference.
8. **Public dependency change** only if BD-1/BD-2 approve it.
9. Update stale comment in `media.service.ts:159`; update `docs/home-admin-contract.md` §6 to match code (doc-only).
10. Post-deploy: re-run checksums (§11.3); Stage 5.22 API QA re-run (approved staging QA, separate from this stage).

Explicitly **not** touched: global `HttpExceptionFilter`, other modules' reorder (N3), `AdminAuditLogService.record()` semantics, audit read API, Category/Card/Service endpoints, Admin UI, seeds.

---

## 14. Test Plan

**Unit (Jest, mocked Prisma, no DB writes)** — additions to each `home-*.service.spec.ts` and DTO specs:
- Error mapping: real `Prisma.PrismaClientKnownRequestError` instances with codes `P2002` and `P2025` (installed 6.19.3) → 409/404; unknown code rethrown (→ 500).
- FK: unknown `categoryId` → 422; unknown or soft-deleted `mediaAssetId` → 422; `mediaAssetId: null` accepted on create and update.
- Uniques: `cardKey` and `bodySlug` conflicts → 409 (pre-check and race path).
- DTO: empty/whitespace, over-max, bad enum, non-int/negative/too-large `sortOrder`, bad uuid, extra property; whitespace trimmed; `''`→`null` for nullable text.
- Reorder: empty, malformed id, duplicate id, duplicate position, negative → 400; unknown id → 422 with **no** `update` call; valid partial (1 item) accepted; inactive id accepted; audit has `beforeJson`+`afterJson`.
- Ordering: tiebreak `orderBy` arguments asserted.
- Audit: snapshots include the new fields and still include the old keys.
- Media: delete of referenced asset → 409 (each referrer type incl. gallery JSON), unreferenced → 200 and soft-delete unchanged; **no `mediaAssetId` update is ever issued** (asserted).
- Regression: existing suites for home/media/admin-audit/common (71 tests today) stay green.
- Compatibility: payload fixtures copied from the Admin forms (§10.1) must pass the new DTOs unchanged (create with `mediaAssetId: null`, mosaic `title/lead: null`, `{active}`-only `PUT`, full-list reorder).

**API QA (staging, separate approved stage, mutating):** re-run the existing `authenticated-qa-runner.ts` (114 PASS baseline expected to stay), then add cases for 409/422/400 responses and reorder rejects. Not run in 5.16-A.

**Release gates:** typecheck + lint + unit tests; checksum equality (§11.3); no Browser QA in the hardening stage; customer visual check only in a later, explicitly approved stage.

---

## 15. Explicit Non-Goals
- No code, schema, migration, seed, data or deployment change in 5.16-A.
- No draft/published/archived/scheduled states.
- No change to card, category, service or CategoryCard visuals, artwork, `mediaAssetId` values, crops or mapping; no image generation, replacement, migration, detach or "refresh".
- No global error-filter change; no changes to non-Home reorder endpoints.
- No Admin UI redesign; no audit retention/filtering; no audit transactional guarantee.
- No change to `GET /categories` (which returns inactive categories, N1) or to Customer App fallback logic.
- No Browser QA; no run of `authenticated-qa-runner.ts`.

---

## 16. Decisions Required Before Implementation

| ID | Decision | Options | Owner | Engineering recommendation (TR) |
|---|---|---|---|---|
| **BD-1** | Should a Home row whose Category is inactive appear on the Customer Home? (This would hide the live `اتومبیل` banner on staging.) | A: show / B: hide | Product | A now; revisit after product confirms intent for `اتومبیل` |
| **BD-2** | If a Home row's MediaAsset is soft-deleted: broken URL / `image: null` fallback / hide row | A / B-media-1 / B-media-2 | Product | B-media-1 |
| **BD-3** | Reorder: partial (today) vs complete replacement | partial-strict / complete | Product + QA owner | partial-strict |
| **BD-4** | Deleting a media asset that is referenced (by Home, Category, Service, Card, CategoryCard) | block (409) / warn-then-force / allow | Product | block (409) |
| **BD-5** | Must a `wide` mosaic tile have `title` and `lead`? | enforce (422) / keep optional | Product | keep optional until Admin form is updated (the form currently allows blank) |
| **BD-6** | Confirm `active` stays the only Home state | confirm / request scheduling | Product | confirm |
| **BD-7** | Audit retention period, if any | none / N days | Product + compliance | none in 5.16 |
| **BD-8** | Confirm which visual is the "approved individual card image" on the Customer App (rendered card artwork vs `CategoryCard` vs `Category` image) — see §11.3 item 6 | | Product/design | protected in all cases |
| Technical (no BD needed) | Error mapping mapping (§3), field limits (§4, subject to pre-flight), strict reorder payload (§5.2), `ParseUUIDPipe`, deterministic ordering, additive audit snapshots | | Engineering | proceed |

---

## 17. Final Stage 5.16-A Assessment

- Stage 5.15 findings P1–P10 are all reflected (§2) and each has a contract in §3–§9.
- Existing Admin API clients, payloads and response expectations were checked (§10); no proposed change breaks them provided the four compatibility constraints hold.
- Existing data was inspected before proposing constraints (§4.1). Limitation: dev DB + public staging API only; the real DB pre-flight (§12) is a hard prerequisite.
- Business decisions are isolated in §16; technical recommendations are labeled TR.
- Card/category visual preservation: no proposed change writes or rewrites any `mediaAssetId`; a checksum release gate is specified; the only pre-existing card-image risk found (unchecked media delete) is addressed by *blocking*, not rewriting.
- **Assessment:** the plan is complete and implementable. Stage 5.16-B may start after (a) the §12 pre-flight passes, and (b) BD-2, BD-3, BD-4 and BD-5 are answered (BD-1 may default to "A / unchanged").

### Final decision table
| Decision | Current Behavior | Proposed Contract | Business Decision Required |
|----------|------------------|-------------------|-----------------------------|
| Error mapping | Prisma errors → 500 `INTERNAL_ERROR`; only `P2002` handled (orders) | 400 malformed / 404 missing / 409 unique (`cardKey`, `bodySlug`) / 422 invalid reference (category, media, reorder ids) / 500 unexpected; local to Home services | No |
| Validation | `@IsString` only; no max length, no non-empty, no uuid, FK checked by DB | trim + non-empty + max lengths (§4.1), `@IsUUID`, `sortOrder` 0…100000, FK pre-checks (422), nullable media/title/lead preserved | No for limits/format; **Yes** for BD-5 (wide `title`/`lead`) |
| Reorder | Partial; no dup/existence checks; unknown id → 500; ties unspecified | Stay partial; 400 for empty/malformed/dup ids/dup positions/negative; 422 unknown ids with nothing written; deterministic tiebreak | Yes (BD-3, default = partial-strict) |
| Inactive category | Public row still returned | Option A (no change) recommended; Option B would hide the live `اتومبیل` banner | **Yes** (BD-1) |
| Deleted media | Row returned with a dead URL (broken `<img>`) | Option A (as-is) or B-media-1 (`image: null` → themed fallback); TR B-media-1 | **Yes** (BD-2) |
| Media deletion | Soft delete, no reference check, breaks all referrers | Block with 409 when referenced by any table (recommended); never rewrite references | **Yes** (BD-4) |
| Audit | Best-effort, post-mutation, partial snapshots, no filters, no retention | Keep best-effort/non-transactional; add fields to snapshots and `beforeJson` for reorder; leave filters and retention unchanged | No (retention: BD-7 if needed) |
