# Services Prototype Analysis & Full Implementation Contract

**Analysis-only. No implementation, no component code, no backend changes,
no Admin changes were made to produce this document.**

---

## 1. Executive Summary — read this first, it changes the shape of everything below

**Services is not a blank slate.** A real, live, backend-data-driven browse
experience already exists in production code and is deployed on staging
right now: `/services` → `/services/[categoryId]` → `/services/[categoryId]/[serviceId]`,
built against real `Category`/`Service` domain models (19 categories, 108
services, seeded), with client-side active-filtering, category chips, a
service grid, and a full service-detail page. The bottom nav's own code
comment confirms it: *"`services` is `'available'` now that Stage 9.1
shipped a real browse experience."* This was done under a prior body of
work — `docs/services-ui-contract.md` ("Stage 9.0") and
`docs/services-v1-implementation-report.md` ("Stage 9.1") — that this
document builds on and reconciles with, rather than duplicates.

**What genuinely does not exist yet**, confirmed by both the prior
contract and a fresh, direct read of the raw prototype source this stage
performed: the **Purchase Flow** (payment-method selection → confirm sheet
→ order), and **Merchant Detail**. Both are deliberately unbuilt, not
overlooked — the prior contract found that `POST /orders` creates an inert
`pending` row and does nothing else (no wallet debit, no credit-limit
enforcement, no installment record), and shipping a live "buy" button
against that would present a non-functional flow as if it worked. That
finding is re-confirmed current in this stage (§9, §13).

**A second load-bearing finding, new to this stage**: the prototype's
purchase-method chooser is gated by a previously-undocumented mode flag,
not by product data. Every path that actually starts from the Services tab
(`services` → category → detail) opens Service Detail in **"card-only"
mode**, which hides the 4-method chooser and gallery entirely and shows a
single pre-selected "card" instead. The 4-method chooser only appears when
Service Detail is opened directly from **Home** (category tiles, credit
service items, "more" links) — a different entry point, out of this
document's scope, already noted as such by the prior contract. This
materially changes what "Service Detail" means depending on where the user
came from, and neither prior doc surfaced it. See §2, §6, §16.

**The numbering this document's own request proposes (Stage 6.0–6.8)
collides with an already-used numbering track.** `docs/services-ui-contract.md`
references "Wallet (Stage 6.0)," "Credit (Stage 7.0)," "Installment (Stage
8.0)" as already-completed prior stages, and Services itself as "Stage
9.0/9.1." This is a different numbering sequence than the Home CMS track
this engagement has otherwise used (Stage 5.x). Reusing "Stage 6.0" for
Services would collide with the existing Wallet stage. **Flagged as the
top open question (§23) — this document does not silently renumber
around it.**

**Bottom line for phasing (§21)**: the actual remaining work is narrower
than a full from-scratch Services build. Sections 2–20 below are still a
complete, rigorous accounting (full screen inventory, content inventory,
asset inventory, interaction graph, gap matrix, etc.) — but the honest
scope of *new* work is: (a) close two real prototype-fidelity gaps in the
already-shipped browse experience (the category-accent theming and the
`cardOnly` entry-point distinction), (b) build the Purchase Flow once the
already-known Orders-module backend gap is closed (a backend-first
sequencing question, not a frontend one), and (c) decide whether Merchant
Detail is worth building at all given zero real data exists for it.

---

## 2. Prototype source

`biawin_single_file_app_requested_edits_v15.html` — the exact file named
in the task, located outside the repository at
`C:\Users\Mehrdad\Desktop\New folder\biawin_single_file_app_requested_edits_v15.html`
(26.0MB, 14,358 lines, base64-embedded images). Read directly this stage
(not re-derived from a prior summary) via a base64-stripped working copy
that truncates only embedded image *data* — no markup, CSS, or JS was
altered for analysis. A newer file, `biawin_single_file_app_requested_edits_v16_clean.html`
(3 days later, 3.4MB/1,702 lines smaller), also exists in the same folder
— **not used as a source, per the task's explicit instruction to use v15**.
A structural-identifier check (counts only, no content read) found
identical marker counts for the Services flow between the two files,
suggesting the size reduction comes from elsewhere in the prototype, not a
Services rewrite — unverified, flagged as an open question (§23).

**Confirmed via full-file grep: exactly 9 `data-view` sections exist in
the whole prototype** — `landing`, `home`, `card-detail`, `services`,
`service-category`, `service-detail`, `rewards`, `advisor`, `profile`. No
hidden 10th view. Three of these — `services`, `service-category`,
`service-detail` — are the Services flow proper; a 4th, `purchaseSheet`,
is a global overlay (not a `data-view`) reachable only from `service-detail`.

---

## 3. Main Services page anatomy (`data-view="services"`)

Top to bottom, exact structure (full detail in the raw prototype-mining
report this stage produced; summarized here with every real value
preserved):

1. **Header** (shared shell chrome, same as Home) — brand logo (`<img>`,
   base64 WEBP, ~3.4KB), search box (`<input id="serviceSearch"
   placeholder="جستجو بین خدمات بیاوین...">`).
2. **Promo banner** — one full-width `<img>` (base64 WEBP, ~43KB), alt
   text `"هر یک میلیون تومان در بیاوین ۳ میلیون کار می‌کند"`. Purely
   decorative/promotional, no click handler.
3. **Category grid (`#serviceGrid`)** — 12 tappable `.service-card`
   buttons in view by default (round thumb image + label under it), plus
   one `.more-tile` toggle button (`#moreToggle`, label "بیشتر"/"کمتر").
4. **Extra category grid (`#extraServices`)** — 8 more `.service-card`
   buttons, `display:none` until `#moreToggle` is tapped, then
   `display:grid`.
5. **Two featured category strips** — `#travelSection` (گردشگری) and
   `#carSection` (اتومبیل) **only** — each: a full-bleed category banner
   image + copy, then a horizontally-scrollable `product-track` of 4
   static "bank card" visuals (installment/credit/discount/mixed
   variants). **No other of the 20 categories has this strip.**

