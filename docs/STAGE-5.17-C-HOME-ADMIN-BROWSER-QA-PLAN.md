# STAGE 5.17-C — Home Admin Browser QA Plan & Fixture Contract

**PLANNING AND PREPARATION ONLY. Browser QA has NOT been run in this stage.** Nothing was deployed, no data was touched, no backend/Prisma/seed/catalog/Admin-UI source was changed, and `authenticated-qa-runner.ts` was not run.

What this stage produced:
- this plan;
- a **tested, pure contract library** (`backend/scripts/staging-qa/stage-5-17-c/qa-contract.ts`) holding the tag/slug convention, fixture registry, ownership proof, dependency gate, **mutation firewall**, checksum and real-row baseline comparison, the 46-test matrix, the 20-fixture catalog and the final-verdict/exit-code logic;
- 46 unit tests for that library (`backend/src/qa-contract/stage-5-17-c-qa-contract.spec.ts`).

What it did **not** produce: the executable Playwright verifier, the fixture-control script, the wrapper script and the workflow. They are fully specified in Appendix A and are the scope of the next stage. **A Browser QA verifier was therefore NOT created in this stage** — only its tested foundation.

---

## 1. Objective
Give a future Browser QA run everything it needs to verify the real Home Admin UI (Stage 5.17-B, commit `8a4c53c`) against the Stage 5.17-A contract, using only isolated, tagged, self-cleaning fixtures, with hard integrity gates (protected artwork checksums, real-row baseline, zero leftover fixtures).

## 2. Scope
Home Admin (`/home`, `/home/{hero-cards,service-banners,service-mosaic,news}` list/new/[id]) and the Media Library (`/media`) plus the shared media picker, as exercised through the Admin UI at `https://admin-staging.biawin.ir`, backed by `https://api-staging.biawin.ir`.

## 3. Out of scope
Customer app, Catalog screens (`/catalog/**`), audit-log UI (none exists), any backend/UI code change, deployment, `authenticated-qa-runner.ts`, the 5.22 browser layer, pixel/visual-fidelity comparison, load/performance testing.

## 4. Environment
| Item | Value / source |
|---|---|
| Admin UI | `https://admin-staging.biawin.ir` (`docker-compose.staging.yml`, `admin` service, `127.0.0.1:3002`) |
| API | `https://api-staging.biawin.ir/api/v1` (backend `127.0.0.1:4001`) |
| Browser tooling (existing) | Playwright **1.48.2**, `deploy/staging/qa/browser/` (own `package.json`, `tsconfig.json`, Dockerfile `mcr.microsoft.com/playwright:v1.48.2-jammy`, ts-node). **No new framework is needed or proposed.** |
| Existing conventions | `step/record/skip`, `trackPageIssues` (console/network capture with documented benign-cancellation filters), screenshots to `${QA_REPORT_DIR}/screenshots`, admin login by label `ایمیل` / `رمز عبور` / button `ورود` then `waitForURL(/dashboard/)`, token key `biawin.admin.accessToken`; secrets passed with `-e`, never logged. **No traces/videos are standardized.** |
| Existing gap | The 5.22 browser layer only runs chained behind `run-authenticated-qa.sh` (API runner → browser). It cannot be run alone and is forbidden here. |
| Selector policy | The Admin UI has **no `data-testid`**; tests use roles/labels/visible Persian text (as 5.22 does). Adding test ids would change UI code and is out of scope. |
| Data access | Fixture control needs Prisma + `STORAGE_*` (backend image, `docker compose run --rm backend`), like `run-authenticated-qa.sh` and the Stage 5.16-E verifier. |

