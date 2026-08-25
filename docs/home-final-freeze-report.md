# Home Prototype Final QA + Freeze Report (Stage 5.12)

Final QA review of the Home Pixel Perfect Migration, comparing
`biawin_single_file_app_requested_edits_v15.html` against the actual
deployed application on `staging.biawin.ir` — not just local dev. Per
this stage's explicit instruction, the full release flow (commit → push
→ deploy → verify live) was run before this report was written, and
before Home is declared FINAL.

---

## 1. QA Summary

The Home Pixel Perfect Migration (built in the prior stage, still
uncommitted at the start of this one) was reviewed section-by-section
against the prototype, one real bug was already found and fixed before
this stage began (a category-ticker item that looked tappable but had
no handler — see `docs/home-pixel-perfect-migration-report.md`), and a
fresh QA pass this session found **no new defects**. Every check in
this stage's 10-point review passed, both locally and — after the
release flow completed — on the live staging deployment.

**One item flagged as a genuine, disclosed limitation, not a defect**: a
true pixel screenshot diff against the prototype file was not possible
this session (the Browser pane's screenshot capability was unavailable
in both this stage and the prior one). Verification instead used exact
CSS-value extraction (every color/spacing/radius/gradient copied
directly from the prototype's own stylesheet, not eyeballed) plus live
structural/behavioral checks. This is called out explicitly rather than
silently claimed as done — see §4.

## 2. Prototype Parity Score

**9 / 10 sections at full parity**, 1 section with a disclosed
verification-method gap (screenshot diff unavailable, compensated with
exact-value + structural verification — see §4).

| # | Section | Parity |
|---|---|---|
| 1 | App Header | ✅ Full |
| 2 | Bottom Navigation | ✅ Full |
| 3 | Stories Section | ✅ Full |
| 4 | Biawin Cards Carousel | ✅ Full |
| 5 | Quick Actions | ✅ Full |
| 6 | Brand Introduction | ✅ Full (verified character-for-character) |
| 7 | Categories Section | ✅ Full |
| 8 | Banner/Mosaic/Membership/News | ✅ Full (see §5 for real/mock split) |
| 9 | Global regression | ✅ No regressions found |
| 10 | Responsive matrix | ✅ Full — 9/9 widths, zero overflow, both locally and on staging |

---

## 3. Passed Items (verified this session, with method)

### 1. App Header
- Logo (`.brand-mark` gradient + ring cutouts), App Guide button, search
  box all present, pixel-matched to `.page-home .header` — confirmed via
  code read + live render.
- **Sticky behavior**: genuinely tested by scrolling the page 1200px and
  re-reading the header's `getBoundingClientRect()` — `top: 0`,
  `position: sticky` held under real scroll, not just assumed from CSS.
- **Shared through `AppShell`**: confirmed live on `/wallet`, `/credit`,
  `/installments`, `/services` — identical header renders on every one,
  not just Home.
- App Guide + search are real `disabled` controls with visible
  "به‌زودی" — no backend exists for either (search: `docs/services-ui-contract.md`
  §6 already documented this as MISSING; App Guide: no content model
  exists anywhere).

### 2. Bottom Navigation
- Items confirmed exactly: بیاوین / خدمات / جایزه / پروفایل (not
  "خانه" — matches the prototype's actual `<nav class="app-bottom-nav">`
  literally, a real fix from the pixel-perfect migration).
- **Fixed position**: `position: fixed`, confirmed via computed style.
- **Active state**: genuinely tested by reading computed `color`/
  `background` on every nav button on `/services` (خدمات correctly
  blue+highlighted, others muted) and on `/wallet` (بیاوین correctly
  highlighted, since Wallet/Credit/Installments all pass
  `activeNavKey="home"` — they're reached from Home, not tabs
  themselves).
- **Navigation**: tapping "خدمات" correctly routes to `/services` (verified in the prior stage; unchanged this session).

### 3. Stories Section
- 8 bubbles present (`چرا بیاوین`, `کسب‌وکار با بیاوین`,
  `خاص‌ترین‌های بیاوین`, `کارت‌های عضویت`, `اعتبار من`, `اقساط من`,
  `خدمات منتخب`, `کیف پول`) — matches the prototype's actual
  `.stories-strip` exactly (the request's own paraphrase listed only 7;
  the prototype has 8, and the prototype wins per "single source of
  truth").
- **Circular**: measured live — `58px × 58px`, `border-radius: 50%`.
- Typography (`8.5px/700`), spacing (`11px` gap), RTL inherited from the
  app-wide `dir="rtl"` — all match.
- **Mock/static**: all 8 bubbles are `disabled` (no intro-story viewer
  exists) — see §5/§6 for the CMS requirement.

### 4. Biawin Cards Carousel
- **Swipe/snap**: `scroll-snap-type: x mandatory` on the track,
  `scroll-snap-align: center` per card — genuine native scroll-snap, not
  a simulated animation.
- **Pagination dots**: bidirectional sync confirmed in the prior stage —
  scrolling updates the active dot, tapping a dot scrolls to that card.
- **Card dimensions**: `aspect-ratio: 1.62/1`, `flex: 0 0 min(82vw,470px)` — matches `.credit-card` exactly.
- **RTL**: card content (`dir="rtl"`) inside an `dir="ltr"` track — same
  trick the prototype itself uses so native swipe direction feels
  correct in an RTL app.
- All 3 cards (`کارت کسب درآمد`, `کارت بیاوین`, `کارت جایزه`) are real
  `disabled` buttons (Card Detail doesn't exist yet) — no fake "tap to
  open" flow.

### 5. Quick Actions
Re-verified live this session via each button's `disabled`/`aria-label`:

| Item | State |
|---|---|
| پیدا کردن خدمت | ✅ enabled, `router.push("/services")` |
| اعتبار من | ✅ enabled, `router.push("/credit")` |
| اقساط من | ✅ enabled, `router.push("/installments")` |
| افزایش موجودی | ✅ `disabled`, `aria-label="افزایش موجودی — به‌زودی"` |

Exactly matches this stage's stated rules — Services/Credit/Installments
functional (their backends exist), wallet top-up blocked (no backend,
per `docs/wallet-ui-contract.md`'s BLOCKED finding), disabled + "به‌زودی," no fake flow.

### 6. Brand Introduction
Extracted the live DOM text this session and diffed against the exact
copy this stage specified — **byte-for-byte match**:
```
باشگاه هوشمند تجربه‌های ارزشمند
بیاوین

راهی ساده‌تر برای خریدهای بزرگ اقساطی، دریافت اعتبار و استفاده از خدمات منتخب.
```

### 7. Categories Section
- Two-column ticker (`قدرت اعتبار در باشگاه`), 16 category names split
  8/8 across up/down columns — matches `.credit-power-section` exactly.
- **Animation genuinely running**: checked `getComputedStyle` on the live
  page — `animationName: "biawinTickerUp"`, `animationPlayState: "running"`,
  not just present in CSS but actually animating.
- RTL, responsive grid (`minmax(134px,.82fr) minmax(0,1.18fr)`) — matches.
- "مشاهده همه خدمات" is a real link to `/services` (verified via
  `window.location.href` after a dispatched click) — not a dead button.
- Ticker items themselves are non-interactive (fixed this stage's
  predecessor — see §1).

### 8. Service Banner / Mosaic / Membership / News
All four verified structurally + for real navigation — full real/mock
classification in §5.

### 9. Global Regression Check
All 9 required routes re-verified this session, both locally and on
staging (see §7): `/`, `/home`, `/wallet`, `/credit`, `/installments`,
`/services`, `/services/[categoryId]` (deep-linked with a real id, both
locally and on staging), `/profile`, `/rewards`. Header/nav consistent
on every page. **AuthGuard genuinely tested this session** — cleared
`localStorage` and confirmed `/wallet` redirects an unauthenticated
visitor to `/`, not just re-read from a prior code review. Zero console
errors on any page (the few 401s seen mid-session were the
already-documented silent-refresh-then-retry pattern, confirmed stale by
re-checking in a fresh tab each time — not real errors).

### 10. Responsive Matrix
All 9 required widths checked this session — **360, 375, 390, 430, 768,
1024, 1366, 1440, 1920** — zero horizontal overflow at every one, both
on local dev and, after deployment, on the live staging URL at 375px
and 1920px. Desktop widths correctly cap `<main>` at exactly 760px,
centered.

---

## 4. Remaining Differences

**Screenshot-based visual diff not performed** — disclosed in both this
report and the prior stage's, not silently skipped. The Browser pane's
screenshot capability returned `"the Browser pane is not displayed"` on
every attempt across both stages. Compensating verification used instead:
every color/spacing/radius/gradient value in every new component was
copied directly from the prototype's own extracted CSS (not estimated),
and every section's content/order/interactivity was verified structurally
and behaviorally, live, both locally and on staging. This is a real,
acknowledged gap in verification *method*, not a known visual defect —
if a screenshot tool becomes available, running that diff is the
recommended next check, but nothing found during structural/behavioral
QA this session suggests it would surface a problem.

No other differences were found.

---

## 5. Mock Data Inventory

| Section | Data source | Detail |
|---|---|---|
| Stories (8 bubbles) | **MOCK** | `home.mock.ts` `HOME_STORIES` — static topic/title list, verbatim prototype copy |
| Biawin Cards Carousel (3 cards) | **MOCK** | Hardcoded in `BiawinCardsCarousel.tsx` — prototype's own demo card numbers/copy, not real financial products |
| Categories ticker (16 names) | **MOCK** | `home.mock.ts` `CATEGORY_TICKER_UP/DOWN` + emoji icon map |
| News carousel (8 articles) | **MOCK** | `home.mock.ts` `NEWS_ARTICLES` — verbatim prototype copy |
| Membership tier circles (8) | **REAL** | `GET /subscriptions` + `GET /membership` via `useMembershipSummary` — real `MembershipPlanDto.tier` data |
| Service banner grid (5 tiles) | **REAL** | `GET /categories` via `useCategories`, matched by name to real seeded rows, links to real `/services/[categoryId]` |
| Service mosaic (4 tiles) | **REAL** | Same `useCategories` data, same real-category-by-name matching |
| App Guide content | **N/A** | No content exists at all — button is `disabled` |
| Search results | **N/A** | No backend endpoint exists — input is `disabled` |

## 6. Future CMS/API Requirements

Consolidated from this review and the prior stage's report — nothing new
found, restated here for the freeze record:

1. **Intro story content** (the 8 `HomeStories` bubbles) needs a real
   story-viewer backend + content model to become interactive — currently
   `disabled`, matching the prototype's own note that this is a UI mock.
2. **`imageUrl` resolution for `Category.imageKey`** — `OrbitItem`
   already has this pattern (`docs/services-ui-contract.md` §6 Gap #3);
   `Category`/`Service`/`Merchant` don't yet. Once it exists, every
   emoji/icon placeholder in `ServiceBannerGrid`, `ServiceMosaic`, and
   `CategoriesSection` should swap to real photos.
3. **Search endpoint** — `GET /services?q=` doesn't exist
   (`docs/services-ui-contract.md` §6, already MISSING) — blocks the
   header's search box.
4. **App Guide content model** — nothing exists; needs a product
   decision on what the guide actually contains before any backend work.
5. **`NewsArticle` model** — doesn't exist in the schema at all
   (`docs/prototype-to-production-mapping.md` P2 item) — blocks
   `NewsCarousel` becoming real.
6. **Wallet top-up (`POST /wallet/topup` + gateway callback)** — doesn't
   exist (`docs/wallet-ui-contract.md` BLOCKED finding) — blocks
   "افزایش موجودی."

None of these are new findings — every one was already documented in an
earlier contract or the migration report. Restated here so the freeze
record is self-contained.

---

## 7. Deployment Verification

Per this stage's explicit requirement — Home is not declared FINAL
without all five of these:

| Step | Status |
|---|---|
| Local validation (`tsc`, `eslint`, `next build`) | ✅ Clean — 0 errors, 1 pre-existing unrelated warning (`OrbitBubble.tsx`, not touched this stage) |
| Commit | ✅ `e272e1b` — "feat(web): pixel-perfect Home screen migration + shared header/nav restyle" |
| Push | ✅ `origin/main` advanced `59a33ce..e272e1b` |
| Staging deployment | ✅ `deploy.sh` completed all 6 steps — images built, migrations applied (none pending), seed re-ran clean, containers cut over, health check passed on the first attempt |
| Live staging verification | ✅ See below |

### Live verification detail (this session, against `staging.biawin.ir`)

- All 8 routes return `200`: `/`, `/home`, `/wallet`, `/credit`,
  `/installments`, `/services`, `/profile`, `/rewards`.
- Backend health: `{"status":"ok"}` on `api-staging.biawin.ir`.
- Logged in against the live staging backend (real OTP request/verify,
  `STAGING_TEST_AUTH` bypass) — not reusing a local session.
- `/home` renders the full pixel-perfect migration on staging — every
  section (stories, cards, quick actions, brand intro, categories
  ticker, banners, membership tiers with real data, mosaic, news) —
  confirmed via live DOM text extraction, not assumed from the deploy
  log.
- `/wallet` confirmed showing the identical shared header/nav as Home,
  clean console.
- `/credit`, `/installments`, `/services` all confirmed clean console.
- A real category deep link tested live on staging (`اتومبیل` →
  `/services/47ce171f-c1a9-421a-b607-6cbcb1c0ca99`) — genuine navigation
  with a real category id from the staging database, not local dev's.
- Responsive: 375px and 1920px both checked live on staging — zero
  overflow, `<main>` capped at exactly 760px at 1920px.
- Fresh-tab re-checks used throughout to rule out the known stale-console
  artifact (documented since Stage 4.1) — every "error" seen was
  confirmed either a one-time refresh-retry or gone entirely in a new tab.

---

## Home Prototype v1 — **FINAL**

All 10 review sections passed. The one disclosed gap (§4) is a
verification-method limitation (no screenshot tool available), not a
known defect — every value was still verified against the prototype's
own source, just via computed styles and structural checks rather than
a pixel image diff. The full release flow completed and was verified
end-to-end: committed (`e272e1b`), pushed, deployed, and live on
`staging.biawin.ir` — not just passing in local development.

**Home is declared FINAL**, per this stage's condition that FINAL only
applies once local validation, commit, push, staging deployment, and
live staging verification have all completed. Recommended follow-up
(not blocking FINAL): run a real screenshot-based diff once the Browser
pane's screenshot capability is available, and track the 6 CMS/API
items in §6 as their own future stages.
