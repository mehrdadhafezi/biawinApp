# Media Library Foundation — Implementation Report (Stage 5.18)

Source of truth: `docs/admin-architecture-decision-record.md` §6 (media
architecture), `docs/home-admin-contract.md` §5 (the same image pipeline,
Home-scoped), Stage 5.16 (`AdminJwtAuthGuard`/`AdminRolesGuard`/
`AdminAuditLogService`), Stage 5.17 (`apps/admin` shell/auth). Scope: the
central Media Library only — no Home CMS, no News management, no
Home/News wiring, no Customer App change.

## 1. Files created/changed

### Backend — new `modules/media/`

- [media.module.ts](../backend/src/modules/media/media.module.ts)
- [media.controller.ts](../backend/src/modules/media/media.controller.ts) — `GET /admin/media`, `GET /admin/media/:id`, `POST /admin/media/upload`, `DELETE /admin/media/:id`
- [media.service.ts](../backend/src/modules/media/media.service.ts) — upload validation/persistence, list, findOne, soft-delete
- [media.service.spec.ts](../backend/src/modules/media/media.service.spec.ts) — 10 tests
- [media.controller.spec.ts](../backend/src/modules/media/media.controller.spec.ts) — role-restriction tests
- [media-storage.service.ts](../backend/src/modules/media/media-storage.service.ts) — the storage abstraction layer (item 2/3 below)
- [dto/list-media-query.dto.ts](../backend/src/modules/media/dto/list-media-query.dto.ts), [dto/upload-media.dto.ts](../backend/src/modules/media/dto/upload-media.dto.ts)
- [utils/media-validation.constants.ts](../backend/src/modules/media/utils/media-validation.constants.ts) — allowed-format allow-list
- [utils/file-signature.util.ts](../backend/src/modules/media/utils/file-signature.util.ts) + [.spec.ts](../backend/src/modules/media/utils/file-signature.util.spec.ts) — magic-byte MIME sniffing
- [utils/image-metadata.util.ts](../backend/src/modules/media/utils/image-metadata.util.ts) + [.spec.ts](../backend/src/modules/media/utils/image-metadata.util.spec.ts) — dependency-free width/height extraction
- [utils/__fixtures__/sample-images.ts](../backend/src/modules/media/utils/__fixtures__/sample-images.ts) — byte-accurate PNG/JPEG/GIF/WebP test fixtures

**Modified**: `backend/prisma/schema.prisma` (new `MediaAsset` model, `AdminAuditAction` gains `CREATE`/`DELETE`, `AdminUser` gains the `uploadedMedia` relation), `backend/src/app.module.ts` (registers `MediaModule`), `backend/src/config/env.validation.ts` (`MEDIA_MAX_FILE_SIZE_BYTES`). Migration: `backend/prisma/migrations/20260825140711_media_library_foundation/`.

### Frontend — `apps/admin`

- [app/media/page.tsx](../apps/admin/src/app/media/page.tsx) — protected route, `AdminRouteGuard` + `AdminShell`
- [app/media/page.test.tsx](../apps/admin/src/app/media/page.test.tsx)
- [components/media/MediaUploadForm.tsx](../apps/admin/src/components/media/MediaUploadForm.tsx) — plus exported pure `performMediaUpload()`
- [components/media/MediaUploadForm.test.ts](../apps/admin/src/components/media/MediaUploadForm.test.ts)
- [components/media/MediaLibraryGrid.tsx](../apps/admin/src/components/media/MediaLibraryGrid.tsx) — list/delete UI
- [lib/media/media-api.ts](../apps/admin/src/lib/media/media-api.ts)

**Modified**: `apps/admin/src/lib/api-client.ts` (adds `delete` and `postFormData` — the client had neither before this stage), `apps/admin/src/components/shell/AdminSidebar.tsx` (adds the real "کتابخانه رسانه" nav item, per the same "only list routes that actually exist" rule Stage 5.17 established).