## 5. Fixture tag convention
- Run id: `<epoch-ms>_<hex>` e.g. `1790152949527_d02b48`.
- **Text tag** (names/titles/kickers/categories/upload file names): `stage517c_qa_<run-id>` — underscores allowed **only here**.
- **Slug prefix** (every `bodySlug`): `stage517c-qa-<run-id with _→->` e.g. `stage517c-qa-1790152949527-d02b48`, built **only** by `makeQaBodySlug(run, suffix)` → `stage517c-qa-1790152949527-d02b48-news1`. The helper validates `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤100, rejects any non-`[a-z0-9]` suffix, and a unit test proves the tag itself is *not* slug-valid (so nothing may be derived from it). This is the exact defect the first 5.16-E verifier run hit.
- Uploaded files: `<tag>-<suffix>.png`.
- **Ownership proof** (`isOwnedByRun`): an object may be mutated or cleaned only if it is **both** in this run's registry **and** carries this run's tag/slug prefix. An old run's fixtures, a real row, or a tagged-but-unregistered row all fail.

## 6. Fixture matrix
Design rules: rows are created **inactive** (never public); rows use `sortOrder` ≥ 99990; a created-active row is blocked by the firewall; no QA Category, no QA Hero Card.

**Why no Category fixture.** `categories` is a protected table and `categories-admin.controller.ts` exposes only `POST` and `PUT` (no `DELETE`): a QA category could never be cleaned up. Banner/Mosaic fixtures therefore *reference existing categories* (a new QA row pointing at an untouched category row). The **inactive-category** scenario is reproduced by a QA banner that references the existing inactive category (`اتومبیل`, seen on staging) — the real inactive-category banner is never edited.

**Why no Hero fixture.** `cardKey` is a closed, `@unique` 3-value enum and all three keys are occupied on staging, so no Hero row can be created and no real Hero row may be modified. Hero coverage is observation (`O`), payload capture with the request aborted (`P`) and stubbed responses (`S`) only (§7).

| Fixture | Type | Description | Used by |
|---|---|---|---|
| mediaA | media | active QA media, referenced by bannerMediaA and newsMediaA (delete must 409) | MED-06, MED-08 |
| mediaB | media | active, unreferenced QA media — picker/replace target | BAN-02, BAN-04, MOS-03, NEWS-05, SDM-02, SDM-05 |
| mediaC | media | QA media uploaded, then **soft-deleted through the API while unreferenced** (legacy-reference source) | SDM-01…SDM-05 |
| mediaD | media | active, unreferenced — UI delete-confirm / delete-success target | MED-04, MED-05 |
| mediaD2 | media | active, unreferenced — CONTENT_EDITOR delete target | RBAC-04 |
| mediaE | media | active QA media removed via the API **after** the page loaded (delete-elsewhere / 404) | MED-07 |
| bannerMediaA | banner | inactive QA banner on an existing active category, referencing mediaA | BAN-04 |
| bannerInactiveCat | banner | inactive QA banner on the existing **inactive** category | BAN-03 |
| bannerToggle | banner | inactive QA banner for toggle/delete | BAN-07 |
| bannerLegacy | banner | QA banner repointed (direct Prisma, QA row → QA media) to soft-deleted mediaC | SDM-05 |
| mosaicWide | mosaic | inactive QA wide tile (title/lead set) | MOS-03 |
| newsSlugOwner | news | inactive QA news owning a valid bodySlug (duplicate-slug source) | NEWS-03 |
| newsMediaA | news | inactive QA news referencing mediaA | NEWS-05, MED-06, MED-08 |
| newsLegacyReplace | news | legacy reference to mediaC — resolved by Replace | SDM-01, SDM-02 |
| newsLegacyClear | news | legacy reference to mediaC — resolved by Clear | SDM-03 |
| newsLegacyKeep | news | legacy reference to mediaC — edited without resolving | SDM-04 |
| newsStale | news | deleted through the API after the list loaded (toggle → 404) | ERR-01 |
| newsStale2 | news | deleted through the API after the list loaded (delete → 404) | ERR-02 |
| newsReorderA / newsReorderB | news | inactive QA news, sortOrder 99990 / 99991 | REO-01…REO-04 |

Additional, runtime-sized fixtures (registered like any other): **pagination padding** — if the active library has ≤ 50 assets (staging has 180 `media_assets` rows but the *active* count is unknown; dev has 48 of 101), the setup uploads `51 − activeTotal` tagged QA assets (`mediaPad-<n>`) so pagination can be exercised; if padding fails, MED-02 is NOT_RUN. Assets uploaded through the UI during tests (picker, NEWS-04) are caught by the tag sweep (`fileName` contains the tag).

**Creation** is via the same admin API the verifier already proved in 5.16-E (`POST /admin/media/upload`, `POST /admin/home/*`, `DELETE /admin/media/:id`). The **only direct-Prisma writes** are: (1) repointing QA news/banner rows at soft-deleted **mediaC** (the API refuses this state by design — Stage 5.16-B), (2) hard-deleting QA media at cleanup, (3) creating/deleting temporary QA admin accounts (§8, needs approval). Each writes only ids this run created.

## 7. Test matrix (46 tests — the single source of truth is `QA_TESTS` in `qa-contract.ts`)
Classes: **R** real backend on QA rows only · **S** backend response stubbed in the browser (`page.route` fulfill; nothing is sent) · **O** observation only on real data (nothing submitted) · **P** payload capture (the UI request is intercepted and **aborted**; only its shape is asserted).

| ID | Test | Class | Role | Fixtures | Requires |
|---|---|---|---|---|---|
| NAV-01 | Sign in; /home overview lists the 4 resources with counts | O | SUPER_ADMIN | — | — |
| NAV-02 | All 4 Home lists render (rows, thumbnails, empty/loading) without console errors | O | SUPER_ADMIN | — | — |
| HERO-01 | Create form with all 3 keys occupied shows the "all keys used" state and a disabled submit | O | SUPER_ADMIN | — | — |
| HERO-02 | Edit form (real row, NOT saved): blank/over-long fields block submit with field errors and send ZERO requests | P | SUPER_ADMIN | — | — |
| HERO-03 | Duplicate cardKey 409 renders the Persian "key already used" message (stubbed response) | S | SUPER_ADMIN | — | — |
| BAN-01 | Create banner: required kicker/category, max 200 (client validation, no request) | R | SUPER_ADMIN | — | — |
| BAN-02 | Create valid QA banner (inactive) with an existing active category + picker-selected media B | R | SUPER_ADMIN | mediaB | — |
| BAN-03 | Edit QA banner referencing the existing INACTIVE category: stays visible as "(غیرفعال)", id unchanged after save | R | SUPER_ADMIN | bannerInactiveCat | — |
| BAN-04 | Replace media / clear media on a QA banner; API state after save | R | SUPER_ADMIN | bannerMediaA, mediaB | — |
| BAN-05 | Real inactive-category banner opened read-only (NOT saved): placeholder bug fixed, no request sent | O | SUPER_ADMIN | — | — |
| BAN-06 | Unknown category 422 renders "دسته‌بندی انتخاب‌شده معتبر نیست." (stubbed) | S | SUPER_ADMIN | — | — |
| BAN-07 | Toggle payload {active:true} captured and aborted on a QA banner (never made public); then delete the QA banner (real) | R | SUPER_ADMIN | bannerToggle | — |
| MOS-01 | Create QA half tile (title/lead blank → null) and QA wide tile (title/lead set) | R | SUPER_ADMIN | — | — |
| MOS-02 | Length limits: title 200, lead 500, kicker 200; required kicker/category | R | SUPER_ADMIN | — | — |
| MOS-03 | Edit tile: media replace/clear, category, valid save; API state | R | SUPER_ADMIN | mosaicWide, mediaB | — |
| NEWS-01 | Required fields and max lengths (100/200/300/1000) block submit client-side | R | SUPER_ADMIN | — | — |
| NEWS-02 | Invalid bodySlug (space, UPPER, underscore, double hyphen, >100) blocked with a Persian message, no request | R | SUPER_ADMIN | — | — |
| NEWS-03 | Valid bodySlug saves; the same slug on another QA row → real 409 Persian message | R | SUPER_ADMIN | newsSlugOwner | — |
| NEWS-04 | Create QA news via UI (inactive) with picker-uploaded media | R | SUPER_ADMIN | — | — |
| NEWS-05 | Edit QA news; replace/clear media; API state | R | SUPER_ADMIN | newsMediaA, mediaB | — |
| NEWS-06 | Unknown media 422 renders "رسانه انتخاب‌شده معتبر نیست." (stubbed) | S | SUPER_ADMIN | — | — |
| SDM-01 | Legacy row (media C soft-deleted): warning "تصویر قبلی در دسترس نیست" + Replace + Clear shown, no silent substitute | R | SUPER_ADMIN | newsLegacyReplace, mediaC | — |
| SDM-02 | Resolve by Replace (media B) → save → API `mediaAssetId === media B` | R | SUPER_ADMIN | newsLegacyReplace, mediaC, mediaB | — |
| SDM-03 | Resolve by Clear → save → API `mediaAssetId === null` | R | SUPER_ADMIN | newsLegacyClear, mediaC | — |
| SDM-04 | Edit another field WITHOUT resolving → save succeeds (no 422), `mediaAssetId` still media C (never rewritten) | R | SUPER_ADMIN | newsLegacyKeep, mediaC | — |
| SDM-05 | Same warning/Replace path on a legacy QA banner | R | SUPER_ADMIN | bannerLegacy, mediaC, mediaB | — |
| MED-01 | Media page opens; total count shown; pager present when total > 50 | O | SUPER_ADMIN | — | — |
| MED-02 | Next/previous page load different assets; page/total consistent with the API total | O | SUPER_ADMIN | — | — |
| MED-03 | Picker pages through the library; selecting an asset sends no write request | P | SUPER_ADMIN | — | — |
| MED-04 | Delete shows a confirmation dialog; Cancel sends no request | R | SUPER_ADMIN | mediaD | — |
| MED-05 | Confirm delete of an unreferenced QA asset succeeds and the list refreshes | R | SUPER_ADMIN | mediaD | — |
| MED-06 | Delete of a referenced QA asset (media A) → real 409, Persian in-use message with references, asset remains, reference intact | R | SUPER_ADMIN | mediaA, newsMediaA | — |
| MED-07 | Delete of an asset removed elsewhere (media E) → 404 message and the list reconciles | R | SUPER_ADMIN | mediaE | — |
| MED-08 | No delete bypass: exactly one DELETE, never a PUT/PATCH detaching a reference | R | SUPER_ADMIN | mediaA, newsMediaA | — |
| ERR-01 | Row deleted elsewhere: toggle → Persian 404 message and the list refetches | R | SUPER_ADMIN | newsStale | — |
| ERR-02 | Row deleted elsewhere: delete → dialog closes, message shown, list refetches | R | SUPER_ADMIN | newsStale2 | — |
| ERR-03 | 500 shows only the generic Persian message (stubbed response containing internal text) | S | SUPER_ADMIN | — | — |
| ERR-04 | Malformed UUID edit route (`/home/news/not-a-uuid`) shows a Persian-prefixed 400 message, no crash | O | SUPER_ADMIN | — | — |
| REO-01 | Reorder payload captured and aborted: whole displayed list, unique uuids, positions 0..n-1, no empty/duplicate | P | SUPER_ADMIN | newsReorderA, newsReorderB | — |
| REO-02 | Valid reorder of two QA rows, list refreshes, order restored | R | SUPER_ADMIN | newsReorderA, newsReorderB | **REORDER_METADATA_TOUCH** |
| REO-03 | Unknown-id reorder 422 (stubbed): Persian message with count, list refetched | S | SUPER_ADMIN | newsReorderA | — |
| REO-04 | Reorder failure (stubbed 500): list keeps the server order after reconciliation | S | SUPER_ADMIN | newsReorderA | — |
| RBAC-01 | SUPPORT_VIEWER: lists show no create/reorder/delete controls; toggle disabled | O | SUPPORT_VIEWER | — | **SUPPORT_VIEWER_ACCOUNT** |
| RBAC-02 | SUPPORT_VIEWER: edit page read-only (no submit); `/home/*/new` redirects to the list | O | SUPPORT_VIEWER | — | **SUPPORT_VIEWER_ACCOUNT** |
| RBAC-03 | SUPPORT_VIEWER: Media page shows no delete control | O | SUPPORT_VIEWER | — | **SUPPORT_VIEWER_ACCOUNT** |
| RBAC-04 | CONTENT_EDITOR: can create a QA news row and delete a QA media asset | R | CONTENT_EDITOR | mediaD2 | **CONTENT_EDITOR_ACCOUNT** |

Coverage map against the task: Hero (required/max lengths/available key/all-occupied/409/create/edit/reorder) → HERO-01…03 + REO-*; Banner (required, max, category, **inactive category**, media select/clear/replace, create/edit, reorder) → BAN-01…07; Mosaic → MOS-01…03; News (required, max, bodySlug invalid/duplicate/valid, media, edit, reorder) → NEWS-01…06; errors 400/404/409/422 → ERR-*, HERO-03, BAN-06, NEWS-06, MED-06/07; reorder cases (empty/malformed/duplicate/unknown) → REO-01 (the UI's client guard never sends them; the backend side of those is proven by Stage 5.16-E) plus stubs REO-03/04.

**Honest limits of the matrix.** Real-row mutations are impossible by rule, so: valid **Hero** create/edit/reorder cannot run against the backend; the **duplicate-cardKey 409** is proven only as UI rendering of a stubbed 409 (the backend behavior is proven by 5.16-E); **REO-02** (a real UI reorder) is gated on an explicit approval (§12) because the UI always sends the whole list.

## 8. Authentication / RBAC
**From the repository (source of truth):**

| Capability | Roles | Evidence |
|---|---|---|
| Read Home lists / items (admin API) | any authenticated admin (incl. SUPPORT_VIEWER) | `home-*-admin.controller.ts` (no `@AdminRoles` on GET) |
| Create / update / delete / reorder Home rows | SUPER_ADMIN, CONTENT_EDITOR | `@AdminRoles(SUPER_ADMIN, CONTENT_EDITOR)` on each mutation; `home-admin-permissions.spec.ts` |
| Media list/get | any admin | `media.controller.ts` |
| Media upload / delete | SUPER_ADMIN, CONTENT_EDITOR | `media.controller.ts:67,87` |
| Audit log read | SUPER_ADMIN | `admin-audit-log.controller.ts:26` |
| UI gating | `canManageHomeContent(role)` = SUPER_ADMIN/CONTENT_EDITOR; SUPPORT_VIEWER → read-only forms, no create/reorder/delete/toggle, no media delete | `features/home/rbac.ts`, Stage 5.17-B |

**Accounts.** Only the seeded **SUPER_ADMIN** (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in the server's `.env.staging`, reaching containers via the same `env_file`/`-e` mechanism `run-authenticated-qa.sh` already uses) exists. **No SUPPORT_VIEWER or CONTENT_EDITOR account is available** and none may be invented. Precedent: `authenticated-qa-runner.ts` provisions temporary RBAC admins via Prisma (no REST endpoint exists) and deletes them. Plan: the control script may do the same — accounts named `<tag>@example.invalid`, random one-time passwords held only in a `0600` temp env file mounted read-only into the browser container and deleted in the trap, rows deleted at cleanup. **This is a decision (D2, §20).** Without approval RBAC-01…04 are **BLOCKED**, and a BLOCKED required test makes the exit code non-zero (they are not silently skipped).

**Login throttle.** `POST /admin/auth/login` is limited to 10 attempts / 10 min / IP. A run needs ≈ 1 login per role in the browser plus ≈ 3 for control steps. The wrapper clears only the throttler Redis keys (`{*:default}*`) before a run — the exact precedent in `run-authenticated-qa.sh` — and each role's browser session is logged in **once** and reused.

## 9. Soft-deleted-media scenario (mandatory; Stage 5.17-A M1)
Setup (control script, all objects created by this run):
1. `POST /admin/media/upload` → **mediaC**; register immediately.
2. `DELETE /admin/media/:mediaC` while unreferenced → 200 (soft delete; the row stays, the storage object stays).
3. Create `newsLegacyReplace`, `newsLegacyClear`, `newsLegacyKeep`, `bannerLegacy` through the API (inactive, no media).
4. **One direct Prisma `update` per row**: `mediaAssetId = mediaC`, each guarded by `assertOwnedByRun` (row registered *and* tagged) and a read-back. (The API cannot create this state: Stage 5.16-B requires an active asset on writes and blocks soft-deleting a referenced one.)
5. Read-back via the admin API: `image === null`, `mediaAssetId === mediaC`.

Browser assertions:
- SDM-01: open the row's edit page → text "تصویر قبلی در دسترس نیست", the Persian warning ("…مرجع قبلی بدون تغییر می‌ماند…"), buttons "انتخاب تصویر جایگزین" and "پاک‌کردن مرجع تصویر"; the preview shows no substituted image.
- SDM-02: click Replace → pick **mediaB** in the picker → Save → `GET /admin/home/news-articles/:id` gives `mediaAssetId === mediaB`; the request body contained `mediaB`, never `mediaC`.
- SDM-03: click Clear → Save → `mediaAssetId === null`; body had `mediaAssetId: null`.
- SDM-04: change only `kicker` → Save → HTTP 200 (no 422); the PUT body has **no** `mediaAssetId` key; API `mediaAssetId` still `mediaC`.
- SDM-05: same Replace flow on `bannerLegacy`.
All request bodies are captured with `page.on('request')` (secrets are in headers, never recorded).

## 10. Media Library tests
Covered by MED-01…MED-08, MED-03 (picker) and the padding fixture. Key checks:
- **Pagination:** the UI's page/"N فایل" text equals `GET /admin/media?page=1&limit=50 → total`; next shows a different first asset id; previous returns to the original; the picker pager behaves the same. If the active total is ≤ 50 the padding fixture is created first (otherwise MED-02 = NOT_RUN with that reason).
- **Selecting media sends no write:** in the picker only `GET /admin/media` requests occur (`P`).
- **Delete:** dialog text names the file and warns; Cancel → zero requests (`R` on mediaD); Confirm → exactly one `DELETE`, list reloads, asset gone from the list; **409** on mediaA → Persian "این تصویر هنوز در حال استفاده است…" with the reference label ("اخبار صفحه خانه: 1", "بنرهای خدمات صفحه خانه: 1"), then the API still returns mediaA and both rows still reference it; **404** on mediaE (removed via the API after the page loaded) → "این فایل دیگر وجود ندارد…" and the list refetches; **no bypass** — the request log for MED-06/08 contains exactly one `DELETE` and no `PUT`/`PATCH`.
- Only QA-tagged media are ever deleted (the firewall enforces it).

## 11. Validation tests
All client-side rules mirror the 5.16 DTOs (`HOME_LIMITS`, `BODY_SLUG_PATTERN`). "Blocked, no request" is proven by the request log containing zero non-GET requests. Forms must be exercised with **`active` unticked** (the forms default it on) — the firewall blocks a create body with `active: true`.
- **Hero** — HERO-01 (all-occupied state), HERO-02 (real edit form, over-long/blank fields → field errors, zero requests, never saved), HERO-03.
- **Banner** — BAN-01 (blank kicker, kicker 201 chars, no category), BAN-02, BAN-03/05 (inactive category), BAN-04, BAN-06.
- **Mosaic** — MOS-01 (both slot types; blank title/lead sent as `null`), MOS-02 (title 201, lead 501, kicker 201), MOS-03.
- **News** — NEWS-01 (100/200/300/1000 boundaries), NEWS-02 (`Has Space`, `UPPER`, `under_score`, `a--b`, 101 chars), NEWS-03 (valid slug from `makeQaBodySlug`, then the same slug on a second QA row → **real** 409, Persian "این نامک مقاله قبلاً استفاده شده است."), NEWS-04/05/06.

## 12. Reorder tests
- **The UI always sends the WHOLE displayed list** (`moveItem` renumbers every row `0..n-1`) and the backend updates each listed row including `updatedBy`/`updatedAt`. Therefore any real UI reorder touches **real rows' update metadata** even when their order is unchanged. This conflicts with "no real row may be modified" and must not happen silently.
- Default plan (no approval): **REO-01** captures the outgoing `PATCH …/reorder` and aborts it, asserting: non-empty, uuid ids, unique ids, unique positions `0..n-1`, includes only rows from the list. **REO-03/04** use stubbed 422/500. **REO-02 (a real reorder) is BLOCKED** and therefore fails the exit gate until decided.
- With approval `STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true` (**decision D1**): REO-02 runs on the QA rows; the firewall allows the PATCH; the baseline comparison then uses `ignoreUpdateMetadata` **only** for `updatedAt`/`updatedBy` — ids, order, `active`, `sortOrder`, `mediaAssetId`, `categoryId` of every real row must still be identical.
- The backend's own reorder rejections (empty, malformed uuid, duplicate id, duplicate position, unknown id → 400/422) were proven over real HTTP in Stage 5.16-E; the UI cannot generate them (client guard), so they are not repeated here.

## 13. Error handling
| Status | How it is verified | Expected UI |
|---|---|---|
| 400 | ERR-04 (real: `/home/news/not-a-uuid`) | Persian-prefixed message ("اطلاعات واردشده معتبر نیست: …"), no crash |
| 404 | ERR-01/02, MED-07 (real, row/asset removed elsewhere) | Persian message + "ممکن است در جای دیگری حذف شده باشد", **list refetched**, dialog closed |
| 409 | NEWS-03 (real slug), MED-06 (real in-use), HERO-03 (stub) | Persian specific message; in-use lists references |
| 422 | BAN-06, NEWS-06, REO-03 (stubbed) | Persian message; reorder shows the unknown-id count and refetches |
| 500 | ERR-03, REO-04 (stub whose body contains e.g. `postgres://…`/a stack path) | **Only** the generic Persian fallback; the page text must not contain the stubbed internal text |
For every failure test also assert: no duplicate/cascade request (request log), the page still renders, and no uncaught console error.

