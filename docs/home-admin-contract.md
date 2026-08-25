# Home — Admin Portal Content Contract (Stage 5.15)

Contract-only document. **No migration, no Admin UI, no Customer App change
in this stage** — this freezes the spec that a future implementation stage
builds against, the same role `docs/11-orbit-asset-system.md` played for the
Orbit Media Library before it actually shipped (`OrbitItem` +
`admin/orbit-items`, now live). Grounded directly in the actual current code
(`apps/web/src/components/home/*`, `backend/prisma/schema.prisma`,
`backend/src/modules/orbit-items/*`), not abstract numbers.

## 1. Current-state audit

Every Home section, read directly from `apps/web/src/components/home/` and
`apps/web/src/app/home/page.tsx` as of commit `927f347`:

| Section | Component | Data source today | Images today |
|---|---|---|---|
| Header / bottom nav | `AppShell`, `GlobalHeader`, `BottomNavigation` | Code (navigation config) | N/A |
| کارت‌های بیاوین | `BiawinCardsCarousel.tsx` | Hardcoded `CARDS` array in the component itself | none (CSS gradients) |
| میانبرهای کاربردی | `QuickActions.tsx` | Hardcoded `QUICK_ACTIONS` array (real routes) | none (inline SVG icons) |
| استوری‌های معرفی | `HomeStories.tsx` | Hardcoded `HOME_STORIES` in `home.mock.ts` | none (inline SVG icons) |
| قدرت اعتبار در باشگاه (ticker) | `CategoriesSection.tsx` | Hardcoded `CATEGORY_TICKER_UP`/`DOWN` name lists in `home.mock.ts` — **does not call `useCategories()` at all**, despite `Category` being a real, seeded DB table | Hardcoded `CATEGORY_TICKER_IMAGE` map, keyed by category **name string** → static file in `apps/web/public/home/categories/` |
| باشگاه هوشمند (intro) | `BrandIntroduction.tsx` | Hardcoded JSX copy | none |
| خدمات منتخب بیاوین | `ServiceBannerGrid.tsx` | Real `GET /categories` (`useCategories`) joined in-memory to hardcoded `SERVICE_BANNERS` by **`categoryName === category.name` string match** | Hardcoded `image` field per tile, static file in `apps/web/public/home/banners/` |
| کارت‌های اشتراک بیاوین | `MembershipStoryStrip.tsx` | Real `GET /subscriptions` (`useMembershipSummary`) | Hardcoded `MEMBERSHIP_TIER_IMAGE` map, keyed by **`plan.title` string match** — this exact pattern caused a live production bug (Stage 5.14.1: `"سبک زندگی"` vs `"کارت سبک زندگی"`) |
| مبلمان/دیجیتال موزاییک | `ServiceMosaic.tsx` | Real `GET /categories`, same name-matching pattern as `ServiceBannerGrid` | Hardcoded, static files in `apps/web/public/home/mosaic/` |
| مقالات و اخبار بیاوین | `NewsCarousel.tsx` | Hardcoded `NEWS_ARTICLES` in `home.mock.ts` — no backend model exists (`docs/prototype-to-production-mapping.md` explicitly lists `NewsArticle` as a **P2, post-launch** item) | Hardcoded, static files in `apps/web/public/home/news/` |

**Finding A — the name-matching coupling is a recurring, already-proven bug
class.** Three of four sections that touch real backend entities
(`ServiceBannerGrid`, `ServiceMosaic`, `MembershipStoryStrip`) resolve their
image/copy by matching a hardcoded string against a live API field
(`category.name` or `plan.title`) rather than a stable foreign key. This
already caused one live, undetected-until-audited bug (the membership tier
whose real title has no `"کارت "` prefix). Any Admin-managed replacement for
these sections must key its content rows by the real entity's **id**, never
by re-typing its display name into a second table.

**Finding B — Home's images are more primitive than Orbit's, not less.**
Every Home image today is a filename hardcoded into `home.mock.ts` pointing
at a file checked into `apps/web/public/home/**`. There is no `imageKey`, no
`StorageService` involvement, and no way to change a Home image without a
code deploy. `OrbitItem` already solved this exact problem one stage ago
(`imageKey` column + `StorageService` upload + a static-bridge public URL) —
this contract reuses that solved pattern rather than inventing a new one.

