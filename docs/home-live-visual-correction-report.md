# Home — Live Staging Visual Correction Report (Stage 5.14.1)

Source of truth: `.page-home` rules in `biawin_single_file_app_requested_edits_v15.html#home` (re-inspected fresh this stage, not inferred from the React implementation). Live environment: `https://staging.biawin.ir/home` and other authenticated routes on the same `AppShell`.

## 1. خدمات منتخب بیاوین — service photos rendering invisible

**Root cause**: `.biawin-service-banner img` and `.biawin-service-banner:after` use negative `z-index` (`-2`/`-1`) to sit behind the card's text, relying on the card itself to establish a stacking context. `.biawin-service-banner` had `position:relative` but no `z-index`/`isolation`, so it did **not** establish one — the negative-z-index photo and overlay escaped to the nearest ancestor that does (`AppShell`'s `transform:translateZ(0)` column, several levels up), painting underneath every section's own opaque background between here and there. Not an opacity/asset problem — the photo was loading correctly, just compositing behind unrelated content.

**Fix**: added `isolation:isolate` to `.biawin-service-banner`, containing the negative-z-index children within the card's own stacking context — matching the same pattern already present on `BiawinCardsCarousel`'s `.biawin-credit-card`.

**File**: [ServiceBannerGrid.tsx](apps/web/src/components/home/ServiceBannerGrid.tsx)

**Prototype source**: `.page-home .service-banner{...isolation:isolate;background:#0a63b8}` (prototype already has this on the equivalent rule — the React port had simply dropped it).

## 2. کارت‌های بیاوین — "BiaWin" text overlapping title/subtitle

**Root cause**: isolated empirically via a bare `<button style="all:unset;display:block">` reproduction — Chromium's native `<button>` rendering vertically centers its in-flow content regardless of `all:unset` or an explicit `display:block` on the button itself. `.biawin-credit-card`'s only in-flow child (the brand/label row; everything else is `position:absolute`) was being centered inside the ~199px-tall card, dropping it down onto the title block.

**Fix**: `display:flex;flex-direction:column` on `.biawin-credit-card`, which resolves the button's own `display` to `flex` and removes the native centering (confirmed the offset disappears both on a `<div>` control and on the same `<button>` once its `display` resolves to `flex`).

**File**: [BiawinCardsCarousel.tsx](apps/web/src/components/home/BiawinCardsCarousel.tsx)

**Prototype source**: `<article class="credit-card ...">` — a non-button element in the prototype, so it never hit this Chromium `<button>`-specific quirk. React's port needed a button (for `aria-label`/`disabled` semantics), which is what introduced it.

## 3. Stray "به‌زودی" caption / inflated Quick Actions tiles / oversized gap to Brand Introduction

**Root cause**: the "افزایش موجودی" tile rendered a *visible* "به‌زودی" caption line — not present in the prototype's Quick Actions markup at all. Since `.biawin-home-quick-actions-grid` is `display:grid` (default `align-items:stretch` per row), that one extra line stretched **all four** tiles taller than the prototype's exact 68px/60px `min-height`, which is what made the space above Brand Introduction look inflated.

**Fix**: removed the `ComingSoonCaption` render and its wrapping div; kept the tile itself `disabled` with `aria-label="... — به‌زودی"` for assistive tech, matching the same pattern already used for the header's App Guide button — a disabled control communicates "not available yet" without adding visual content the prototype never had.

**File**: [QuickActions.tsx](apps/web/src/components/home/QuickActions.tsx)

**Prototype source**: prototype's Quick Actions tiles have no caption row at all under any tile — verified directly.

## 4. کارت‌های اشتراک بیاوین — "سبک زندگی" tier missing its photo

Not one of the three originally reported defects — found during the mandated Section 7 live-asset audit (enumerating every unique image on the live page turned up 40 unique paths instead of the expected 41; `.biawin-story-circle-btn` inspection showed the "سبک زندگی" tier alone had no `<img>` at all — no broken-image icon, just silently absent).