## 14. Artwork preservation (hard release gate)
- BEFORE: the five checksums with the exact 5.16-E SQL — `card_products`, `category_cards`, `categories`, `services` (`id:mediaAssetId`), `services.gallery` (`id:galleryMediaAssetIds`), each `md5(string_agg(... order by id))` plus row count — recomputed on the real database immediately before fixtures (never taken from an old report).
- DURING: the firewall forbids every catalog endpoint; the verifier's only Prisma writes are QA-owned Home rows/media/temp admins; **no write to the five protected tables is possible by construction** (`categories` is never written because no QA category exists).
- AFTER cleanup: recompute; `compareChecksums` requires all five present and equal (count and md5). Any difference → FAIL, the changed table is named, Stage 5.17 is not closed. No "restoring" writes are ever performed.
- Also asserted: a static test (Stage 5.17-B `artwork-preservation.test.ts`) already proves Home/Media UI code has no catalog write path.

## 15. Cleanup contract
- Runs from a shell `trap` **and** a `finally` in each control step, regardless of test outcome.
- Order = reverse creation (`cleanupOrder`): QA rows (API `DELETE`, hard) → QA media (API soft-delete, then a verifier-owned hard delete of the row after `countReferences === 0` across the 7 FK columns + `services.galleryMediaAssetIds`, then the storage object) → temporary admin accounts.
- A media row/object is deleted **only** if it is registered **and** its `fileName` carries this run's tag; a row is deleted only after `assertOwnedByRun`.
- Media uploaded by the UI (picker, NEWS-04) and any accidentally-created row are found by the **tag/slug sweep** and cleaned the same way.
- After cleanup, **remaining fixtures = 0** is proven by (a) id lookups for every registered fixture, (b) a sweep for the tag in news/banner/mosaic/hero text fields and slugs (`startsWith slugPrefix`), (c) a sweep of `media_assets.fileName`, (d) `HeadObject` on every recorded storage key, (e) temporary admin accounts. Any remainder → FAIL, listed with type/id/marker/cleanup result.
- **Not cleanable, disclosed:** `admin_audit_logs` rows written by the fixture operations and by the temporary accounts (append-only by design). They are not fixtures and are excluded from the count.

