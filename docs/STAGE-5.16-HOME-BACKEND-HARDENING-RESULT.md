# STAGE 5.16-B — Home Backend Contract Hardening: RESULT

**Implementation status: COMPLETE locally. All local gates PASS.**
**Deployment: NOT PERFORMED. Staging AFTER verification: NOT PERFORMED.**
**Browser QA: NOT RUN. `authenticated-qa-runner.ts`: NOT RUN.**

Implements `docs/STAGE-5.16-HOME-BACKEND-HARDENING-PLAN.md` with the product decisions locked in the task (BD-1 … BD-8). Backend only; no customer UI, Admin UI, seed, migration or image change.

## 1. Summary of the result

| Item | Result |
|---|---|
| Unit tests (full backend) | **PASS — 51 suites / 347 tests** (before: 47 suites / 255 tests) |
| Home + media + audit-log + common suites | **PASS — 19 suites / 163 tests** (Stage 5.15 baseline: 15 suites / 71 tests; all 71 still pass, 9 assertions deliberately updated, see §5) |
| Typecheck (`tsc --noEmit`) | **PASS** (0 errors) |
| Lint (`eslint` + prettier, run on all 30 changed files, no `--fix` on unrelated code) | **PASS** (0 errors, 0 warnings) |
| Build (`nest build`) | **PASS** |
| Migrations | **NO** |
| Seed changes | **NO** |
| Customer/Admin UI changes | **NO** |
| Global error filter changed | **NO** |
| Browser QA | **NOT RUN** |
| `authenticated-qa-runner.ts` | **NOT RUN** |
| **CARD ARTWORK PRESERVATION (code level)** | **PASS** — no code path in this change writes any protected image reference (§6) |
| Post-deploy checksum comparison | **PENDING** (requires deployment; see §9) |

## 2. Pre-flight (provided by the product owner; run by them on the real staging DB)

I could not reach the staging DB from this environment; the results below were supplied in the task and are recorded as given, not independently verified.

- Home rows: hero 3/3 active, banners 5/5, mosaic 4/4, news 8/8.
- empty-text 0, too-long 0, bad-bodySlug 0, duplicate-sortOrder 0, invalid-sortOrder 0, wide-missing-title/lead 0, soft-deleted-media rows 0, non-uuid ids 0.
- `home rows w/ inactive category = 1` — known and intentional (BD-1, behavior kept).
- Every proposed limit/format in the DTOs therefore holds for all existing staging rows, so no existing row becomes invalid on read.

## 3. Image-integrity baseline (real staging, before) — release gate

| Table | count | checksum |
|---|---|---|
| card_products | 5 | `3820a5b2562c2f49e4022d8a2ef8d413` |
| category_cards | 47 | `a1810c0e7e050f9b0000327c3c8b8b9d` |
| categories | 24 | `e7dd7c01de3c76c8fd0460a3116a27b6` |
| services | 113 | `5c75a0e357a7b4a0870ddb52cbed1d84` |
| services.gallery | 113 | `1426eb78c0855edcd8c633c881dcde12` |
| home_service_banners | 5 | `c138bf6808b974d62010b7cf87d7cfac` |
| home_service_mosaic_tiles | 4 | `7b1ee41e4242ecf2475665e6ed20d3d2` |
| home_news_articles | 8 | `7fdfecdb6ef0a4e473b13fceefc73d16` |
| media_assets (id + active) | 180 | `b03154a4db0168b43398b11791a2a5f4` |

## 4. Exact behavior changes

### 4.1 Error mapping (Home services + media delete only; global filter untouched)
| Situation | Before | Now |
|---|---|---|
| duplicate `cardKey` (create/update) | 500 | **409** (`این کلید کارت قبلاً استفاده شده است.`) — pre-check + `P2002` catch |
| duplicate `bodySlug` | 500 | **409** (`این نامک مقاله قبلاً استفاده شده است.`) — own row excluded |
| unknown `categoryId` (banner/tile) | 500 (FK) | **422** (`دسته‌بندی انتخاب‌شده معتبر نیست.`, the existing catalog string) |
| unknown / soft-deleted `mediaAssetId` | 500 (FK) / accepted | **422** (`رسانه انتخاب‌شده معتبر نیست.`) |
| FK violation that slips past the pre-check (`P2003`) | 500 | **422** |
| row deleted mid-request (`P2025`) on update/delete/reorder | 500 | **404** |
| reorder with an unknown id | 500 | **422**, body `details.unknownIds`, nothing written |
| malformed uuid in `:id` path | 404 | **400** (`ParseUUIDPipe`, never reaches Prisma) |
| explicit `null` on a NOT NULL field (e.g. `kicker: null`, `theme: null`) | 500 | **400** |
| delete a media asset that is referenced | soft-deleted (images 404) | **409**, nothing written |
| any other error | 500 | 500 (re-thrown unchanged, not swallowed) |

