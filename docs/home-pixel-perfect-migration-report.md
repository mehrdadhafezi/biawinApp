# Biawin Home Screen Pixel Perfect Migration — Report

Rebuilds Home to reproduce `#view-home` in
`biawin_single_file_app_requested_edits_v15.html` exactly, superseding
Stage 4.1–4.4's "Home Dashboard v1: FROZEN" design-system version. Also
restyles the shared `AppShell`/`GlobalHeader`/`BottomNavigation` to
pixel-match the prototype's fixed header and bottom nav, since the
request frames both as permanent shell chrome ("same across screens"),
not Home-only.

---

## Decisions made before implementation (via clarifying questions)

Three architecture questions were resolved with the user before writing
any code, since this request otherwise conflicts with the
already-shipped, staging-deployed AppShell every other module depends on:

1. **Replaces `app/home/page.tsx` in place** (not a parallel `(mobile)` route).
2. **Extends `AppShell`/`GlobalHeader`/`BottomNavigation` in place**
   rather than adding a parallel `components/layout/` shell — so every
   page (Wallet/Credit/Installment/Services/Profile/Rewards) gets the
   same pixel-matched header/nav, not two divergent shells.
3. **Unbuilt features (search, App Guide, wallet top-up) are real
   `disabled` controls + "به‌زودی"** — the same established pattern
   every prior module already uses for a feature with no backend yet,
   not live UI for a non-functional flow.

## A content-mapping judgment call, stated explicitly

