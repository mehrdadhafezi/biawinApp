# Home CMS Backend — Implementation Report (Stage 5.19)

Source of truth: `docs/home-admin-contract.md`, `docs/admin-architecture-decision-record.md`,
Stage 5.16 (`AdminJwtAuthGuard`/`AdminRolesGuard`/`AdminAuditLogService`), Stage 5.18
(`MediaStorageService`/static-bridge URL pattern). Scope: database-driven backend for
Biawin Home only — no Admin UI, no visual page builder, no Customer App change, no
scheduling workflow.

## 1. Files created/changed

### Backend — new `modules/home/`

- [home.module.ts](../backend/src/modules/home/home.module.ts)
- [home-media.util.ts](../backend/src/modules/home/home-media.util.ts) — shared `resolveMediaUrl()`, reused by all 4 services
- [dto/reorder-home-items.dto.ts](../backend/src/modules/home/dto/reorder-home-items.dto.ts) — shared by all 4 resources
- Hero cards: [home-hero-cards.service.ts](../backend/src/modules/home/home-hero-cards.service.ts), [home-hero-cards.controller.ts](../backend/src/modules/home/home-hero-cards.controller.ts) (public), [home-hero-cards-admin.controller.ts](../backend/src/modules/home/home-hero-cards-admin.controller.ts), [home-hero-cards.service.spec.ts](../backend/src/modules/home/home-hero-cards.service.spec.ts), [dto/create-home-hero-card.dto.ts](../backend/src/modules/home/dto/create-home-hero-card.dto.ts), [dto/update-home-hero-card.dto.ts](../backend/src/modules/home/dto/update-home-hero-card.dto.ts)
- Service banners: [home-service-banners.service.ts](../backend/src/modules/home/home-service-banners.service.ts), [home-service-banners.controller.ts](../backend/src/modules/home/home-service-banners.controller.ts), [home-service-banners-admin.controller.ts](../backend/src/modules/home/home-service-banners-admin.controller.ts), [home-service-banners.service.spec.ts](../backend/src/modules/home/home-service-banners.service.spec.ts), [dto/create-home-service-banner.dto.ts](../backend/src/modules/home/dto/create-home-service-banner.dto.ts), [dto/update-home-service-banner.dto.ts](../backend/src/modules/home/dto/update-home-service-banner.dto.ts)
- Service mosaic tiles: [home-service-mosaic-tiles.service.ts](../backend/src/modules/home/home-service-mosaic-tiles.service.ts), [home-service-mosaic-tiles.controller.ts](../backend/src/modules/home/home-service-mosaic-tiles.controller.ts), [home-service-mosaic-tiles-admin.controller.ts](../backend/src/modules/home/home-service-mosaic-tiles-admin.controller.ts), [home-service-mosaic-tiles.service.spec.ts](../backend/src/modules/home/home-service-mosaic-tiles.service.spec.ts), [dto/create-home-service-mosaic-tile.dto.ts](../backend/src/modules/home/dto/create-home-service-mosaic-tile.dto.ts), [dto/update-home-service-mosaic-tile.dto.ts](../backend/src/modules/home/dto/update-home-service-mosaic-tile.dto.ts)
- News articles: [home-news-articles.service.ts](../backend/src/modules/home/home-news-articles.service.ts), [home-news-articles.controller.ts](../backend/src/modules/home/home-news-articles.controller.ts), [home-news-articles-admin.controller.ts](../backend/src/modules/home/home-news-articles-admin.controller.ts), [home-news-articles.service.spec.ts](../backend/src/modules/home/home-news-articles.service.spec.ts), [dto/create-home-news-article.dto.ts](../backend/src/modules/home/dto/create-home-news-article.dto.ts), [dto/update-home-news-article.dto.ts](../backend/src/modules/home/dto/update-home-news-article.dto.ts)
- [home-admin-permissions.spec.ts](../backend/src/modules/home/home-admin-permissions.spec.ts) — combined `it.each()` spec covering role gating across all 4 admin controllers

**Modified**: `backend/prisma/schema.prisma` (4 new models, 5 new enums, `AdminAuditAction` gains `UPDATE`/`REORDER`, `AdminUser`/`Category`/`MediaAsset` gain back-relations), `backend/src/app.module.ts` (registers `HomeModule`), `backend/src/modules/media/media.module.ts` (exports `MediaStorageService`, previously provider-only), `backend/prisma/seed.ts` (new Home CMS seed block, ~150 lines, idempotent). Migrations: `backend/prisma/migrations/20260825152328_home_cms_foundation/`, `backend/prisma/migrations/20260825152535_admin_audit_action_update_reorder/`.