**Visual system, exact values (from the mined CSS):**
- Category grid card: `border-radius:24px`, `min-height:138px`, `border:1px solid #dbeafb`, `box-shadow:var(--shadow-sm)`.
- Round thumb: 64×64px, `border-radius:50%`, `border:4px solid #edf7ff`, `box-shadow:0 8px 20px rgba(8,121,220,.13)`.
- Label: `font-size:11px`, `font-weight:700`, `color:#214866`.
- Horizontal carousel (`product-track`): `overflow-x:auto`, `scroll-snap-type:x proximity`, cards `flex:0 0 210px`.
- "Floating card" animation (`biawinFinanceFloat`, 4.8s ease-in-out, staggered per `nth-child`) applied to both the travel/car featured cards on this page **and** the category-page product cards (§4) — a deliberate, repeated motif, not a one-off.

**Confirmed prototype defect, not to be reproduced**: the `<h4>انواع
کارت‌های گردشگری</h4>` / `<h4>انواع کارت‌های اتومبیل</h4>` headings above
each featured strip are present in markup but permanently hidden by a CSS
rule (`.page-services .slider-head > div:first-child{display:none!important}`)
that nothing later un-hides. Verified in both the travel and car sections
identically. **This is a prototype bug, not an intentional hidden state —
flag in §23, do not silently omit the heading from a future build without
a product decision on whether it should actually be visible.**

RTL/mobile: standard app-shell RTL, horizontal scroll begins from the
right (native RTL scroll direction, no custom JS override found for these
carousels).

---

## 4. Complete screen/state inventory

| # | Name | Prototype id | Type | Entry point(s) | Exit/back | Currently implemented (Next.js)? | Backend data? | Admin CMS likely? |
|---|---|---|---|---|---|---|---|---|
| 1 | Services List | `data-view="services"` | ROUTE | Bottom nav "خدمات" | n/a (tab root) | ✅ `/services` | ✅ `GET /categories` (real) | Partial — see §12 |
| 2 | Category View | `data-view="service-category"` | ROUTE | Services List (tap category tile) · Home (4 entry points, `sourceView:'home'`) | Back → `sourceView` (Services or **Home**, entry-point-dependent) | ✅ `/services/[categoryId]` | ✅ `GET /services` (client-filtered) | See §12 — prototype's real driver is generated, not seeded |
| 3 | Service Detail — **card-only mode** | `data-view="service-detail"` + `cardOnly:true` | ROUTE (same URL, different render) | Category View (tap product card) · Services List (tap travel/car featured card) | Back → `sourceView` | ✅ `/services/[categoryId]/[serviceId]` (browse fields only — no card-only/full-mode distinction exists in current code, see §9 gap) | ✅ `GET /services/:id` | See §12 |
| 4 | Service Detail — **full mode** | `data-view="service-detail"` + `cardOnly:false` | ROUTE (same URL, different render) | **Home only** (category tiles, credit-service items, "more" links) — not reachable from the Services tab flow at all | Back → `sourceView` (Home) | Not distinguished in current code (§9) | ✅ `GET /services/:id` | Out of this document's scope — a Home entry point |
| 5 | Purchase Sheet | `#purchaseSheet` | MODAL (bottom sheet) | Service Detail's sticky buy bar | Close ×, Cancel, backdrop tap — all equivalent | ❌ Not built (deliberately — `DisabledPurchaseCTA` instead) | Would need `POST /orders`, blocked (§13) | No |
| 6 | Purchase confirm toast | `#detailToast` | INLINE STATE (toast) | Purchase Sheet's confirm button | Auto-hides 2600ms | ❌ N/A until Purchase Sheet exists | n/a | No |
| 7 | FAQ accordion item | `.detail-faq-item` | INLINE STATE | Tap question | Tap again (native `<details>`-style toggle in current code, `.open` class toggle in prototype) | ✅ (current code uses `<details>`/`<summary>`, prototype uses a custom `.open` toggle — same visual effect) | n/a | n/a |
| 8 | Category search filter | `#categorySearch` input | INLINE STATE | Category View | n/a | ❌ Not built — current `/services/[categoryId]` has no search input | n/a | n/a |
| 9 | Services List search filter | `#serviceSearch` input | INLINE STATE | Services List | n/a | ❌ Not built | n/a | n/a |
| 10 | Category filter chips (همه/اقساطی/اعتباری/تخفیفی/ترکیبی) | `#categoryFilters` | TAB STATE | Category View | n/a | ❌ Not built (current `CategorySelector` is a *category* chip row, a different concept — see §9) | Schema mismatch — 2 of 5 values have no backing field (§9, carried from the prior contract) | n/a |
| 11 | Empty state (search/filter, zero results) | `#categoryEmpty` | EMPTY STATE | Category View, after search/filter | n/a | ✅ `ServicesEmptyState` exists for the zero-active-services case, not specifically for search/filter (neither exists yet) | n/a | n/a |
| 12 | Loading state | *(prototype has none — everything is synchronous DOM manipulation)* | LOADING STATE | — | — | ✅ **Production addition, not prototype-derived** — `SkeletonBlock` × grid, already built | n/a | n/a |
| 13 | Error state | *(prototype has none)* | ERROR STATE | — | — | ✅ **Production addition** — `ServicesErrorState`, inline red text on Service Detail | n/a | n/a |
| 14 | Merchant Detail | *(does not exist in the prototype at all)* | — | — | — | ❌ Not built, not in prototype | Backend model exists, 0 rows | See §12 — likely never, no prototype precedent |

**Distinguishing note per the task's own instruction**: rows 3 and 4 are
the *same* prototype view and the *same* proposed production route,
differentiated only by a runtime mode flag carried in state, not by a
separate URL or component — correctly modeled as one ROUTE with two
render states, not two routes.

---

## 5. Content inventory — exact prototype copy, two genuinely different data sources

**Critical finding: the prototype has two competing "catalog" data
structures, and only one of them is what a user actually sees.**

### `categoryCatalog` — defined, but dead code

A JS object with real, specific product names (کارت‌های واقعی — تور کیش,
فیدلیتی پرایم, انگشتر طلا, یخچال و فریزر, etc.), 19 category keys, 108
total entries, each shaped `{title, group, badge, subtitle, price, icon}`
(icon = a plain Unicode emoji, e.g. `✈`, `🚙`, `📺`, `💍`). **Confirmed by
grep: this object is never read anywhere else in the entire file.** It
looks like an earlier, more product-realistic content pass that was
superseded but never removed. **Do not treat `categoryCatalog`'s specific
product names as the live prototype content** — they were never rendered
to a real user in this prototype version. They ARE useful as evidence of
the *intended* shape of a real catalog (title/group/badge/subtitle/price
per SKU), which happens to already match `backend`'s real `Service` model
almost exactly (§13).

