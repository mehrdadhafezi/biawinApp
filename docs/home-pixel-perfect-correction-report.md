# Home Pixel-Perfect Correction Report (Stage 5.13)

Re-audited `biawin_single_file_app_requested_edits_v15.html` directly
(not the prior React implementation) and corrected every real deviation
found. Every fix went through the full required flow — local fix → QA →
commit → push → staging deploy → live verification — before this report
was written.

---

## Sections Corrected

### 1. Credit Power Section — major correction (the one this stage called out explicitly)

Re-read `.credit-power-section`/`.credit-tickers`/`.credit-service-item`/
`.credit-service-photo`/`.credit-service-name` directly from the source
this session (lines 805–864) and found the prior implementation had
never actually read these specific selectors — it invented rectangular,
`rgba(255,255,255,.1)`-background tiles with emoji instead. The real
prototype rule:

```
.credit-service-item{height:var(--ticker-item-h);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:8px;color:#fff;background:transparent}
.credit-service-photo{width:88px;height:88px;border-radius:50%;overflow:hidden;
  border:5px solid rgba(255,255,255,.88);background:#fff;box-shadow:0 14px 30px rgba(0,45,88,.28)}
.credit-service-name{font-size:12px;font-weight:800;...}
```

`CategoriesSection.tsx` was rebuilt from this exact spec: transparent
item background, circular photo (88px desktop → 66px ≤620px → 58px
≤390px, matching the real breakpoint cascade), 5px/4px white border,
label below. 16 real category photos extracted from the prototype's own
inline base64 (`apps/web/public/home/categories/`) replace the emoji map
entirely. The copy side (`.credit-power-copy`) also got its full
responsive typography re-added (`h3` 23px→16px→15px, eyebrow, `p`, and
the CTA button) — the first pass had a single flat size with no
`@media` handling at all.

### 2. Shared Header

Re-read the full cascade for `.page-home .header` and found **two**
declarations for the same selector+media-query (`max-width:620px`) at
different points in the file — line 387 (single-column `1fr`) and line
2708 (3-column `auto minmax(0,1fr) auto`, later in the document, wins
the cascade). The prior implementation had **zero** `@media` rules at
all, so header layout never adapted at any width. Added the real,
cascade-winning mobile rule: brand text hidden, brand mark 38×38, App
Guide collapses to a 42×42 icon-only square, search box 42px — verified
live at 360px on both local dev and staging. Removed a visible
"به‌زودی" caption under the App Guide button that the first pass had
added (not in the prototype) — it silently grew the header taller than
the prototype's exact height; the button's `disabled` state + hidden
`aria-label` now carry that signal instead, matching how the search
input already only hints via its placeholder.

### 3. Stories Strip

Re-verified against `.home-stories`/`.stories-strip`/`.story-bubble*` —
no `@media` override exists for this section anywhere in the prototype,
and the existing implementation already matched every base value (58px
circle, 3px ring padding, 22px icon, 8.5px label, 11px gap). No changes
needed.

### 4. Biawin Cards Carousel

Re-verified geometry against `.credit-card`/`.card-track`/
`.card-viewport`/`.carousel-nav` — base values (aspect-ratio 1.62/1,
`scale(.94)`/`opacity(.74)` inactive → `scale(1)`/`opacity(1)`/
`saturate(1.08)` active, 26px radius, 47×35 chip) were already correct.
Found and added the missing `max-width:620px` tightening (card radius
23px/padding 18px, card-center/card-bottom inset 18px, title 23px,
card-number 10px/1.4px letter-spacing) and the missing `hero`/
`hero-title` mobile padding — none of this existed in the first pass.

### 5. Quick Actions

Re-verified against `.home-quick-actions*` — base values already
correct. Added the missing `max-width:420px` tightening (container
radius 16px/gap 5px/padding 5px, item min-height 60px/radius 12px,
icon-box 28×28/radius 9px, label 7.2px) — absent before this pass.
Functional rules unchanged and re-verified: Services/Credit/Installments
`router.push` to their real pages, "افزایش موجودی" stays `disabled` +
"به‌زودی" (no fake deposit flow).

### 6. Brand Introduction

Re-verified `.intro` — single declaration, no responsive override exists
in the prototype at all. Copy re-diffed character-for-character against
the exact text this stage specified — already matched, no changes
needed.

### 7–8. Service Banner Grid / Service Mosaic / Membership Story Strip / News Carousel

All four rebuilt to use real extracted photos instead of the first
pass's gradients/emoji — no other structural changes were needed (grid
layout, spacing, radii, gradient overlays, and responsive rules already
matched the prototype). Section order re-confirmed unchanged from the
prototype's own document order; nothing added, nothing removed.

---

## Extracted Assets