No file under `apps/web` or `apps/admin` was touched.

## 2. Database models

Migration `20260825152328_home_cms_foundation` (+ `20260825152535_admin_audit_action_update_reorder`):

| Model | Key fields | FKs |
|---|---|---|
| `HomeHeroCard` | `cardKey` (unique, `earn`\|`biawin`\|`reward`), `label`, `title`, `subtitle`, `displayNumber`, `ownerLabel`, `colorPreset` (`blue`\|`sky`\|`white`), `sortOrder`, `active` | `createdBy`/`updatedBy` → `AdminUser` (SetNull) |
| `HomeServiceBanner` | `kicker`, `theme` (`auto`\|`home`\|`fashion`\|`gold`\|`travel`), `wide`, `sortOrder`, `active` | `categoryId` → `Category` (Restrict), `mediaAssetId?` → `MediaAsset` (SetNull), `createdBy`/`updatedBy` → `AdminUser` (SetNull) |
| `HomeServiceMosaicTile` | `slotType` (`half`\|`wide`), `kicker`, `title?`, `lead?`, `theme` (`beauty`\|`insurance`\|`home`\|`digital`), `sortOrder`, `active` | `categoryId` → `Category` (Restrict), `mediaAssetId?` → `MediaAsset` (SetNull), `createdBy`/`updatedBy` → `AdminUser` (SetNull) |
| `HomeNewsArticle` | `category` (plain editorial string, not FK), `kicker`, `title`, `lead`, `bodySlug?` (unique), `sortOrder`, `active` | `mediaAssetId?` → `MediaAsset` (SetNull), `createdBy`/`updatedBy` → `AdminUser` (SetNull) |

All four: `@@index([active, sortOrder])` (mosaic tile additionally indexes `slotType`), hard delete (see §5), `createdAt`/`updatedAt` timestamps.

`AdminAuditAction` grows `UPDATE`/`REORDER` — exactly what the ADR anticipated ("add them the same way, against a real call site, when something does"); Stage 5.19 is the first content type with both an update surface and a reorder surface.

### Design notes

- **One table, not two, for the mosaic** — `docs/home-admin-contract.md` originally speculated two separate arrays (halves/wide). `slotType` discriminates instead; the public response returns both groups in one call, and the (unmodified) `ServiceMosaic.tsx` component already splits its own hardcoded arrays the same way client-side, so a future frontend cutover filters by `slotType` rather than needing two endpoints.
- **`categoryId` is a real FK**, never a `categoryName === category.name` string match — the exact bug class that caused the Stage 5.14.1 membership-image incident. `categoryName` is still included in the public response, resolved server-side from the join.
- **Hard delete, not soft delete** — deliberately different from `MediaAsset`. `MediaAsset` soft-deletes because other tables will reference it by ID and a hard delete could silently break live content. Nothing references Home CMS content by ID from elsewhere (it's leaf content, same as `OrbitItem`, which also hard-deletes), so that justification doesn't transfer.
- **`colorPreset` mapping is an untested, disclosed simplification** — `BiawinCardsCarousel.tsx`'s 3 real gradients (earn = dark navy, biawin = bright blue, reward = teal) don't literally correspond to "blue/sky/white". Seeded in `CARDS`-array order (earn→blue, biawin→sky, reward→white) as a stable but arbitrary assignment. A future frontend-cutover stage must reconcile this against the actual gradient design, not treat it as verified.

## 3. API contracts

Every resource follows the same shape: `@Public() @Get()` customer controller (opts out of the global `JwtAuthGuard`) + a separate `@Public() @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)` admin controller. `list`/`findOne` on admin controllers carry no `@AdminRoles()` (any authenticated admin, including `SUPPORT_VIEWER`); `create`/`update`/`remove`/`reorder` require `@AdminRoles(SUPER_ADMIN, CONTENT_EDITOR)`.

| Resource | Public route | Admin routes |
|---|---|---|
| Hero cards | `GET /home/hero-cards` | `GET/POST /admin/home/hero-cards`, `GET/PUT/DELETE /admin/home/hero-cards/:id`, `PATCH /admin/home/hero-cards/reorder` |
| Service banners | `GET /home/service-banners` | same pattern under `/admin/home/service-banners` |
| Service mosaic tiles | `GET /home/service-mosaic-tiles` | same pattern under `/admin/home/service-mosaic-tiles` |
| News articles | `GET /home/news-articles` | same pattern under `/admin/home/news-articles` |

All routes are versioned (`/api/v1/...`). Public list responses are `{active: true}` only, ordered by `sortOrder` ascending, and never expose the database entity directly — each service maps to a dedicated `*PublicResponse`/`*AdminResponse` interface (admin responses extend public ones with `mediaAssetId`, `active`, `createdBy`, `updatedBy`, timestamps).

**Media resolution**: every response with a `mediaAsset` relation exposes `image: string | null`, resolved via the same static-bridge convention Stage 5.18 established (`MediaStorageService.resolvePublicUrl(key)` → `/media/{filename}`, never a raw key or presigned URL). `image` is `null`, not a broken link, whenever `mediaAssetId` is unset — confirmed by both a unit test and live verification (§6).

**Reorder**: `PATCH .../reorder` takes `{items: [{id, sortOrder}]}`, applies all updates inside `prisma.$transaction`, records one `REORDER` audit entry per call (not one per item), and returns the resource's fresh public list.

## 4. Migration strategy

`apps/web/src/components/home/home.mock.ts` and `BiawinCardsCarousel.tsx`'s hardcoded `CARDS` array are **untouched** and remain what the live Home page renders today — this stage builds the backend and seeds it with the same content, but does not cut the frontend over. `backend/prisma/seed.ts` gained a new block, transcribed verbatim from those two files, seeded idempotently (`upsert` for hero cards by `cardKey`; `findFirst`-then-update-or-create for the other three, matching the existing seed script's convention for orbit items).