### `buildServiceOffers(categoryName)` — what actually renders

A generator function that synthesizes **6 generic financial-card entries
per category** by string-templating the category name — not real, distinct
products:

```
کارت اقساطی {category}          — type: اقساطی / kind: installment
کارت اقساطی پلاس {category}     — type: اقساطی / kind: installment (higher limit)
کارت اعتباری {category}         — type: اعتباری / kind: credit
کارت اعتباری ویژه {category}    — type: اعتباری / kind: credit (higher limit)
کارت تخفیفی {category}          — type: تخفیفی / kind: discount
کارت ترکیبی {category}          — type: ترکیبی / kind: mixed
```

Per-category spend limits come from a separate `serviceOfferLimits` table
(19 keys, e.g. `'گردشگری': ['۳۰ میلیون', '۱۲۰ میلیون']`,
`'اتومبیل': ['۳۰۰ میلیون', '۱ میلیارد و ۵۰۰ میلیون']`).

**پوشاک and کفش are hardcoded special cases** — 3 and 2 items
respectively, each with a real full-bleed poster image (`exactPoster:true`)
instead of the generic gradient card visual, e.g. `"کارت اقساطی کفش ۱۰
میلیون تومانی"` — `"خرید کفش با پرداخت منعطف"` — `"اعتبار ۱۰ میلیون
تومانی برای خرید کفش، تا سقف ۵۰٪ تخفیف و پرداخت منعطف."`.

**Total live "product" count across all category pages: 113** (18 generic
categories × 6 = 108, + پوشاک 3 + کفش 2).

**All 20 category grid labels** (12 default + 8 under "بیشتر"), verbatim:
گردشگری، اتومبیل، لوازم خانگی، طلا و جواهر، پوشاک، کفش، زیبایی، بیمه،
دیجیتال، سلامت، باشگاه و ورزش، کارت هدیه، موبایل و لپ‌تاپ، خانه و زندگی،
مبلمان، آموزش، خدمات سازمانی، خرید روزمره، مالی و اعتباری، کودک و نوجوان.

**Per-category description copy** (`serviceCopy`, 20 keys, used as the
Category View header fallback description) exists separately from both
structures above — real, distinct Persian copy per category, not
templated.

**Practical implication for §12/§13**: the *actual* live prototype content
for Category View is synthetic/templated, not a real per-SKU catalog — the
opposite of what the current real backend already has (108 real,
distinctly-named, real-priced `Service` rows, already live on staging).
**The current backend implementation is closer to `categoryCatalog`'s
intended shape than to what the prototype actually renders.** This is a
genuine, positive finding: production should keep using the real `Service`
catalog it already has, not regress toward the prototype's templated
placeholder cards.

---

## 6. Asset inventory

All Services-flow prototype images are `<img>` tags with **inline base64
`data:image/webp;base64,...`** sources — zero external image paths in
these views. No SVG icons for category thumbnails (raster WEBP only);
inline SVGs are used only for chrome (search icon, back/share icons,
bottom-nav icons — already migrated pixel-perfect per `navigation.ts`'s
own comment, §9).

| Prototype asset | Current source | Target app asset | Static or CMS |
|---|---|---|---|
| Brand logo (header) | Prototype base64, ~3.4KB | Already migrated (shared shell chrome) | Static |
| Services promo banner | Prototype base64, ~43KB | **Not migrated** | Static (decorative, no product data attached) or a future Admin-managed banner — no current mechanism |
| 20 category round-thumb icons | Prototype base64, 6.8KB–61.9KB each | **Not migrated** — current `ServiceCard`/category UI shows a **text emoji fallback**, since `Category.imageKey`/`Service.imageKey` have no `imageUrl` resolver yet (already-known backend gap, §13) | CMS-managed once the resolver exists — `Category.imageKey` already exists in the schema for exactly this |
| Travel category banner (`#travelSection`) | Prototype base64, ~140KB | Not migrated | Static or CMS |
| Car category banner (`#carSection`) | Prototype base64, ~123KB | Not migrated | Static or CMS |
| پوشاک/کفش `exactPoster` images (5 total) | Prototype base64, 89–257KB each | Not migrated | These are the closest thing to "real product photography" in the whole flow — worth prioritizing if/when real service images are sourced |
| Service Detail hero/gallery images | **No static source in the prototype at all** — populated at runtime by scavenging whatever image happened to render on the *previous* screen (`getAllDetailImages()` queries `#view-services .service-thumb img, .product-card img, #view-home img`) | N/A — there is no independent asset per generated card to migrate; only the 5 `exactPoster` images (پوشاک/کفش) and the two category banners are real, distinct assets | N/A for the 108 generic cards; CMS-managed for real content once real service photography exists |

**Category-accent color theming (not an image asset, but a real per-category
visual difference worth tracking alongside assets)**: `service-category`
sets 4 distinct accent color triples via `style.setProperty` based on
category name — زیبایی (pink `#d64b8a`/`#a92b67`/`#fff0f7`), گردشگری
(green `#27955b`/`#17643c`/`#eefaf2`), طلا و جواهر (gold
`#b78618`/`#7e5a0b`/`#fff8e7`), اتومبیل (grey `#4d5965`/`#20262c`/`#f0f2f4`),
everything else defaults to blue (`#0879dc`/`#064d91`/`#eef7ff`). **`service-detail`
never varies this — it's hardcoded blue regardless of category, a real
prototype inconsistency, not a deliberate simplification.** Current
production code has neither behavior — flagged as an open design question
in §23, not silently resolved either way here.

**No asset migration to the Media Library is proposed by this document**
— per §12, none of the 20 category icons or 2 category banners have a
clear Admin-ownership story yet (they're currently text-fallback in
production, matching the prototype's own dead-`categoryCatalog`
abandonment of per-category imagery as a maintained concept). This is a
genuine open product question, not a technical one this document can
resolve unilaterally.

---

## 7. Interaction graph

