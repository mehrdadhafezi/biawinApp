# STAGE 5.17-A — Home Admin UI Contract Analysis

**Analysis only.** No application code, backend, Admin UI, schema, migration, seed or deployment change was made, and no Browser QA was run. The only file added by this stage is this report.

**Evidence rule.** Every conclusion cites source under `apps/admin/src` (paths below are relative to that folder unless stated) or the Stage 5.16 backend (`backend/src/modules/home`, `backend/src/modules/media`). Nothing here was observed in a browser; statements about rendered behavior are inferences from the code and are marked *(code-inferred)*.

**Read-only checks executed:** `apps/admin` `jest` → 25 suites / 84 tests pass; `tsc --noEmit` clean. No other command changed anything.

---

## 1. Scope
Existing Home Admin UI vs. the Stage 5.16-verified backend contract: Hero Cards, Service Banners, Service Mosaic Tiles, News Articles, Media. Verified backend contract used as the reference: 13/13 authenticated API tests, partial-reorder semantics, 400/404/409/422 mapping, `mediaAssetId` nullable, soft-deleted media → `image: null`, media delete → 409 when referenced (`docs/STAGE-5.16-HOME-BACKEND-HARDENING-RESULT.md`, `-E-...-RESULT.md`).

## 2. Files / routes inspected

**Routes (10 Home screens + 1 overview + Media = 12 pages)** — `find app -name page.tsx`:

| Route | File |
|---|---|
| `/home` (overview) | `app/home/page.tsx` → `features/home/overview/HomeOverview.tsx` |
| `/home/hero-cards`, `/new`, `/[id]` | `app/home/hero-cards/**` |
| `/home/service-banners`, `/new`, `/[id]` | `app/home/service-banners/**` |
| `/home/service-mosaic`, `/new`, `/[id]` | `app/home/service-mosaic/**` |
| `/home/news`, `/new`, `/[id]` | `app/home/news/**` |
| `/media` | `app/media/page.tsx` |

Count: **1 overview + 4 lists + 4 create + 4 edit = 13 Home routes**, plus `/media` (14 total). Sidebar entries: `components/shell/AdminSidebar.tsx` (Home group with 4 children, flat `/media`).

**Also read:** `features/home/{types.ts,logic.ts,rbac.ts}`, `features/home/api/*` (6), `features/home/components/*` (9: `ResourceListPage`, `ReorderControls`, `ActiveToggle`, `ConfirmDialog`, `HomeFormShell`, `FormField`, `CategorySelect`, `MediaPickerField`, `MediaPickerModal`), the 4 forms + 4 list contents, `components/media/{MediaLibraryGrid,MediaUploadForm}.tsx`, `lib/media/media-api.ts`, `lib/api-client.ts`, `components/shell/AdminRouteGuard.tsx`, `packages/types/src/media.ts`, all Home/media tests. Backend: Stage 5.16 DTOs/services/controllers and `home-write.util.ts`.

## 3. Home Admin architecture
- Every page = `AdminRouteGuard(require-auth)` → `AdminShell` → content (`app/home/hero-cards/[id]/page.tsx` pattern, identical for all four).
- **One shared client factory** `createHomeResourceApi(basePath)` (`features/home/api/home-resource-api.ts`) → `list(limit=100)`, `get`, `create`, `put`(partial), `remove`, `reorder({items})`. The four `home-*-api.ts` files are one-liners binding it to `/admin/home/{hero-cards|service-banners|service-mosaic-tiles|news-articles}` (paths verified equal to the backend controllers).
- **One shared list scaffold** `ResourceListPage`, **one shared form shell** `HomeFormShell`, **one set of mutation helpers** `performSave/performToggleActive/performReorder/performRemove/moveItem` (`logic.ts`) — every screen funnels through the same code, so most findings below apply to all four.
- State is local `useState` per screen; there is no query cache/hook library. Data loads once in `useEffect`.
- Auth/RBAC: `canManageHomeContent(role)` (`rbac.ts`) = SUPER_ADMIN/CONTENT_EDITOR. UI-only; backend enforces.
- Transport: `lib/api-client.ts` — unwraps `{success,data}`/`{success:false,error}`, throws `ApiError(message, code, status)`; one silent refresh-and-retry on 401.

