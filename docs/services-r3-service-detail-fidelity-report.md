# SERVICES-R3 — Service Detail Fidelity Report

Prototype fidelity upgrade of the existing Service Detail
(`/services/[categoryId]/[serviceId]`), built on the verified
SERVICES-R2 staging baseline (revision `7db4936`, API QA 54/0/0, browser
QA 68/0/0). Not a greenfield rebuild.

---

## 1. Scope

Implemented: Service Detail's real cardOnly visual fidelity (a
prototype-mined "card summary" section built from 100% real domain
fields), category/service data-integrity validation, and a distinct
not-found state. Explicitly not touched: Merchant Detail, Purchase Flow,
transaction execution, any R4/R5/R6 concern. Preserved and re-verified:
every R1/R2 baseline item.

## 2. Prototype findings

A dedicated deep-mining pass on `#view-service-detail`
(`openServiceDetail()`, prototype lines 9288–9444, plus its dedicated
cardOnly CSS block at lines 5533–5685) surfaced two findings that change
what "fidelity" means for this screen:

1. **The full 4-payment-method chooser and the compact "card summary"
   section are mutually exclusive, CSS-gated, not just JS-gated.**
   `.detail-payment-options`/`.detail-gallery-section` are
   `display:none !important` in cardOnly mode; `.detail-card-only-info`
   is `display:none` by *default* and only revealed by
   `.card-only-mode`. The `if (cardOnly) return` guard inside the plan
   click handler is a belt-and-suspenders no-op on an already-invisible
   subtree, not a "shown but disabled" pattern. This directly confirms
   R1's original architecture (hide the chooser entirely, never show it
   disabled) was already correct.
2. **The cardOnly-specific "card summary" section
   (`#detailCardOnlyInfo`) has no equivalent anywhere in the current
   implementation.** Its fields (`#detailCardTypeTag`,
   `#detailCardName`, `#detailCardSummary`, `#detailCardValue`,
   `#detailCardFactType`, `#detailCardFactHeadline`,
   `#detailCardFactCategory`, `#detailCardTags`) are populated from a
   synthetic per-card payload in the prototype, but map cleanly onto
   real `Service`/`Category` fields with **zero invention required** —
   this is this stage's main implementation.

Also confirmed, precisely: `#detailBack` calls `openView(sourceView)`
directly (never `history.back()`), matching Category View's already-
established `replaceState`-only routing model exactly, for this screen
too — not a new finding, a confirmation. Merchant content: grepped the
entire 26MB file for "merchant"/"Merchant" — **zero matches anywhere**,
not just this screen. The 3 gallery buttons remain confirmed dead (no
click handler anywhere). FAQ content is prototype-templated in both
modes (interpolated strings, never sourced from `buildServiceOffers()`/
`categoryCatalog`) — our real `service.faq` field is **more real** than
the prototype's own content here, not a gap to close.

## 3. Detail-state matrix

