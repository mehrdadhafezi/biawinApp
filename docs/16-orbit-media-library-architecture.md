# 16 — Orbit Media Library + Admin API Architecture (Stage 2)

Replaces the frozen static `orbitItems.ts` catalog (Stage 1.9) with a real
`Database → Backend API → Admin API → Frontend` pipeline. Pure data
architecture — no change to Orbit's visual design, animation engine, bubble
positions, responsive calculations, landing layout, auth flow, or modal
behavior, and no other Biawin screen was touched.

## Data model

`OrbitItem` (`backend/prisma/schema.prisma`, migration
`20260823131704_add_orbit_items`):

```
id, slug (unique), title, categoryId (optional, → Category), imageKey
(optional), sortOrder, isActive, positionConfig (Json), animationConfig
(Json), createdAt, updatedAt
```

`positionConfig`/`animationConfig` are stored as `Json` rather than flat
columns so Admin can tune `{leftPercent, topPercent}` /
`{variant, delaySeconds}` without a migration — they mirror the frontend's
`OrbitItemPosition`/`OrbitItemAnimation` shape verbatim. `categoryId` is
nullable and left unset on all 12 seeded items: none of them map cleanly
onto an existing `Category` row, and guessing a link would be worse than
leaving it for Admin to set deliberately later.

## API

`backend/src/modules/orbit-items/` — reuses the exact controller/service/
module split already established by `categories`, `orders`, `profiles`
(see those modules for the precedent). Two controllers, one service:

- **Public** — `GET /api/v1/orbit-items` (`@Public()`, no auth). Returns
  active items sorted by `sortOrder`, shaped to match the frontend's
  existing contract exactly:
  `{id, title, imageKey, imageUrl, sortOrder, position, animation, active}`.
- **Admin** (`OrbitItemsAdminController`, path `admin/orbit-items`) —
  `POST /api/v1/admin/orbit-items`, `PUT .../:id`, `DELETE .../:id`,
  `PATCH .../reorder`. Gated by the app's global `JwtAuthGuard` only
  (authenticated, not role-checked) — **there is no admin-role/RBAC system
  anywhere in this codebase yet** (confirmed: `User` has no role field, no
  `@Roles`/`RoleGuard` exists). Building one was out of scope for a data
  migration; this is a known, intentional gap for a future RBAC feature.
  Enable/disable and image replacement are both just `PUT` with
  `isActive`/`imageKey` — no separate endpoints needed.

Every response passes through the app's existing `ResponseInterceptor`
(`{success, data}` envelope) automatically — controllers return plain
data, same as every other module.

## Image serving: the interim static bridge (flagged decision)

`imageKey` (e.g. `orbit/orbit_01_clothing.webp`) is a real Media Library
object key — the 11 real, QA'd assets were uploaded into MinIO under that
key via `backend/scripts/upload-orbit-assets.ts` (a one-time, standalone
script; see below). But **`imageUrl` is resolved as `/orbit/{filename}`**,
pointing at the same static files still served from
`apps/web/public/orbit/` — not a MinIO-backed URL. Two reasons, both
pre-existing constraints from earlier stages, not introduced here:

1. MinIO is deliberately loopback-only (`127.0.0.1:9000` dev,
   `127.0.0.1:9010` staging) — not publicly reachable from a browser. That
   was an explicit earlier security decision; standing up a public route
   for it is an infra task, out of scope for "data architecture, not a UI
   redesign."
2. `StorageService.getPresignedGetUrl()` defaults to a 300-second expiry —
   wrong for a public landing-page image; the browser would need to
   re-fetch a fresh URL every 5 minutes, breaking caching entirely.

Net effect: **the "Media Library architecture" piece (imageKey, object
storage, upload path) is real and functional**; only public *serving* of
new bytes still requires a code deploy (dropping a new file into
`apps/web/public/orbit/`), because that's the one piece MinIO can't yet do
publicly. This is the same interim-bridge option `docs/11-orbit-asset-system.md`
already documented as a known option — now actually wired up end to end.
Standing up real public object-storage serving (a LiteSpeed proxy route to
MinIO, or a CDN) is a separate, future infra task.

## Seeding & the asset upload script

`prisma/seed.ts` gained an `orbitItems` block seeding the exact 12 frozen
items (ids/titles/positions/animations transcribed verbatim from the old
`MOCK_ORBIT_ITEMS`), idempotent via the same `findFirst` → `update`/`create`
pattern every other seed entity already uses.

Seeding the *rows* is separate from uploading the *image bytes*: `seed.ts`
uses a plain `PrismaClient` with no NestJS DI, so it can't call
`StorageService`, and the backend Docker build context doesn't include
`apps/web/public/`. `backend/scripts/upload-orbit-assets.ts` is a small
standalone script (real `@aws-sdk/client-s3`, reads `STORAGE_*` from env)
that uploads the 11 real webp files to `orbit/{filename}` in the bucket —
run it by hand against dev or staging whenever the bucket needs
(re-)populating. `insurance` still has no real asset (unresolved since
Stage 1.8/1.9 QA — two objects in every regeneration) and keeps
`OrbitBubble`'s placeholder, both here and in the fallback.

## Frontend

`apps/web/src/components/landing/orbitItems.ts`'s `useOrbitItems()` now
fetches `GET /api/v1/orbit-items` via the existing `apiClient` (public,
same envelope-unwrapping/error handling every other API call uses) instead
of returning static mock data. `OrbitStage.tsx`/`OrbitBubble.tsx` needed
**zero changes** — the hook still returns a plain `OrbitItem[]` synchronously
on first render.

`FALLBACK_ORBIT_ITEMS` (a frozen snapshot of the old static catalog) is
what renders for the first paint and if the fetch fails — the Orbit must
never render empty. It is not the data source and is not kept in sync with
Admin edits; it exists purely for resilience (offline/backend-down), which
Stage 2 explicitly asked `useOrbitItems()` to handle.

## Validation performed

- Migration applied to local dev DB; `prisma generate` clean.
- Backend: `tsc --noEmit`, `eslint` (0 errors after auto-fix), full Jest
  suite (15 suites / 29 tests, including 2 new files for this module) —
  all pass. `nest build` clean.
- Frontend: `tsc --noEmit`, `eslint` — both clean. `next build` succeeds.
- Live smoke test against the local backend + web dev servers:
  `GET /api/v1/orbit-items` returns exactly 12 items in the correct order;
  the Landing page renders all 12 bubbles (11 real images + `insurance`'s
  placeholder) with zero console errors, confirmed at both desktop and
  mobile (375×812) viewports.
  `POST`/`PUT`/`DELETE`/`PATCH .../reorder` all exercised end-to-end with a
  real JWT — create, disable (confirmed excluded from the public list),
  delete, and reorder (confirmed the public list re-sorts) all work; state
  was restored to the original 12-item order afterward.
  Unauthenticated admin requests correctly receive `401`.

## Known gaps (explicitly out of scope for this stage)

- No admin-role/RBAC — admin endpoints require *any* authenticated user,
  not a specific role. Needs a dedicated RBAC feature.
- `imageUrl` still resolves to the static bridge, not real public
  object-storage serving — needs a future infra task (public MinIO route
  or CDN).
- No admin "list" endpoint was added — the four endpoints Stage 2 asked
  for (create/update/delete/reorder) are exactly what's implemented; an
  admin UI would need a list view, deliberately left for whenever the
  actual Admin Panel is built rather than guessed at here.