```
Bottom Nav "خدمات"
  ↓
Services List (services)
  ├── #serviceSearch (input)                    → inline filter, no navigation
  ├── .service-card (×12 default, ×8 "extra")    → Category View (sourceView:'services')
  ├── #moreToggle                                 → reveals 8 extra category cards (inline, no nav)
  ├── .slider-btn (×2, travel/car)                → horizontal scroll (inline, no nav)
  └── .product-card (×4 travel, ×4 car)           → Service Detail, card-only mode (sourceView:'services')

Category View (service-category)
  ├── #categoryBack                                → back to sourceView (Services or Home)
  ├── #categoryShare                                → native OS share sheet (dead end — no in-app destination)
  ├── #categorySearch (input)                       → inline filter, no navigation
  ├── .category-filter chips (×5)                   → inline filter, no navigation
  └── .service-finance-card (×6 per category, or 3/2 for پوشاک/کفش) → Service Detail, card-only mode (sourceView:'service-category')

Service Detail — card-only mode (service-detail, cardOnly:true)
  ├── #detailBack                                   → back to sourceView
  ├── #detailShare                                   → native OS share sheet (dead end)
  ├── .detail-faq-question (×3, static)              → inline accordion toggle, no navigation
  ├── .detail-gallery-item (×3)                      → DEAD BUTTONS, no click handler exists anywhere (prototype bug, §16)
  ├── .detail-plan (×4)                              → INERT — explicitly no-op'd in card-only mode (`if (cardOnly) return`)
  └── #detailBuyBtn (sticky buy bar)                 → Purchase Sheet

Purchase Sheet (#purchaseSheet, global overlay)
  ├── #purchaseSheetClose / #purchaseCancel / backdrop tap  → close, no navigation (all 3 equivalent)
  └── #purchaseConfirm                                → close + toast "درخواست خرید ثبت شد" — DEAD END, no order created, no navigation, no persisted state

[Not part of the Services tab flow, reachable only from Home — noted, not traced further, per this document's scope]
Home → .category-item / .credit-service-item / .more-service-link / .service-banner(non-پوشاک/کفش)
  → Service Detail, FULL mode (cardOnly:false) → 4-method chooser IS interactive here → same Purchase Sheet
```

**Confirmed dead-end interactions**, explicit per the task's requirement:
- `#categoryShare`/`#detailShare` — native share sheet, no in-app
  destination either way (not a bug, standard share-intent pattern).
- `.detail-gallery-item` (×3) — no click handler registered anywhere in
  the file; these buttons are visually present and presumably meant to
  open an image viewer, but do nothing. **Prototype bug**, not an
  intentional no-op — flag in §23, do not build a matching dead button.
- `#purchaseConfirm` — the entire purpose of tapping "buy" terminates in a
  toast with zero persisted effect. This is the prototype's own
  acknowledgment that Purchase is UI-only, consistent with the prior
  contract's independent backend-side finding that `POST /orders` doesn't
  do anything either.

---

## 8. Mobile behavior (375 / 390 / 430)

The prior implementation report already validated the *current, already-built*
browse pages at all 8 required widths (375×812, 393×852, 430×932,
768×1024, 1024×768, 1366×768, 1440×900, 1920×1080) live, with zero
overflow, using `repeat(auto-fill, minmax(150px, 1fr))` for the grid
rather than fixed per-breakpoint columns. This document does not
re-validate that (nothing changed in this stage), but does add what the
*prototype itself* specifies for the pieces not yet built:

- **Horizontal carousels** (`product-track`, travel/car strips):
  `scroll-snap-type:x proximity`, cards `flex:0 0 210px` — a fixed card
  width, not responsive per se; RTL scroll begins from the right (no
  custom override found — native browser RTL scroll behavior).
- **Category filter chips**: `overflow-x:auto` row, same horizontal-scroll
  pattern as `CategorySelector` already uses today.
- **Sticky buy bar**: `position:fixed`, `bottom:76px` in the prototype —
  chosen specifically to sit *above* the prototype's own bottom nav.
  Production's `AppShell`/`BottomNavigation` uses a different mechanism
  (`translateZ(0)` containing-block trick, §10/§19) — the exact prototype
  pixel value does not directly transfer; the real requirement is "sit
  immediately above the bottom nav, inside the 760px shell," which is an
  `AppShell`-level layout question already flagged as unresolved by the
  prior contract (§16).
- **Purchase Sheet**: `align-items:flex-end` bottom sheet,
  `width:min(100%,540px)`, `border-radius:30px 30px 22px 22px` — directly
  reusable via the already-existing `packages/ui` `BottomSheet` primitive
  (confirmed present, §10).
- **Touch targets**: category grid cards are 64px thumb + full card
  ~138px min-height — comfortably above any reasonable touch-target
  minimum; filter chips are smaller (`padding:8px 12px`) but consistent
  with the same sizing already accepted for `CategorySelector`'s existing
  chips in production.

---

## 9. Desktop / wide viewport behavior

The prototype has no distinct desktop layout — it's a single
`max-width:760px` centered column at every viewport, the same "app-in-a-
browser-window" presentation the whole app uses (confirmed by
`docs/01-prototype-analysis.md`'s own design-system extraction, §55-60,
and independently re-confirmed structurally in this stage's own read — no
`@media` query anywhere in the mined CSS changes this container's max-width
for the Services flow specifically). Production should continue exactly
what's already established for every other module: content reflows inside
the capped shell (more grid columns as width increases via
`auto-fill`/`minmax`, per the already-validated pattern), never a
different "desktop layout." No new container/max-width behavior is
required beyond what `AppShell`/`PageContainer` already provide.

---

## 10. Current staging gap matrix