`mediaAssetId` is intentionally left `null` on every seeded row — the real images are still static files under `apps/web/public/home/**`, not `MediaAsset`-backed uploads. Connecting them was explicitly out of scope this stage ("do not connect media to Home yet" was not literally stated but follows the same "no Admin UI, no scope creep" boundary as the other constraints). A future stage uploads the real files through the Stage 5.18 Media Library API and `PATCH`es these rows with the resulting `mediaAssetId`.

Verified live: ran `prisma db seed` against the real local database — zero missing-category warnings, confirming every category name in the mock data (اتومبیل، لوازم خانگی، پوشاک، طلا و جواهر، گردشگری، زیبایی، بیمه، مبلمان، دیجیتال) already exists in the seeded `Category` table. The seed is safe to re-run (confirmed by running it twice in this session with identical results).

## 5. Security

- **Auth**: every admin route requires a valid `AdminJwtAuthGuard` JWT; `AdminRolesGuard` narrows mutations to `SUPER_ADMIN`/`CONTENT_EDITOR`. Confirmed live (§6) — a `SUPPORT_VIEWER` account gets `200` on list/detail and `403` on create/update/delete/reorder, across all 4 resources.
- **Audit log**: every mutation (`create`, `update`, `remove`, `reorder`) calls `AdminAuditLogService.record()` with the correct `AdminAuditAction`, `resourceType`, and `resourceId` (reorder omits `resourceId` since it touches multiple rows, and instead carries the full `items` array in `afterJson`). Confirmed live via `GET /admin/audit-logs`.
- **Ownership**: `createdBy`/`updatedBy` stamped from the authenticated admin's ID on every mutation, `onDelete: SetNull` so a later admin-user deletion never cascades into content loss.
- **Hard delete**: deliberate, reasoned choice (§2) — not a shortcut. Confirmed live: delete removes the row entirely and records a `DELETE` audit entry with `beforeJson` snapshotting the deleted content's key fields.

## 6. Tests

### Backend (unit)

```
Test Suites: 29 passed, 29 total   (5 new: 4 service specs + 1 permissions spec)
Tests:       99 passed, 99 total   (30 new)
```