## 4. Hero Cards analysis
- List: `HeroCardsListContent.tsx` → `homeHeroApi.list()` (`GET …/hero-cards?limit=100`), shows key/color columns; no thumbnail (`getThumbnail={() => null}`); no media (correct — model has none).
- Create/Edit: `HeroCardForm.tsx`, sends `{cardKey,label,title,subtitle,displayNumber,ownerLabel,colorPreset,active}` (full object on edit → `PUT` merge). `sortOrder` never sent.
- `cardKey`: dropdown limited to keys not already taken (loads the list to compute `takenKeys`); on **create with all 3 keys taken** the state default is `earn` and `availableKeys` (`key === cardKey || !takenKeys.includes(key)`) always keeps the currently selected key, so the dropdown still offers the taken `earn` and a submit is answered **409** *(code-inferred)*; the UI gives no "all keys used" message.
- Delete: hard delete with `ConfirmDialog`; toggle: `PUT {active}`; reorder: full-list.
- Matches backend DTO field names/enums exactly (`CARD_KEY_LABEL`, `COLOR_LABEL` keys = `earn|biawin|reward`, `blue|sky|white`).

## 5. Service Banners analysis
- Form: `ServiceBannerForm.tsx` sends `{categoryId, mediaAssetId (string|null), kicker, theme, wide, active}`.
- Client check only: `categoryId` non-empty ("انتخاب دسته‌بندی الزامی است.").
- `CategorySelect` shows **only active categories** (`categories-api.ts:15` filters `active`) but the value is initialized from `initial.categoryId`. For a banner whose category is inactive (real staging case: `اتومبیل`) the current id is **not among the options** → the select shows the placeholder while state still holds the real id *(code-inferred)*; saving without touching it re-sends the same id, which the backend accepts (existence only, BD-1).
- Media via `MediaPickerField` (§8).

## 6. Mosaic analysis
- `ServiceMosaicForm.tsx`: `{categoryId, mediaAssetId, slotType, kicker, title: title||null, lead: lead||null, theme, active}`. `title`/`lead` optional for both slot types → matches BD-5 and the backend DTO (blank → null; whitespace-only is sent as-is and normalized by the backend).
- List shows slot type badge; `half`/`wide` share one order list (matches the backend single `sortOrder` space).

