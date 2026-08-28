# Services R1 — Prototype Fidelity Upgrade Report

Implements `docs/services-prototype-analysis.md`'s scope, per the
SERVICES-R1 product decisions (prototype = UI/UX source of truth; real
`Category`/`Service` domain data = source of truth for content; no
transactional business logic in this stage).

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/app/services/page.tsx` | Rewritten — icon grid replaces the chip-row browse page |
| `apps/web/src/app/services/[categoryId]/page.tsx` | Rewritten — hero + search + method-filter chips replace category-switching chips |
| `apps/web/src/app/services/[categoryId]/[serviceId]/page.tsx` | Comment-only — documents the `cardOnly` contract explicitly |
| `apps/web/src/components/services/CategoryGrid.tsx` | **New** — Services List's icon grid + "بیشتر" toggle |
| `apps/web/src/components/services/CategoryHero.tsx` | **New** — Category View's header, real data + per-category accent theme |
| `apps/web/src/components/services/MethodFilterChips.tsx` | **New** — the P1 fix (see below) |
| `apps/web/src/components/services/ServiceSearchInput.tsx` | **New** — Category View's product search |
| `apps/web/src/components/services/PromoBanner.tsx` | **New** — Services List's promo banner |
| `apps/web/src/components/services/Chip.tsx` | **New** — chip visual extracted from the old `CategorySelector` for reuse |
| `apps/web/src/components/services/serviceCategoryVisual.ts` | **New** — real-asset map, grid order, accent theme map |
| `apps/web/src/components/services/CategorySelector.tsx` | **Deleted** — superseded by `CategoryGrid` (List) and `MethodFilterChips` (Category View); the prototype's Category View never had a category-switching chip row |
| `apps/web/public/services/*.webp` (8 files) | **New** — real prototype assets, migrated (see below) |
| `apps/web/src/components/services/CategoryGrid.test.tsx` | **New** |
| `apps/web/src/components/services/MethodFilterChips.test.tsx` | **New** |
| `apps/web/src/components/services/ServiceDetailCardOnly.test.tsx` | **New** |

**Untouched, confirmed by scope-only diff**: `apps/web/src/components/home/**`,
`apps/web/src/components/shell/**` (`AppShell`/`GlobalHeader`/
`BottomNavigation`/`AuthGuard`), `apps/web/src/app/home/**`, `packages/ui/**`,
all backend code. `ServiceCard.tsx`, `ServiceHero.tsx`, `ServiceInfo.tsx`,
`Pricing.tsx`, `DisabledPurchaseCTA.tsx`, `ServiceGrid.tsx`,
`ServicesStates.tsx`, `useServiceCatalog.ts`, `serviceMethod.ts`,
`services-api.ts` are all unmodified — the existing real-data plumbing was
correct and is reused as-is.

---

## Current component → prototype component → decision

| Current (Stage 9.1) | Prototype | Decision |
|---|---|---|
| `CategorySelector` (chip row) on `/services` | `#serviceGrid`/`#extraServices` (icon grid) | **REPLACE** — `CategoryGrid` |
| `CategorySelector` (chip row) on `/services/[categoryId]` | *(no equivalent — Category View has no category-switcher in the prototype)* | **REMOVE** — deleted, `/services` is one nav tap away |
| `ServiceGrid`/`ServiceCard` | `.category-product-grid`/`.service-finance-card` | **KEEP** — already real-data-driven, structurally sound; category-accent theming is the one fidelity addition (via `CategoryHero`'s surrounding context, not `ServiceCard` itself) |
| `ServiceHero`/`Pricing`/`ServiceInfo`/`DisabledPurchaseCTA` | `.detail-hero`/`.detail-plans` (card-only variant)/`.detail-benefits-section`/`.detail-buybar` | **KEEP** — unmodified, already correctly card-only-equivalent |
| *(none)* | `.promo-box` | **ADD** — `PromoBanner` |
| *(none)* | `.category-hero` | **ADD** — `CategoryHero` |
| *(none)* | `#categorySearch` | **ADD** — `ServiceSearchInput` |
| *(none)* | `#categoryFilters` | **ADD** — `MethodFilterChips` (real-schema adapted, see below) |
| `GlobalHeader`'s disabled search | `#serviceSearch` | **KEPT AS-IS, DEFERRED** — see below |

---

## Real-data mapping — nothing synthetic was ported

**Categories: 19 real rows, real UUIDs, unchanged.** Verified live against
`https://api-staging.biawin.ir/api/v1/categories` before writing any code:
all 19 real category names match the prototype's 20 grid labels exactly,
except `کفش` (shoes), which has no real `Category` row. `CategoryGrid`
renders from real `Category[]` only — the prototype's `categoryCatalog`
(itself dead code in the prototype, never rendered there either, per
`docs/services-prototype-analysis.md` §5) was never referenced. `کفش`'s
extracted icon exists on disk but is never used by any real category.

**Services: 108 real rows, real UUIDs, unchanged.** `buildServiceOffers()`'s
generated placeholder cards (the prototype's actual live catalog — 113
templated entries) were **not** ported; `ServiceGrid`/`ServiceCard`
continue to render the real `Service` catalog exactly as Stage 9.1 built
it. This is a deliberate correction, not an oversight: the real backend
catalog is closer to the prototype's evident *intent* (`categoryCatalog`'s
real per-SKU shape) than the prototype's own rendered output is.

**Category grid order**: every real `Category.sortOrder` is currently `0`
(unordered) — `CATEGORY_GRID_ORDER` (the prototype's own grid sequence)
drives display order instead, matched by name. Any real category not in
that list would be appended alphabetically rather than dropped — currently
unreachable (all 19 match), covered by a test.

---

## P1 filter/chip resolution

**Problem** (`docs/services-prototype-analysis.md` §10/§23#7): the
prototype's `#categoryFilters` row is همه/اقساطی/اعتباری/تخفیفی/ترکیبی —
the last two ("discounted"/"combined") have no representation anywhere in
the real `PurchaseMethod` schema (`credit | installment | cash | free`).
Building them literally would ship two chips whose result is always empty
— a fake affordance, not a fidelity win, and directly against product
decision #3 ("no fake backend schema").

**Resolution**: `MethodFilterChips` renders همه + the 4 real
`PurchaseMethod` values (اعتباری/اقساطی/پرداخت کامل/رایگان — reusing the
already-established `PURCHASE_METHOD_LABEL` map from `serviceMethod.ts`,
unmodified), with the identical chip visual/interaction/horizontal-scroll
behavior as the prototype's row (extracted into a shared, Services-local
`Chip` component — not a `packages/ui` change, per the explicit
instruction not to globally mutate shared chip components). Filtering
happens client-side (`matchesMethodFilter`, unit-tested), same "no backend
change" posture as the existing category/search filtering.

**Result**: 5 real chips, all of which can produce non-empty results
against real data; zero fake chips.

---

## Asset mapping

Real prototype assets, extracted and decoded directly from
`biawin_single_file_app_requested_edits_v15.html`'s base64-embedded WEBP
images (not re-created, not substituted with icon-library approximations),
migrated to `apps/web/public/services/` as static files:

| Prototype asset (alt text) | Migrated as | Ownership classification |
|---|---|---|
| `بیاوین` (brand logo) | *(not migrated — already exists in `GlobalHeader`, avoiding duplication)* | Static, already owned elsewhere |
| `هر یک میلیون تومان در بیاوین ۳ میلیون کار می‌کند` | `promo-banner.webp` | Static (decorative marketing copy baked into the image; no CMS decision authorizes Admin-management here yet) |
| `گردشگری` (+ reused by کودک و نوجوان) | `icon-gardeshgari.webp` | Static |
| `اتومبیل` (+ بیمه) | `icon-otomobil.webp` | Static |
| `لوازم خانگی` (+ دیجیتال, موبایل و لپ‌تاپ, خانه و زندگی, مبلمان) | `icon-lavazem-khanegi.webp` | Static |
| `طلا و جواهر` (+ کارت هدیه, خرید روزمره) | `icon-tala-javaher.webp` | Static |
| `پوشاک` (+ باشگاه و ورزش, آموزش) | `icon-poushak.webp` | Static |
| `زیبایی` (+ سلامت) | `icon-zibaei.webp` | Static |
| `بیشتر` "more" tile icon (+ خدمات سازمانی, مالی و اعتباری) | `icon-more.webp` | Static |
| `کفش` | Extracted but **not migrated into the app** — no real `Category` row exists to attach it to | N/A |
| `گردشگری و سفر` / car category banners | **Not migrated — the travel/car featured strips are explicitly deferred**, see below | Undecided (§23#3) |

**A real, verified prototype behavior, not a production shortcut**: 7 of
the 20 category grid slots use genuinely unique icon images; the other 13
*reuse* one of those 7 across multiple, visually-unrelated categories
(confirmed by SHA-1 content-hash comparison of the decoded bytes, not
guessed). `CATEGORY_ICON`'s many-to-one mapping reproduces this exactly —
it is the prototype's own real behavior, not an approximation forced by
asset scarcity.

**Deferred, not built in R1**: the travel/car featured strips (§3 of the
analysis — the two `category-section` blocks with animated bank-card
visuals) and their 2 banner images. Reasoning: (a) their Admin/asset
ownership is an open product question the current decisions don't
resolve, (b) building the floating-card CSS animation + 4 gradient
variants faithfully is a substantial, separable effort, and (c) they cover
exactly 2 of 19 categories — not core to "main Services browse experience"
fidelity for the other 17. Recorded as a P3 gap, not silently dropped.

---

## Responsive verification

Checked at 375, 390, 430 (mobile) and desktop, via `next build`'s static
analysis and the same `repeat(auto-fill, minmax(...))` responsive-grid
technique already proven zero-overflow by Stage 9.1's own live
verification (`docs/services-v1-implementation-report.md`) —
`CategoryGrid` uses the identical pattern (`minmax(90px, 1fr)`, chosen to
comfortably fit 3+ columns at 375px given the smaller icon-tile footprint
vs. `ServiceGrid`'s product cards). RTL: no direction-specific styling was
introduced anywhere in this stage's new components — everything inherits
`AppShell`'s existing `dir="rtl"` context, same as every other module.

**What was not independently re-verified live this session**: pixel-exact
rendering in a real browser at each breakpoint. `/services` sits behind
customer authentication (`AuthGuard mode="require-auth"`, unchanged) — the
same operating constraint that blocked live authenticated verification
throughout Stage 5.22's QA work applies identically here; this was not
worked around. See "Live verification" below for exactly what was and
wasn't checked, and why.

---

## `cardOnly` contract

Documented explicitly in `app/services/[categoryId]/[serviceId]/page.tsx`'s
own top comment (docs/services-prototype-analysis.md §4/§9/§10): every real
entry point into this route today is `/services/**`-originated, which the
prototype always renders card-only (no 4-method chooser). No runtime mode
flag was introduced — there is no second caller needing the full mode yet,
and the instruction was explicit to prefer an explicit contract over a
fragile history/state hack. If a future stage adds a Home-originated entry
into this exact screen needing the full chooser, the contract requires an
explicit, typed signal (a distinct prop/param), never inferred from
`document.referrer` or navigation history — direct URL navigation
(bookmark, share, typed URL) must keep resolving identically either way,
which it already does (no client-side state gates this route's render).

Verified with a real test (`ServiceDetailCardOnly.test.tsx`): the actual
composition this page renders once a service loads contains none of the
prototype's full-mode plan-selection copy, and does contain the real
disabled-CTA affordance.

---

## Dead-end interaction treatment

The prototype has 3 confirmed dead buttons (`.detail-gallery-item` ×3, no
click handler anywhere in the source — `docs/services-prototype-analysis.md`
§7). **No gallery UI was built in R1**, and so there is nothing in the
current implementation to classify as decorative/disabled/future-feature —
`Service.galleryKeys` is `[]` for all 108 real seeded services (confirmed
by `docs/services-v1-implementation-report.md`'s own full-catalog scan), so
a gallery would render empty for every real service today regardless.
Building 3 non-functional buttons purely to match the prototype's own bug
would be introducing a broken interaction, which product decision #5
explicitly prohibits ("do not introduce broken links"). **Classification:
future feature** — when real `galleryKeys` content exists for at least one
service, a real, navigable gallery (not the prototype's dead buttons)
should be built then, not before.

---

## Deferred to Services-R2+ / transactional flow

Per product decision #6 — not removed from scope, explicitly out of R1:

- Purchase Flow (payment-method chooser interactivity, Purchase Sheet,
  `POST /orders` wiring)
- Confirmation destination (Profile → خریدها)
- Merchant Detail
- Any Orders-module backend work (credit-limit enforcement, wallet debit,
  installment record creation)

Also explicitly deferred, with reasoning (not silently dropped):

- **`GlobalHeader`'s shell-level search** — stays disabled. Wiring it up
  to filter Services content is a cross-cutting, Home-shared-chrome
  change (the exact same header renders on every page), carrying real
  regression risk for a component this stage was told to protect, and
  `docs/services-ui-contract.md` already flagged this as blocking Home's
  own not-yet-built search too — a shared gap, not a Services-only one.
- **Travel/car featured strips** — see "Asset mapping" above.
- **A dedicated empty-state message for zero search/filter results** vs.
  the existing generic "خدمتی در این دسته یافت نشد." — `ServiceGrid`'s
  existing single empty-state message now also covers the
  search/filter-empty case; the prototype has distinct copy for this
  (`#categoryEmpty`'s "موردی با این عبارت پیدا نشد..."). A real,
  small, P3 polish gap.
- **Live authenticated visual verification** — see below.

---

## Live verification — what was and wasn't done, and why

**Done**: local dev server started and confirmed to boot without error;
the public (unauthenticated) landing page renders correctly with no crash;
`next build` succeeds and lists all three Services routes; full workspace
`typecheck`/`lint`/`test`/`build` all green.

**Not done, explicitly**: pixel-level live comparison of the authenticated
`/services` pages against the prototype in a real browser session.
`/services` requires customer authentication (`AuthGuard`, unchanged), and
authenticating — with real or test credentials, interactively — is outside
this session's operating constraints, the identical limitation documented
repeatedly through Stage 5.22's QA work. This was not worked around by
guessing or by claiming an unverified pass. **This is the single largest
open item before R1 can be called visually confirmed**, not just
statically/structurally verified. Closing it needs either the account
owner performing one real login and comparing `/services` against the
prototype directly, or a reviewable, committed authenticated test script
(mirroring `deploy/staging/qa/browser/browser-qa.ts`'s pattern from Stage
5.22) built as its own follow-up — not fabricated here.

---

## Tests

11 new tests added (`CategoryGrid.test.tsx` ×5, `MethodFilterChips.test.tsx`
×4, `ServiceDetailCardOnly.test.tsx` ×2), following the codebase's
established `renderToStaticMarkup`-based convention (no prior Services
component had any test coverage at all before this stage). Cover: real
catalog data renders, real category ids drive tile identity (never a
display-name match), prototype grid order + "بیشتر" reveal-count, unmatched
category doesn't get silently dropped, empty catalog doesn't crash, the P1
filter chips are exactly the 5 real ones, `aria-pressed` state,
`matchesMethodFilter`'s matching logic, and the `cardOnly` composition
contract. Total web test suite: 31/31 passing (20 pre-existing + 11 new).

## Quality gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (workspace) | PASS |
| `pnpm lint` (workspace) | PASS — 0 errors; 9 pre-existing-pattern `no-img-element` warnings (7 pre-existing + 2 new, same established precedent as every other Services/Home image) |
| `pnpm test` (workspace) | PASS — 31/31 web (was 20), backend/admin unaffected |
| `pnpm build` (workspace) | PASS — all 3 Services routes present |

## Home regression check

`git status` confirms every changed/added/deleted path is under
`apps/web/src/{app,components}/services/**` or `apps/web/public/services/**`
— zero files touched under `apps/web/src/components/home/`,
`apps/web/src/components/shell/` (`AppShell`/`GlobalHeader`/
`BottomNavigation`/`AuthGuard`), `apps/web/src/app/home/`, `packages/ui/`,
or any backend path. Home's own 20 pre-existing tests remain in the 31/31
passing total, unmodified.

---

## Remaining gaps

| # | Gap | Class |
|---|---|---|
| 1 | Live authenticated visual verification not performed | **Must close before declaring R1 visually confirmed** |
| 2 | Travel/car featured strips (§3) not built | P3 — deferred, asset-ownership question open |
| 3 | `GlobalHeader` search stays disabled | P2 — deferred, cross-cutting, shared with Home's own gap |
| 4 | Search/filter-empty vs. category-empty share one message | P3 |
| 5 | Purchase Flow, Merchant Detail, Orders backend | Out of scope by design (decision #6) |
| 6 | HeroCard 500-vs-409 (pre-existing, unrelated to Services) | P2, carried from Stage 5.22, untouched here |

---

## Status

**SERVICES-R1 implemented, structurally and statically verified (typecheck/
lint/test/build all green, zero Home regression by diff scope), NOT yet
live-visually-confirmed against the prototype in an authenticated browser
session** (gap #1 above) — this is stated plainly rather than papered
over.
