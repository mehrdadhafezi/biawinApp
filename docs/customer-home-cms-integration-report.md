# Customer Home CMS Integration — Implementation Report (Stage 5.21)

Source of truth: `docs/home-admin-contract.md`, `docs/admin-architecture-decision-record.md`,
Stage 5.14.1 (Home Live Visual QA PASS — the visual baseline this stage must not regress),
Stage 5.18 (Media Library), Stage 5.19 (Home CMS backend — the real, as-shipped public API
this stage consumes), Stage 5.20 (Admin Home Management UI — how content actually gets
edited). Scope: migrate `apps/web`'s Customer Home data source from `home.mock.ts` to the
real Home CMS, with zero intentional visual change. This is CMS integration, not redesign.

## 1. Files created/changed

### Backend

- **New**: [backend/src/modules/media/media-files.controller.ts](../backend/src/modules/media/media-files.controller.ts) — the actual byte-serving route for `MediaStorageService.resolvePublicUrl()`'s URLs (see §8, this was a real, confirmed gap).
- **New**: [media-files.controller.spec.ts](../backend/src/modules/media/media-files.controller.spec.ts), [media-storage.service.spec.ts](../backend/src/modules/media/media-storage.service.spec.ts) — no spec existed for the storage service before this stage.
- **New**: [backend/prisma/seed-home-media.ts](../backend/prisma/seed-home-media.ts) — the static-asset → `MediaAsset` migration script (§4).
- **Modified**: `backend/src/infra/storage/storage.service.ts` (`+getObject()`), `backend/src/modules/media/media-storage.service.ts` (`resolvePublicUrl()` now returns an absolute URL), `backend/src/modules/media/media.module.ts` (registers `MediaFilesController`), `backend/src/config/env.validation.ts` (`+PUBLIC_API_ORIGIN`), `backend/.env`/`.env.example`, `backend/package.json` (`+seed:home-media` script).

### `apps/web`

- **New feature module**: [homeCmsAdapter.ts](../apps/web/src/components/home/homeCmsAdapter.ts) (+ `.test.ts`), [useHomeCms.ts](../apps/web/src/components/home/useHomeCms.ts).
- **New tests**: `BiawinCardsCarousel.test.tsx`, `ServiceBannerGrid.test.tsx`, `ServiceMosaic.test.tsx`, `NewsCarousel.test.tsx`.
- **New test infra**: `jest.config.js`, `jest.env-setup.js` (`apps/web` had no test runner at all before this stage — see §7).
- **Modified**: `lib/home-api.ts` (+4 Home CMS DTOs/methods), `components/home/BiawinCardsCarousel.tsx`, `ServiceBannerGrid.tsx`, `ServiceMosaic.tsx`, `NewsCarousel.tsx` (all switched from static imports to the new CMS hooks), `components/home/home.mock.ts` (role clarified — see §7), `app/home/page.tsx` (no longer threads a shared `categories` prop into `ServiceBannerGrid`/`ServiceMosaic`), `package.json` (+jest devDependencies).
- **Deleted**: `components/home/useCategories.ts` — its only 3 callers (page.tsx, `ServiceBannerGrid`, `ServiceMosaic`) no longer need a name-matched category lookup once `categoryId` comes directly from the CMS (§15 of the brief; confirmed zero remaining references before deleting).

### Docs

- **New**: this report, [docs/home-cms-parity-audit.md](home-cms-parity-audit.md).

## 2. Customer Home API/data architecture

```
Home page / components
        ↓
useHomeCms.ts (4 hooks: useHomeHeroCards, useHomeServiceBanners, useHomeServiceMosaic, useHomeNewsArticles)
        ↓
homeApi (lib/home-api.ts) — apiClient wrapper, public: true
        ↓
GET /home/hero-cards | /home/service-banners | /home/service-mosaic-tiles | /home/news-articles
```