| Prototype element | Current implementation (pre-R3) | Real domain support | R3 action | Deferred release |
|---|---|---|---|---|
| Header title (`#detailHeaderTitle`, dynamic full / static "جزئیات کارت" cardOnly) | No in-page header title exists (shared `GlobalHeader` has no per-page title slot) | N/A | **Not built** — consistent with R1's identical `CategoryHero`/back-button reasoning: no page-title slot exists anywhere else in this app either | — |
| Hero (photo + gradient scrim + 3 stats) | `ServiceHero` — icon/emoji + title + subtitle + 2 badges, no photo, no stats | Title/subtitle real; no per-service photo (`Service.imageKey` unresolved, R1-era gap) | **Not rebuilt as a photo hero** — same reasoning as `CategoryHero` (R2): no real image asset exists to use without inventing one | Revisit if `imageUrl` resolution + real service photography ever ship |
| **cardOnly card-summary (`#detailCardOnlyInfo`)** | **Did not exist** | Real: title, subtitle, priceLabel, primary `PurchaseMethod`, `creditMultiplierLabel`/installment range/badge, real category name, tags | **Built** — `ServiceDetailCardSummary`, 100% real fields (§7) | — |
| Full 4-method chooser (`.detail-plans`) | Not built | No real Home-origin caller exists today (§5) | **Not built** — nothing to preserve or regress; would be premature Purchase-Flow UI regardless | R5 (Purchase Flow) if a real full-mode entry point is ever added |
| Sticky buy bar | `DisabledPurchaseCTA` (disabled button + caption, not fixed-position) | Real disabled-CTA pattern, already established app-wide | **Unchanged** — already correct per R1's "no fake flows" finding | R5 |
| Gallery (3 dead buttons) | Not built | `galleryKeys` empty for every real service | **Not built** — same R1 reasoning, reaffirmed: building even a real gallery shell would render empty for every real service today | Build once real gallery content exists |
| Benefits/features (4 static trust tiles) | `ServiceInfo`'s real `benefits[]` list | Real, already domain-derived | **Unchanged** — our real per-service benefits list is *more real* than the prototype's 4 identical-for-every-card static tiles; not replaced with static decoration | — |
| FAQ | `ServiceInfo`'s real `faq[]` (native `<details>`) | Real, already domain-derived | **Unchanged** — confirmed this stage the prototype's own FAQ is templated placeholder text in both modes, never real data; ours already is | — |
| Merchant content | Not built | Doesn't exist in prototype OR backend (0 merchant matches, 0 seed rows) | **Not built** — nothing to defer structurally beyond what's already true | R4 (Merchant Detail), if ever |
| Back affordance | Native browser back only | N/A | **Unchanged** — confirmed again this stage: prototype's own back button exists only because it has no real browser history (`replaceState`-only); doesn't apply to this real multi-route app | — |
| Category/service relationship | **Not validated** — a service was rendered if it existed at all, regardless of URL categoryId | Real, checkable client-side | **Fixed** (§13) | — |

## 4. cardOnly contract

**Reconfirmed, unchanged architecture, stronger evidence.** Grepped every
`router.push` into a `/services/**` route across the entire app this
stage: the only real caller of the two-segment Service Detail route is
Category View's own product-card click
(`app/services/[categoryId]/page.tsx`). Home's `ServiceBannerGrid`/
`ServiceMosaic` both navigate only to `/services/${categoryId}`
(Category View) — **never** to a specific service. There is, today, **no
real Home-origin entry point into this route at all**. This route
remains unconditionally cardOnly-equivalent, exactly as R1 documented —
restated here as a freshly re-verified fact, not an assumption carried
forward unchecked.

No runtime mode flag was introduced (none is needed without a second real
caller). If a future stage adds one, the existing doc comment's
requirement stands: an explicit, typed signal, never inferred from
history/referrer, and direct URL navigation must keep resolving
identically either way — unchanged from R1, re-verified by the
`ServiceDetailCardOnly.test.tsx` composition test (now including
`ServiceDetailCardSummary`) and the cold-direct-URL browser QA checks.

## 5. Home-origin vs Services-origin behavior

Home-origin "full mode" **does not exist as a real code path today** —
see §4. There is therefore no full-mode behavior to regress-test beyond
confirming it doesn't exist by accident (which the grep above does,
directly). No fake Home-origin entry point was invented merely to have
something to test — that would be scope creep beyond what's real. If R4/
R5 ever add one, its own regression suite should be built then, against
real behavior, not simulated here.

## 6. Prototype/current gap matrix