### Shared types

- `packages/types/src/media.ts` (new, `MediaAsset`), exported from `packages/types/src/index.ts`.

## 2. Database changes

Migration `20260825140711_media_library_foundation`:

| Change | Detail |
|---|---|
| `AdminAuditAction` enum | `+CREATE`, `+DELETE` (Stage 5.16 anticipated exactly this: *"added by whichever future stage builds the first real admin-managed content controller"* — this is that stage) |
| `media_assets` table (new) | `id, fileName, key (unique), mimeType, sizeBytes, width?, height?, altText?, active, deletedAt?, uploadedBy? → admin_users (SetNull), createdAt, updatedAt` |
| `admin_users` | `+uploadedMedia MediaAsset[]` (relation target for the FK above) |

Fully additive — no existing table altered beyond the enum extension (itself additive, not a value removal).

## 3. Storage architecture

Three explicit layers, matching the ADR's "do not directly couple controllers to MinIO/S3" requirement literally — `MediaController` never imports `StorageService` or any AWS SDK type:

```
MediaController → MediaService → MediaStorageService → StorageService (existing, unmodified) → MinIO/S3
```

- **`StorageService`** (existing, `backend/src/infra/storage/storage.service.ts`) — untouched. Item 3 ("object storage adapter using existing storage infrastructure") is satisfied by reuse, not a new adapter.
- **`MediaStorageService`** (new — item 2, "storage abstraction layer") — the one place that knows the `"media/"` key namespace and the public-URL convention. `MediaService` calls only this; if the namespace, URL scheme, or even the underlying provider ever changes, `MediaService`'s business logic doesn't.
- **Public URL**: `resolvePublicUrl(key)` returns `/media/{filename}` — the exact static-bridge pattern `OrbitItemsService.resolveImageUrl()` already established and ADR §6 confirms as the project-wide standard (not a presigned MinIO URL: MinIO is loopback-only in every environment this runs in, and a presigned URL would expire and break caching on a page every viewer loads).

**Known, disclosed gap**: actually *serving* `/media/{filename}` from a public origin (the reverse-proxy/static-file wiring) is not built this stage — this is deployment-level infrastructure, and it's the identical gap Orbit's own `/orbit/{filename}` bridge still has (nothing has uploaded a real Orbit asset through that API either). The admin Media Library page's image previews will 404 until that wiring exists in a later stage; the page handles this gracefully (`onError` hides the broken `<img>`, metadata still displays) rather than pretending it works.

## 4. API contracts

All four routes live under `/api/v1/admin/media`, gated by `@Public()` (opts out of the *customer* global guard) + `AdminJwtAuthGuard` + `AdminRolesGuard` at the controller level — every route requires at least an authenticated admin.

| Route | Role restriction | Notes |
|---|---|---|
| `GET /admin/media` | none (any admin, including `SUPPORT_VIEWER`) | paginated (`?page`/`?limit`, existing `PaginationQueryDto`), `active: true` only |
| `GET /admin/media/:id` | none | 404 for missing or soft-deleted |
| `POST /admin/media/upload` | `SUPER_ADMIN`, `CONTENT_EDITOR` | `multipart/form-data`, field `file` (+ optional `altText`) |
| `DELETE /admin/media/:id` | `SUPER_ADMIN`, `CONTENT_EDITOR` | soft delete (see §5) |

**Response shape** (`MediaAssetResponse`, same for list items / detail / upload result):
```json
{ "id": "...", "fileName": "photo.png", "url": "/media/<generated>.png",
  "mimeType": "image/png", "sizeBytes": 69, "width": 4, "height": 3,
  "altText": "...", "uploadedBy": "<adminUserId>", "createdAt": "..." }
```

### Validation (executed in this order, in `MediaService.upload()`)

