# Services v1 Implementation Report (Stage 9.1)

Implements the scope approved in `docs/services-ui-contract.md`: Services
List, Category View, Service Detail — a read-only browse experience.
Purchase Flow, Checkout, Payment, Order Confirmation, Credit Purchase,
Installment Creation, and Merchant Detail are all out of scope — there is
no UI for any of them, matching the contract's Tier 2/3 findings that
`POST /orders` doesn't actually debit a wallet/credit line or create an
installment yet, and that `Merchant` has zero seed data.

---

## What was built

```
app/services/page.tsx                           [🆕 replaces Stage 5.2's PlaceholderContent]
├── AppShell                                     [existing, reused unmodified]
├── CategorySelector                             [🆕 components/services/ — chip row, "همه" + 19 categories]
├── ServiceGrid                                  [🆕 components/services/ — loading/empty/error/populated]
│   └── ServiceCard                              [🆕 components/services/ — one product tile]
└── ServicesStates                               [🆕 components/services/ — ServicesEmptyState / ServicesErrorState]

app/services/[categoryId]/page.tsx               [🆕 replaces Stage 5.2's PlaceholderContent]
├── AppShell  pageLabel=<category name>
├── CategorySelector, ServiceGrid, ServiceCard   [same components, reused verbatim — see below]

app/services/[categoryId]/[serviceId]/page.tsx   [🆕 new route, not reserved by Stage 5.2]
├── AppShell  pageLabel=<service title>
├── ServiceHero                                  [🆕 — icon/title/subtitle/badges]
├── Pricing                                      [🆕 — price + method badges + installment range + credit multiplier]
├── ServiceInfo                                  [🆕 — benefits/tags/FAQ, only when present]
└── DisabledPurchaseCTA                          [🆕 — disabled Button + "به‌زودی", same established pattern]
```

New API layer: `apps/web/src/lib/services-api.ts` — imports `CategoryDto`
from `home-api.ts` (type-only, doesn't modify it, same pattern every
prior module used) and adds `servicesApi.listCategories()`,
`servicesApi.listAllServices()`, `servicesApi.getService(id)`.

Shared purchase-method label/tone maps live in
`components/services/serviceMethod.ts` (mirrors
`installmentStatus.ts`'s pattern from Stage 8.1).

## Services List and Category View share one component set

The approved contract's component tree only specified one `ServicesPage`
tree, not two — and `CategorySelector`/`ServiceGrid`/`ServiceCard`
naming (a *selector*, not a link-only category grid) pointed at a single
unified browse experience rather than two independent screens. Both
`app/services/page.tsx` and `app/services/[categoryId]/page.tsx` compose
the identical `CategorySelector` + `ServiceGrid` against one shared hook,
`components/services/useServiceCatalog.ts` (fetches categories + all
services once, same "fetch once, filter client-side" shape
`useCategories` already established on Home):

- `/services` — `activeCategoryId = null`, `CategorySelector` shows a
  "همه" (all) chip active by default, `ServiceGrid` shows every service.
- `/services/[categoryId]` — `activeCategoryId` comes from the route
  param, the matching chip is active, `ServiceGrid` is filtered to that
  category.
- Tapping a different chip in either page calls `router.push` to the
  matching route (`/services` for "همه", `/services/:id` for a category)
  — a real URL change, not just local state, so both routes stay
  independently linkable/bookmarkable.

## `GET /services` has no filter — worked around exactly as the contract's Tier 1 recommended

`docs/services-ui-contract.md` §6 confirmed `GET /services` has no
`categoryId`/`method`/`q` param. Per the contract's own Tier 1 roadmap,
`servicesApi.listAllServices()` fetches the full catalog client-side and
every page filters by `categoryId` in the browser — the same workaround
`useCategories` already uses for the missing `active` filter.

**One correction made during response-shape verification, before
coding:** the contract's Tier 1 note assumed a single unfiltered request
would cover all 108 seeded services. Verified live this session that
`limit` is capped at **100** server-side (`PaginationQueryDto`,
`@Max(100)`) — a `limit=108` request actually fails with `400 limit must
not be greater than 100`. Also discovered live: pagination uses
`page`/`limit` query params (the `skip` field is a read-only getter
derived from them, not a settable query param — `?skip=100` silently
fails with a 500). `listAllServices()` loops `page=1,2,...` until
`items.length >= total`, correctly returning all 108 (100 + 8) rather
than silently truncating at 100.

## Response shapes verified live before coding, per this stage's instruction

- `GET /categories?limit=100` — `{items: CategoryDto[], total:19, skip, take}`, matches the existing `CategoryDto` in `home-api.ts` exactly.
- `GET /services?limit=100&page=1` / `page=2` — `{items: ServiceDto[], total:108, ...}`, matches the `ServiceDto` shape defined in the approved contract exactly, including that `benefits`/`galleryKeys`/`faq`/`tags` are `[]` and `merchantId`/`imageKey`/`priceFrom`/`installmentMin/MaxMonths`/`creditMultiplierLabel` are `null` on every one of the 108 seeded rows — confirmed live via a full-catalog scan, not assumed.
- `GET /services/:id` — returns the single object directly, unwrapped, same pattern as Installment/Credit. A nonexistent id returns `404 {code:"NOT_FOUND", message:"Services not found"}`, surfaced via `ApiError.message` the same way every prior module's not-found case already renders (English message, not translated — pre-existing behavior, not something this stage changed).

## Verifying the "populated" branches with real backend-shape data

Since none of the 108 seeded services actually has non-empty
`benefits`/`faq`/`tags`/`installmentMinMonths`/`creditMultiplierLabel`
(confirmed by scanning the full catalog), a temporary test service was
inserted directly into the local dev database — same established
pattern as every prior module's temp-row verification:

- `availableMethods: ["installment","credit"]`, `installmentMinMonths:3`,
  `installmentMaxMonths:24`, `creditMultiplierLabel`, 2 `benefits`, 1
  `faq` entry, 2 `tags` — all rendered correctly: both method badges,
  the installment-range line, the credit-multiplier line, a benefits
  list, tag badges, and a native `<details>` FAQ entry (collapsed by
  default, question visible, answer inside)
- A real seeded service with all of those fields empty/null (`لوازم
  نوزاد`) was checked immediately after: `ServiceInfo` correctly renders
  nothing at all (not an empty card) when `benefits`/`tags`/`faq` are
  all empty, and `Pricing` correctly omits the installment-range and
  credit-multiplier lines when those fields are `null`
- Category filtering verified end-to-end: tapping "کودک و نوجوان" in
  `CategorySelector` navigated to `/services/16a140a8-...`, updated the
  page header to the category name, and correctly filtered the grid from
  109 services down to exactly the 6 in that category
- Error state verified: navigating to a service id that doesn't exist
  renders `ServicesErrorState` with the backend's 404 message, no crash
- Temporary test service deleted after verification; a fresh tab
  confirmed it no longer appears anywhere in the catalog

## Design system — no `packages/ui` changes

Per this stage's explicit instruction, `CategorySelector`'s chip row is a
plain module-local `<button>` in `components/services/CategorySelector.tsx`
— not a new `packages/ui` primitive, even though the approved contract
(§9) already flagged a Chip/segmented-control as a missing primitive
with other future consumers. `ServiceInfo`'s FAQ uses native
`<details>`/`<summary>` rather than inventing a module-local Accordion
stand-in for the other primitive the contract flagged — avoiding the gap
entirely instead of building a throwaway version of something already
documented as worth building properly later (Profile needs the same
one). `Card`, `Badge`, `Button`, `SkeletonBlock` are all reused as-is,
no new export from `packages/ui`.

## Loading / empty / error states

`ServiceGrid` follows the same `T[] | null` = loading convention as
every prior module's list component (`SkeletonBlock` × 4 in a grid while
loading, `ServicesEmptyState` for a zero-result category, inline red
text for a fetch error). `ServiceDetailPage` has its own independent
loading/error state scoped to the selected service, same shape as
Installment's `InstallmentDetail` (Stage 8.1) — 3 skeleton blocks
standing in for hero/pricing/info while `GET /services/:id` resolves.