**41 real photos**, 688 KB total, extracted verbatim from the
prototype's inline base64 `<img>` tags via a one-off Python script (read
each section's known line range, decoded each `base64,...` payload,
wrote to `apps/web/public/home/<subdir>/`). Every extracted file
verified as a valid, loadable WebP image both locally and on staging
(`new Image()` load test: 40/40 unique sources succeeded, zero
failures, on both environments). Full alt-text→file mapping in
[docs/home-prototype-asset-map.md](home-prototype-asset-map.md).

**One finding worth recording, not a bug**: `membership/item-01.webp`
("کارت شروع") and `news/item-01.webp` ("معرفی بیاوین") are
byte-identical — confirmed by comparing the raw base64 at both source
lines (7251 and 7344) directly, not just the extracted files. The
prototype's own author reused the same stock photo for two unrelated
mock content pieces. Per this stage's "do not reinterpret" instruction,
this was reproduced faithfully rather than "fixed" with a different
image, since the prototype is the source of truth, including this.

No emoji, generic icon, or gradient-only placeholder remains anywhere
the prototype has a real photo.

---

## Remaining Visual Differences

**None identified.** Every deviation flagged in this stage's brief (and
several not explicitly flagged, found during the re-audit — the header's
missing responsive rules, the cards/quick-actions missing mobile
tightening) was corrected and verified. The same disclosed limitation
from the prior stage still applies: a true screenshot-based pixel diff
is not possible in this session (Browser pane screenshot capability
unavailable), compensated with exact CSS-value extraction (every number
in this report traced to a specific source line, not estimated) plus
live computed-style verification (border-radius, widths, image src,
responsive display toggles all read directly from the rendered DOM, both
locally and on staging).

---

## Local Validation

- `tsc --noEmit` — clean
- `eslint` (`src/components/home`, `src/components/shell`) — clean, 6
  informational `@next/next/no-img-element` warnings (consistent with
  existing project convention — `OrbitBubble.tsx` already carries the
  same warning, plain `<img>` is the established pattern here)
- `next build` — succeeds, all 10 routes listed
- All 41 extracted images load successfully (`new Image()` test, 40
  unique sources, 0 failures)
- Full 9-width responsive matrix (360/375/390/430/768/1024/1366/1440/1920)
  — zero overflow at every width
- Header responsive collapse verified live at 360px (brand-text
  `display:none`, guide button `42px` square)
- Global regression: `/wallet`, `/credit`, `/installments`, `/services`,
  `/profile`, `/rewards` all re-checked, clean console on every page

## Commit / Push / Deploy

| Step | Result |
|---|---|
| Commit | `c437329` — "fix(web): pixel-perfect Home correction pass — real photos, exact geometry" (52 files, 41 new image assets) |
| Push | `origin/main` advanced `e272e1b..c437329` |
| Staging deploy | `deploy.sh` completed all 6 steps — images rebuilt (new `public/home/` assets confirmed copied into the runtime image via the build log), migrations (none pending), seed re-ran clean, containers cut over, health check passed first attempt |

## Live Staging Verification

- `staging.biawin.ir/home` → `200`; asset URLs
  (`/home/categories/item-01.webp`, `/home/banners/item-01.webp`,
  `/home/membership/item-01.webp`) → `200 image/webp`, confirmed via
  direct `curl` against the live domain, not assumed from the deploy log.
- Logged in against the live staging backend (real OTP request/verify).
- **Credit Power section specifically verified live**: `.credit-service-photo`
  computed style read directly from the DOM on staging —
  `border-radius: 50%`, `width: ~88px`, `img.src` pointing at
  `staging.biawin.ir/home/categories/item-01.webp` — the circular real-photo
  design is genuinely deployed, not just built locally.
- **Old emoji/rectangular version confirmed gone**: full page-text dump
  from live staging contains zero emoji characters anywhere in the
  Credit Power ticker, Service Banner Grid, Membership Story Strip,
  Service Mosaic, or News Carousel — every one now renders only real
  image `<img>` tags and text labels.
- All 40 unique images on the live page load-tested directly against
  `staging.biawin.ir` — 40/40 succeeded, 0 failures.
- Header responsive collapse re-verified live on staging at 360px
  (identical result to local dev).
- Responsive: 1920px re-verified live on staging — zero overflow,
  `<main>` capped at exactly 760px.
- Regression: `/wallet` and `/services` re-checked live on staging,
  clean console on both.
- Fresh-tab re-checks used throughout to rule out the documented stale-console
  artifact — every "error" seen was confirmed either the known
  silent-refresh-then-retry pattern or absent entirely in a new tab.

---

## Final Verdict: **PIXEL PARITY PASS**

Every deviation identified in this stage's brief — the Credit Power
section's rectangular-tiles-and-emoji error above all — was traced to
its exact source in the prototype's CSS/HTML, corrected to match that
source precisely (not redesigned, not simplified, not reinterpreted),
and confirmed live on `staging.biawin.ir`, not just in local development.
No emoji-based fallback remains anywhere the prototype has a real image.
No known remaining visual difference — the only open item is the
still-unavailable screenshot-diff tooling, a verification-method gap
disclosed in both this report and the prior stage's, not a known defect.