## 7. News analysis
- `NewsArticleForm.tsx`: `{category,mediaAssetId,kicker,title,lead,bodySlug: bodySlug||null,active}`.
- `bodySlug` is a free-text input with **no format hint or validation** while the backend now enforces `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤100, unique → 400 (format) / 409 (duplicate).
- List thumbnail from `item.image`.

## 8. Media analysis
- **Picker** (`MediaPickerField` + `MediaPickerModal`, used by banner/mosaic/news **and by the catalog forms** `CardProductForm`, `CategoryForm`, `CategoryCardForm`, `ServiceForm`): lists `GET /admin/media?limit=50` (`media-api.ts:13`, no paging), upload via `POST /admin/media/upload` (creates a *new* asset), selecting calls `onChange(asset.id, asset.url)`.
- **Media page** (`app/media/page.tsx` + `MediaLibraryGrid.tsx`): list (same 50), upload, and a **Delete button on every asset** → `DELETE /admin/media/:id`. No role check in the grid (a SUPPORT_VIEWER sees the button; backend would 403), no usage information, no confirmation dialog.
- The only Home-screen write to media is *creating* an asset through the picker's upload tab.

## 9. CRUD matrix (evidence = code)

| Entity | List | Create | Edit | Delete | Active toggle | Media assignment | Reorder |
|---|---|---|---|---|---|---|---|
| Hero Cards | PASS | PASS (409 latent when keys exhausted, see §4) | PASS | PASS | PASS | n/a (no field) | PASS |
| Service Banners | PASS | PASS | PARTIAL (inactive-category display; soft-deleted-media save → 422, §13) | PASS | PASS | PARTIAL (50-item picker, no paging) | PASS |
| Mosaic | PASS | PASS | PARTIAL (same two conditions) | PASS | PASS | PARTIAL | PASS |
| News | PASS | PASS | PARTIAL (soft-deleted media; slug format) | PASS | PASS | PARTIAL | PASS |
| Media (page) | PARTIAL (no paging, 50 max) | PASS | MISSING (no alt-text edit; backend has none either) | MISMATCH (§13) | n/a | n/a | n/a |

`PASS` = the request/response shape matches the verified backend contract; it says nothing about visual behavior.

## 10. Validation matrix — can the UI submit something the backend rejects?

`HomeFormShell.tsx:31` renders `<form … noValidate>`, so the HTML `required` attributes on the inputs are **not enforced** by the browser. The only client-side checks in all four forms are the banner/mosaic category check. No input has `maxLength`.

| Rule (backend, Stage 5.16) | UI behavior | Can UI trigger a backend rejection? |
|---|---|---|
| required text non-empty after trim | not checked | **Yes → 400** (English class-validator text) |
| max lengths (100/200/300/500/1000…) | none | **Yes → 400** |
| `categoryId` uuid + exists | from a `<select>` of real ids | No (except a deleted-meanwhile category → 422) |
| `mediaAssetId` uuid, exists, **active** | from picker / initial value | **Yes → 422** when the initial value is a soft-deleted asset (§13) |
| `mediaAssetId` nullable | `null` when nothing selected / "حذف انتخاب" | Accepted |
| mosaic `title`/`lead` nullable | `value || null` | Accepted |
| `bodySlug` format + unique | free text, `|| null` | **Yes → 400 / 409** |
| `sortOrder` 0…100000 | never sent on create/edit; reorder sends `0..n-1` | No |
| `cardKey` unique | dropdown excludes taken keys | Only when all 3 are taken (409) |
| unknown properties | none sent | No |

## 11. Error-handling matrix

There is **no status-specific handling on any Home screen**: `grep` for `.status ===` in `apps/admin/src` finds only the 401 refresh in `api-client.ts`. Every failure goes `ApiError(message from envelope)` → `messageFor()` (`logic.ts`) → a banner string.

| Status | Screen behavior (code trace) |
|---|---|
| 400 (validation / malformed id) | Form banner shows the raw backend message, which is **English** `class-validator` text joined with `; ` (or `ParseUUIDPipe`'s English text on the edit page load). Fields are not highlighted. |
| 404 (edit page) | `EditXContent` shows the Persian message in a red `<p role="alert">` instead of the form. |
| 404 (toggle/delete/reorder on a row deleted elsewhere) | Toggle/reorder: message in the list's `actionError`, **list is not refreshed** (stale row stays). Delete: message inside the confirm dialog; row stays until reload. |
| 409 duplicate `cardKey` / `bodySlug` | Persian message in the form banner; no field focus. Works as intended. |
| 409 media delete (Media page) | `MediaLibraryGrid` shows `error.message` (Persian "in use" text). `details.references` is **dropped** by `ApiError`, so the admin is not told *what* references it. |
| 422 unknown category / media | Persian message in the form banner. |
| 422 unknown reorder id | `performReorder` returns failure → `actionError` shown; **no refetch**, list stays stale. |
| 500 | The backend filter sends `exception.message` for non-HTTP errors, so the raw server message would be shown in the banner *(code-inferred; a Prisma text could surface)*. |
| Non-JSON / network | `res.json()` throws a non-`ApiError` → the Persian generic fallback for that action. |
| 401 | one silent refresh; on failure the (401) message is shown; redirect depends on `AdminRouteGuard` state. |

## 12. Reorder analysis
Implementation: `moveItem()` (`logic.ts:104`) swaps two items in the **currently displayed list** and returns `reordered.map((item,i) => ({id, sortOrder: i}))` for **every** row; `performReorder` sends `PATCH …/reorder {items}` then **always refetches** `list()` (the reorder response is typed `unknown` and ignored).

| Question | Answer |
|---|---|
| Payload shape | `{ items: [{id, sortOrder}] }` — **matches** the verified contract |
| ID format | ids from the server list (uuid) |
| Duplicate IDs possible? | No (one entry per list row) |
| Duplicate positions possible? | No (`0..n-1`) |
| Empty payload possible? | No (buttons disabled on 0/1 items; a 1-item list has both arrows disabled) |
| Partial reorder | The UI always sends the **full displayed list** (up to the 100-row page). It is a valid superset of the backend's partial contract; if a list ever exceeded 100 rows only the first 100 would be renumbered *(latent)* |
| Restore/refresh | refetches on success; on **failure it neither restores nor refreshes** |
| Error display | `actionError` banner |
| Includes inactive rows | Yes (admin list includes them) — consistent with the backend accepting inactive ids |
| Ties on create | New rows are created with default `sortOrder` 0 (form never sends it) and appear according to the backend's deterministic order (`sortOrder`, `createdAt`, `id`) |

Verdict vs Stage 5.16: **PASS** (no request the backend would reject).

## 13. Media behavior
- **`mediaAssetId` / null:** forms initialize from `initial.mediaAssetId ?? null`; "حذف انتخاب" sets `null`; the PUT sends `null` to clear. Matches the DTO (`@IsOptional` + `@IsUUID`).
- **Soft-deleted media (MISMATCH, latent):** the public/admin `image` is now `null` for such a row, so the form's preview shows "تصویری انتخاب نشده است", **but** `mediaAssetId` in state is still the old id, so the picker shows "تغییر تصویر"/"حذف انتخاب" and **every save re-sends that id** → backend `assertMediaAssetUsable` (`home-write.util.ts`) returns **422 "رسانه انتخاب‌شده معتبر نیست."** The admin must clear or replace the image to save any other edit. Toggle-active and reorder are unaffected (they do not send `mediaAssetId`). Staging currently has 0 such rows, so it is not reachable today.
- **Preview:** uses the server-resolved `image`/`asset.url`; `onError` hides broken images.
- **Replacement:** pick another asset or upload a new one; old asset is left untouched (no delete). An upload in the picker that is then abandoned leaves an orphan asset (no cleanup).
- **Deletion via UI:** only on `/media`. The backend now answers **409** when the asset is referenced by any Home row, Category, CategoryCard, Service (incl. gallery) or CardProduct, so deleting through the UI cannot break unrelated records. Unreferenced assets are soft-deleted. The grid gives no usage warning and no confirmation dialog.
- **Picker scope:** lists all active assets (including those used by card/category artwork). *Selecting* one only copies its id into a Home row; it does not modify the asset or its other referrers.
- **Paging:** 50 items max, `total` ignored; older assets (staging has 180 rows in `media_assets`) are unreachable from the picker except by uploading again *(code-inferred from `?limit=50` + no paging UI)*.

## 14. Artwork preservation analysis (HARD requirement)

Every state-changing call issued from `apps/admin/src`, from `grep "apiClient\.(post|put|patch|delete|postFormData)"`:

| Caller | Endpoint | Touches protected refs? |
|---|---|---|
| `features/home/api/home-resource-api.ts` | `POST/PUT/DELETE/PATCH /admin/home/{hero-cards, service-banners, service-mosaic-tiles, news-articles}[/id|/reorder]` | **No** — writes only `home_*` tables (`home-image-integrity.spec.ts` proves the backend services write only their own table) |
| `lib/media/media-api.ts` | `POST /admin/media/upload` (creates a new asset), `DELETE /admin/media/:id` | **No direct write**; delete is guarded (409) against every reference, including all five protected columns |
| `lib/auth/admin-auth-api.ts` | login/refresh/logout | No |
| `features/catalog/api/catalog-resource-api.ts` | `PUT /admin/{card-products,category-cards,categories,services}/:id` | **Yes — but these are the Catalog screens, not Home.** `CardProductForm/CategoryForm/CategoryCardForm/ServiceForm` submit their own `mediaAssetId` (and `galleryMediaAssetIds` for Service) |

Conclusions:
1. **No Home Admin screen can write `card_products.mediaAssetId`, `category_cards.mediaAssetId`, `categories.mediaAssetId`, `services.mediaAssetId` or `services.galleryMediaAssetIds`.** Home code never calls a catalog endpoint (grep of `features/home`, `lib`, `app/home`, `app/media` for `card-products|category-cards|/admin/categories|/admin/services` finds only a comment).
2. The Home forms and the catalog forms **share** `MediaPickerField`/`MediaPickerModal`; the shared component never writes, and each consumer writes only its own endpoint.
3. The one path that can affect artwork indirectly is media **deletion**, and the Stage 5.16-B guard blocks it (409) while any of those columns reference the asset.
4. Out of scope but recorded, not changed: the catalog screens can change/clear a card's/category's image by design (pre-existing capability documented in Stage 5.16-A §10.3).

## 15. Active-state analysis
- Only the backend's boolean `active` is used. `ActiveToggle` (`aria-pressed`, "فعال"/"غیرفعال") calls `PUT {active}`; forms have an "فعال" checkbox (default `true` on create). No draft/published/scheduled UI exists — consistent with BD-6.
- `HomeOverview` counts active/inactive from the fetched page (`total` from the API, active/inactive counted from ≤100 rows) and says so.
- A row with an inactive category or dead media still shows as "فعال" in the admin list; **the admin has no indicator** that the customer sees no image (BD-2) or that the category is inactive (BD-1 keeps it public).

## 16. Audit UI analysis
`grep -ril audit apps/admin/src` → **no matches**. The Admin UI neither calls nor displays `GET /admin/audit-logs` (SUPER_ADMIN-only, unfiltered, raw rows with `beforeJson/afterJson`, richer since Stage 5.16-B). Sidebar has no audit entry. **MISSING** (documented only).

## 17. Frontend / backend contract mismatches

| # | Finding | Type | Evidence |
|---|---|---|---|
| M1 | Saving a Home row whose media was soft-deleted re-sends the stale `mediaAssetId` → 422; UI shows "no image" but treats it as selected | MISMATCH (latent, 0 rows today) | `ServiceBannerForm.tsx:35-36`, `home-write.util.ts` |
| M2 | Forms are `noValidate`, no `maxLength`, no trim → blank/oversized/`bodySlug`-format input reaches the backend and returns English 400 text in the banner | MISMATCH (UX) | `HomeFormShell.tsx:31`, forms |
| M3 | `bodySlug` has no format/uniqueness hint | MISMATCH (UX) | `NewsArticleForm.tsx:94` |
| M4 | Inactive category of an existing banner/tile is not in `CategorySelect` options → placeholder shown | PARTIAL | `categories-api.ts:15` |
| M5 | Failed toggle/delete/reorder on a row that no longer exists leaves the list stale | PARTIAL | `*ListContent.tsx`, `logic.ts:58` |
| M6 | `ApiError` drops `details` (e.g. media-delete `references`, reorder `unknownIds`) | MISSING | `api-client.ts` (`ApiError(message, code, status)`) |
| M7 | Media picker/page: `?limit=50`, no paging (`total` ignored) | PARTIAL | `media-api.ts:13` |
| M8 | Media page: Delete shown to every role, no usage info, no confirm | MISMATCH (UX/RBAC) | `MediaLibraryGrid.tsx` |
| M9 | Hero create when all 3 keys are taken: the select still offers the taken default `earn` (the filter always keeps the selected key), no "all keys used" message → 409 | PARTIAL | `HeroCardForm.tsx` |
| M10 | Stale copy/comments: Media page says "not connected to any content (home, news)"; `MediaLibraryGrid` comment says the `/media/{filename}` route isn't built; `categories-api.ts` says no `/admin/categories` exists — all three are false against current code (`media-files.controller.ts`, `categories-admin.controller.ts:44`) | Stale docs/text | `app/media/page.tsx:58`, `MediaLibraryGrid.tsx` doc, `categories-api.ts:7` |
| M11 | Frontend types otherwise match the backend: `Paginated {items,total,skip,take}`, `mediaAssetId`, `image: string|null`, reorder body `{items:[{id,sortOrder}]}`, `PUT` partial merge, enums | Verified match | `types.ts`, `home-resource-api.ts`, DTOs |

`docs/admin-home-management-ui-report.md` contains no `/image` endpoint or `imageKey` claims (grep empty), so the stale-contract items from Stage 5.15 (`/image` endpoints, array reorder body) do **not** appear in the UI code; they existed only in `docs/home-admin-contract.md`, now bannered.

## 18. Existing test coverage
`apps/admin`: 25 suites / 84 tests pass. Home-related:

| Area | Tests | What they cover | Not covered |
|---|---|---|---|
| `features/home/__tests__/logic.test.ts` | performSave (create/edit/ApiError/network), performToggleActive (incl. 403), performReorder (success, failed reorder, failed refetch), performRemove, moveItem | request logic with mocked deps | real HTTP, status-specific UX |
| `rbac.test.ts` | role → canManage | | |
| `ResourceListPage.test.tsx` | render items, empty, load error, canManage on/off | static render only | clicks, toggle, reorder, delete flow |
| 4 form tests + `HeroCardsListContent.test.tsx` | create/edit/readOnly **static rendering** (server render) | field presence, prefill | submit, validation, 400/409/422 display |
| `MediaPickerField.test.tsx` | empty vs selected render | | picker modal, upload-in-picker, selection |
| `app/home/page.test.tsx`, `app/media/page.test.tsx` | overview/media page render | | delete flow, 409 message |
| `MediaUploadForm.test.ts` | `performMediaUpload` cases | | |

Error states tested: only the generic ApiError-message pass-through in `logic.test.ts`. **No test covers**: status-specific handling, 409/422, malformed-id, reorder failure display, soft-deleted media, inactive category, media delete (409), the picker's 50-item limit, or a real browser interaction. (Tests use server rendering; no `@testing-library`/DOM interaction library is a dependency.)

## 19. Browser QA readiness matrix

| Area | Status | Reason |
|---|---|---|
| Sign-in + Home nav / overview | READY FOR BROWSER QA | routes and guard exist; read-only |
| Lists (4) — render, thumbnails, empty/loading | READY FOR BROWSER QA | read-only |
| Active toggle (4) | READY FOR BROWSER QA (needs fixture) | mutates data; run only on QA-tagged fixture rows |
| Create/Edit forms (4) — valid submits | READY FOR BROWSER QA (needs fixture) | mutation |
| Create/Edit — invalid input (blank, over-length, bad `bodySlug`, duplicate slug) | READY FOR BROWSER QA (needs fixture) | expected outcome is a documented English 400 / Persian 409 banner |
| Reorder (4) | READY FOR BROWSER QA (needs fixture) | must not reorder real rows; use ≥2 QA rows per resource, restore after |
| Media picker (select / clear / upload) | READY FOR BROWSER QA (needs fixture) | upload creates assets that must be hard-cleaned (media delete is soft) |
| Soft-deleted-media edit → 422 (M1) | **BLOCKED** | no such row exists on staging and creating one requires the direct-Prisma step (only available in the server-side verifier), not the UI |
| Inactive-category banner edit (M4) | READY FOR BROWSER QA (read-only observation) | the real staging `اتومبیل` banner can be *opened* without saving |
| Hero create with all keys taken (M9) | READY FOR BROWSER QA | opens the create form only; submitting would create a 409 request but no row |
| Media page delete / 409 (M8) | **NOT READY for destructive testing on real assets** | only on QA-tagged assets; risk of deleting a real customer asset via the always-visible button |
| RBAC (SUPPORT_VIEWER read-only) | **BLOCKED** | needs a SUPPORT_VIEWER account; none is available outside the API QA runner's temporary accounts, which are out of scope |
| Audit log UI | **NOT READY (missing)** | no UI exists to test |
| Admin login via the browser | **BLOCKED** in this environment | no admin credential reachable from the sandbox (Stages 5.16-C/D); needs an operator-run session or a CI job |

**Overall:** the Home Admin UI is structurally testable in a browser; every mutation test needs the same isolated, tagged, self-cleaning fixture discipline used in Stage 5.16-E. Browser QA against real staging content is **not** recommended without it.

## 20. Recommended next stage
1. **Decide** (product) whether M1–M10 are in scope. Suggested minimal set for a UI hardening stage (5.17-B, *not started*): enable client validation (remove `noValidate` or add explicit checks, trim, `maxLength`, `bodySlug` pattern hint) mirroring the Stage 5.16 limits; clear/flag a stale `mediaAssetId` when `image === null`; include the current inactive category in `CategorySelect`; refetch on failed reorder/toggle/delete; surface `ApiError.details`; add a confirm dialog + usage message and RBAC gating to media delete; media picker paging; fix stale copy (M10).
2. **Add tests** for the untested mutation and error paths before or with those changes (interaction tests need a DOM testing dependency, or extract more logic as plain functions as the repo already does).
3. **Then** Browser QA (5.17-C) using a tagged, self-cleaning fixture and an operator-supplied admin session, never against unlabeled staging rows, with the artwork checksum gate (`card_products`, `category_cards`, `categories`, `services`, `services.gallery`) before and after.

---

## Verification of this stage
- `git status` before writing this file: only the 3 pre-existing unrelated untracked files (`apps/admin/AGENTS.md`, `apps/admin/CLAUDE.md`, `docs/stage-5.20-…-audit.md`).
- Files created by this stage: this report. No application source modified. Browser QA: **NOT RUN**. `authenticated-qa-runner.ts`: **NOT RUN**. No deployment.