| Prototype element | Current staging (`apps/web`) | Status | Required change | Priority |
|---|---|---|---|---|
| Services List — category grid | `CategorySelector` (chip row, not a grid) + `ServiceGrid` | **Different UX shape** — prototype is a 2-column icon grid with a "بیشتر" reveal; current production is a horizontal chip selector | Product decision needed: keep the chip-row UX (already shipped, already validated at all 8 widths) or rebuild toward the prototype's grid-with-more-toggle. Not a bug — a deliberate prior design choice, not silently reproducible without a decision | P2 (fidelity gap, functioning either way) |
| Services List — search | `#serviceSearch`, client-side text filter | **Missing** — no search input exists on `/services` today | Buildable now, no backend change (client-side filter over already-fetched catalog, same pattern as category filtering) | P2 |
| Services List — promo banner | *(none)* | **Missing** | Needs a real asset + a decision on whether it's static or Admin-managed (§6) | P3 |
| Services List — travel/car featured strips | *(none)* | **Missing** | Same asset/ownership decision as above; also inherits the prototype's own hidden-heading bug (§3) — needs a product decision on the heading, not a silent copy | P3 |
| Category View — filter chips (5, incl. تخفیفی/ترکیبی) | *(none)* | **Missing**, AND 2 of 5 values have no backing enum/field (already known, prior contract) | Blocked on a product decision, not frontend-buildable as specified | P1 (blocks exact fidelity) but **cannot be closed by frontend work alone** |
| Category View — search | `#categorySearch` | **Missing** | Buildable now | P2 |
| Category View — product cards | `.service-finance-card` (templated 6/category) vs. current `ServiceCard` (real `Service` rows) | **Current implementation is architecturally better** — real catalog data, not templated placeholders | No change recommended; do not regress toward the prototype's synthetic cards | N/A — current state preferred |
| Category View — category-accent theming (4 distinct color themes) | *(none — one universal look)* | **Missing** | Buildable now if the 4 (or N) category→color mapping is confirmed as a real product requirement, not just this one prototype iteration's choice | P2 |
| Service Detail — `cardOnly` vs. full mode distinction | *(none — one universal render)* | **Missing**, and non-obvious (undocumented until this stage) | Needs a product decision on whether this distinction is worth preserving at all, since the Services-tab flow only ever needs card-only mode per this analysis | P1 to decide, P2/P3 to build depending on the decision |
| Service Detail — gallery | *(none)* | **Missing**, but the prototype's own gallery buttons are dead code (§7) | Do not build a matching dead interaction; if a gallery is wanted, it needs real click behavior designed, not reproduced | P3 |
| Service Detail — 4-method payment chooser | `DisabledPurchaseCTA` (single disabled button) | **Correctly deferred** per the prior contract's "no fake flows" finding — not a gap, a deliberate block | No change until Orders backend gap closes (§13) | N/A — correctly blocked |
| Purchase Sheet | *(none)* | **Missing, deliberately** | Same backend blocker | N/A — correctly blocked |
| Merchant Detail | *(none, and not in prototype either)* | **Missing on both sides** | No prototype precedent, zero seed data — see §12 | P3, likely never |
| FAQ accordion | Native `<details>`/`<summary>` | **Present, different mechanism, same visual result** | No change needed | N/A |
| Loading/error/empty states | `SkeletonBlock`/`ServicesErrorState`/`ServicesEmptyState` | **Present — production addition beyond the prototype**, correctly flagged as such | No change needed | N/A |

---

## 11. Component architecture — what Services can safely reuse

Already reused, unmodified, proven across Home and the existing Services
v1 build: `AppShell`, `GlobalHeader`, `BottomNavigation`, `PageContainer`,
`AuthGuard`, `Card`, `Badge`, `Button`, `SkeletonBlock`, `BottomSheet`
(exists, unused so far — the natural fit for a future Purchase Sheet).

**Missing `packages/ui` primitives** (already identified by the prior
contract, re-confirmed current — `packages/ui/src/components/` has no
Chip, Accordion, or Gallery/carousel primitive today):
- **Chip / segmented control** — needed for category filter chips (§10)
  and the payment-method filter row. Two real, independent consumers
  already identified (this module + any future filterable list) — worth
  building as a real primitive if/when the filter-chip gaps above are
  approved for building, not a module-local one-off.
- **Accordion** — deliberately *not* needed here (native `<details>`
  already covers the FAQ case cleanly), but Profile will need one later
  (prior contract's own note, unchanged).
- **Horizontal carousel / gallery** — needed only if the travel/car
  featured strips or a Service Detail gallery are approved for building;
  `HeroCardCarousel` (Home-specific) is not reusable as-is.

**No shared component needs modification to build anything in §10's
gap list** — every item above is additive (new module-local components
or, where flagged, new `packages/ui` primitives), not a change to
`AppShell`, `BottomNavigation`, `GlobalHeader`, or any Home CMS component.
**Zero regression risk to Home from anything in this document's scope**
(see §19 for the explicit boundary).

---

## 12. Data ownership matrix

| Content | Classification | Basis |
|---|---|---|
| Category/service grid layout, card shapes, page structure | **A. Static product UI** | Fixed by design/prototype, not user- or admin-editable |
| Category names, descriptions, sort order, active state | **C. Backend domain data** (already real — `Category` model, 19 rows) | Pre-existing domain catalog, not Home-CMS-style content |
| Service title/subtitle/price/badge/methods/benefits/gallery/FAQ | **C. Backend domain data** (already real — `Service` model, 108 rows) | Same |
| Category/service icon images | **C/D boundary — currently text-fallback, no resolver exists** | `imageKey` fields already exist on both models; whether filling them in becomes an Admin CMS workflow or a one-time data-migration script is a genuine open question, not resolved here (§23) |
| Services List promo banner, travel/car featured strips | **A or D, undecided** | No current mechanism either way — these are marketing/merchandising content, arguably closer to Home's `HomeServiceBanner` CMS pattern than to the domain catalog; flagged, not decided, in §23 |
| Purchase-method chooser copy/behavior | **A. Static product UI** | Fixed 4-card layout, not content-managed |
| `cardOnly` mode logic | **E. Derived/runtime state** | A navigation-context flag, not stored content |
| Order/purchase state (once built) | **C. Backend domain data** | `Order`/`Installment`/`CreditUsage`/`Payment` — already-modeled domain data, explicitly NOT Home-CMS-style Admin content |
| Category filter chip set (همه/اقساطی/اعتباری/تخفیفی/ترکیبی) | **A, blocked on a schema/product decision** | Not admin-editable either way — it's a fixed filter taxonomy, the open question is only which 5 (or fewer) values are real |

**Consistent with the established architectural principle (Admin manages
content, not layout)**: nothing in this analysis proposes a page-builder
for Services. The two live open questions (icon images, promo/featured
banners) are exactly the same *class* of decision Home CMS already
resolved for its own banners/tiles — **if** the product decision is "yes,
these should be Admin-editable," the correct pattern is a small, targeted
CMS model mirroring `HomeServiceBanner`'s shape, not a new architecture.

---

## 13. Admin CMS impact — proposed, not implemented

**Two candidate models, both conditional on product decisions this
document does not make unilaterally:**

### Candidate: `ServiceCategoryIcon` (or: extend `Category.imageKey` with a real Media Library workflow)
- **Only needed if**: the product decision in §12 is "yes, category icons
  should be Admin-editable images," not a one-time static asset drop.
- If yes: no new model needed at all — `Category.imageKey` already exists;
  the actual gap is purely the missing `imageUrl` resolver (a backend
  change, §13/Backend, not an Admin/CMS change) plus wiring the existing
  Admin Media Library picker to `Category`'s admin edit form (which
  doesn't exist yet — Categories have no Admin management UI today at
  all, confirmed by absence in `apps/admin/src/features/`).
