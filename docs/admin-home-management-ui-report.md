# Admin Home Management UI — Implementation Report (Stage 5.20)

Source of truth: `docs/home-admin-contract.md`, `docs/admin-architecture-decision-record.md`,
Stage 5.16 (admin identity/RBAC/audit foundation), Stage 5.17 (Admin Portal Shell —
`AdminShell`/`AdminSidebar`/`AdminRouteGuard`/`apiClient`), Stage 5.18 (Media Library —
`mediaApi`/`MediaUploadForm`), Stage 5.19 (Home CMS backend — the 4 resources' real
DTOs/routes/response shapes this stage builds a UI for). Scope: the Admin Portal UI for
managing existing Home CMS content only — no page builder, no Customer App change, no
scheduling workflow, no second Media Library.

## 1. Files created/changed

### Backend (one small, disclosed deviation — see §8)

- [apps/admin/src/lib/api-client.ts](../apps/admin/src/lib/api-client.ts) — **not backend**, but flagged here since it's infrastructure: added `apiClient.put()`. Home CMS updates use `PUT /admin/home/**/:id` (Stage 5.19's contract), and the Stage 5.17 client only had `get`/`post`/`patch`/`delete`/`postFormData`. No backend route changed.
- [apps/admin/src/components/media/MediaUploadForm.tsx](../apps/admin/src/components/media/MediaUploadForm.tsx) — one-line fix, `event.stopPropagation()` added to `handleSubmit` (see §8).

### Admin app — `apps/admin/src/features/home/` (new feature module)

- [types.ts](../apps/admin/src/features/home/types.ts) — admin-only response/input shapes mirroring Stage 5.19's DTOs exactly (`HomeHeroCardAdmin`, `HomeServiceBannerAdmin`, `HomeServiceMosaicTileAdmin`, `HomeNewsArticleAdmin` + their `*Input` counterparts), plus `CategoryOption`, `ReorderEntry`, `Paginated<T>`.
- [rbac.ts](../apps/admin/src/features/home/rbac.ts) — `canManageHomeContent(role)`.
- [logic.ts](../apps/admin/src/features/home/logic.ts) — shared, resource-agnostic plain functions: `performSave`, `performToggleActive`, `performReorder`, `performRemove`, `moveItem`. Same factored-out-for-testability pattern as Stage 5.17's `performAdminLogin`.
- `api/home-resource-api.ts` — a thin HTTP-wrapper factory (not a generic-CRUD backend abstraction — each resource still has its own dedicated NestJS controller/service; this only removes client-side boilerplate), plus `home-hero-api.ts`, `home-service-banner-api.ts`, `home-service-mosaic-api.ts`, `home-news-api.ts`, `categories-api.ts` (wraps the existing public `GET /categories`).
- `components/` — `ActiveToggle.tsx`, `ReorderControls.tsx`, `ConfirmDialog.tsx`, `FormField.tsx`, `formStyles.ts`, `CategorySelect.tsx`, `MediaPickerModal.tsx`, `MediaPickerField.tsx`, `HomeFormShell.tsx`, `ResourceListPage.tsx` (+ `.test.tsx`), `MediaPickerField.test.tsx`.
- `hero/` — `HeroCardForm.tsx` (+ `.test.tsx`), `HeroCardsListContent.tsx` (+ `.test.tsx`).
- `service-banners/` — `ServiceBannerForm.tsx` (+ `.test.tsx`), `ServiceBannersListContent.tsx`.
- `service-mosaic/` — `ServiceMosaicForm.tsx` (+ `.test.tsx`), `ServiceMosaicListContent.tsx`.
- `news/` — `NewsArticleForm.tsx` (+ `.test.tsx`), `NewsListContent.tsx`.
- `overview/HomeOverview.tsx`.
- `__tests__/logic.test.ts`, `__tests__/rbac.test.ts`.

### Admin app — routes (`apps/admin/src/app/home/`)

13 new route files — see §2.

### Admin app — modified

- [components/shell/AdminSidebar.tsx](../apps/admin/src/components/shell/AdminSidebar.tsx) — `AdminNavItem` gained an optional `children` field; a "خانه" (Home) entry with 4 children replaces the previous flat-only nav list. `/media` is unchanged as a flat item.

No file under `apps/web` was touched. No `backend/` file was touched beyond nothing — the one API-client addition and the `stopPropagation()` fix are both in `apps/admin`.