## Validation

- `tsc --noEmit` — clean
- `eslint` (full sweep on the new files) — clean, no fixes needed
- `next build` — succeeds; `/services` and `/services/[categoryId]`
  listed as dynamic routes, `/services/[categoryId]/[serviceId]` also
  listed as a new dynamic route

## Responsive validation

All 8 required widths checked live this session, on both the browse
grid and the Service Detail page:

| Width | Result |
|---|---|
| 375×812 | ✅ no overflow |
| 393×852 | ✅ no overflow |
| 430×932 | ✅ no overflow |
| 768×1024 | ✅ no overflow |
| 1024×768 | ✅ no overflow |
| 1366×768 | ✅ no overflow |
| 1440×900 | ✅ no overflow |
| 1920×1080 | ✅ no overflow, `<main>` stays inside the 760px `AppShell` column |

`ServiceGrid` uses `repeat(auto-fill, minmax(150px, 1fr))` rather than a
fixed per-breakpoint column count — this fluidly gives 2 columns at
375–430px and more columns as the 760px-capped shell widens at
768px+, without needing separate breakpoint rules, and was confirmed
zero-overflow at every required width above.

## Scope discipline

`git status` confirms the only new paths are `app/services/` (previously
a Stage 5.2 placeholder, now real), `components/services/`, and
`lib/services-api.ts`. Landing, Orbit, Home, Wallet, Credit, Installment,
Auth, `components/shell/` (AppShell/Navigation), and the backend are all
untouched. (`apps/web/src/app/home/page.tsx` and
`packages/ui/src/components/Modal.tsx` show as modified in `git status`
but predate this stage and were not touched during this implementation.)

---

## Status: Services Module v1 — IMPLEMENTED (browse-only)

Services List, Category View, and Service Detail are real, live-data
features backed entirely by `GET /categories`, `GET /services`, and
`GET /services/:id` — no new backend endpoints. Purchase Flow, Checkout,
Payment, Order Confirmation, Credit Purchase, Installment Creation, and
Merchant Detail remain explicitly out of scope, per
`docs/services-ui-contract.md`'s Tier 2/3 findings — `DisabledPurchaseCTA`
is the only purchase-related UI on Service Detail, and it does nothing
when tapped.