**Root cause**: confirmed directly against the real `GET /subscriptions` response on staging — every other membership tier's `plan.title` is prefixed `"کارت ..."` (`"کارت شروع"`, `"کارت پلاس"`, etc.), but this one tier's real title is the bare `"سبک زندگی"` (no prefix). `MEMBERSHIP_TIER_IMAGE` in `home.mock.ts` was keyed `"کارت سبک زندگی"` since Stage 5.13 — a guess that never matched the live API, so the lookup silently returned `undefined` and the `? <img> : null` guard correctly rendered nothing.

**Fix**: corrected the map key to `"سبک زندگی"`.

**Files**: [home.mock.ts](apps/web/src/components/home/home.mock.ts), [MembershipStoryStrip.tsx](apps/web/src/components/home/MembershipStoryStrip.tsx) (doc comment only)

## 5. Bottom navigation not actually pinned to the screen

Also not one of the three originally reported defects — found while executing the mandated responsive checklist item "fixed bottom nav correct / content not hidden behind bottom nav." Direct measurement showed the nav's screen position shifted 1:1 with `scrollY` (e.g. at 390×844, `top` was 2907px at `scrollY=0`, and became 2407px at `scrollY=500` — a decrease exactly matching the scroll delta), i.e. it was scrolling away with the page and only became visible once scrolled to a page's literal bottom. This reproduced identically on every authenticated route (Home, Wallet, Credit, Installments, Services, Profile, Rewards), since all of them share `AppShell`.

**Root cause**: `AppShell` intentionally wraps every page in a `transform:translateZ(0)` column (Stage 5.1 decision, so that `position:fixed` descendants cap to the 760px mobile-shell column instead of spanning the full browser window on desktop). A `transform` on an ancestor makes it the *containing block* for `position:fixed` descendants — so `BottomNavigation`'s `bottom:0` was resolving against that column's full content-height box, not the viewport. `GlobalHeader` hit the identical trap and already avoids it — it uses `position:sticky`, confirmed via live measurement to stay correctly pinned (`top:0` at every scroll position) both before and after this fix.

**Fix**: changed `BottomNavigation`'s `position:fixed` to `position:sticky`, which isn't subject to the fixed-positioning containing-block rule and resolves against the transformed column the same way `sticky`/`relative`/`absolute` already do — mirroring `GlobalHeader`'s existing solution. Verified the 760px desktop cap is unaffected (`navWidth:760`, centered) and the nav now stays pinned (`top`/`bottom` constant across `scrollY = 0 / 500 / page-bottom`) on Home, Wallet, at both 390px and 1440px viewports.

**File**: [BottomNavigation.tsx](packages/ui/src/components/BottomNavigation.tsx)

**Prototype source**: `.page-home .bottom-nav{position:fixed;...}` — the prototype is a single unscaled page with no transformed ancestor, so this trap doesn't exist there; it's specific to the React app's shared, width-capped shell architecture.

## Local verification

- `tsc --noEmit`: clean (both commits)
- `eslint`: 0 errors both times (only pre-existing `@next/next/no-img-element` warnings, unrelated to these changes)
- `next build`: compiled successfully, all 11 routes generated, both times
- Local dev server (`localhost:3000`), authenticated session, direct DOM/computed-style measurement:
  - Membership fix: all 8 story-circle tiers render an `<img>`, including "سبک زندگی" → `/home/membership/item-07.webp`
  - Bottom-nav fix: `position:sticky` confirmed; `top`/`bottom` constant across `scrollY = 0/500/page-bottom` at 390×844; `navWidth:760`, centered, still pinned at 1440×900; reproduced on `/wallet` too

## Commits

| Commit | Contents |
|---|---|
| `694d172` | Stacking-context isolation fix, button-centering flex fix, stray caption removal (previous stage segment, already deployed) |
| `ab59176` | Membership tier image key fix |
| `b0d5fb0` | Bottom-navigation sticky-positioning fix |