1. File present and non-empty → `400` otherwise
2. `file.size <= MEDIA_MAX_FILE_SIZE_BYTES` (default 5MB, env-configurable) → `400` otherwise
3. Declared `mimetype` is in the allow-list (`image/jpeg`, `image/png`, `image/webp`, `image/gif` — `image/svg+xml` deliberately excluded, can embed scripts) → `400` otherwise
4. **The real security check**: the file's actual magic bytes (`sniffImageMimeType`) must exist and match the declared MIME type exactly → `400` otherwise. This is what stops a relabeled/spoofed upload — the declared `Content-Type` is never trusted alone.

### Metadata extraction

Width/height are parsed directly from each format's own header bytes (`image-metadata.util.ts`) — no image-decoding library. Best-effort: returns `null` on anything unparseable rather than throwing, so a metadata-extraction miss never blocks an otherwise-valid upload.

### On dependencies: none new, disclosed why

**No new npm packages were added this stage** — not `file-type`, not `sharp`/`image-size`/`probe-image-size`, not even `@types/multer`. The npm registry was unreachable from this environment for the entire implementation window (same class of constraint as Stage 5.16's bcrypt→scrypt substitution and Stage 5.17's testing-library substitution — this is the third consecutive admin stage to hit it). Concretely:
- **MIME sniffing** uses hand-written magic-byte checks for exactly the 4 allowed formats (~20 lines) instead of `file-type`.
- **Metadata extraction** parses PNG/GIF/JPEG/WebP headers directly instead of decoding via `sharp`/`image-size`.
- **`@types/multer`** isn't installed; `@UploadedFile()`'s parameter is typed with a local `UploadedFileLike` interface instead of `Express.Multer.File` — confirmed safe by reading `@nestjs/platform-express`'s own `.d.ts` files, which don't reference `@types/multer` anywhere in `FileInterceptor`'s or `MulterOptions`' signatures. `multer` itself (the runtime, untyped) is already present as an existing transitive dependency of `@nestjs/platform-express` — nothing new was installed.

All three were verified by direct, live, real-file testing (§5), not just unit tests — the constraint changed the *implementation technique*, not the *rigor of verification*.

## 5. Security

- **Role checks**: `SUPPORT_VIEWER` can list/view but not upload/delete — verified two ways: a unit test asserting the exact `@AdminRoles(...)` metadata on the controller's route handlers (`media.controller.spec.ts`), and live, with a real `SUPPORT_VIEWER` admin account against a running server: `GET /admin/media` → `200`, `POST /admin/media/upload` → `403`, `DELETE /admin/media/:id` → `403`.
- **Audit log**: every successful upload writes a `CREATE` entry (`resourceType: "MediaAsset"`, `afterJson` with fileName/mimeType/sizeBytes); every delete writes a `DELETE` entry (`beforeJson` with fileName/mimeType/key, so the audit trail still names the file after the row is gone). Both confirmed live via `GET /admin/audit-logs`, showing the exact real upload/delete just performed.
- **Delete safety mechanism**: `DELETE /admin/media/:id` **soft-deletes only** (`active: false`, `deletedAt` set) — the row and the underlying storage object both survive. Nothing references `MediaAsset.id` yet (explicitly out of scope this stage), so there's no live-content-breakage risk to check for today; the mechanism is built the safe way from the start rather than retrofitted once a real content type does reference it. Confirmed live: after delete, the asset disappears from `GET /admin/media` and `GET /admin/media/:id` returns `404`, but the object is still present in the bucket (`mc ls` confirmed the file byte-for-byte intact).
- **MIME/format security**: covered in §4 — the magic-byte check is the actual security control, not the declared header.

## 6. Tests

### Backend

```
Test Suites: 24 passed, 24 total   (4 new: media.service, media.controller, file-signature.util, image-metadata.util)
Tests:       69 passed, 69 total   (24 new)
```