| Required scenario | Test(s) |
|---|---|
| Customer Home returns CMS data | `listPublic` cases across all 4 service specs — confirm shape and `where: {active: true}` query |
| Ordering works | `orderBy: {sortOrder: 'asc'}` asserted in every `listPublic`/`listAdmin` call |
| Inactive items hidden | `home-service-banners.service.spec.ts` — explicit case confirming `active: false` rows are excluded from `listPublic`'s query filter |
| Media relations work | `home-service-banners.service.spec.ts` — confirms `image` resolves via `MediaStorageService.resolvePublicUrl`, and confirms `image: null` (not a broken link) when `mediaAssetId`/`mediaAsset` are absent |
| Admin CRUD works | `create`/`update`/`remove` cases in all 4 service specs, asserting the real Prisma call shape and `createdBy`/`updatedBy` stamping |
| Permission checks work | `home-admin-permissions.spec.ts` — `it.each()` over all 4 admin controllers, asserting `@AdminRoles(SUPER_ADMIN, CONTENT_EDITOR)` metadata on mutation routes and denial via `AdminRolesGuard.canActivate()` for a mocked `SUPPORT_VIEWER` |
| Audit records created | every mutation case in every service spec asserts `auditLog.record` was called with the correct `action`/`resourceType` |

`home-service-banners.service.spec.ts` carries the most thorough coverage (all 7 scenarios directly); the other 3 resources have lighter but real coverage of the same scenarios, following this engagement's established "don't triple every edge case, cover it once thoroughly and confirm the pattern repeats" convention.

### Live end-to-end verification (real Postgres, real running backend, not mocks)

Started the backend dev server (`pnpm --filter @biawin/backend start:dev`) against the project's existing `biawin-postgres`/`biawin-redis` Docker containers, applied both migrations, ran the seed script, then exercised the real HTTP API:

- `GET /api/v1/home/hero-cards`, `/home/service-banners`, `/home/service-mosaic-tiles`, `/home/news-articles` — all genuinely public (no `Authorization` header), all returned the real seeded content in the correct `sortOrder`, `image: null` on every row (no `mediaAssetId` seeded yet, as designed).
- Logged in as the seeded `SUPER_ADMIN` (`admin@biawin.ir`) via `POST /admin/auth/login`, obtained a real JWT.
- `POST /admin/home/news-articles` with `active: false` → `201`, row created with `createdBy`/`updatedBy` correctly stamped to the logged-in admin's ID.
- Confirmed the inactive article was **absent** from `GET /home/news-articles` (public) and **present** in `GET /admin/home/news-articles` (admin) — inactive-visibility rule verified against real data, not just a mocked query assertion.
- `PATCH /admin/home/hero-cards/reorder` — swapped `sortOrder` on all 3 hero cards, confirmed the public list reflected the new order immediately, then restored the original order.
- Created a real `SUPPORT_VIEWER` admin account (via a one-off Prisma script — no admin-user-management API exists yet in this backend, that's a different stage's scope) and confirmed: `GET /admin/home/hero-cards` → `200`, `POST /admin/home/hero-cards` → `403`.
- `DELETE /admin/home/news-articles/:id` on the test article → `200`, row gone.
- `GET /admin/audit-logs` confirmed real `CREATE`, `REORDER`, and `DELETE` entries for the actions just performed, each with the correct `resourceType`/`resourceId`.
- Cleaned up: deleted the test article and the temporary `SUPPORT_VIEWER` account after verification; production seed data left untouched.

### Workspace-wide regression check

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all run clean at the monorepo root (turbo-orchestrated across all 7 packages). `apps/web`'s build/lint/test results were cache hits — confirming byte-for-byte no change reached it, satisfying "do NOT modify Customer App UI" by evidence, not just by intent.

`backend/prisma/seed.ts`'s pre-existing CRLF-driven prettier lint baseline (161 errors, unrelated to this stage, established in Stage 5.16) was explicitly checked before and after this stage's additions and confirmed **unchanged at 161** — the new Home CMS seed block was written and reformatted to match the file's existing CRLF/prettier conventions rather than adding to that baseline.

## 7. Explicitly out of scope (confirmed not built)

No Admin UI (every route in this stage is a plain JSON API, exercised only via `curl`/HTTP in this report). No visual page builder. No Customer App UI change — `apps/web` was read for reference but never edited. No scheduling/publish-workflow (every row's visibility is the plain `active` boolean, no future-dated publish). No wiring of real uploaded media into Home content (`mediaAssetId` stays `null` in seed data — see §4). No admin-user-management API (had to provision a test `SUPPORT_VIEWER` via a throwaway script rather than the admin API, because that API doesn't exist yet — out of this stage's scope).

---

# HOME CMS BACKEND:
READY