The request's "Section 5: Categories — circular images, horizontal
scrolling" doesn't literally match anything at that position in the
prototype's actual `#view-home` (read in full this session, base64
image data stripped for readability). What sits there is
`<section class="categories credit-power-section">` — a two-column,
vertically auto-scrolling ticker of 16 category names with photos,
titled "قدرت اعتبار در باشگاه." A separate, later section
(`#membershipStories`) *does* have circular images in a horizontal
strip, but it's the 8 membership-tier cards, not categories. Per this
stage's own "the HTML prototype is the single source of truth... do not
redesign," `CategoriesSection` was built as the actual `credit-power`
ticker (it's literally `class="categories"` in the markup) rather than
force-fitting the paraphrased description onto the wrong element — both
real pieces of prototype content were kept, nothing was dropped to
satisfy the shorthand description.

---

## What was built

```
AppShell (shared, all pages)
├── GlobalHeader   [restyled — logo/App Guide/search, pixel-matched to `<header class="header">`]
└── BottomNavigation (packages/ui)  [restyled — 4 SVG-icon tabs, pixel-matched to `<nav class="app-bottom-nav">`]

app/home/page.tsx
├── HomeStories            [rewritten — 8 story bubbles, `.home-stories`]
├── BiawinCardsCarousel    [new — replaces HeroCardCarousel, `.hero`/`#cardTrack`]
├── QuickActions           [new — replaces QuickActionsGrid, `.home-quick-actions`]
├── BrandIntroduction      [new — `.intro`]
├── CategoriesSection      [new — replaces ServiceTicker, `.categories.credit-power-section`]
├── ServiceBannerGrid      [rewritten — replaces FeaturedServiceBanner, `.services`/`.banner-grid`]
├── MembershipStoryStrip   [rewritten — replaces MembershipStories, `.story-strip-section`]
├── ServiceMosaic          [new — `.sketch-continuation`]
├── NewsCarousel           [new — `.news-sketch-section`]
└── footer                 [inline, `.footer`]
```

New: `apps/web/src/components/home/home.mock.ts` — the "Temporary data"
deliverable: `HOME_STORIES`, `CATEGORY_TICKER_UP/DOWN` + icon map,
`NEWS_ARTICLES`, all verbatim prototype copy, not placeholder text.

Deleted (fully superseded, zero remaining references — confirmed via
grep before removal): `HeroCardCarousel.tsx`, `QuickActionsGrid.tsx`,
`ServiceTicker.tsx`, `FeaturedServiceBanner.tsx`, `MembershipStories.tsx`,
`BenefitsSection.tsx` (no counterpart anywhere in the prototype's Home
view — Stage 4.3 content with nothing to reproduce),
`AccountFinancialCards.tsx` (same — the prototype's Home never shows
inline Wallet/Credit/Installment summary cards), `PageHeader.tsx`
(superseded by the new fixed `GlobalHeader`), `NotificationButton.tsx`
(no bell icon anywhere in the prototype header).

## Real API data vs. mock — kept deliberately, not automatically

Three prototype sections use **real backend data**, not mock, because
the backend already models exactly that content and building fake data
instead would be a strict downgrade:

- **`MembershipStoryStrip`** — the 8 tier circles map 1:1 onto the real
  `MembershipPlanDto.tier` enum (start/plus/family/prime/gift/travel/
  lifestyle/organizational). Reused Stage 4.1's `useMembershipSummary`.
- **`ServiceBannerGrid`** / **`ServiceMosaic`** — all 9 category names
  the prototype names (اتومبیل، لوازم خانگی، پوشاک، طلا و جواهر،
  گردشگری، زیبایی، بیمه، مبلمان، دیجیتال) exist verbatim in the real
  seeded `Category` table (verified live this session against
  `/services`'s real chip list) — matched by name, linked to the real,
  already-shipped `/services/[categoryId]` route (Stage 9.1).

**`BiawinCardsCarousel`** is the one exception kept fully static —
the request explicitly said "Use prototype content" for these 3 cards,
and the prototype's own card numbers/copy are demo content, not real
membership data (unlike the tier circles, nothing in the schema models
"کارت کسب درآمد" as an activatable product).

**`CategoriesSection`** (credit-power ticker) and **`NewsCarousel`** are
mock, per the request's own "Temporary: mock data... Future: Admin
controlled" instruction — no `imageUrl` resolution exists for
`Category.imageKey` yet (docs/services-ui-contract.md §6 Gap #3) and no
`NewsArticle` model exists in the schema at all
(docs/prototype-to-production-mapping.md P2 item).

## Asset mapping

The prototype embeds every photo as inline base64 (the source file is
~26 MB). None of that was extracted or copied in — every image is
replaced with an emoji/icon placeholder, the same fallback
`ServiceCard`/`FeaturedServiceBanner` already established for
`imageKey`-less categories/services. This is a real, load-bearing gap
(already documented, not new): once `imageUrl` resolution exists for
`Category`/`Service`, these placeholders are the first thing to swap for
real photos.

## Interactive behavior (not just static markup)

- **`BiawinCardsCarousel`**: real horizontal swipe/snap-scroll, active
  card centers via `scroll-snap-align`, side cards visible at `scale(.94)
  /opacity(.74)`, pagination dots both reflect and drive the active card
  (tap a dot to jump, scroll to update the dot) — verified live.
- **`QuickActions`**: 3 of 4 buttons `router.push` to real pages
  (`/services`, `/credit`, `/installments`) — verified live, each
  navigates correctly. This is a genuine capability upgrade over Stage
  4.1's version (which only scrolled to an in-page section) — those
  routes didn't exist yet when the original was built.
- **`CategoriesSection`**: both ticker columns auto-scroll continuously
  (CSS keyframe animation, pauses on hover, respects
  `prefers-reduced-motion`); "مشاهده همه خدمات" `router.push`es to
  `/services` — verified live.
- **`ServiceMosaic`**: the wide slider auto-rotates every 5s with dot
  controls; both half-tiles and both wide slides `router.push` to the
  matching real `/services/[categoryId]` — verified live
  (`زیبایی و مراقبت` tile → real category id confirmed via
  `window.location.href`).
- **`NewsCarousel`**: snap-scroll with prev/next arrow buttons and a
  live "current / 8" counter tied to scroll position.

**One bug caught and fixed during verification**: `CategoriesSection`'s
ticker items were initially real `<button>` elements with no `onClick`
(the prototype's equivalent fills a search box we don't have a working
backend for) — they looked tappable but did nothing, exactly the
"silent no-op" pattern this project has flagged and fixed in every prior
stage. Changed to plain non-interactive `<div>`s instead of leaving a
fake-looking control.

## Validation

- `tsc --noEmit` (both `apps/web` and `packages/ui`) — clean
- `eslint` (full `apps/web/src` sweep) — clean (one pre-existing,
  unrelated warning on `OrbitBubble.tsx`, not touched this stage)
- `next build` — succeeds; all 10 routes still listed correctly

## Regression check across every other page

Since `GlobalHeader`/`BottomNavigation` are shared, every other page was
re-verified live after the change, not just Home:

| Page | Result |
|---|---|
| `/credit` | ✅ renders correctly under the new header/nav, clean console |
| `/wallet` | ✅ same |
| `/installments` | ✅ same |
| `/services`, `/services/[categoryId]`, `/services/[categoryId]/[serviceId]` | ✅ same |
| `/profile`, `/rewards` | ✅ still show their Stage 5.2 placeholders correctly |

`AppShellProps` dropped `pageLabel`/`greeting`/`headerEnd` (no longer
meaningful — the header is fixed content now, not per-page text) — all
9 call sites updated to match; no dangling/unused props left behind.

## Responsive verification

All 4 required widths checked live (`window.innerWidth` vs.
`document.documentElement.scrollWidth`), zero horizontal overflow at
each:

| Width | Result |
|---|---|
| 360px | ✅ no overflow |
| 375px | ✅ no overflow |
| 390px | ✅ no overflow |
| 430px | ✅ no overflow |

## Screenshot comparison — not available this session, compensated for

The deliverable asks for a Prototype-vs-Application screenshot
comparison as the final fidelity check. The Browser pane's screenshot
capability was unavailable in this session (**"the Browser pane is not
displayed"** — an environment/display-state issue, not an application
bug) even after retrying at multiple points. This is disclosed rather
than silently skipped. In its place, fidelity was verified two other
ways: (1) every color/spacing/radius/gradient value in every new
component was copied directly from the prototype's own extracted CSS,
not estimated by eye; (2) structural content was verified against
`get_page_text`/`read_page` output, confirming every section, in the
correct order, with the correct copy. **A real screenshot diff against
the prototype is still recommended as a follow-up** once the Browser
pane is available, to catch anything a value-by-value CSS read can't —
this report does not claim pixel-identical has been visually confirmed,
only that it was built from pixel-exact source values and verified
structurally.

---

## Status: Home Screen Pixel Perfect Migration — IMPLEMENTED

All 5 named sections plus the prototype's remaining "AdditionalHomeSections"
content (service banners, membership tiers, mosaic, news) are live,
pixel-value-matched, and verified structurally + responsively. The
shared header and bottom nav now match the prototype across the whole
app, not just Home. Outstanding: a true visual screenshot diff once the
Browser pane is available (see above), and swapping emoji/icon
placeholders for real photos once `imageUrl` resolution exists for
`Category`/`Service`.