- **Ordering**: SN/A — inherits `Category.sortOrder`, already exists.
- **Active status**: N/A — inherits `Category.active`, already exists,
  and already has the known "not filtered server-side" gap (§13/Backend,
  carried from the prior contract).

### Candidate: `HomeServicePromoBanner`-style model for the Services List promo/featured content
- **Only needed if**: the product decision in §12 is "yes, the promo
  banner and travel/car featured strips should be Admin-editable," which
  would make this architecturally identical to `HomeServiceBanner`
  (fields: title, image, category link, CTA/link target, sortOrder,
  active).
- **If no** (these stay static/decorative, matching how the prototype
  itself treats them — no per-category data attached, purely marketing
  copy): no model needed at all.

**Explicitly NOT Admin-editable, regardless of the above decisions**: the
core catalog (`Category`/`Service` rows — already real domain data, not
CMS content, correctly outside Home CMS's pattern), the purchase-method
chooser, `cardOnly` logic, and anything Orders-related. None of this is a
"content" decision an editor should make through a CMS — it's product
catalog and transactional data, matching the existing Home-CMS boundary
principle exactly (Admin manages *content*, not domain data or business
logic).

**If and only if** a real Admin CRUD for `Category` becomes wanted
(currently Categories have zero Admin UI — they're seeded, static domain
data, same as `Service`), the smallest clean contract would be: model
`Category` (already exists), fields already present, public read API
already exists (`GET /categories`), Admin CRUD API would be net-new
(`/admin/categories` — does not exist today), Admin UI would be net-new. **Not
recommended to build until the icon-image question in §12 is actually
answered "yes, Admin-managed"** — building Admin CRUD for a domain-catalog
resource with no clear editorial need would be scope creep against the
"Admin manages content, not layout" principle applied narrowly (this
isn't Home-CMS-style presentational content, it's the underlying product
catalog).

---

## 14. Backend / domain impact

**Everything below is a restatement/reconfirmation of the prior
contract's findings (`docs/services-ui-contract.md` §5–§10), spot-checked
live against current source this stage — not re-derived from scratch,
and still accurate:**

| Gap | Confirmed still current? |
|---|---|
| `GET /services` has no `categoryId`/`method`/`q` filter param | ✅ re-confirmed — `ListServicesQueryDto extends PaginationQueryDto {}`, empty body |
| `list()`/`findOneOrThrow()` never filter `active:true` server-side | Not re-verified this stage (no code changed there since the prior contract; low risk of drift) |
| No `imageUrl` resolution for `Category.imageKey`/`Service.imageKey`/`Merchant.logoKey` | Not re-verified this stage; `OrbitItem` remains the existing pattern to copy |
| `CreateOrderDto` has no `installmentMonths` field | Not re-verified this stage |
| `POST /orders` performs no credit-limit check, never debits Wallet, never writes `CreditUsage`/`Installment` | ✅ re-confirmed — `orders.service.ts`'s `create()` is exactly `prisma.order.create({...status:'pending'})`, comment literally says "Foundation-level" |
| `Merchant` has 0 seed rows, 0 service links | Not re-verified this stage (no seed changes since) |
| تخفیفی/ترکیبی filter values have no schema representation | ✅ confirmed again this stage from the schema read — `PurchaseMethod` enum is exactly `credit \| installment \| cash \| free` |

**New from this stage's direct schema read**: `Order` already has
`installment Installment?`, `creditUsages CreditUsage[]`, `payments
Payment[]` relations defined in Prisma — **the schema is already shaped
for real order fulfillment; only the service-layer logic
(`orders.service.ts`) is missing.** This narrows the actual backend
implementation work considerably compared to "design a new data model" —
it's "write the missing business logic against an already-correct
schema."

**Also new**: `PaymentProvider` enum is `wallet | gateway` — confirming
"wallet" already exists as a concept, just at the `Payment.provider`
level, not as a 5th `PurchaseMethod`. This resolves one ambiguity the
prior contract left open (§7 of that doc) — wallet is a *payment rail* for
a cash-method order, not a distinct purchase method.

---

## 15. Authentication boundaries

- Services List, Category View, Service Detail: all reached through
  `AppShell`'s `AuthGuard mode="require-auth"` — **customer authentication
  is already required for the whole Services tab**, confirmed by direct
  read of `AppShell.tsx` (§11). This matches production's existing
  Home/Wallet/Credit pattern, not a prototype-derived requirement (the
  prototype itself gates the whole app behind `authModal`, so this is
  consistent either way).
- The underlying public APIs (`GET /categories`, `GET /services`, `GET
  /services/:id`) are themselves `@Public()` — unauthenticated reachable
  at the API level, but the *page* requires auth via `AppShell`. No
  change proposed.
- `POST /orders` (once built) requires authentication and correctly scopes
  by `currentUser.userId`, not a client-supplied field (prior contract's
  §10 finding, security-positive, no gap).
- No eligibility/credit-data-gated screen exists anywhere in this flow
  today (§9) — the prototype's "eligible members" copy on the free/reward
  plan is decorative text, not an actual check.

---

## 16. Routing contract

**Keep the already-shipped, already-validated route structure — no
change proposed:**

```
/services                              — Services List
/services/[categoryId]                 — Category View
/services/[categoryId]/[serviceId]     — Service Detail
```

This already correctly matches the prototype's 3-view structure onto 3
real, bookmarkable, independently-linkable Next.js routes — not a modal
or query-param scheme, and not one route per generated card (which would
be meaningless anyway, since 108 of 113 prototype "cards" are generated,
not distinct entities). Browser back behavior already works correctly
through Next.js's own router (confirmed by the prior implementation
report's live verification).

**Open question, not resolved here**: does `cardOnly` vs. full-mode (§4/§9)
warrant a route-level distinction (e.g. a query param) or should Service
Detail always render in browse/card-only mode when reached via `/services/**`,
with the full 4-method mode reserved for whatever future Home-entry-point
route eventually needs it? Recommendation: **no new route needed** — since
every path through `/services/**` is card-only by prototype design, this
resolves itself naturally as long as the 4-method chooser is only ever
shown for Home-originated navigation, not gated by URL shape.

**Purchase Sheet**: a modal, not a route — matches the prototype exactly
(no distinct URL for it), and matches every other purchase-adjacent
overlay already established elsewhere in the app (`BottomSheet` primitive
already exists for this).

---

## 17. Loading / empty / error state requirements

Already built and already correctly distinguished from prototype-derived
content (the prototype itself has none of these — everything is
synchronous DOM manipulation against already-loaded data):

| State | Prototype-derived? | Current implementation |
|---|---|---|
| Loading | **Production-required addition** | `SkeletonBlock` × grid (list), 3 skeleton blocks (detail) |
| Empty (zero active services in a category) | **Production-required addition** | `ServicesEmptyState` |
| Empty (zero search/filter results) | Prototype-derived (`#categoryEmpty`, `#serviceGrid` implicit) | **Not yet built** — needed once search/filter chips are built (§10) |
| Error (fetch failure) | **Production-required addition** | Inline red text / `ServicesErrorState` |
| Error (network failure on order submit) | Prototype-derived, explicitly flagged by the prototype's own edge-case awareness in the mapping doc (§14, "خطای شبکه هنگام ثبت باید Retry/پیام خطا داشته باشد") | **N/A until Purchase Sheet is built** |

No new visual language is needed for any of these — same
established pattern reused everywhere else in the app.

---

## 18. Accessibility / touch requirements

- Category cards, service cards, and filter chips are already real
  `<button type="button">` elements in current code (not `<div onClick>`)
  — matches the prototype's own semantics (`.service-card` is a `<button>`
  in the raw HTML too).