## 2. Routes created

| Route | Purpose |
|---|---|
| `/home` | Overview — 4 resource cards with total/active/inactive counts, links to each list |
| `/home/hero-cards` | Hero cards list |
| `/home/hero-cards/new` | Create |
| `/home/hero-cards/[id]` | Edit (or read-only view for `SUPPORT_VIEWER`) |
| `/home/service-banners`, `/new`, `/[id]` | Same pattern for service banners |
| `/home/service-mosaic`, `/new`, `/[id]` | Same pattern for service mosaic tiles |
| `/home/news`, `/new`, `/[id]` | Same pattern for news articles |

All 13 routes render behind `<AdminRouteGuard mode="require-auth">` inside `<AdminShell>`, identical to every existing admin page. `next build` confirms all list/overview/new routes prerender statically; the 4 `[id]` routes are correctly dynamic (server-rendered on demand).

## 3. Home resources implemented

All 4 Stage 5.19 resources: list, create, edit, active/inactive toggle, reorder (move up/down), delete (with confirmation). Fields exposed in every form come **only** from the real backend DTOs (`backend/src/modules/home/dto/*.ts`) — verified against them directly, not assumed from this stage's brief.

- **Hero cards** — `cardKey` (select, filtered to keys not already used by another card), `label`, `title`, `subtitle`, `displayNumber` (hinted as decorative), `ownerLabel`, `colorPreset`. **No MediaAsset field, no link field** — see §8, this is a deliberate deviation from the brief's generic per-resource requirement list, because the real `HomeHeroCard` model has neither.
- **Service banners** — `CategorySelect` (real `Category.id`, never a name match), `kicker`, `theme`, `wide`, `MediaPickerField`, `active`.
- **Service mosaic tiles** — `CategorySelect`, `slotType` (half/wide), `kicker`, `title`/`lead` (hinted as wide-only, matching the backend's own doc comment), `theme`, `MediaPickerField`, `active`.
- **News articles** — `category` (plain editorial text field, not a Category FK — matches the real model), `kicker`, `title`, `lead`, `bodySlug` (hinted as reserved/unused, matching the backend DTO's own description), `MediaPickerField`, `active`.

## 4. Media Picker behavior

`components/MediaPickerModal.tsx` + `MediaPickerField.tsx` — reuses Stage 5.18's `mediaApi` and `MediaUploadForm` directly; no second upload/storage subsystem exists. Behavior:

- Browse: lists `mediaApi.list()` results (already `active: true`-filtered server-side) as a thumbnail grid.
- Select: clicking a thumbnail sets the field's `mediaAssetId` + preview URL and closes the picker.
- Upload: an in-picker toggle switches to the real `MediaUploadForm`; a successful upload both adds the asset to the Media Library and selects it in one action, going through `POST /admin/media/upload` → `MediaService` → `MediaStorageService`, unmodified.
- Missing media: `MediaPickerField` shows "تصویری انتخاب نشده است" ("no image selected") rather than any placeholder image, per §18 of the brief — verified live against the real seeded content (every seeded row's `mediaAssetId` is still `null`, exactly as Stage 5.19 left it).
- Replace/clear: "تغییر تصویر" re-opens the picker on an already-selected field; "حذف انتخاب" clears the selection.

The modal is rendered via `createPortal(..., document.body)` — see §8 for why.

## 5. Reorder implementation

`ReorderControls.tsx` (up/down arrow buttons only — no drag-and-drop library added, matching §10's "do not introduce a large drag/drop framework unnecessarily"). On each click, `logic.ts`'s `moveItem()` computes the full list's new `{id, sortOrder}[]` (every item reassigned a sequential index, not just the two swapped rows — keeps `sortOrder` canonical rather than accumulating drift), which is sent as one call to the existing `PATCH .../reorder` endpoint. The list is then always re-fetched from the admin endpoint afterward — `reorder()`'s own response is the resource's *public* list shape (`HomeXxxService.reorder()` returns `listPublic()`), so it's deliberately never used directly to update UI state. A failed reorder call (network error, 403, etc.) leaves the displayed order untouched and shows an error banner — verified both by unit test (`performReorder`'s failure path never calls `list()` and never reports success) and live (reorder persisted correctly across a full page reload during E2E verification).

## 6. RBAC behavior

- `rbac.ts`'s `canManageHomeContent(role)` is `true` only for `SUPER_ADMIN`/`CONTENT_EDITOR`.
- List pages: `SUPPORT_VIEWER` sees no "+ new" button, no reorder arrows, no delete buttons, and row titles render as plain text instead of edit links. The active/inactive badge is still shown but its toggle button is `disabled`.
- `/new` routes: a `SUPPORT_VIEWER` is redirected back to the resource's list (a create form has no value for a read-only role).
- `/[id]` routes: a `SUPPORT_VIEWER` sees the real saved values in a `disabled` `<fieldset>` with no submit button and an explicit "دسترسی شما فقط مشاهده است" notice — read-only visibility, not "no access."
- **Backend remains authoritative** — none of the above is a security boundary. Verified live: a real `SUPPORT_VIEWER` JWT against `POST/PATCH /admin/home/hero-cards` still gets `403 FORBIDDEN` from the untouched Stage 5.19 `AdminRolesGuard`.

## 7. Tests and live verification

### Automated (Jest, `renderToStaticMarkup` — no DOM, same constraint as every prior admin-app stage: the npm registry has been unreachable for `@testing-library/*`/`jest-environment-jsdom` for this entire engagement)

```
Test Suites: 16 passed, 16 total  (10 new)
Tests:       57 passed, 57 total  (39 new)
```

| Required scenario | Test(s) |
|---|---|
| Home management route renders | `app/home/page.test.tsx` |
| Protected route behavior | unchanged, covered generically by the existing `AdminRouteGuard.test.tsx` (every new page reuses that same guard) |
| Hero: list rendering, create/update, active toggle, reorder | `logic.test.ts` (shared, resource-agnostic) + `HeroCardForm.test.tsx` + `HeroCardsListContent.test.tsx` |
| Service Banner: Category ID selection, MediaAsset selection, save flow | `ServiceBannerForm.test.tsx` — explicitly asserts the raw `categoryId` never appears as visible text, only the resolved name |
| Mosaic: list/edit behavior, reorder | `ServiceMosaicForm.test.tsx` (edit prefill) + `ResourceListPage.test.tsx` (shared list scaffold, used by all 4 resources) + `logic.test.ts` (reorder) |
| News: create/edit, active toggle, reorder | `NewsArticleForm.test.tsx` + `logic.test.ts` |
| RBAC: `CONTENT_EDITOR` gets controls, `SUPPORT_VIEWER` is read-only | `ResourceListPage.test.tsx` (generic, all 4 resources) + `HeroCardsListContent.test.tsx` (real end-to-end wiring, not just the scaffold in isolation) |
| Failed save surfaces an error / failed reorder never shows false success | `logic.test.ts` — `performSave`/`performReorder` failure-path assertions, including the case where reorder succeeds but the follow-up re-fetch fails |

`ResourceListPage.test.tsx` is the most load-bearing file: since the shared list scaffold fetches nothing itself, it's the one place `renderToStaticMarkup` exercises the *real* rendered list (not stuck on a loading state), so it covers list rendering + RBAC visibility for all 4 resources at once.

### Live end-to-end verification (real Postgres, real MinIO, real running backend + admin dev server — not mocks)

Restarted `biawin-postgres`/`biawin-redis` (and `biawin-minio`, initially stopped — see §8), started the backend and `apps/admin` dev servers, logged in as the seeded `SUPER_ADMIN`, and drove the actual browser UI:

- **News article**: filled category/kicker/title/lead → opened the Media Picker → uploaded a real PNG through the in-picker upload flow (the picker's grid was empty at that point, confirmed via the real `GET /admin/media`) → the uploaded asset was auto-selected → saved → `POST /admin/home/news-articles` → `201`, real `mediaAssetId` persisted, `image` resolved. Edited the same article (title change + re-activate after toggling inactive) → `PUT` → both changes persisted (`GET` confirms). Reordered it via the move-up control → confirmed the new order **persisted after a full page reload**. Deleted it via the confirm dialog (which correctly named the item being removed) → confirmed removal.
- **Inactive visibility**: while the test article was toggled inactive, confirmed it was absent from the public `GET /home/news-articles` and present in the admin list — the exact rule §18/§11 require.
- **Service banner**: selected a real category via `CategorySelect` (submitted `categoryId`, a UUID — never the category name), selected the already-uploaded test image via the picker's *browse* path (not upload, exercising the other half of the picker), saved → `GET /admin/home/service-banners/:id` confirmed `categoryId`/`categoryName` both correct and `mediaAssetId` linked.
- **Service mosaic**: confirmed the list correctly renders both `half` and `wide` slot types in one table; opened a real `wide` tile's edit page and confirmed `category`/`slotType`/`title`/`lead` all pre-filled from the real row.
- **RBAC**: created a temporary `SUPPORT_VIEWER` admin (via a one-off Prisma script — no admin-user-management API exists yet, same gap Stage 5.19's own live verification hit), logged in as them, and confirmed: no create/reorder/delete controls on the list, `/new` redirects to the list, `/[id]` renders a disabled read-only form, and — via direct HTTP — `POST`/`PATCH .../reorder` both return real `403 FORBIDDEN` from the backend.
- **Cleanup**: deleted the temporary `SUPPORT_VIEWER` account, the test news article, the test service banner, and the test media asset. Final counts confirmed back to the original seed (3 hero cards / 5 banners / 4 mosaic tiles / 8 news articles / 0 media assets) and hero card order confirmed restored to `earn, biawin, reward`.

## 8. Backend deviations and other disclosed adjustments

**No NestJS route, controller, service, DTO, or Prisma model was changed this stage.** Two frontend-only adjustments were required, both disclosed:

1. **`apiClient.put()` added** (`apps/admin/src/lib/api-client.ts`) — the Stage 5.17 admin API client never needed `PUT` (Media only has create/delete), but Stage 5.19's Home CMS update routes are `PUT /admin/home/**/:id`. Purely additive; no existing method changed.
2. **`MediaUploadForm`'s `handleSubmit` gained `event.stopPropagation()`** — discovered live, not anticipated. The Media Picker's `MediaUploadForm` is a React descendant of whichever Home resource form opened it; even though `MediaPickerModal` is rendered via `createPortal(..., document.body)` (to avoid literally nesting `<form>` inside `<form>` in the DOM, which browsers handle unpredictably), React's synthetic `onSubmit` event still bubbles through the **React component tree**, not the DOM tree — a documented React portal behavior. Without `stopPropagation()`, submitting the inner upload form also fired the outer resource form's `onSubmit`, once creating a stray empty news article during verification (caught and deleted — see §7). The fix is one line, harmless on the standalone `/media` page (which has no ancestor form), and does not change Stage 5.18's own upload behavior.

**Non-code environment gap** (not a deviation, but relevant to reproducing verification): the local `biawin-minio` container was stopped at the start of this stage's live verification; media uploads failed with `ECONNREFUSED 127.0.0.1:9000` until it was restarted. This is infrastructure state, not application behavior, and needed no code change.

**Customer App**: confirmed unchanged. `apps/web` was never edited; every `pnpm typecheck`/`lint`/`test`/`build` run this stage shows `@biawin/web` as a cache hit (byte-for-byte identical output to before this stage), and its route list is unchanged from Stage 5.19.

## 9. Known limitations intentionally deferred

- **Hero card `create` is effectively inert in practice**: `cardKey` is a fixed 3-value enum (`earn`/`biawin`/`reward`), and the seed data already uses all 3. The form filters the key selector to keys not used by *other* rows, but since all 3 are already taken, a genuinely new hero card always collides on the unique `cardKey` constraint. This surfaces as the backend's raw Prisma `P2002` error text (unpretty, but handled — confirmed live, the form shows it inline without crashing). Not fixed by expanding the enum or the model — that would be redesigning the Stage 5.19 backend without a real product need; there is no 4th hero card slot in the Customer Home design today.
- **No admin-user-management UI/API** exists yet — provisioning the test `SUPPORT_VIEWER` for live verification required a one-off script, same gap Stage 5.19's own report already disclosed. Out of this stage's scope.
- **Overview counts cap at 100 rows per resource** (the shared pagination limit) — comfortably covers current content volume; a resource that ever exceeds that would need a real count endpoint, not a client-side page-1 tally.
- **Customer Home is still 100% static** (`apps/web/src/components/home/home.mock.ts` untouched, as required) — this stage is Admin-only. Cutting the customer app over to read live CMS data is explicitly Stage 5.21.

---

# ADMIN HOME MANAGEMENT UI:
READY