## 16. Home baseline contract
Captured BEFORE any fixture and AFTER cleanup, compared by `compareHomeBaseline` / `publicCountsEqual`:
- **Public counts:** `GET /home/{hero-cards,service-banners,service-mosaic-tiles,news-articles}` → 3 / 5 / 4 / 8 on the last verified baseline (not assumed — recomputed).
- **Real rows (IDs, not just counts):** via Prisma `select id, active, sortOrder, mediaAssetId, categoryId, updatedAt, updatedBy` for the four Home tables, ordered as the API orders them. QA rows are excluded by the run tag. Required: same ids, same order, same `active`, `sortOrder`, `mediaAssetId`, `categoryId`, **and unchanged `updatedAt`/`updatedBy`** (proof that no real row was touched). Only with D1 are `updatedAt`/`updatedBy` ignored.

## 17. Failure / cascade rules
```
create fixture ─ success → register for cleanup → dependents may run
               └ failure → dependents = NOT_RUN "dependency not satisfied — fixture(s) not created: <names>"
                            (never executed with undefined/non-uuid ids; FixtureRegistry/FixtureBag refuse them)
```
- A missing capability (D1/D2) → **BLOCKED** with the capability named.
- Final statuses are exactly `PASS | FAIL | NOT_RUN | BLOCKED`.
- **Exit non-zero** if: any test FAIL; any required test NOT_RUN or BLOCKED or missing; any cleanup failure; remaining fixtures ≠ 0; checksum mismatch; Home baseline or public counts not restored; any blocked-mutation attempt against non-QA data (`finalVerdict`, unit-tested for each condition).
- A failed test never stops cleanup; cleanup failure never prevents the AFTER evidence.