- FAQ: current `<details>/<summary>` is natively keyboard-accessible
  (Tab + Enter/Space) without any extra work — an accessibility
  *improvement* over the prototype's custom click-toggle, not a
  regression, and should be kept rather than "matched" to the prototype's
  less-accessible mechanism.
- Icons/images: category thumbs currently render as decorative emoji
  fallback (`aria-hidden="true"` already present in `ServiceCard`/
  `ServiceHero`) — correct as-is; real `alt` text is only needed once real
  images are wired up (§6/§12 decision-dependent).
- Touch targets: category chips/cards already meet a reasonable minimum
  (§8) — no gap identified.
- Reduced motion: the prototype's `biawinFinanceFloat` card-floating
  animation (§3/§6) should respect `prefers-reduced-motion` if built —
  not addressed anywhere in the prototype's own CSS, a production-required
  addition if that visual motif is approved for building at all.

---

## 19. Performance considerations

- **Base64 images are a real risk if ported directly** — the prototype's
  largest single Services-flow asset is 257KB inline base64 (a پوشاک
  poster); inlining any of these into a Next.js bundle instead of serving
  them as real files would bloat the JS/HTML payload. **Recommendation**:
  if any prototype image asset is approved for use (§6), extract it to a
  real static file (or Media Library upload) — never keep it as an inline
  base64 string in production code.
- **`listAllServices()`'s pagination-loop-until-complete pattern** (already
  built, fetches all 108 rows across `page=1,2` due to the server's
  `limit<=100` cap) is a known, accepted, already-shipped workaround — not
  a new risk, but worth remembering if the catalog grows meaningfully
  larger (it would degrade linearly, not catastrophically, but is worth
  revisiting if service count grows past a few hundred).
- **No eager-loading risk identified** — current `ServiceGrid`/`ServiceCard`
  render text/emoji, not images, so there's no current image-loading
  performance concern; this changes only if/when real images are wired up
  (§6/§12), at which point standard `next/image` lazy-loading should be
  used, consistent with how Home CMS images are already handled.
- **No unnecessary client JS identified** in the current implementation —
  `useServiceCatalog` fetches once, filters client-side; no polling, no
  redundant re-fetching found.

---

## 20. Home regression boundary

**Explicitly shared with Home, must not regress:**
- `AppShell`, `GlobalHeader`, `BottomNavigation`, `PageContainer`,
  `AuthGuard` (all `apps/web/src/components/shell/`)
- `navigation.ts` (`BOTTOM_NAV_ITEMS`) — Services' nav entry already
  exists and is already `"available"`; nothing in this document proposes
  changing it
- `packages/ui`: `Card`, `Badge`, `Button`, `SkeletonBlock`, `BottomSheet`
  — reused, not proposed to be modified