**Finding C — `Category.imageKey` already exists and is already unused by
its own resolver.** `docs/services-ui-contract.md` (Gap #3, confirmed again
here) already flagged that `Category`, `Service`, and `Merchant` all have a
raw `imageKey` column with no `imageUrl` resolution — `OrbitItemsService`
has the only implementation of this pattern in the codebase today
(`resolveImageUrl()`). Closing this gap for `Category` is a **prerequisite**
for this contract (§4.1), not new scope invented here.

## 2. Scope — what this contract covers

| Section | In scope for Admin management? | Reasoning |
|---|---|---|
| قدرت اعتبار در باشگاه (ticker) | ✅ Yes | Currently duplicates `Category` data by hand; fixing Finding C makes this section directly Category-driven, no new model needed. |
| خدمات منتخب بیاوین | ✅ Yes | New model, FK to `Category` (§4.3). |
| مبلمان/دیجیتال موزاییک | ✅ Yes | New model, FK to `Category` (§4.4). |
| کارت‌های اشتراک بیاوین (tier images) | ✅ Yes | Single-column addition to the existing `MembershipPlan` model (§4.2) — closes the exact bug class from Stage 5.14.1. |
| مقالات و اخبار بیاوین | ✅ Yes | New model (§4.5) — was already planned pre-launch as a P2 item; this contract defines its shape now that Home actually renders it. |
| کارت‌های بیاوین (`BiawinCardsCarousel`) | ✅ Yes, content-only | New model (§4.6) for the 3 marketing cards' text/number/owner/color-preset. These are explicitly **not real financial products** (existing code comment) — Admin manages the copy, not any financial logic. |
| استوری‌های معرفی (`HomeStories`) | ❌ Deferred, not in this contract | Every bubble is a real `disabled` button with no destination — the "intro story viewer" it points at doesn't exist as a feature yet. Admin-managing labels for a dead-end UI has no product value until that viewer is built; revisit this section's contract alongside that feature, not before it. |
| باشگاه هوشمند (`BrandIntroduction`) | ❌ Deferred, not in this contract | Three lines of static brand copy that have not changed since Stage 5.2. A single hardcoded paragraph doesn't justify a table, an API, and an Admin form; if it starts changing frequently in practice, it's a one-row settings-style addition, not a listable content model — revisit only if that need materializes. |
| میانبرهای کاربردی (`QuickActions`) | ❌ Out of scope | These are real navigation routes (`/services`, `/credit`, `/installments`), not marketing content — changing them changes app navigation, not copy. Navigation structure belongs in code review, not a content-admin form. |
| Header / bottom nav | ❌ Out of scope | Shared app chrome, not Home content. |

## 3. Prerequisite fixes (block implementation of §4 until done)

These are gaps in the **existing** codebase this contract's data model
depends on — not new work invented by this stage, but they must land before
any of §4's admin endpoints can serve real data end-to-end.

1. **`CategoriesService` needs an `imageUrl` resolver**, mirroring
   `OrbitItemsService.resolveImageUrl()` exactly (same static-bridge
   approach, e.g. `/categories/{filename}`, for the same reason Orbit uses
   it — MinIO is loopback-only, not publicly reachable, and a presigned URL
   would expire and break caching on a public page). `CategoriesController`'s
   public `GET /categories` response must include the resolved `imageUrl`
   alongside the raw `imageKey`, matching `OrbitItemsController`'s public
   shape.
2. **`CategoriesController.list()` must filter `active: true`** for public
   callers (confirmed still unfiltered in `categories.service.ts` as of this
   session — the same gap `docs/services-ui-contract.md` flagged). An
   Admin-disabled category currently still appears on the live ticker.

Neither of these requires a schema migration — both are service/controller
logic changes against the existing `Category` model.

## 4. Data model

### 4.1 `Category` (existing model — no schema change, resolver only)