## Deployed server commit hash

Verified via `git rev-parse HEAD` on the staging server after each deploy:
- After `ab59176`: `ab5917685e3c1a659cd56578f117ff81e0cdbb39` ✓ matches
- After `b0d5fb0`: `b0d5fb041257fcc43dd06c012c87bf25b92238dd` ✓ matches (final state)

## Live staging verification (`https://staging.biawin.ir`, fresh authenticated session, direct DOM/computed-style measurement — see note on method below)

- Service banner photos: `isolation:"isolate"` on `.biawin-service-banner`, `img` present with correct `src`, no overlap with page background
- Card overlap fix: `overlap:false` at 768px+ widths (see "Remaining differences" for narrow-width behavior)
- Quick Actions: `qaHeights:[68,68,68,68]`, `qaCaptionPresent:false`
- Membership images: all 8 `.biawin-story-circle-btn` tiers have `hasImg:true`, including `"سبک زندگی" → /home/membership/item-07.webp`
- Bottom nav: `position:sticky`; `top`/`bottom` unchanged across `scrollY = 0/500/page-bottom` at 390×844 and 1440×900 on both `/home` and `/wallet`
- Asset inventory: 41 unique image paths used across Home; all 41 return HTTP 200 via `HEAD` against `staging.biawin.ir`; a representative sample per section (banner, membership, mosaic half, mosaic wide, news, category) independently re-fetched and pixel-decoded (`new Image()`, non-cached), all returning real, non-zero dimensions (e.g. `900×675`, `520×390`) — confirming valid image bytes, not just 200-status headers
- Do-not-touch regression smoke check on staging: `/wallet`, `/credit`, `/installments`, `/services`, `/profile`, `/rewards` all return HTTP 200

### Responsive QA — live staging, no horizontal overflow at any width

360, 375, 390, 393, 430, 768, 1024, 1366, 1440, 1920 — `document.documentElement.scrollWidth` matched `clientWidth` at every width (max 1px rounding), confirmed on `/home`.

### Verification method note

This environment's Browser pane does not composite/paint frames (screenshot calls fail with "the page is not compositing frames"), so native `loading="lazy"` never fires on the actual `<img>` elements in this tool regardless of scroll position — confirmed harmless by testing that a fresh, non-lazy `new Image()` request for the same URL loads and decodes correctly. All visual claims in this report are backed by direct DOM structure, computed-style, and `getBoundingClientRect()` measurement rather than pixel screenshots, consistent with prior stages' reports.

## Remaining differences

- **BiaWin cards, narrow viewports (≲393px)**: the brand/label row and the title/subtitle center block sit close enough to touch or slightly overlap at very narrow widths (e.g. 2px overlap measured at 393px, ~21px at 360px), because `.biawin-credit-card-center{top:46%}` is percentage-positioned against a card whose height shrinks with viewport width (`aspect-ratio:1.62/1`, `flex:0 0 min(82vw,470px)`). **This is not a regression or a fidelity gap**: opening the frozen prototype file itself at 360px width and measuring the identical elements (`.card-top`, `.card-center`) shows the same overlap (rowBottom 66 vs centerTop 41 — slightly worse than the React port's 64 vs 43). The prototype's own CSS values are byte-identical to the port's. Genuinely eliminating this would mean diverging from the frozen prototype's own narrow-width layout math, which is outside this stage's mandate (matching the prototype, not revising it). Flagged here per the instruction to list any remaining difference explicitly, even a prototype-inherited one.
- No other known visual differences from the prototype remain on Home at any of the 10 tested widths.

---

# HOME LIVE VISUAL QA: PASS

Remaining issues (non-blocking, inherited from the frozen prototype, not introduced by this stage): narrow-viewport (≲393px) BiaWin card text spacing is tight-to-slightly-overlapping, matching the prototype's own behavior at the same width.