Prisma codes handled: `P2002`, `P2003`, `P2025` (asserted in tests with real `PrismaClientKnownRequestError` instances from the installed Prisma 6.19.3). Only `P2002` was already referenced in the repo (`orders.service.ts`).

### 4.2 Validation (all four resources, create + update)
- Text is **trimmed**; empty/whitespace → 400. Max lengths: label/ownerLabel 100, title 200 (news 300), subtitle 500, displayNumber 50, kicker 200, news category 100, news lead 1000, mosaic title 200, mosaic lead 500, bodySlug 100.
- `bodySlug`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`; blank → `null`.
- `@IsUUID()` on `categoryId`, `mediaAssetId`, and reorder ids.
- `sortOrder`: integer, `0 ≤ n ≤ 100000` (QA's `9999`/`9998` remain valid).
- **Preserved nullable**: `mediaAssetId`, mosaic `title`, mosaic `lead` (blank → `null`), news `bodySlug`. **BD-5:** `title`/`lead` stay optional for both slot types.
- Unknown properties still 400 (unchanged global pipe).

### 4.3 Reorder (partial semantics KEPT — BD-3)
- Only the listed rows are updated; unlisted rows untouched. Single-item and two-row-swap payloads (Stage 5.22 API QA shapes) remain valid.
- 400 (DTO, before anything else): empty/missing `items`, malformed uuid, duplicate ids, duplicate positions, negative/non-integer/`> 100000` positions.
- 422: unknown id (existence pre-check *before* the transaction → no writes, no audit).
- Ordering is now deterministic on public and admin lists: `sortOrder, createdAt, id`. Existing data has unique `sortOrder`, so current order is unchanged.
- Other modules' reorder endpoints (`category-cards`, `categories`, `orbit-items`) are untouched.

### 4.4 Public Home dependencies
- **BD-1 (kept):** `listPublic` still filters only on the Home row's own `active`. An inactive category does **not** hide its banner. Covered by a test.
- **BD-2:** a soft-deleted `MediaAsset` yields `image: null` on banners, mosaic tiles and news; the row stays, `mediaAssetId` is untouched, nothing is substituted. (Admin responses also show `image: null` but still expose the stored `mediaAssetId`.)
- Writes require an **existing, active** `MediaAsset`; a `Category` only has to exist (not be active).

### 4.5 Media deletion guard (BD-4)
`DELETE /admin/media/:id` checks, read-only, every reference location: `home_service_banners`, `home_service_mosaic_tiles`, `home_news_articles`, `categories`, `category_cards`, `services.mediaAssetId`, **`services.galleryMediaAssetIds`** (JSON id array, checked with `array_contains`; SQL verified to be `@>`, and the operator semantics verified on the real Postgres 16), `card_products`. Any hit → **409** with `details.references` (per-location counts). It never detaches, rewrites, replaces or cascades. Unreferenced assets are soft-deleted exactly as before.

### 4.6 Active state / audit
- `active` remains the only Home state (BD-6). No new state.
- Audit stays best-effort and non-transactional (BD-7); a test proves a failing audit write does not fail the mutation and no transaction wraps them. Snapshots are richer: create/update/delete now record every editable column (`beforeJson`/`afterJson` are supersets that still contain the old `title`/`kicker`/`active`/… keys); reorder now records `beforeJson.items` (previous positions) besides `afterJson.items`. Audit read API and retention unchanged.

### 4.7 Existing Admin compatibility (checked against source; no browser)
Fixtures copied from the Admin forms are asserted valid: banner create with `mediaAssetId: null`; mosaic create with `mediaAssetId/title/lead: null`; news with `bodySlug: null`; hero full-form update and `{ active }` toggle; full-list reorder `0..n-1`; list response shape `{items,total,skip,take}` and `PUT` partial-merge unchanged. The reorder response body is unchanged (Admin ignores it anyway).

## 5. Files changed (25 modified + 9 new, all in `backend/` and `docs/`)

**Source (modified):** `home/dto/{create,update}-home-{hero-card,service-banner,service-mosaic-tile,news-article}.dto.ts` (8), `home/dto/reorder-home-items.dto.ts`, `home/home-{hero-cards,service-banners,service-mosaic-tiles,news-articles}.service.ts` (4), `home/home-*-admin.controller.ts` (4, `ParseUUIDPipe` only), `home/home-media.util.ts`, `media/media.service.ts`.
**Source (new):** `home/home-write.util.ts`, `home/dto/home-dto.decorators.ts`.
**Tests (new):** `home/home-write.util.spec.ts`, `home/home-dto-validation.spec.ts`, `home/home-hardening.service.spec.ts`, `home/home-image-integrity.spec.ts`.
**Tests (updated, 4 Home service specs + `media.service.spec.ts`):** only where the intended contract changed — `orderBy` now the deterministic constant; new `category`/`mediaAsset` mock methods for the added reference checks; reorder tests supply the existence pre-check result; media `remove` mocks gain the read-only reference counts. No assertion was removed or loosened; 9 tests that encoded the old contract were adapted and re-pass.
**Docs:** `docs/home-admin-contract.md` (status banner + corrected reorder body and `/image` endpoints), `docs/STAGE-5.15-…-ANALYSIS.md`, `docs/STAGE-5.16-…-PLAN.md`, this file.
**Not changed:** `prisma/**` (schema, migrations, seeds), `apps/**`, `packages/**`, `deploy/**`, `common/filters/**`, any non-Home reorder, `authenticated-qa-runner.ts`.

## 6. Image-integrity evidence

1. **No write path:** `home-image-integrity.spec.ts` statically scans every Home and media source file (non-spec) and asserts: (a) no write (`create/update/upsert/delete…`) on `cardProduct`, `categoryCard`, `category`, `service`, `customerCard`, `order`; (b) no raw SQL; (c) `media.service.ts` writes only `mediaAsset`, and touches all other tables only through `.count()`; (d) each Home service writes only its own `home_*` table.
2. `media.service.spec.ts` asserts that a referenced-asset delete makes **no** `update`, no storage removal, no audit; the 409 test asserts the reference models expose only `count`.
3. `git diff` search for writes to `cardProduct|categoryCard|category|service` and `galleryMediaAssetIds`: the only hits are the two read-only `count({ where: { galleryMediaAssetIds: { array_contains } } })` filters.
4. **No migration, no seed, no `prisma/**` change.** `apps/**` untouched, so no customer artwork or fallback rendering code changed.
5. Local dev DB (read-only, not the staging DB): the same checksum queries were run after implementation and all gates: card_products `2da26fba…`, category_cards `5b1e9190…`, categories `8085b861…`, services `4f6ecd6c…`, services.gallery `10170ee1…`, home_service_banners `fc249e8d…`, mosaic `2ca451ce…`, news `eed11fd5…`, media_assets `fbb9a1b2…`. **A before-implementation dev snapshot was not taken**, so this is a record, not a comparison; the release gate is the staging BEFORE/AFTER comparison in §9.
6. Card artwork: existing individual card visuals were not read, resolved or changed by any code in this stage (BD-8: preservation only).

**CARD ARTWORK PRESERVATION: PASS** (code level: no protected image reference is written by any changed code; database-level BEFORE == AFTER on staging is still to be confirmed after deployment).

## 7. Known limitations
- **Not exercised over real HTTP.** 409/422/400 mappings are proven by unit tests (mocked Prisma, real `PrismaClientKnownRequestError` and DTO validation with the `main.ts` pipe options), not by an end-to-end run; no e2e/DB-backed test was run in this stage.
- Media delete: the reference check and the soft-delete are two statements; content attached in that same instant could slip through (the delete is a recoverable soft delete, and new Home writes require an *active* asset).
- Validation messages from `class-validator`/`ParseUUIDPipe` remain English (unchanged convention); service-level 409/422 messages are Persian.
- Malformed `:id` now returns 400 instead of 404 (intended, per plan §13.6).
- An explicit `null` on NOT NULL Home fields is now 400 (previously an unhandled 500) — additional to the plan's list but the same class of defect.
- Public `GET /categories` still returns inactive categories (observation only, not changed).
- Home rows pointing at soft-deleted media are handled in the API; the Customer App's behavior for `image: null` is its existing fallback (not re-verified in a browser by design).
- CI on `main` has been red at `pnpm/action-setup` since before this stage (pre-existing, unchanged).

## 8. Intentionally NOT changed
Public inactive-category filtering (BD-1); global error filter; other modules' reorder; mosaic `title`/`lead` requirement (BD-5); Home state model (BD-6); audit transactionality, filters, retention (BD-7); any card/category-card/category/service/gallery image or reference (BD-8); Admin UI; customer UI; seeds; migrations.

## 9. Next deployment / verification step (not done here)
1. Deploy `main` to staging using the existing workflow (Actions → *Deploy Staging*, or `./deploy/staging/deploy.sh` on the server).
2. Re-run the read-only checksum script on the staging DB and require **BEFORE == AFTER** for every row in §3 (card_products, category_cards, categories, services, services.gallery are the protected ones; the Home tables and media_assets must also be unchanged because API verification below is read-only). Any difference ⇒ stop, do not proceed, investigate.
3. API-only verification (no Browser QA, no QA runner): public `GET /home/*` (shape, count 3/5/4/8, ordering, `image` non-null), `GET /admin/home/*` and validation/409/422/400 cases only with an approved isolated test fixture, `DELETE /admin/media/:id` on a referenced asset expecting 409 (only if the owner supplies a safe fixture), UUID-path 400 on a read-only `GET /admin/home/hero-cards/not-a-uuid`.

## 10. Confirmations
- Browser QA: **NOT RUN**. `authenticated-qa-runner.ts`: **NOT RUN**.
- No deployment performed; no staging or production data touched; no staging/production DB access from this environment.
- Local dev Postgres was started for read-only `SELECT`s only and stopped afterward.