No new columns. §3 already covers the one gap (`imageUrl` resolution).
`CategoriesSection`'s ticker becomes: fetch `GET /categories`, sort by
`sortOrder`, render `imageUrl` — the hardcoded `CATEGORY_TICKER_UP/DOWN`
name lists and `CATEGORY_TICKER_IMAGE` map are deleted entirely, and the
ticker's two-column split (`UP`/`DOWN`) becomes a simple even/odd (or
first-half/second-half) split of the same sorted list rather than two
independently-curated arrays — one Admin-managed order drives both columns.

### 4.2 `MembershipPlan` (existing model — one column addition)

```prisma
model MembershipPlan {
  // ...existing columns unchanged...
  imageKey String?   // NEW — object-storage key, same pattern as Category.imageKey
}
```

`MembershipStoryStrip` changes from `MEMBERSHIP_TIER_IMAGE[plan.title]`
(string lookup into a hand-maintained map) to `plan.imageUrl` (resolved
server-side from `plan.imageKey`, same resolver pattern as §3). This is the
direct structural fix for the Stage 5.14.1 bug class: there is no longer a
second table whose keys can silently drift from the real `title` strings,
because the image now lives on the same row as the title.

`MembershipSubscriptionsService` (or wherever `GET /subscriptions` is
served) needs the same `resolveImageUrl()` treatment as §3.

### 4.3 `HomeServiceBanner` (new model — خدمات منتخب بیاوین)

```prisma
model HomeServiceBanner {
  id         String   @id @default(uuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  imageKey   String?
  kicker     String                // e.g. "اعتبار و اقساط منعطف"
  theme      BannerTheme @default(auto)  // auto | home | fashion | gold | travel — drives the --ov1/--ov2/--ov3 overlay tint
  wide       Boolean  @default(false)    // spans both grid columns (prototype's single "گردشگری" tile)
  sortOrder  Int      @default(0)
  active     Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("home_service_banners")
}

enum BannerTheme {
  auto
  home
  fashion
  gold
  travel
}
```

