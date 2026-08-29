# SERVICES-R2 — Category / Filter Fidelity Report

Prototype fidelity upgrade of the existing Category View (`/services/[categoryId]`),
built on top of the verified SERVICES-R1 baseline (staging revision
`4718068`, API QA 54/0/0, browser QA 67/0/0 — see
[docs/services-r1-staging-qa.md](services-r1-staging-qa.md)). Not a
greenfield rebuild — every decision below either sharpens an already-real
component to match freshly-mined prototype CSS/markup, or explicitly
declines to, with reasoning.

---

## 1. Scope

Implemented, narrowly: Category Hero fidelity, category-local search
fidelity, filter/chip fidelity, empty-state distinction, and the
search+filter composition contract — exactly SERVICES-R2's stated A–G
focus areas. Explicitly **not** touched: the Services List page (R1
scope, unchanged), Service Detail beyond its existing `cardOnly` contract
(unchanged, still verified working), Purchase Flow/Merchant Detail/any
transactional logic (still out of scope), Admin (zero files changed —
verified below).

## 2. Prototype findings

Mined directly from `biawin_single_file_app_requested_edits_v15.html`
this stage (a fresh, deep pass — beyond what
[docs/services-prototype-analysis.md](services-prototype-analysis.md)
and [docs/services-r1-fidelity-report.md](services-r1-fidelity-report.md)
already captured). The two most consequential findings:

1. **The real, live `.service-finance-card` product-card design is a
   fictional "bank card" visual** — brand lockup ("BIAWIN MEMBERSHIP
   CLUB"), a decorative gold chip graphic, a fake card number/expiry row
   ("VALID 08/29" / "•••• 2088", static and identical on every card), and
   a continuous floating/rotating CSS animation. This is intrinsically
   tied to `buildServiceOffers()`'s synthetic "کارت اقساطی/اعتباری/
   تخفیفی/ترکیبی {category}" concept — not a real product-card metaphor
   at all. **This confirms (not just repeats) R1's own finding**: our real
   `Service` catalog (real Persian product titles, real prices, real
   `PurchaseMethod` data) has no legitimate mapping onto a fake bank-card
   visual. Building it would misrepresent every real service as a
   "membership card," which is worse fidelity to the *real* product, not
   better fidelity to the prototype. **Not reproduced** — see §4.
2. **The prototype's own `#categoryEmpty` empty state is a single,
   undifferentiated message** for search-empty, filter-empty, and
   search+filter-empty alike (`visible.length === 0`, no distinction by
   cause). This directly settled §8's empty-state design — see §8.

Full mining findings (Category Hero DOM/CSS, search box CSS, filter chip
CSS, card grid CSS-cascade history, empty-state markup/copy, page
spacing, and the confirmed hash-only/no-query-param routing model) are
summarized inline in §4–§9 below and in the source code comments of every
file changed.

## 3. Current-vs-prototype gap matrix

| Element | R1 state | Prototype (mined) | R2 action |
|---|---|---|---|
| Category Hero background | Light, flat accent-tinted color | Full-bleed real photo + dark gradient scrim, white text | **Not reproduced as a photo** — no real per-category hero photo exists in the backend (§4). Enriched the light-theme hero instead: real icon, real item-count meta chip, prototype's exact label-badge text/shape |
| Category Hero size/radius | `radius.xl` (24), `spacing.lg` padding | `border-radius:30px` (26px mobile), `min-height:245px` (220px mobile) | Radius raised to 28 (a documented close approximation, not exact — no real CSS media query mechanism exists in this codebase's inline-style components); content genuinely richer, closer to the real min-height range |
| Category Hero meta row | Did not exist | Item count (real, dynamic) + 2 static phrases | Added, with the fictional "تخفیفی" phrase replaced by the real 4 `PurchaseMethod` values (§4) |
| Category search box | `Input` base (radius 14, `color.ice` bg, no shadow), static placeholder | `border-radius:16px`, `background:#f8fbfe`, `box-shadow:0 9px 24px rgba(6,73,135,.06)`, per-category dynamic placeholder, accent-tinted icon | Matched exactly (radius/bg/shadow/icon color); placeholder made dynamic per real category name |
| Filter chips (inactive) | `padding:8px 16px`, `font-size:13`, `font-weight:700`, `color:ink` | `padding:8px 12px`, `font-size:10`, `font-weight:800`, `color:#668097` | Matched exactly |
| Filter chips (active) | Flat `accent` background | Two-stop `accent→deep` gradient + colored box-shadow | Matched exactly |
| Filter row | `paddingBottom:4` | `padding:12px 0 3px`, hidden scrollbar | Padding matched; `scrollbar-width:none` added (WebKit-only `::-webkit-scrollbar` hiding not expressible via inline styles — documented gap) |
| Product card visual | Real-data `Card` (icon/title/subtitle/price/badge) | Fictional gold "bank card" (see §2) | **Kept as-is, deliberately** — see §4 |
| Product grid columns (mobile) | `repeat(auto-fill, minmax(150px,1fr))` (effectively 2 columns at 375–430px) | Final CSS-cascade winner: forced single column ≤740px (traced through 12 competing `!important` overrides, confirmed by the mining pass to be the *actual* live behavior, not the earlier "2 columns" rule) | **Not adopted** — see §10, an open question, not a clear improvement |
| Empty state (search/filter) | 3 separate invented messages (B/C/D) | 1 undifferentiated message, exact copy mined | Collapsed to the exact prototype copy, dashed-border visual matched |
| Empty state (category has 0 services) | Same generic message as above | No prototype precedent (structurally unreachable there) | Kept a distinct implementation-decision message (§8) |
| Loading state | `SkeletonBlock` | None in prototype | Unchanged, extended with a hero-shaped skeleton to avoid a layout jump (§9) |
| Search/filter URL state | Local React state, no query params | Pure in-memory JS state, never in the URL/hash (confirmed: `openView()` uses `history.replaceState` for the view name only) | **Confirmed correct as-is** — see §5/§6 |

## 4. Category Hero decisions

**PROTOTYPE-DERIVED, adopted verbatim:**
- The "کارت‌های خدمات بیاوین" label badge text (identical for every
  category in the prototype too).
- The 4-color accent theme (`--category-accent`/`--category-deep`/
  `--category-soft`) — already built in R1, unchanged.
- The real, dynamic item-count meta chip (`#categoryItemMeta`'s pattern:
  count + a fixed suffix).

**PROTOTYPE-DERIVED, adapted (not verbatim) — with reasoning:**
- The second static meta phrase. Prototype: "اقساطی، اعتباری و تخفیفی"
  ("...and discounted"). **"تخفیفی" has no real `PurchaseMethod`
  backing** — the exact same mismatch R1 already resolved for the filter
  chips. Rather than repeat a fictional claim in hero copy, this lists
  the real 4 enum values: "اقساطی، اعتباری، نقدی و رایگان."

**IMPLEMENTATION DECISION, deliberately diverging from the prototype:**
- **No full-bleed photo hero.** The prototype's real hero is a large
  photo under a dark scrim. The real backend has **no per-category hero
  photo** — `Category.imageKey` is `null` for all 19 real rows, and the
  only real, migrated per-category assets are the 220×220px round icon
  thumbnails (`apps/web/public/services/icon-*.webp`, SERVICES-R1).
  Verified their real pixel dimensions this session (220×220, confirmed
  via each file's own WebP header) before deciding — stretching one to a
  ~760px-wide full-bleed hero would be visibly blurred/pixelated. Reusing
  it as a real icon, at its own native display scale (56×56px), integrates
  the actual migrated asset without degrading it, rather than either
  skipping the image entirely or inventing a fake photo. If real
  per-category photography is ever sourced, the dark-photo-hero treatment
  should be revisited then — documented, not silently foreclosed.
- Hero `border-radius` set to 28 (not the prototype's exact 30/26 split)
  — no real `@media` mechanism exists in this codebase's inline-style
  component convention (confirmed: no component in `apps/web` or
  `packages/ui` uses a CSS media query today), so a single, close
  approximation was chosen over introducing a new pattern for one value.

**DOMAIN-DERIVED:** `category.name`, `category.description`, and the real
service count (`serviceCount`, computed in the page from the actual
category-scoped catalog) — all real, all as before.

## 5. Search contract

**Confirmed, not changed:** category-local search is `#categorySearch`'s
exact real behavior — client-side substring filtering over the current
category's already-fetched real services, no backend endpoint, `q === ""`
restores the unfiltered (method-filtered) list. Partial matching against
`title`/`subtitle` already worked in R1 and is unit-tested (§12).

**PROTOTYPE-DERIVED, newly matched:** the placeholder is now dynamic per
real category — `` `جستجو در کارت‌های ${category.name}...` ``, mirroring
`openServiceCategory()`'s exact per-category placeholder pattern (R1 had
a static string). The search icon is now stroked with the category's own
accent color (`stroke:var(--category-accent)` in the prototype), not a
fixed blue.

**IMPLEMENTATION DECISION, deliberately kept:** the input's font-size
stays 16px (not the prototype's 12px) — `Input`'s own established, R1-era
fix for iOS Safari's auto-zoom-on-focus bug at font-sizes under 16px.
"Fidelity" here would reintroduce a previously-fixed real bug; not
reverted.

## 6. Filter contract

**Unchanged from R1 (already correct):** the 5 real chips are همه + the 4
real `PurchaseMethod` values — R1 already resolved the دهفیفی/ترکیبی
schema mismatch, and R2's own instructions explicitly accept that
resolution as authoritative ("current real purchase-method semantics must
remain authoritative"). Not re-litigated.

**PROTOTYPE-DERIVED, newly matched (visual only, mined this stage):**
inactive chip padding/font-size/weight/color, and — the more significant
find — the **active chip's real visual is a two-stop `accent→deep`
gradient with a colored shadow**, not a flat accent fill (R1's version).
`Chip.tsx` and `MethodFilterChips.tsx` now take the full `{accent, deep}`
theme object instead of a single color string to render this correctly.

## 7. Search + filter composition

Extracted into a standalone, directly-testable pure function,
`filterServicesForCategory()` (`apps/web/src/components/services/serviceListFilter.ts`),
used by both the page and its own unit tests (§12). Composition is a
plain AND of three conditions (category scope, method filter, search
substring):

- **"همه" (all)** → every real service in the category, current search
  query still applied (`matchesMethodFilter(..., "all")` is always
  `true`, so "همه" is equivalent to omitting that condition — it can
  never disturb an active search).
- **A specific real method** → the exact real subset, intersected with
  any active search.
- **Clearing search** (`q === ""`) → short-circuits to `true`, restoring
  exactly the current method-filtered subset — no special-case code
  needed, it falls out of the same boolean expression.
- **No cross-category leakage, no duplicates** — enforced by construction
  (`s.categoryId === categoryId` is one of the AND'd conditions; the
  filter never duplicates array entries) and directly asserted by tests.

No behavior changed from R1 here — R1's original inline logic already
implemented exactly this AND-composition correctly. R2's contribution is
making it a named, independently-tested unit instead of inline page logic
that could only be exercised through the page component.

## 8. Empty/error/loading states

**PROTOTYPE-DERIVED (exact copy + exact CSS), the single biggest empty-
state finding this stage:** the prototype's `#categoryEmpty` shows **one**
message regardless of whether the emptiness came from search, from the
filter chips, or both — `visible.length === 0` is the only condition
checked. Verbatim copy: **"موردی با این عبارت پیدا نشد. عبارت دیگری
جستجو کنید."** R2 initially built 3 separate invented messages for
scenarios B/C/D before this exact prototype text was found; those were
replaced with the single real prototype message once mined, applied
identically to all of B/C/D — more faithful to the prototype than keeping
3 invented variants it never actually has. Visual: matched too — a
dashed `1px dashed #cadff2` border, `border-radius:22px`,
`background:#f8fbfe` (`CategoryFilterEmptyState`, `ServiceGrid.tsx`),
distinct from the app's normal solid-border `Card`-based empty state.

**IMPLEMENTATION DECISION, no prototype precedent:** scenario A (a real
category with zero real, active services) is structurally unreachable in
the prototype (`buildServiceOffers()` always synthesizes ≥2 cards per
category), so it has no prototype copy to reuse. Kept a distinct message,
"در حال حاضر خدمتی در این دسته ثبت نشده است.", and the prior generic
solid-card `ServicesEmptyState` visual (not the dashed treatment, which
is specifically the prototype's search/filter-empty look).

**Error / API-failure:** unchanged from R1 — `ServicesErrorState`
(inline, distinct from both empty states), never silently downgraded to
an empty-list message. "Category not found" now reuses this same
component (was a one-off inline `<p>` before), same visual language, no
functional change.

**Loading:** unchanged (`SkeletonBlock`), no prototype precedent (§17 of
the prior analysis already established this). New this stage: the hero
itself now shows a `SkeletonBlock` (height 160) while the category is
still loading, instead of rendering nothing — avoids a visible layout
jump once the real, now-richer `CategoryHero` mounts.

## 9. Asset mapping

No new assets introduced. `CategoryHero` reuses the exact same
`CATEGORY_ICON`/`CATEGORY_ICON_FALLBACK` map `CategoryGrid` already uses
(SERVICES-R1) — the same real, migrated, already-approved WEBP icons, at
their native 220×220px resolution, never upscaled. No stock imagery, no
invented merchant/product photos, no new base64 assets. The prototype's
real per-category hero photos and the (confirmed, this stage) entirely
dead `SERVICE_POSTER_LIBRARY` alternate-card-visual system were both
identified and explicitly **not** built against — see §4 and §10.

## 10. Responsive decisions

**Verified via `next build`'s static analysis and the existing component
test suite** (32 Services component tests, all passing) — **not** via a
live authenticated browser session at 375/390/430/desktop. `/services/
[categoryId]` sits behind `AuthGuard`, the same operating constraint
documented repeatedly through this entire engagement (Stage 5.22 onward):
interactive authentication is outside this session's boundaries, and no
workaround was attempted. This is the same class of gap SERVICES-R1's own
fidelity report disclosed for the identical reason — real, authenticated,
multi-breakpoint visual confirmation is the next real staging QA run's
job (§17), not something this implementation turn can honestly claim.

**Open question, deliberately not resolved unilaterally:** the mining
pass traced the product grid's CSS cascade through 12 competing
`!important` overrides across the prototype's edit history and found the
*final, actually-winning* rule forces a **single column** on all mobile
widths (≤740px) for the generic 6-card-per-category grid — not the
commonly-assumed 2-column layout an earlier rule in the same file also
declares (and which a later rule overrides). This was **not adopted**:
(a) it appears to be an accidental artifact of "the file's edit history
genuinely flip-flopped" (the mining agent's own words) rather than a
deliberate design decision, and (b) our real `ServiceCard` is far more
compact than the prototype's tall gold bank-card visual, so a 2-column
grid may genuinely serve real users better regardless of what the
prototype's cascade happened to land on. Flagged here as a real,
traced, exact fact for a product decision — not silently resolved either
way, matching how R1 handled the earlier تخفیفی/ترکیبی ambiguity.

**Not built, explicitly deferred:** the prototype's bottom
`.category-info-strip` ("پس از انتخاب کارت..." tip banner) — its copy is
about post-purchase guidance, premature before Purchase Flow exists
(explicitly out of R2 scope). The prototype's floating-card CSS animation
— moot, since it's part of the fictional bank-card visual not being
built (§4).

## 11. Accessibility notes

No regressions, no new gaps introduced. Category tiles/service cards/
filter chips remain real `<button>` elements (unchanged from R1). The new
`CategoryHero` icon is `aria-hidden="true"` with an empty `alt`, matching
the established decorative-icon pattern (`CategoryGrid`'s own icons).
`MethodFilterChips`' `aria-pressed` semantics are unchanged — only visual
styling (padding/color/gradient) was touched, verified by the unchanged,
still-passing `MethodFilterChips.test.tsx` assertions on `aria-pressed`.
No new interactive dead-ends were added (`#categoryShare`'s native-share
button and `#categoryBack`'s in-page back button, both real prototype
elements, remain **not built** — R1's existing, still-valid reasoning:
`GlobalHeader`/`AppShell` and real browser-back already cover this
correctly for a real multi-route app, unlike the prototype's single-file
hash-state model).

## 12. Files changed

**Application code** (`apps/web/src/**` only — zero Admin, zero backend, zero Home files):

| File | Change |
|---|---|
| `apps/web/src/components/services/CategoryHero.tsx` | Rewritten — real icon, real item-count meta row, prototype-matched label badge, richer light-theme layout |
| `apps/web/src/components/services/ServiceSearchInput.tsx` | Exact prototype box styling (radius/bg/shadow), accent-tinted icon, dynamic per-category placeholder support |
| `apps/web/src/components/services/Chip.tsx` | Exact prototype padding/font/color; active state now a real 2-stop gradient + shadow (was flat fill) |
| `apps/web/src/components/services/MethodFilterChips.tsx` | Row padding + hidden scrollbar matched; passes the full accent theme (not just one color) to `Chip` |
| `apps/web/src/components/services/ServiceGrid.tsx` | Empty-state distinction (§8): real prototype copy for search/filter-empty (dashed-border visual), a separate implementation-decision copy for a genuinely-empty category |
| `apps/web/src/components/services/serviceCategoryVisual.ts` | Added `toPersianDigits()` (matches the prototype's own `persianNumber()`, used for the hero's real item count) |
| `apps/web/src/components/services/serviceListFilter.ts` | **New** — the extracted, directly-testable search+filter composition function |
| `apps/web/src/app/services/[categoryId]/page.tsx` | Wires the above together: real service count into `CategoryHero`, category-scoped set for empty-state context, dynamic search placeholder, `ServicesErrorState` reused for "category not found," hero-shaped loading skeleton |

**QA tooling** (`deploy/staging/qa/browser/browser-qa.ts`): updated the
category-search placeholder selector to the new dynamic per-category
string (would otherwise have broken against the real deployed app), and
added 2 new deterministic checks for the unified empty-state copy (a
real zero-match `PurchaseMethod`, computed from the live snapshot rather
than hardcoded; and a guaranteed-no-match search term).

**Docs:** this report.

## 13. Tests added/updated

19 new unit tests across 3 new/updated files (all `renderToStaticMarkup`-
based, same established convention, no new test infrastructure):

- `CategoryHero.test.tsx` (**new**, 6 tests): real name/description
  render, real Persian-digit item count, never claims تخفیفی/ترکیبی,
  correct real icon for a mapped category, fallback icon for an unmapped
  one, verbatim label badge text.
- `ServiceGrid.test.tsx` (rewritten, 8 tests): loading/error/populated
  states, the exact prototype empty copy for all of B/C/D, the distinct
  scenario-A copy, and that A takes priority when both could apply.
- `serviceListFilter.test.ts` (**new**, 12 tests): no cross-category
  leakage, "همه" returns everything, an exact real-method subset, a
  zero-match method returns `[]` (not an error), partial title/subtitle
  search matching, search never crosses categories, clearing search
  restores the method-filtered subset, search+filter as a true
  intersection (not a union), "همه" preserves an active search, no
  duplicate results, a fully-unmatched search returns `[]`.

Total Services component test count: 40 (was 20 pre-R1, 32 after R1).
Full web suite: 58/58 passing.

## 14. Quality-gate results

| Gate | Result |
|---|---|
| `pnpm typecheck` (workspace) | PASS |
| `pnpm lint` (workspace) | PASS — 0 errors; 10 pre-existing-pattern `no-img-element` warnings (9 pre-existing + 1 new in `CategoryHero.tsx`, same established convention as every other Services/Home image) |
| `pnpm test` (workspace) | PASS — web 58/58 (was 39 pre-R2), backend/admin unaffected, fully cached |
| `pnpm build` (workspace) | PASS — all Services routes unchanged in shape (`/services` static, `/services/[categoryId]` and `/services/[categoryId]/[serviceId]` dynamic) |

## 15. Known remaining gaps

| # | Gap | Class |
|---|---|---|
| 1 | Live authenticated visual verification (375/390/430/desktop, real RTL rendering) not performed | Must close via the next real staging QA run (§17) — same disclosed limitation as R1 |
| 2 | Product grid mobile column count (1 vs 2) — the prototype's own final CSS cascade winner not adopted, flagged as an open product question | P2 — deliberately not resolved unilaterally |
| 3 | Filter row's native scrollbar not hidden in WebKit browsers (`scrollbar-width:none` set; `::-webkit-scrollbar{display:none}` has no inline-style equivalent) | P3 — cosmetic only |
| 4 | Category Hero uses a small real icon, not the prototype's full-bleed photo — no real per-category photo asset exists | P2/P3 — revisit only if real category photography is ever sourced |
| 5 | `.category-info-strip` (post-selection tip banner) not built | Deferred — content is purchase-flow-adjacent, premature before Purchase Flow |

## 16. Explicit deferrals to R3/R4/R5/R6

- **R3+ (Service Detail):** its own fidelity pass, if scoped later — R2
  only confirmed the existing `cardOnly` contract remains unchanged and
  still passes its own tests.
- **R4/R5 (Purchase Flow, Merchant Detail, transactional logic):**
  untouched, per explicit instruction — `DisabledPurchaseCTA` remains the
  only purchase-related UI anywhere in Services.
- **R6 (possible future Admin ownership of category icons/hero imagery):**
  explicitly not built here — `Category`/`Service`/`PurchaseMethod` remain
  domain/catalog data, not CMS content, matching the existing Home-CMS
  boundary principle. If real category photography and Admin-managed
  hero images are ever approved, §4's dark-photo-hero treatment should be
  revisited then, not preempted now.
- **The single-column-mobile grid question (§10, §15#2)** — a real,
  traced fact from the prototype's cascade, deliberately left as an open
  product decision rather than silently resolved in either direction.

## 17. Staging deployment/QA plan

Same proven mechanism as every prior Services round (SERVICES-R1 through
R1.8): `bash deploy/staging/deploy.sh && ./deploy/staging/run-authenticated-qa.sh`,
run from the existing server shell. Expected to preserve the fully-green
baseline (API 54/0/0, browser 67/0/0) and additionally exercise, for the
first time against real staging: the richer `CategoryHero` (real icon +
real item count rendering correctly for real categories), the corrected
active-filter-chip gradient, the dynamic per-category search placeholder
(the browser QA script's own selector was updated to match — an
un-updated QA script would have failed against this real change, caught
and fixed in this same round), and the new prototype-exact empty-state
copy (2 new deterministic QA checks added, §12). This is the run that
provides the live, authenticated, multi-breakpoint visual confirmation
§10/§15#1 disclosed as not yet performed.