## 18. Required artifacts
`manifest.json` (ids/tag/slugs, no secrets) · `stage-5.17-c-before.txt` / `-after.txt` (5 checksums) · `home-baseline-before.json` / `-after.json` · `remaining-fixtures.json` · `results.json` · `stage-5-17-c-report-<run>.txt/.json` · `screenshots/` (failures + key states). Uploaded by the workflow as one sanitized artifact; **never** tokens, passwords, `Authorization` headers, `DATABASE_URL`, traces or videos.

## 19. Exit criteria (Stage 5.17 may be closed only if ALL hold)
All 46 tests PASS · zero firewall violations · cleanup PASS · remaining fixtures 0 · 5/5 checksums BEFORE == AFTER · Home real-row baseline restored (ids/order/active/sortOrder/media/category/updated*) · public counts restored · no console/network error on QA pages beyond the documented benign cancellations · no code change required · no secret in any artifact. Anything BLOCKED/NOT_RUN keeps Stage 5.17 open.

## 20. Known blockers and decisions required
| # | Item | Effect if not resolved |
|---|---|---|
| D1 | Approve **reorder metadata touch** (`STAGE517C_ALLOW_REORDER_METADATA_TOUCH=true`): the real UI reorder rewrites `updatedAt`/`updatedBy` of real rows | REO-02 BLOCKED → verdict non-zero |
| D2 | Approve **temporary SUPPORT_VIEWER / CONTENT_EDITOR admin accounts** (Prisma insert + delete, audit residue) | RBAC-01…04 BLOCKED → verdict non-zero |
| B1 | The verifier, control script, wrapper and workflow are **not implemented yet** | No run possible until the next stage |
| B2 | Active media total on staging unknown (≤ 50 → pagination padding needed) | MED-02 NOT_RUN if padding fails |
| B3 | Valid Hero create/edit/reorder and real duplicate-`cardKey` 409 are impossible without touching real rows | Covered only by O/P/S tests (documented limitation, not a failure) |
| B4 | Audit-log rows for QA operations cannot be removed | Disclosed residue |
| B5 | No `data-testid` in the Admin UI | Selectors rely on Persian text/roles; UI copy changes would need test updates |
| B6 | Admin credentials are reachable only on the server / CI path, not from the sandbox | The run must be executed server-side or via the `workflow_dispatch` path (same as 5.16-E) |