`categoryId` is a real FK, not a name string — `ServiceBannerGrid` no
longer needs its `banner.categoryName === category.name` join; it becomes a
direct `include: { category: true }` query. The prototype's fixed 4 tiles +
1 wide tile become however many `active` rows exist, ordered by
`sortOrder` — Admin can add/remove/reorder tiles without a deploy. `theme`
stays a closed enum (not free-form color input) because it drives specific,
hand-tuned CSS custom properties (`ServiceBannerGrid.tsx`'s `THEME_VARS`) —
letting Admin pick raw colors would bypass that tuning per category family.

### 4.4 `HomeServiceMosaicTile` (new model — موزاییک خدمات)

```prisma
model HomeServiceMosaicTile {
  id         String       @id @default(uuid())
  categoryId String
  category   Category     @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  imageKey   String?
  slotType   MosaicSlot                 // half | wide — half = 2-up grid tile, wide = full-width auto-rotating slide
  kicker     String
  title      String?                    // only used by wide slides (half tiles use the category's own name)
  lead       String?                    // only used by wide slides
  theme      MosaicTheme @default(home) // beauty | insurance | home | digital
  sortOrder  Int          @default(0)
  active     Boolean      @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("home_service_mosaic_tiles")
}

enum MosaicSlot {
  half
  wide
}

enum MosaicTheme {
  beauty
  insurance
  home
  digital
}
```

`ServiceMosaic.tsx` currently renders exactly 2 `half` tiles and 2 `wide`
slides from two separate hardcoded arrays (`SERVICE_MOSAIC_HALVES` /
`SERVICE_MOSAIC_WIDE`) — one table with a `slotType` discriminator replaces
both, filtered client-side (or via two query params) into the same two
render groups the component already has.

### 4.5 `HomeNewsArticle` (new model — مقالات و اخبار بیاوین)

```prisma
model HomeNewsArticle {
  id          String   @id @default(uuid())
  category    String                // display label only, e.g. "معرفی بیاوین" — not an FK; news categories are editorial tags, not the Category catalog
  imageKey    String?
  kicker      String
  title       String
  lead        String
  /// Reserved for when "مشاهده مقاله" becomes a real link instead of a
  /// disabled button (NewsCarousel.tsx currently ships it `disabled`
  /// on purpose — no article page exists). Nullable so this model doesn't
  /// need another migration when that page ships; until then it's unused.
  bodySlug    String?  @unique
  sortOrder   Int      @default(0)
  active      Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("home_news_articles")
}
```

This finally gives `docs/prototype-to-production-mapping.md`'s long-deferred
`NewsArticle` P2 item a concrete shape, scoped to exactly what
`NewsCarousel.tsx` renders today (no comments, no author, no rich body —
those are real additions for whenever "مشاهده مقاله" stops being disabled,
not invented speculatively here).

### 4.6 `HomeHeroCard` (new model — کارت‌های بیاوین)

```prisma
model HomeHeroCard {
  id           String        @id @default(uuid())
  cardKey      HeroCardKey   @unique  // earn | biawin | reward — matches BiawinCardsCarousel's CardData["key"] today
  label        String                 // small top-right label, e.g. "کارت درآمد"
  title        String                 // large centered title, e.g. "کارت کسب درآمد"
  subtitle     String
  displayNumber String                // decorative only — "6037 9918 0146 1280" is not a real card number (existing code comment)
  ownerLabel   String                 // e.g. "BIAWIN EARN"
  colorPreset  HeroCardColor @default(blue)  // maps to one of the 3 existing gradient definitions — not raw CSS
  sortOrder    Int           @default(0)
  active       Boolean       @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("home_hero_cards")
}

enum HeroCardKey {
  earn
  biawin
  reward
}

enum HeroCardColor {
  blue
  sky
  white
}
```

`colorPreset` (and, by extension, the `iconChip` glyph) stays a closed
enum mapping to the 3 gradient/icon definitions already hand-tuned in
`BiawinCardsCarousel.tsx`, for the same reason as `HomeServiceBanner.theme`
(§4.3) — free-form color/SVG input from Admin would bypass that tuning, and
nothing about this section calls for more than 3 visual variants.

## 5. Image asset pipeline

Every `imageKey` field above (§4.2–§4.6) follows the **exact pattern
`OrbitItem` already ships with** — no new mechanism:

- Upload via the existing `StorageService` (`backend/src/infra/storage/`,
  S3-compatible, MinIO in dev) — `PutObjectCommand` through
  `storageService.putObject()`, same as every other `imageKey` field in the
  schema.
- Public resolution via a static-bridge URL (`/home/service-banners/{filename}`,
  `/home/mosaic/{filename}`, etc. — one prefix per model, mirroring
  `/orbit/{filename}`), **not** a presigned MinIO URL, for the identical
  reason `OrbitItemsService`'s own comment gives: MinIO is loopback-only and
  a presigned URL's expiry would break browser/CDN caching on a page every
  user loads. `imageKey` remains the durable identifier; the filename it
  resolves to is what's actually cached.
- Existing `apps/web/public/home/**` files become the seed data for each new
  table's first migration (same file, now referenced by an admin-editable
  DB row instead of a hardcoded import) — no reshoot needed to cut over.

## 6. API contract

Mirrors `docs/11-orbit-asset-system.md` §5 exactly — public routes are
`@Public()`-decorated NestJS controllers already-used pattern, admin routes
sit under `/admin/...` gated by `JwtAuthGuard` only (see §7 for why that's
an accepted, not ignored, gap).

### Public (consumed by the existing Home hooks)

```
GET /api/v1/categories                          # unchanged route; response gains resolved imageUrl (§3)
GET /api/v1/subscriptions                        # unchanged route; response gains resolved imageUrl (§4.2)
GET /api/v1/home/service-banners                  # active only, sorted, category joined + imageUrl resolved
GET /api/v1/home/service-mosaic-tiles             # active only, sorted, category joined + imageUrl resolved
GET /api/v1/home/news-articles                    # active only, sorted, imageUrl resolved
GET /api/v1/home/hero-cards                       # active only, sorted, imageUrl resolved
```