| Required scenario | Test(s) |
|---|---|
| Successful upload | `media.service.spec.ts` → *"succeeds for a valid PNG: stores the file, persists the row, and returns a shaped response"* |
| Invalid file rejection | `media.service.spec.ts` → missing file, disallowed MIME (`application/pdf`), and spoofed content (declares `image/png`, real bytes are plain text) — 3 distinct rejection paths |
| Oversized file rejection | `media.service.spec.ts` → a test-scoped 10-byte limit confirms the size check fires independent of format |
| Metadata extraction | `image-metadata.util.spec.ts` (all 4 formats, unit-level) + `media.service.spec.ts` → *"extracts and persists real width/height metadata from the uploaded file"* (integration-level, confirms the extracted values actually reach the persisted row) |
| Permission rejection | `media.controller.spec.ts` → confirms `upload`/`remove` declare `[SUPER_ADMIN, CONTENT_EDITOR]` and `list`/`findOne` declare no restriction, each exercised through `AdminRolesGuard.canActivate()` itself, not just metadata presence |
| Audit creation | `media.service.spec.ts` → CREATE on upload, DELETE on remove, both asserting the real `AdminAuditLogService.record()` call shape |

Plus format-sniffing unit coverage (`file-signature.util.spec.ts`) for all 4 allowed formats and 2 rejection cases.

### Frontend

```
Test Suites: 6 passed, 6 total   (2 new: MediaUploadForm, media/page)
Tests:       18 passed, 18 total (6 new)
```

| Required scenario | Test(s) |
|---|---|
| Media page render | `app/media/page.test.tsx` — static-render smoke test (same `react-dom/server` technique as Stage 5.17, for the same reason: `@testing-library/*` unreachable) confirming the heading, file input, and shell chrome render |
| Upload flow | `MediaUploadForm.test.ts` → `performMediaUpload` succeeds, calls `onUploaded`, omits blank `altText` |
| Error state | `MediaUploadForm.test.ts` → no file selected, backend `ApiError` message surfaced verbatim, generic-message fallback for a non-`ApiError` failure |

### Live end-to-end verification (both backend and frontend, real servers, not just mocks)

Backend, via direct HTTP against a running server with a temporary local MinIO (the documented port-9000 permission conflict on this Windows host — same class of issue as the P1000 incident this project has already documented — was worked around with a throwaway container on an alternate port for verification only; reverted after):
- Uploaded a real, byte-accurate 4×3 PNG → `201`, `width: 4, height: 3` extracted correctly, file confirmed present in MinIO via `mc ls`
- Spoofed upload (text content labeled `image/png`) → `400`, correct message
- Disallowed format (`application/pdf`) → `400`, correct message
- `SUPPORT_VIEWER` blocked from upload/delete (`403` both), list still works (`200`)
- Delete → asset disappears from list/detail, file confirmed still in MinIO (soft delete)
- Both `CREATE` and `DELETE` audit entries confirmed via `GET /admin/audit-logs`

Frontend, in the live browser against the real `apps/admin` dev server: logged in, navigated to `/media`, confirmed the empty state, then — since this sandboxed environment cannot drive a real OS file picker (the same Browser-pane-doesn't-composite limitation disclosed in earlier stages) — uploaded a programmatically-constructed real PNG through the actual `fetch`/`FormData`/CORS code path the form uses (not a mock), confirmed it appeared in the grid with correct metadata, deleted it via the real delete button and confirmed removal, then triggered the browser's native file-input `change` event with a spoofed file (a legitimate technique, distinct from setting `.value`) and confirmed the real backend validation message rendered inline. A fresh tab confirmed zero console errors at every step.

## 7. Explicitly out of scope (confirmed not built)

No Home CMS, no News management, no wiring of `MediaAsset` into any content model (`Category`, `MembershipPlan`, or any future Home/News table) — `MediaAsset.id` is not referenced by any other table yet, by design (§5). The static-bridge public-serving infrastructure for `/media/{filename}` is not built (§3) — this was never in scope; it's the same not-yet-built step Orbit's own asset bridge is waiting on.

---

# MEDIA LIBRARY FOUNDATION:
READY