## 21. Exact execution command (planned — the script does not exist yet)
```bash
# on the staging server, from /srv/biawin-staging (after the 5.17-D implementation stage)
STAGE517C_ALLOW_REORDER_METADATA_TOUCH=false \
STAGE517C_PROVISION_ROLES=false \
./deploy/staging/run-stage-5-17-c-browser-qa.sh
```
or the `workflow_dispatch`-only workflow `stage-5-17-c-home-admin-browser-qa.yml` (same secrets as `stage-5-16-e-home-verification.yml`; no deploy; no chaining into any other QA). With D1/D2 approved set the two variables to `true`. **Neither exists in this commit.**

## 22. Explicit statement
**Browser QA has NOT been run in this stage.** No browser was launched, no admin session was opened, no staging request other than reading existing repository files was made, no fixture was created, and no deployment happened. Stage 5.17 is **not** closed.

## Appendix A — Browser QA execution architecture (to be implemented next — NOT built in this stage)
```
run-stage-5-17-c-browser-qa.sh   (server, /srv/biawin-staging; wrapper — also invoked by a workflow_dispatch workflow)
 ├─ trap  teardown → verify  (ALWAYS, on success/failure/interrupt)
 ├─ 1. control setup      (backend image, Prisma+API)  →  manifest.json (ids, tag, slug prefix, slugs; NO secrets)
 ├─ 2. browser verifier   (Playwright 1.48.2 image, deploy/staging/qa/browser)  →  results.json + screenshots
 ├─ 3. control teardown   (hard cleanup, ownership-proven)
 └─ 4. control verify     (remaining fixtures, AFTER snapshot, verdict = finalVerdict(...), report, exit code)
```
- `qa-contract.ts` is copied into the browser build context at wrapper time (not committed) so the verifier's mutation firewall and matrix are the *same code* the unit tests cover.
- **Mutation firewall** (`decideMutation`): every non-GET request from the browser goes through `page.route`; requests that fail the decision are **aborted** and counted as `firewallViolations` (→ FAIL). Allowed: admin auth, media upload, `DELETE`/`PUT` of registered QA rows/assets, a create whose body carries this run's tag/slug **and is not `active: true`**, and reorder only with D1. Everything else — real rows, any catalog endpoint, unknown routes — is blocked. This makes accidental mutation of real data structurally impossible even if a test is wrong.
- Stubs (`S`) use `route.fulfill`; captures (`P`) use `route.abort` after reading `postDataJSON()`.
- No traces/videos (they record `Authorization` headers). Screenshots on failure + one at each key state; the login screenshot is taken **before** credentials are typed.
- Playwright reuses the 5.22 conventions (`step/record`, `trackPageIssues`), scoped to the routes in §2 only.
- Redaction: the verifier's `redact()` (JWT-shaped strings and the seed password) as in 5.16-E; passwords never enter a manifest, report or log.

**Lifecycle** (`setup → baseline → fixtures → browser tests → cleanup → remaining-fixture check → checksum check → baseline check → verdict`):
1. **Baseline** (before any fixture): 5 protected checksums, public counts, real-row snapshot (§16).
2. **Fixtures**: created in dependency order; each registered **immediately**; a failed creation marks only its dependents NOT_RUN (`gateTest`).
3. **Tests**: each test runs only if `gateTest` says so; the registry is consulted before every mutation.
4. **Cleanup** (mandatory, §15).
5. **Verification** and **verdict** (§19).

---
### Automated gates for this stage
Admin lint/typecheck/Jest, backend typecheck/build and the new helper tests are recorded in the commit message and the final response of this stage.