### Admin (authenticated, not public — one controller pair per model, matching `OrbitItemsAdminController`'s shape)

```
GET    /api/v1/admin/home/service-banners
POST   /api/v1/admin/home/service-banners
PUT    /api/v1/admin/home/service-banners/:id
DELETE /api/v1/admin/home/service-banners/:id
PATCH  /api/v1/admin/home/service-banners/reorder      # body: [{ id, sortOrder }, ...]
POST   /api/v1/admin/home/service-banners/:id/image    # multipart upload → sets imageKey

# identical 6-endpoint shape repeated for:
#   /admin/home/service-mosaic-tiles
#   /admin/home/news-articles
#   /admin/home/hero-cards

PATCH  /api/v1/admin/subscriptions/:id/image            # confirmed: no admin controller exists yet for MembershipPlan (OrbitItemsAdminController is the only admin controller in the backend today) — this is the first one, scoped to just the new imageKey field, not full MembershipPlan CRUD (plan content itself isn't in this contract's scope)
PATCH  /api/v1/admin/categories/:id/image               # same — first admin controller for Category, scoped to imageKey only
```

## 7. Known gap this contract accepts (not a blocker)

**No RBAC/admin-role system exists anywhere in this codebase.**
`OrbitItemsAdminController`'s own code comment already documents this
explicitly: *"Gated by the global JwtAuthGuard only (authenticated, not
role-checked) — this codebase has no admin-role/RBAC system yet."* Every
admin endpoint in §6 inherits the identical posture, for consistency with
the one admin surface that already shipped this way.

This is called out explicitly, not silently inherited, because Home's
content admin has meaningfully larger blast radius than Orbit's (Orbit
gates one landing-page carousel; Home's sections above are the first thing
every authenticated user sees) — **any authenticated user today could call
these admin endpoints**, not just staff. This contract does not block on
building RBAC first (that's a real, separate, cross-cutting feature, not
something to scope-creep into a Home content model), but implementation of
§6 should not proceed to a public/production rollout without at least a
minimal role check in front of every `/admin/**` route — track this as a
release gate for the *rollout*, not for writing this contract's models.

## 8. Migration/rollout sequencing

1. Land §3's prerequisite fixes (`Category` resolver + active filter) —
   independently useful, zero risk to Home's current rendering.
2. Add `MembershipPlan.imageKey` (§4.2), backfill from the existing
   `MEMBERSHIP_TIER_IMAGE` map by real `id` (not by re-typing the title
   string a third time), switch `MembershipStoryStrip` to `plan.imageUrl`,
   delete `MEMBERSHIP_TIER_IMAGE`.
3. Add §4.3–§4.6 tables one at a time, each following the same 3-step
   pattern: migrate + seed from the matching `home.mock.ts` array → switch
   the one consuming component from the mock import to the new `GET`
   endpoint → delete that array from `home.mock.ts`. Each section can ship
   independently; none block the others.
4. Build the 6-endpoint admin CRUD surface per model (§6), reusing
   `OrbitItemsAdminController`/`OrbitItemsService` as the literal template —
   the shape is intentionally identical.
5. `home.mock.ts` is fully deleted once all four sections (§4.3–§4.6) have
   cut over; `HomeStories`/`BrandIntroduction`/`QuickActions` stay in the
   file (or move to plain component-local constants) since §2 keeps them
   code-defined.

## Summary

| Deliverable | Location in this document |
|---|---|
| Current-state audit + root architectural risk | §1 |
| Scope decision per Home section | §2 |
| Required pre-existing-code fixes | §3 |
| Data model (schema-level, no migration applied) | §4 |
| Image asset pipeline | §5 |
| API contract (public + admin) | §6 |
| Accepted gap (RBAC) | §7 |
| Rollout sequencing | §8 |

Nothing in this document has been implemented — no migration, no Admin UI,
no Home code change. This is the frozen contract a future implementation
stage builds against, exactly as `docs/11-orbit-asset-system.md` was for
Orbit before `OrbitItem` shipped.

---

# HOME ADMIN CONTRACT:
READY FOR IMPLEMENTATION