- Customer auth (`AuthGuard`/JWT) — unmodified
- Backend: `Category`/`Service` models and their public read endpoints are
  shared with Home's own category-display components
  (`FeaturedServiceBanner`/`ServiceTicker` on Home already render
  `Category` data, per the prior contract's own note, §1) — **any future
  backend change to these endpoints (e.g. adding the `imageUrl` resolver,
  §13) must be verified against Home's existing consumers too, not just
  Services'**, since they share the same source models.
- Admin Home CMS, Admin Home media, existing staging QA — nothing in this
  document proposes touching any Home-CMS-specific model
  (`HomeHeroCard`/`HomeServiceBanner`/`HomeServiceMosaicTile`/
  `HomeNewsArticle`) or their Admin surfaces.

**Nothing in this document's proposed work (§21) requires modifying any
shared component listed above.** If a future Chip/Accordion/Carousel
primitive is added to `packages/ui` (§11), that's a pure addition, not a
modification to anything Home depends on — verified by checking that none
of Home's own components import from where a new primitive would live.

---

## 21. Implementation phases

**The requested Stage 6.0–6.8 numbering is not used here as proposed —
see §23's top open question for why.** Using placeholder letters (A–H)
instead, pending the account owner's decision on the actual numbering:

```
Stage [X].0 — Services Prototype Analysis           ← this document
        ↓
Stage [X].1 — Product decisions (NOT engineering)
  Resolve the open questions in §23 that block scoping anything below:
  category-icon ownership, promo/banner ownership, category-accent
  theming, cardOnly-mode UX decision, تخفیفی/ترکیبی filter fate,
  numbering collision. No code in this phase.
        ↓
Stage [X].2 — Services Fidelity Pass (frontend-only, no backend change)
  Whatever subset of §10's P2/P3 gaps survives §[X].1's product
  decisions: search inputs, category-accent theming if approved,
  promo/featured banners if approved as static assets. Builds on the
  already-shipped v1, does not rebuild it.
        ↓
Stage [X].3 — Orders Backend Foundation
  Close the Orders-module gaps (§14) — this is shared work already
  identified independently by Wallet/Credit/Installment/Services'
  own prior contracts, not Services-specific; likely belongs to
  whichever stage/team owns the Orders module generally, not a new
  Services-only stage.
        ↓
Stage [X].4 — Purchase Flow (frontend, unblocked by [X].3)
  Purchase-method selector, Purchase Sheet (BottomSheet primitive
  already exists), real POST /orders wiring, install a real
  Confirmation destination (Profile → خریدها, per J9 — no new
  screen needed, matches the prototype's own behavior).
        ↓
Stage [X].5 — Category/Service Admin CMS (ONLY if §[X].1 decides
  icon/banner content should be Admin-managed — otherwise this phase
  does not exist at all)
        ↓
Stage [X].6 — Staging QA
  Mirrors the Home CMS Stage 5.22 pattern (authenticated QA runner,
  propagation checks if Admin CMS was built in [X].5) — reuse that
  runner's architecture, don't rebuild QA tooling from scratch.
```

**If some of these are unnecessary**, per the task's own instruction:
Merchant Detail does not appear as a phase at all — no prototype
precedent, no seed data, no clear product need identified anywhere in this
analysis (§4/§12). Building it would be inventing scope this document was
explicitly told not to invent.

---

## 22. Acceptance criteria (for whichever future phase actually ships)

- Every route in §16 renders with real backend data, matching the schema
  already defined in §14 (no placeholder/lorem content).
- RTL correct at all breakpoints already validated by the prior
  implementation report (§10) — re-verify, don't assume carry-forward,
  for any newly-added screen state.
- No interaction from §7's graph is a dead end unless explicitly approved
  as one (native share sheets are fine; a reproduced version of the
  prototype's dead gallery buttons is not, §7).
- Purchase Flow (once built) never creates an `Order` that silently fails
  to affect the user's actual wallet/credit/installment state — the
  "no fake flows" principle already established by the prior contract
  carries forward unconditionally.
- No console errors, no broken images, no unexpected horizontal overflow
  — same bar as Home CMS's own QA (`docs/stage-5.22-staging-production-readiness-qa.md`).
- Home is unaffected — verified against §20's explicit boundary, not
  assumed.
- `typecheck`/`lint`/`test`/`build` all green at the time of any future
  implementation stage's closure.
- If Admin CMS is built (§21, conditional phase): Admin→Customer
  propagation proven live, mirroring Stage 5.22's exact methodology, not
  a new one invented from scratch.

---

## 23. Open questions / ambiguities — genuinely unresolved, not guessed at

1. **Numbering collision (blocks phase-naming, not the analysis itself).**
   This task proposed "Stage 6.0–6.8." `docs/services-ui-contract.md`
   already documents Wallet as "Stage 6.0," Credit as "Stage 7.0,"
   Installment as "Stage 8.0," and Services itself as "Stage 9.0/9.1" —
   an existing, different numbering track than this engagement's Home CMS
   track (Stage 5.x). Reusing "Stage 6.0" here would collide with the
   already-completed Wallet stage. Needs the account owner's decision:
   continue the 9.x track (e.g. "Stage 9.2" onward), adopt a wholly
   separate namespace, or confirm the Wallet/Credit/Installment/Services
   numbering was itself from an unrelated, superseded planning exercise
   that's safe to renumber over. **Not resolved by this document.**
2. **Category icon ownership** — static asset drop, or a real Admin-
   managed Media Library workflow (§6/§12/§13)? The prototype itself
   abandoned per-category imagery as a maintained concept (`categoryCatalog`'s
   emoji icons are dead code, §5) — worth weighing that the prototype's
   own author may not have considered this a priority either.
3. **Promo banner / travel-car featured strips** — static decoration or
   Admin-managed marketing content (§6/§12/§13)? If the latter, this is a
   real, if small, new CMS surface.
4. **The hidden "انواع کارت‌های گردشگری/اتومبیل" headings (§3)** — genuine
   prototype bug (CSS accidentally hides them) or an intentional
   minimalist choice worth keeping hidden? Needs a product call, not a
   silent reproduction of the bug.
5. **Category-accent theming (§6/§10)** — is the 4-color-plus-default
   scheme a real, durable product decision, or a one-off visual
   experiment for 4 specific categories that happened to exist in v15?
   Worth checking against v16 (not read, per instructions) before
   committing to it.
6. **`cardOnly` vs. full-mode distinction (§4/§9/§10)** — the single
   most significant *new* finding in this analysis. Does production need
   to preserve this distinction at all, given the Services tab flow only
   ever needs card-only mode? Or was this prototype complexity
   specifically because Home also links into Service Detail (a
   documented but out-of-scope-here entry point) — meaning the real
   answer only becomes clear once Home's own service-linking behavior is
   itself in scope somewhere?
7. **تخفیفی/ترکیبی filter chips** — drop them (they'll always be empty
   against the real schema), or define what they mean against real
   fields (a `PurchaseMethod` enum change)? Already flagged by the prior
   contract as unresolved; still unresolved.
8. **Services List UX shape** — keep the already-shipped chip-row
   selector, or rebuild toward the prototype's icon-grid-with-"بیشتر"
   pattern (§10)? These are genuinely different UX approaches, not a
   fidelity gap with one obviously-correct answer.
9. **v16_clean's relationship to v15** — same Services flow (structural
   identifier counts match) or a meaningfully revised version not
   actually inspected? Not verified, per this task's explicit instruction
   to use v15 only.
10. **Merchant Detail** — build it once real data exists, or drop it from
    the roadmap entirely given zero prototype precedent? Leaning toward
    "drop," but this is a product call, not this document's to make
    unilaterally.

---

## Status

**SERVICES PROTOTYPE ANALYSIS: complete.** No implementation performed,
per this stage's explicit instruction. Ten genuine open questions (§23)
exist and are not resolved here — several of them materially change the
shape of §21's phase plan once answered.