See §3 (the detail-state matrix already serves this purpose in full,
per the task's own structure — not duplicated here as a second table).

## 7. Domain-supported fields

Every field `ServiceDetailCardSummary` renders is a real `ServiceDto`/
`CategoryDto` field, no exceptions:

| Prototype field | Real field used | Notes |
|---|---|---|
| `#detailCardTypeTag` / `#detailCardFactType` | `service.availableMethods[0]` → `PURCHASE_METHOD_LABEL` | Same "show the primary method" precedent `ServiceCard` already established (R1) |
| `#detailCardName` | `service.title` | |
| `#detailCardSummary` | `service.subtitle` | The DTO has no separate long-form description field |
| `#detailCardValue` | `service.priceLabel` | |
| `#detailCardFactHeadline` | `service.creditMultiplierLabel`, else an installment-month range, else `service.badge` | A 3-step real-data fallback chain, never an invented phrase — see §9 |
| `#detailCardFactCategory` | Real `Category.name`, fetched via the same `useServiceCatalog()` hook Category View already uses | New: the Detail page previously fetched only the service, never the category |
| `#detailCardTags` | `service.tags` | |

## 8. Unsupported synthetic fields

Nothing from the prototype's synthetic financial-card concept was ported:
no fake "BIAWIN MEMBERSHIP CLUB" branding, no fake card number/expiry
("VALID 08/29"/"•••• 2088", static and identical on every prototype
card), no floating-card animation, no fictional "کارت اقساطی/اعتباری…
{category}" naming. Same reasoning R2 already established for the
Category-View product cards, reaffirmed here for Service Detail's own
card-summary visual — the *shape* of the prototype's fact-card layout was
reproduced (§9's mining), the *fictional content* inside it was not.

## 9. Hero/visual decisions

**IMPLEMENTATION DECISION:** no full-bleed photo hero — same reasoning as
`CategoryHero` (R2): `Service.imageKey` has no resolver, and no real
per-service photography exists to use without inventing one.
`ServiceHero` is unchanged.

**DOMAIN-DERIVED, new this stage — the fallback chain for
`#detailCardFactHeadline`'s "main condition" fact** (`ServiceDetailCardSummary.tsx`'s
`mainConditionLabel()`): prefers `creditMultiplierLabel` (already real,
already shown elsewhere by `Pricing`), falls back to an installment
month range (`installmentMinMonths`–`installmentMaxMonths`, same
plain-digit convention `Pricing.tsx` already uses — not a new gap), and
finally falls back to the real `badge` field, which every real service
has. No branch of this chain can produce an invented value.

## 10. PurchaseMethod presentation

Unchanged real semantics from R1/R2 — `PURCHASE_METHOD_LABEL`/
`PURCHASE_METHOD_TONE` map the 4 real enum values only, never the
prototype's fictional "تخفیفی"/"ترکیبی" or its literal card-type strings
("اقساطی"/"اعتباری"/"پرداخت کامل"/"رایگان / جایزه" as *plan names* — our
labels are the same 4 real concepts, phrased consistently with the rest
of the app, not copied verbatim from the prototype's plan-card copy).
`ServiceDetailCardSummary`'s "نوع خدمت" fact reuses this exact same real
mapping — no second, parallel label set was introduced.

## 11. CTA classification

Every CTA/control on this screen, classified per the task's own A–E
scheme:

| Control | Classification | Treatment |
|---|---|---|
| `DisabledPurchaseCTA` ("خرید این خدمت") | **D. Future Purchase Flow** | Rendered as a real `disabled` button + visible "به‌زودی" caption (established app-wide pattern) — never a fake-looking active button |
| Gallery (3 buttons) | **E. Unsupported / dead prototype control** | **Not rendered at all** — no dead anchors, no `href="#"`, nothing to click. Confirmed by the existing, still-passing "no dead-end anchors" browser QA check |
| Merchant CTA/card | **N/A — doesn't exist in the prototype or backend** | Nothing to classify or defer beyond what's already true |
| Back control | **A. Real and already supported** | Native browser back, verified by the permanent isolated back-navigation QA test |
| FAQ toggle | **A. Real and already supported** | Native `<details>`/`<summary>`, real per-service data |

No `href="#"`, no fake routes, no dead clickable anchors were introduced
anywhere in this stage's changes.

## 12. Merchant deferrals

Nothing to defer beyond the already-documented fact (§2/§10): Merchant
has zero prototype UI (confirmed exhaustively this stage — zero matches
for "merchant" anywhere in the 26MB file), zero seed rows, zero
`Service.merchantId` links (R1-era finding, still true). SERVICES-R4, if
it happens, starts from nothing here — no structural boundary needed to
preserve since none of this screen's real code references merchants at
all.

## 13. Purchase Flow deferrals

Unchanged from R1: no amount input, checkout, payment execution,
installment calculation, credit consumption, invoice creation,
confirmation, OTP, or payment gateway anywhere in this stage's changes.
`DisabledPurchaseCTA` remains the sole purchase-related UI. The
`.detail-buybar`'s exact CSS (`position:fixed;bottom:76px`, centered
gradient button) was mined but **not implemented as a fixed bar** — R1's
existing `AppShell`/`BottomNavigation` overlap concern
(`docs/services-ui-contract.md` §8) is unresolved and out of this stage's
scope; `DisabledPurchaseCTA` stays in normal document flow, matching R1.

## 14. Navigation contract

Unchanged and re-verified: `/services` → category → detail → back
(same category) → back (`/services`), cold direct URL stability, no
custom back implementation. The permanent isolated back-navigation QA
test (SERVICES-R1.7/R1.8) was not modified and continues to be the
authoritative check for this. `page.tsx`'s dependency array now includes
`params.categoryId` alongside `params.serviceId` (needed for the new
validation check) — this does not change when the effect fires in any
reachable real navigation path (Category View always navigates with both
segments changing together; a bookmarked/typed direct URL always mounts
fresh).

## 15. Error/not-found behavior

**Fixed, real gap (§7 of the task, "Not Found / Data Integrity"):** the
page previously fetched `GET /services/:id` and rendered whatever came
back with **no check against the URL's own `categoryId`** — since that
endpoint has no category-scoping of its own,
`/services/{anyCategoryId}/{realServiceId}` would silently render a real
service as if it belonged to the wrong category. Now validated
client-side (`belongsToCategory()`, `serviceValidation.ts`, unit-tested)
and treated identically to a real 404 — both surface the same distinct
"این خدمت یافت نشد." state, reusing `ServicesErrorState` (the same
component Category View already uses for "این دسته‌بندی یافت نشد.").
Genuine network/server errors remain a **separate** state
(`ApiError.status !== 404`), never downgraded to "not found," and never
shown as raw exception text.

## 16. Responsive behavior

**Verified via `next build`'s static analysis and the component test
suite** (67/67 web tests passing) — **not** via a live authenticated
browser session, for the same disclosed reason as every prior Services
stage: `AuthGuard` blocks direct access, and interactive authentication
is outside this session's operating boundaries. The existing R1 browser
QA screenshots at 375/390/430/desktop for Service Detail
(`services-detail-cardonly-*`) remain in place and now also exercise the
new `ServiceDetailCardSummary` section (it renders inline in the normal
document flow, participates in the same responsive column/spacing rules
already validated). Live, authenticated, multi-breakpoint confirmation
is the next real staging QA run's job (§20), consistent with every prior
Services fidelity stage's own disclosure.

## 17. Accessibility

No regressions. `ServiceDetailCardSummary`'s fact cells are plain
`<div>`/`<span>`/`<b>` (non-interactive, no fake button semantics) — the
task's "badges should not masquerade as controls" requirement is
satisfied by construction (nothing in the new component is clickable).
No new icon-only controls were added. Heading hierarchy is unchanged
(`ServiceHero`'s `<h1>` remains the only heading on this page — the new
summary section uses `<strong>`, not a competing heading level).

## 18. Files changed

**Application code** (`apps/web/src/**` only — zero Admin, zero backend, zero Home files):

| File | Change |
|---|---|
| `apps/web/src/app/services/[categoryId]/[serviceId]/page.tsx` | Category/service relationship validation (§15), distinct not-found state, real category name fetched via `useServiceCatalog`, `ServiceDetailCardSummary` inserted into the composition, prototype-mined subtle page background gradient |
| `apps/web/src/components/services/ServiceDetailCardSummary.tsx` | **New** — the real-data cardOnly fact-card summary (§7/§9) |
| `apps/web/src/components/services/serviceValidation.ts` | **New** — `belongsToCategory()`, the extracted, directly-testable category/service validation predicate |

**QA tooling** (`deploy/staging/qa/browser/browser-qa.ts`): the
Services-origin cardOnly click-flow check now also asserts the real
clicked service's title, the real category name, and the real primary
method label all actually render (not just "a" cardOnly page rendering
correctly); added one new negative data-integrity case — a real service
fetched under a mismatched real category's URL must render "این خدمت
یافت نشد." and never the mismatched service's own title.

**Docs:** this report.

## 19. Tests

10 new unit tests across 2 new files, plus 1 updated composition test
(all `renderToStaticMarkup`-based, same established convention):

- `ServiceDetailCardSummary.test.tsx` (**new**, 7 tests): real title/
  subtitle/price render, real category name render, primary real method
  as the type fact (never invented), the 3-step `creditMultiplierLabel`
  → installment-range → `badge` fallback chain (each step individually
  verified), real tags render / correctly absent when empty.
- `serviceValidation.test.ts` (**new**, 2 tests): a real service matching
  its URL's category returns `true`; a real, existing service belonging
  to a *different* real category returns `false`.
- `ServiceDetailCardOnly.test.tsx` (updated): the cardOnly composition
  check now includes `ServiceDetailCardSummary`, still asserting zero
  full-mode plan-selection copy renders.

Total web test count: 67 (was 58 after R2). Services component test
count: 49 (was 40 after R2).

## 20. Quality gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (workspace) | PASS |
| `pnpm lint` (workspace) | PASS — 0 errors; 10 pre-existing-pattern `no-img-element` warnings, unchanged from R2 (this stage added no new `<img>`). One real lint error was found and fixed during this stage: an initial draft called `setState` synchronously inside the fetch effect's body (`react-hooks/set-state-in-effect`) — removed; the resets weren't actually needed since every real reachable navigation path into this route already fully remounts the component (a bookmarked/direct URL is always a fresh mount; Category View always changes both URL segments together) |
| `pnpm test` (workspace) | PASS — web 67/67 (was 58), backend/admin unaffected, fully cached |
| `pnpm build` (workspace) | PASS — all Services routes unchanged in shape |

## 21. Known remaining gaps

| # | Gap | Class |
|---|---|---|
| 1 | Live authenticated visual verification (375/390/430/desktop) not performed | Must close via the next real staging QA run — same disclosed limitation as R1/R2 |
| 2 | No real per-service photo (`ServiceHero` stays icon/emoji-only) | Revisit only if `imageUrl` resolution + real photography ever ship |
| 3 | `DisabledPurchaseCTA` is not a fixed/sticky bottom bar (the prototype's `.detail-buybar` is `position:fixed`) — the pre-existing, documented `BottomNavigation` overlap conflict (`docs/services-ui-contract.md` §8) remains unresolved | Deferred — needs an `AppShell`-level decision, out of this stage's scope |
| 4 | No gallery, no benefits-tile trust-badge row (the prototype's 4 static generic tiles) | Deliberately not built — see §3/§8; real per-service `benefits[]` already covers the "why trust this" need with real content instead of decoration |

## 22. R4/R5/R6 deferrals

- **R4 (Merchant Detail):** nothing to build on or structurally preserve
  — zero prototype/backend precedent, confirmed exhaustively this stage.
- **R5 (Purchase Flow):** `DisabledPurchaseCTA` remains the sole
  purchase-related UI; the sticky-buy-bar/`BottomNavigation` layout
  question (§13/§21#3) should be resolved before this is built, not
  preempted here.
- **R6 (possible future Admin ownership of service imagery):** not
  built, matching the same domain-vs-CMS boundary R2 already established
  for categories.

## 23. Staging QA plan

Same proven mechanism as every prior Services round:
`bash deploy/staging/deploy.sh && ./deploy/staging/run-authenticated-qa.sh`,
run from the existing server shell. Expected to preserve the fully-green
baseline (API 54/0/0, browser 68/0/0) and additionally exercise, for the
first time against real staging: the new `ServiceDetailCardSummary`
section rendering with real title/category/method data, and the new
negative data-integrity case (a real service under a mismatched real
category's URL correctly renders not-found). This is the run that
provides the live, authenticated, multi-breakpoint visual confirmation
§16/§21#1 disclosed as not yet performed.

---

## SERVICES-R3.1 — real staging QA failure, root cause, and fix

`9ada9a6` was deployed and QA'd against real staging. Two independent
issues surfaced — recorded honestly, not merged into a false "all green":

1. **MinIO storage at its free-space threshold**, rejecting uploads. An
   infrastructure/server issue, being handled separately at that layer.
   **Not touched here** — no storage code, no upload-error handling, no
   test was weakened, skipped, or reclassified to route around it.
2. **A real, provable R3 application bug**:
   `Service Detail — Services-origin click navigation renders cardOnly`
   failed with "expected the real category name 'گردشگری' to render on
   Service Detail (ServiceDetailCardSummary)," for the real flow
   `/services` → گردشگری → "رزرو هتل" → Service Detail. The new R3
   data-integrity check (wrong-category service → not-found) **passed**,
   confirmed intact and not touched by this fix.

### Root cause (proven from code, not guessed)

`ServiceDetailPage` runs **two independent async operations** with no
ordering guarantee between them: its own `GET /services/:id` call
(`service` state), and `useServiceCatalog()`'s separate, heavier,
paginated fetch of categories + all 108 services (`categories` state,
which `categoryName` is derived from). The R3 composition rendered as
soon as `service !== null`, with no dependency on `categories` at all.
Since the single-service fetch is materially lighter than the full
paginated catalog fetch, `service` can — and, on real staging, did —
resolve first. In that window, `ServiceDetailCardSummary` rendered with
`categoryName === ""` (a real, live content gap for a real user, not
merely a QA artifact): the QA script's own synchronization point (wait
for the real disabled-CTA button) is tied to `service`, not
`categories`, so it doesn't wait long enough for the category name to be
ready either — which is exactly why the assertion caught a real,
reachable gap rather than a flaky test.

This is confirmed by reading `page.tsx`'s pre-fix render logic directly:
`{... service !== null && (<>...<ServiceDetailCardSummary
categoryName={categoryName} />...)}` had no `categories !== null`
condition anywhere. Ruled out as the cause: `categories?.find()` failing
to locate گردشگری at all — it's one of the 19 real, active seeded
categories, used as the reference "asset-mapped" category throughout
every prior Services QA round; `useServiceCatalog()`'s `active`-only
filter would only hide it if it were inactive, which it demonstrably
isn't. The QA selector/assertion itself was correct as written — it was
never weakened, because the application was proven to be the real cause,
not the test.

### Fix

`app/services/[categoryId]/[serviceId]/page.tsx`: the "content ready"
condition now requires **both** `service !== null` **and**
`categories !== null` — the loading skeleton stays visible until the
real category name is genuinely resolvable, and the full composition
(including `ServiceDetailCardSummary`) only ever renders once it is. No
UUID fallback, no hardcoded "گردشگری" or any other literal category
name, no invented placeholder text — `categoryName` is still derived
exactly as before (`categories.find(c => c.id === params.categoryId)?.name`),
just no longer read before it can possibly be correct. `notFound`/`error`
states are unaffected — those depend only on the `service` fetch and
still resolve immediately, unchanged.

A useful side effect: because the whole composition (including
`DisabledPurchaseCTA`) now only renders once both fetches have settled,
the QA script's existing wait-for-the-real-CTA-button synchronization
point becomes a correct proxy for the category name too — **no browser
QA change was needed or made**; the same assertion that failed on real
staging is expected to pass once this fix is live, without having been
touched.

### Regression coverage

- `belongsToCategory()`/`serviceValidation.test.ts` (SERVICES-R3) —
  **unchanged, unweakened**, re-verified still passing: a real service
  under its real category's URL validates true; under a different real
  category's URL validates false.
- `ServiceDetailCardSummary.test.tsx` (SERVICES-R3) — **unchanged**,
  re-verified still passing: real title/subtitle/price, real category
  name (as passed in), real primary method, the 3-step condition
  fallback chain, real tags. These already prove the component renders
  the real category correctly *given* a resolved name — the R3.1 bug was
  never in this component, it was in when the page decided to pass one
  in.
- **No new unit test was added for the async race itself.** Checked
  first whether this codebase's existing test tooling could express it:
  every Services/Home test uses `renderToStaticMarkup` (a single,
  synchronous pass — `useEffect` does not fire during it, so two
  independently-resolving fetches racing each other cannot be
  represented), and the one place `jest.mock` appears in this codebase
  (`ServiceBannerGrid.test.tsx`) only stubs `next/navigation`'s
  `useRouter`, not an async data hook, for the same reason. Building a
  real async-race simulation would mean introducing new test
  infrastructure (React Testing Library, `act()`, fake timers) for a
  single fix — assessed as disproportionate. The **live browser QA
  check that originally caught this bug is the correct, proportionate
  regression test for it**, and it was left completely unmodified so
  that it keeps meaning exactly what it meant when it failed.
- Full existing suite re-run and confirmed green: 67/67 web tests
  (unchanged count — this fix touched no test files), typecheck/lint/
  build all clean.

### Confirmations

- **cardOnly contract**: unchanged. No full payment-method chooser, no
  Home-origin flow, no Merchant Detail, no Purchase Flow, no Admin
  Services content were added — this fix is a single composition-timing
  condition in one existing file.
- **Wrong-category protection**: intact and re-verified, not touched by
  this fix (see above).
- **No R4/R5/R6 scope pulled forward.**

### Application files changed

`apps/web/src/app/services/[categoryId]/[serviceId]/page.tsx` only —
zero Admin/backend/Home files, zero QA files, zero new/changed test
files.

### Status

**Not closing SERVICES-R3.** This fix has not yet been re-verified
against real staging. The MinIO free-space incident must also be
resolved before a real closure run can show 0 FAIL/0 NOT_TESTED on both
API and browser QA — this document will record that real run's actual
result when it happens, not before.
§16/§21#1 disclosed as not yet performed.