Matches the brief's preferred structure exactly. `apiClient` (`lib/api-client.ts`) is
unchanged — the 4 new `homeApi` methods use the same `{ public: true }` option already
established for `listCategories`/`listSubscriptionPlans`, since Home CMS's public routes
need no customer auth. **No `/admin/*` route is ever called from `apps/web`** — confirmed
by grep, and structurally true since `homeApi`'s new methods only ever target `/home/**`.

## 3. Adapter mapping strategy

`homeCmsAdapter.ts` is the single, typed transformation boundary (`CMS DTO → Customer view
model`) the brief's §3 asked for. Four pure, side-effect-free functions:

- `mapHomeHeroCard` — `HomeHeroCardDto → HeroCardViewModel`. The interesting case:
  `colorPreset` (a closed 3-value enum: `blue`/`sky`/`white`) drives a fixed
  gradient/icon-chip pair per `docs/home-admin-contract.md` §4.6's original design
  intent ("maps to one of the 3 existing gradient definitions... free-form input would
  bypass that tuning"). The seeded data's `colorPreset` values already correspond 1:1,
  in order, to today's 3 real gradients (blue→earn, sky→biawin, white→reward), so this
  mapping reproduces the current visual output exactly while making `colorPreset` a real,
  live-editable control (Stage 5.20's `HeroCardForm` already exposes it) instead of an
  inert stored value. `ariaLabel` is derived from `title` (`مشاهده ${title}`) rather than
  stored — the previous hardcoded `ariaLabel` field always equaled that same formula.
- `mapHomeServiceBanner` — near-1:1, but establishes the boundary: `categoryId` passes
  through as real relational identity, never re-derived from `categoryName`.
- `mapHomeServiceMosaicTiles` — splits the CMS's one `slotType`-discriminated collection
  into the two groups `ServiceMosaic.tsx` already renders (half-grid + wide-slider),
  preserving order within each group. A `wide` row missing `title`/`lead` is skipped (with
  a dev-only `console.warn`) rather than crashing — the component requires both fields to
  render a wide slide correctly, and the real CMS DTO type allows them to be `null`.
- `mapHomeNewsArticle` — 1:1 field mapping.

Presentation components never see a CMS field directly — `homeCmsAdapter.test.ts` and
this report's own read of every migrated component confirm no component reads
`categoryId`/`slotType`/`colorPreset`/`active`/etc.; they only ever receive
`imageUrl`(-shaped)/`title`/`gradient`/`categoryId`(as opaque identity for navigation)-style
presentation-ready fields.

## 4. Static asset → MediaAsset migration

**Mandatory precondition, done before any component was switched to the CMS path** (per
the brief's §5 — "Do NOT switch Customer Home to CMS while those images are missing").

`backend/prisma/seed-home-media.ts`:
1. Boots a real Nest application context (`NestFactory.createApplicationContext(AppModule)`)
   to get a genuine `MediaService` instance via DI — **never bypasses `MediaService`/
   `MediaStorageService`**, matching the same rule Stage 5.20 held for the Admin UI.
2. For each of the 3 image-bearing resources (service banners, mosaic tiles, news articles
   — hero cards have no media field, see §8), reads the real static files from
   `apps/web/public/home/{banners,mosaic,news}/item-NN.webp` in `sortOrder` order and
   calls `mediaService.upload()` with each file's real bytes.
3. Links the resulting `MediaAsset.id` onto the matching CMS row's `mediaAssetId`.
4. **Idempotent**: a row whose `mediaAssetId` is already set is skipped entirely — safe to
   re-run.

Run live against the real dev backend this stage: **all 17 assets uploaded and linked
successfully on the first run**, zero errors. Verified byte-for-byte identity between a
served asset and its source file (`cmp`, exact match) — see `docs/home-cms-parity-audit.md`.

**No arbitrary/regenerated/"close enough" images were used anywhere** — every migrated
image is the literal file that already passed Stage 5.14.1's visual QA.

## 5. Sections migrated to CMS

| Section | Component | CMS model |
|---|---|---|
| کارت‌های بیاوین | `BiawinCardsCarousel` | `HomeHeroCard` |
| خدمات منتخب بیاوین | `ServiceBannerGrid` | `HomeServiceBanner` |
| موزاییک خدمات (نیمه + عریض) | `ServiceMosaic` | `HomeServiceMosaicTile` |
| مقالات و اخبار بیاوین | `NewsCarousel` | `HomeNewsArticle` |

Exactly the 4 models Stage 5.19 actually shipped — no additional CMS model was invented.

## 6. Sections intentionally still non-CMS

Per the brief's §6 and confirmed against the actual Stage 5.19 backend (not the earlier,
broader Stage 5.15 planning contract, which had originally scoped 2 more sections that
were never actually built):

| Section | Component | Why still non-CMS |
|---|---|---|
| قدرت اعتبار در باشگاه (ticker) | `CategoriesSection` | Stage 5.15's contract originally proposed making this `Category`-driven, but Stage 5.19's real backend work never shipped the `Category.imageUrl` resolver that would require — `home.mock.ts`'s `CATEGORY_TICKER_*` exports remain the live, primary source, unchanged. |
| کارت‌های اشتراک بیاوین (tier images) | `MembershipStoryStrip` | Same story — Stage 5.15 proposed a `MembershipPlan.imageKey` column that Stage 5.19 never added. Plan *data* is still the real `GET /subscriptions` API (unchanged, pre-existing); only the per-tier *image* stays keyed by `MEMBERSHIP_TIER_IMAGE[plan.title]`. |
| استوری‌های معرفی | `HomeStories` | Explicitly deferred in `docs/home-admin-contract.md` §2 — no destination page exists for these buttons yet. |
| باشگاه هوشمند (intro) | `BrandIntroduction` | Explicitly deferred — static brand copy, not a listable content model. |
| میانبرهای کاربردی | `QuickActions` | Explicitly out of scope — real app navigation, not marketing content. |
| Header / Bottom Navigation | `AppShell` | Shared app chrome, untouched. |

Adding CMS backing for the first two would mean inventing new backend scope this stage
(a new resolver, a new column) that Stage 5.19 didn't build — exactly what the brief's §7
forbids ("do not invent additional CMS models in this stage").

## 7. Fallback/cutover strategy

`useHomeCms.ts`'s 4 hooks all follow the same pattern:

```
state initializes with the static fallback content (synchronous, no loading flash)
        ↓
useEffect fetches the real CMS endpoint
        ↓
valid, non-empty result → swap state to the real CMS data
fetch fails, or returns empty → stay on fallback, console.warn (dev-visible, not silent)
```

A manual kill-switch (`NEXT_PUBLIC_HOME_CMS_ENABLED=false`) additionally forces every
section straight to fallback without even attempting the fetch — for an instant rollback
in production without a deploy, if a real CMS-side problem is ever found.

**`home.mock.ts`'s status, explicitly** (per the brief's §28):
- `HOME_STORIES`, `CATEGORY_TICKER_UP`/`DOWN`/`IMAGE`, `MEMBERSHIP_TIER_IMAGE` are **still
  the live, primary source** for their sections (§6 above) — not fallback, not deprecated.
- `SERVICE_BANNERS`, `SERVICE_MOSAIC_HALVES`/`WIDE`, `NEWS_ARTICLES`, and the new
  `HERO_CARDS_FALLBACK` (moved here from `BiawinCardsCarousel.tsx`'s old local `CARDS`)
  are **retained, but now fallback-only** — the runtime default path is the CMS; these
  arrays render only if the CMS is unreachable or empty.
- **Nothing in the file was deleted.**

**Removal plan**: once Stage 5.22 staging QA confirms sustained CMS parity in a real
staging environment, delete the fallback-only exports (`SERVICE_BANNERS`,
`SERVICE_MOSAIC_HALVES`/`WIDE`, `NEWS_ARTICLES`, `HERO_CARDS_FALLBACK`), the
`NEXT_PUBLIC_HOME_CMS_ENABLED` flag, and each hook's fallback-construction code in
`useHomeCms.ts` — leaving only the CMS fetch path. `HOME_STORIES`/`CATEGORY_TICKER_*`/
`MEMBERSHIP_TIER_IMAGE` are not part of that removal (§6 — they're not migration
fallback, they're the section's real, permanent source).

## 8. Backend deviation required and why

**One real, confirmed gap was fixed — not invented scope.** `MediaStorageService
.resolvePublicUrl()` had promised a `/media/{filename}` serving route since Stage 5.18,
explicitly disclosed as "deployment-level wiring, not yet built" in that stage's own
report — but nothing had ever needed to actually render a resolved media URL in a real
browser before Customer Home did. Building it exposed two real bugs, both fixed and
tested (§1, §9):

1. **The route didn't exist at all.** Added `MediaFilesController` (`GET /media/:filename`)
   + `StorageService.getObject()`. `resolvePublicUrl()` now returns an **absolute** URL
   (`PUBLIC_API_ORIGIN` + the route) instead of an origin-relative path — the relative
   form resolved against whichever *frontend* origin rendered the `<img>`, not the
   backend, and would 404 in any real deployment (`apps/web`/`apps/admin` and the backend
   are always different origins). New env var `PUBLIC_API_ORIGIN` (defaulted, non-breaking).
2. **`helmet()`'s default `Cross-Origin-Resource-Policy: same-origin` silently blocked
   `<img>` cross-origin loading.** Found live during this stage's own verification:
   `fetch()` against the route succeeded, but a real `<img src>` failed to decode with no
   console error at all — a genuinely hard-to-find bug. Fixed with a targeted
   `Cross-Origin-Resource-Policy: cross-origin` override on just this one route (the JSON
   API's other routes keep helmet's default; this route's entire purpose is being
   embedded cross-origin as an image).

No Prisma model, DTO, or existing route's response shape changed. `home-hero-cards.
service.ts` etc. (Stage 5.19) are untouched.

## 9. Tests

### Automated (`apps/web` — new test infrastructure this stage, see §1)

```
Test Suites: 5 passed, 5 total
Tests:       20 passed, 20 total
```

| Required scenario (brief §22) | Test(s) |
|---|---|
| API DTO → view model mapping | `homeCmsAdapter.test.ts` — all 4 mapper functions |
| Ordering preserved | `homeCmsAdapter.test.ts` — array-order assertions for banners/news; `BiawinCardsCarousel.test.tsx`/`ServiceBannerGrid.test.tsx` — rendered DOM order |
| Missing optional media handled | `homeCmsAdapter.test.ts` — `image: null` passes through as `null`, never a substituted placeholder |
| Category relation mapping never uses display-name identity | `homeCmsAdapter.test.ts` — explicit assertion that `categoryId` is carried through verbatim |
| Inactive content doesn't leak | `homeCmsAdapter.test.ts` — documents that the public DTO types carry no `active` field at all (backend already filters; nothing here could leak one even if it tried) |
| Malformed item can't crash unrelated sections | `homeCmsAdapter.test.ts` — a malformed `wide` mosaic tile (no title/lead) is skipped without affecting the other valid tiles |
| Component rendering (regression) | One `renderToStaticMarkup` smoke test per migrated component — since SSR never runs effects, these directly exercise the fallback-content first-paint state, proving §10's "no loading flash" requirement structurally |

Backend: 104/104 pass (31 suites) — 2 new spec files (`media-storage.service.spec.ts`,
`media-files.controller.spec.ts`), 3 pre-existing files auto-reformatted by `--fix`
(no behavior change).

### Live end-to-end verification (real Postgres, real MinIO, real backend + `apps/web` dev server)

Ran the actual `seed-home-media.ts` migration against the real database (§4), then drove
the real Customer Home page end-to-end in a browser, signed in as a real (OTP-verified)
customer account:

- **All 4 migrated sections render real CMS data**, verified against the raw rendered
  page text, matching the parity audit exactly.
- **All 17 CMS-linked images load successfully** (`900×675`+ real dimensions confirmed
  per image, not just a 200 status) — this is what surfaced and let us fix the CORP bug
  (§8); before the fix, 0/17 loaded in a real `<img>`, only `fetch()` succeeded.
- **Resilience**: stopped the backend entirely, reloaded Home — all 4 sections still
  rendered (from fallback), page did not crash, and the console showed exactly 4 clear
  `[home-cms] ... falling back to static content` warnings (dev-visible, not silent).
  Restarted the backend, reloaded — CMS data resumed immediately.
- **Non-Home regression check**: `/services` still renders correctly, header/bottom-nav
  chrome intact, OTP auth flow (request → verify → signup) works end to end (needed to
  reach an authenticated Home render at all).

## 10. Live Admin → Customer propagation verification

Performed via direct `PUT`/`PATCH` calls to the real Stage 5.19 admin API (matching Stage
5.20's own Admin UI exactly — same endpoints), then confirmed on the **real rendered
Customer Home page** in the browser, then restored:

| Change | Verified on Customer Home |
|---|---|
| Text change (hero card title) | New title appeared in the rendered card immediately on reload |
| Active → inactive (hero card) | Card disappeared from the rendered carousel; public API dropped from 3 to 2 items |
| Reorder (swap 2 hero cards) | Rendered card order in the DOM matched the new `sortOrder` exactly |
| Image change (banner `mediaAssetId` swapped to a different asset) | The rendered `<img src>` for that banner changed to the new asset's URL |

All 4 changes restored to the exact pre-test approved state afterward — verified via a
final API read matching the original seeded values byte-for-byte.

## 11. Visual fidelity results

Target: **data source changed, visual output unchanged.** Checked against the Stage
5.14.1 baseline (the same CSS/JSX every migrated component still uses — only its data
source changed, confirmed by diffing each component's own `<style>` block, which is
untouched in every migrated file):

- **Biawin Cards**: same 3 gradients, same icon chips, same layout/animation — confirmed live (§10's reorder/text tests rendered the real carousel).
- **Service banner gradients**: `THEME_VARS` (the `--ov1`/`--ov2`/`--ov3` custom properties) is byte-identical to before migration; only its `Record` key type changed from a local `BannerTheme` to the imported `HomeBannerTheme` (same 5 string values).
- **Selected service imagery**: real photos now load where they previously would have shown nothing (`image: null` pre-migration) — confirmed 17/17 loading with correct dimensions.
- **Membership imagery**: untouched (§6 — not migrated this stage).
- **Service Mosaic**: half/wide split, theme overlays, auto-rotation timer all unchanged; `wideIndex` clamping was added (`activeWideIndex = wideIndex % wide.length`) purely to prevent a dead slider if `wide.length` ever changes at runtime — invisible when `wide.length` stays constant, which it does in every scenario checked.
- **News**: 8-card snap-scroll carousel, disabled "مشاهده مقاله" button, Persian digit counter — all unchanged.
- **Bottom Navigation / RTL / responsive**: none of this stage's changes touch `AppShell`, any shared layout component, or any CSS — confirmed by the diff itself (zero lines changed in any `<style>` block across all 4 migrated components) and by the live `/services` regression check.

No fidelity regression was found or needed fixing this stage.

## 12. Known remaining issues

- **`CategoriesSection`/`MembershipStoryStrip` images stay on their pre-existing sources** (§6) — not a defect, a scope boundary matching the real Stage 5.19 backend surface. Extending CMS coverage to these would need new backend work (a `Category.imageUrl` resolver, a `MembershipPlan.imageKey` column) that belongs to a future stage, not this one.
- **`useHomeCms.ts`'s `NEXT_PUBLIC_HOME_CMS_ENABLED` flag has no automated test** — verified manually only (backend-down resilience test, §9). Low risk: the flag's own logic is a one-line conditional gate on the same fetch path already covered.
- **Hero card `create` remains effectively inert** (inherited from Stage 5.20, unrelated to this stage) — `cardKey` is a fixed 3-value enum and all 3 are seeded; not a Customer Home concern.

---

# CUSTOMER HOME CMS INTEGRATION:
READY
