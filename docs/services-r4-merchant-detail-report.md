# SERVICES-R4 — Merchant Detail Report

Built on the verified SERVICES-R3 staging baseline (revision `214ebbe`,
API QA 54/0/0, browser QA 69/0/0). This report leads with the single
finding that reshapes everything else in it.

---

## 1. Baseline

| | |
|---|---|
| Starting commit | `214ebbe` (SERVICES-R3.1) |
| SERVICES-R1/R2/R3 status | Complete, real staging QA green (API 54/0/0, browser 69/0/0) |
| Regression posture | Not reopened — no R1/R2/R3 file was touched except the two explicitly extended for R4 (`serviceValidation.ts`, the Service Detail page) |

## 2. Prototype mining findings — the central finding

**The approved prototype has no Merchant Detail screen, and no merchant
concept of any kind, anywhere.** This was re-verified directly and
exhaustively this stage, not assumed from memory:

```
grep -ic "merchant"                              → 0 matches (whole 26MB file)
grep -c  "فروشنده" (seller)                       → 0 matches
grep -c  "شعبه" (branch)                          → 0 matches
grep -c  "merchant-detail|merchantDetail|view-merchant|openMerchant" → 0 matches
```

Three non-zero matches were individually inspected to rule out a
disguised merchant screen — none is one:

- **"برند"/"فروشگاه" (brand/store), 8 matches** — all generic landing-page
  marketing copy ("برندهای معتبر و متنوع", "برند و فروشگاه" in a
  partner-pitch section) and one `categoryCatalog` product description
  ("برندهای محبوب") — already known dead code (SERVICES-R1/R2 finding).
  None is a merchant identity screen.
- **"آدرس" (address), 3 matches** — all inside the **Profile** screen's
  own shipping-address management (`profile-address-card`, "آدرس‌ها و
  تحویل"/"Addresses and delivery") — the *user's own* delivery address,
  not a merchant's.
- **"امتیاز" (rating/points), 19 matches** — all loyalty-club points
  copy (missions, referral points, "۸٬۴۲۰ امتیاز باشگاه") and the
  already-documented Service Detail static trust tile ("امتیاز و
  جایزه" — SERVICES-R3's own `.detail-features`, §8 of that report).
  None is a merchant star-rating.

This is the **third independent confirmation** of the same fact across
this engagement: SERVICES-R1's original analysis, SERVICES-R3's
exhaustive mining pass, and this stage's own fresh re-verification all
agree — zero merchant screen, zero merchant reference, in the prototype.

**Consequence:** there is no prototype UI/UX for logo treatment, hero
layout, badges, gallery, address/location, contact info, ratings,
discount/credit/installment presentation, CTA placement, spacing,
typography, colors, radii, shadows, or any responsive behavior specific
to a "Merchant Detail" screen — because that screen does not exist in
the approved reference. Every one of §0's requested mining categories
returns the same answer: not present.

## 3. Domain audit

**Backend schema** (`backend/prisma/schema.prisma`), read directly this
stage:

```prisma
model Merchant {
  id          String  @id @default(uuid())
  name        String
  description String?
  logoKey     String?
  active      Boolean @default(true)
  services    Service[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

That is the **entire** real Merchant model — 4 content fields
(`name`/`description`/`logoKey`/`active`) plus the `Service[]` reverse
relation. No branch, address, geographic/location field, phone,
external link, rating/review, inventory, or discount/credit/installment
configuration exists on `Merchant` anywhere in the schema (those
purchase-method/installment fields live on `Service`, not `Merchant`,
and are already fully presented on Service Detail since SERVICES-R1/R3).

**API**: `GET /merchants` and `GET /merchants/:id`
(`backend/src/modules/merchants/`) both exist, both `@Public()`, both
already correct and unmodified — `findOneOrThrow()` 404s on a missing
id, matching the same `NotFoundException` pattern `services.service.ts`
already uses.

**Live data** (queried directly against real staging this stage, not
assumed from prior docs):

```
GET https://api-staging.biawin.ir/api/v1/merchants?limit=100
→ {"success":true,"data":{"items":[],"total":0,"skip":0,"take":100}}

GET .../services (both pages, 108 real rows)
→ every single one has "merchantId":null
```

**Zero real Merchant rows exist. Zero of the 108 real Services reference
a Merchant.** This is unchanged since SERVICES-R1 first found it — no
merchant data has been added at any point in this entire engagement —
now re-confirmed with a fresh live query rather than carried forward
from memory.

**Frontend**: grepped `apps/web/src` for "Merchant"/"merchant" before
writing any code — the only matches were `ServiceDto.merchantId`'s type
field. No `MerchantDto`, no merchant API client, no merchant component,
no merchant route existed anywhere prior to this stage.

## 4. Prototype/domain support matrix

| Prototype field | Real domain support | API support | Implement now? | Reason |
|---|---|---|---|---|
| Merchant screen/flow itself | N/A — doesn't exist in the prototype | `Merchant` model + `GET /merchants/:id` exist | **Yes, minimally** | Real relationship (`Service.merchantId`) already modeled and reachable; making it safely navigable is legitimate even with no prototype visual reference |
| Merchant name | Real (`Merchant.name`) | Yes | **Yes** | Real field |
| Merchant description | Real, nullable (`Merchant.description`) | Yes | **Yes**, conditionally rendered | Real field; omitted entirely when null, never shown as blank/placeholder |
| Merchant logo/image | Real key exists (`Merchant.logoKey`), **no `imageUrl` resolver** (same pre-existing gap as `Category.imageKey`/`Service.imageKey`, docs/services-ui-contract.md §6 Gap #3) | Key only, not resolvable to a URL | **No** — text/emoji fallback only | Same established pattern every other Services image already uses; not a new gap, not invented imagery |
| Branches | Doesn't exist | None | **No** | No schema field, no prototype reference either |
| Address/location | Doesn't exist on `Merchant` | None | **No** | No schema field; the prototype's only "address" hits are the user's own Profile shipping address, unrelated |
| Phone/contact | Doesn't exist | None | **No** | No schema field |
| Rating/reviews | Doesn't exist | None | **No** | No schema field; the prototype's only "امتیاز" hits are loyalty points, unrelated |
| Discount % | Doesn't exist on `Merchant` (real discount concept doesn't exist anywhere in the domain — already established SERVICES-R1/R2 finding for the فiktional "تخفیفی" purchase method) | None | **No** | Would require inventing a field the schema and the approved product decisions both already reject |
| Gallery/media | Doesn't exist on `Merchant` | None | **No** | No schema field |
| Merchant's other real services | Real (`Merchant.services` reverse relation / `Service.merchantId`) | Yes, via the existing full-catalog fetch, filtered client-side (same pattern `useServiceCatalog` already uses) | **Yes** | The one genuinely useful, fully real, buildable piece of content beyond the 4 identity fields |
| Purchase/CTA into a transaction | Prototype has no Merchant screen to have a CTA on; even Service Detail's own buy button is `DisabledPurchaseCTA` (Purchase Flow is R5) | `POST /orders` exists but does nothing real yet (R1/R3-era finding, unchanged) | **No** | Explicitly R5's scope; would be a fake flow either way |

## 5. Architecture decision

Given §2–§4: this is **not** a prototype fidelity implementation — there
is nothing to be faithful to. It is a **minimal, honest, real-data
implementation** of an already-modeled but previously-unreachable
domain relationship, following the task's own explicit fallback
guidance for exactly this situation ("create only the minimum legitimate
domain/API foundation if it is clearly required," "never invent
business/domain data merely to reproduce the prototype"). No new backend
model, no new database migration, no new seed data — the `Merchant`
model and its API already existed and needed no schema change. This is
scoped as narrowly as the real domain allows: 2 new frontend components
for identity + other-services, 1 new page, 1 new API client function, 1
new validation predicate, 1 new conditional entry point.

**No fictional merchant content was seeded into the real database** —
not even a single "illustrative" merchant — because doing so would be
inventing a real-looking business identity that doesn't exist, exactly
what the task's ABSOLUTE DATA RULE forbids. The consequence (documented
plainly, not glossed over) is in §17.

## 6. Route decision

**`/services/[categoryId]/[serviceId]/[merchantId]`** — the exact shape
the task itself offered as a starting hypothesis, adopted only after
confirming it against the real data model, not blindly: `Service` is
the only entity with a direct FK to `Merchant`
(`Service.merchantId` → `Merchant.id`), and `Service` already carries
its own validated relationship to `Category` (SERVICES-R3). Nesting the
merchant segment one level under the already-validated
`/services/[categoryId]/[serviceId]` preserves the full real context
needed to validate the whole chain (Category → Service → Merchant) from
the URL alone, with real UUIDs throughout — no merchant name/slug is
used as identity anywhere.

## 7. Relationship-validation design

Mirrors SERVICES-R3's `belongsToCategory` exactly, extended one hop:

```ts
// serviceValidation.ts
export function belongsToCategory(service: ServiceDto, categoryId: string): boolean {
  return service.categoryId === categoryId;
}
export function serviceReferencesMerchant(service: ServiceDto, merchantId: string): boolean {
  return service.merchantId === merchantId;
}
```

`MerchantDetailPage` fetches the real `Service` first, checks
`belongsToCategory` (Category integrity, same as R3) **and**
`serviceReferencesMerchant` (new) before ever fetching the Merchant —
a real, active Merchant fetched by ID alone proves nothing about
whether *this* Service actually sells through them. Any failure at
either check, or a genuine 404 from either `GET /services/:id` or
`GET /merchants/:id`, renders the identical "این فروشنده یافت نشد."
not-found state — never a partial or unrelated render. This is the same
integrity guarantee SERVICES-R3 established for Category/Service,
extended consistently rather than reinvented.

## 8. UI components implemented

| Component | Purpose | Real fields only |
|---|---|---|
| `MerchantHero.tsx` | Identity header — name, optional description, generic store-emoji fallback icon (same "no image resolver yet" convention as every other Services image) | `name`, `description`, `logoKey` (fallback only) |
| `MerchantServicesList.tsx` | The merchant's other real services (excludes the one the user arrived from), reusing `ServiceCard` unmodified; a real, honest empty-state message when there are none | `Service.merchantId`-filtered real catalog |
| `MerchantLinkCTA.tsx` | The real, functioning entry point — only ever rendered by the caller when `service.merchantId` is genuinely non-null | N/A (navigation control) |
| `app/services/[categoryId]/[serviceId]/[merchantId]/page.tsx` | Fetches, validates, and composes the above; not-found/error/loading states matching the established Services pattern exactly | — |

Also added: `MerchantDto` + `merchantsApi.getMerchant()` in
`services-api.ts` (mirrors `servicesApi`'s existing shape exactly).

**Not built**, and explicitly not needed given §2–§4: any hero photo/
banner treatment, badge row, gallery, map/location block, or a
merchant-specific CTA beyond navigating to their other real services —
none has a prototype reference or a real field to render.

## 9. Asset decisions

**No new assets were extracted or added.** The prototype has no merchant
imagery to extract (§2) — there is no fictional merchant identity
embedded in the prototype to falsely attach to a real merchant, and none
was invented. `Merchant.logoKey` reuses the exact same "real key exists,
no resolver yet, text/emoji fallback" pattern already established for
`Category.imageKey` (SERVICES-R2) and `Service.imageKey` (SERVICES-R1/
R3) — not a new decision, applied consistently.

## 10. Unsupported prototype fields and why omitted

There are no "unsupported prototype fields" in the usual sense, because
the prototype defines none for this screen (§2). What's omitted here is
everything the *task's own hypothesis* (rating, branches, discount,
address, phone, gallery) suggested a typical merchant screen might have
— all omitted per the ABSOLUTE DATA RULE, option 1 ("omit the
unsupported element"), since none exists in the real domain and none has
prototype backing to reproduce even decoratively.

## 11. Purchase Flow boundary decision

No amount input, checkout, payment-method selection, installment
calculation, credit consumption, invoice creation, or order creation
anywhere in this stage. `MerchantLinkCTA` is a pure navigation control
(browses to real content, the merchant's other real services) — it does
not lead toward a transaction at all, so there is no "boundary CTA" to
style as disabled; Merchant Detail simply doesn't have a purchase
affordance of its own. The originating Service Detail's own
`DisabledPurchaseCTA` (SERVICES-R1, unchanged) remains the only
purchase-adjacent control anywhere in the Services module.

## 12. Responsive behavior

Every new component uses the same token-based (`spacing`/`color`/
`radius`/`typography`) inline-style approach every other Services
component already uses, with the same `repeat(auto-fill, minmax(150px,
1fr))` responsive grid `ServiceGrid`/`MerchantServicesList` share — no
new layout primitive, no new breakpoint logic. **Verified via `next
build`'s static analysis and the component test suite only** (78/78 web
tests) — not via a live authenticated browser session, for the same
disclosed reason as every prior Services stage (`AuthGuard` blocks
direct access; interactive authentication is outside this session's
operating boundaries). Live 375/390/430/desktop confirmation is the next
real staging QA run's job.

## 13. Accessibility

`MerchantLinkCTA` is a real `<button>`, never disabled when rendered
(it's only ever rendered when it leads somewhere real). `MerchantHero`'s
fallback icon is `aria-hidden="true"` with no text alternative needed
(purely decorative, matching `CategoryGrid`/`ServiceCard`'s established
icon-fallback convention). No new icon-only control lacks an accessible
name. No dead anchors, no `href="#"`, nothing added that isn't either
real content or a real, working navigation control.

## 14. Tests

18 new unit tests across 5 new/updated files (all
`renderToStaticMarkup`-based, same established convention):

- `MerchantHero.test.tsx` (**new**, 3 tests): real name/description
  render; description block omitted entirely (not blank) when null;
  never renders any invented field (rating/branch/address/discount).
- `MerchantServicesList.test.tsx` (**new**, 2 tests): honest empty-state
  copy when a merchant has no other real services (today's actual state
  for every real merchant); real other-services render when present.
- `MerchantLinkCTA.test.tsx` (**new**, 1 test): renders as a real,
  enabled button, never disabled.
- `serviceValidation.test.ts` (extended, +3 tests): `serviceReferencesMerchant`
  — real match, real mismatch, and a `null` merchantId never matching
  (the actual state of all 108 real services today).
- `ServiceDetailCardOnly.test.tsx` (extended, +2 tests): the Merchant
  link is absent for a real service with `merchantId: null` (today's
  universal real state) and present (with no full-mode leak) for a
  service that does have one — mirrors the page's own conditional
  exactly.

Total web test count: 78 (was 67 after R3). No page-level test was added
for the not-found/relationship-validation rendering itself, consistent
with the established convention (R1–R3 never added page-level tests
either) — the underlying predicates (`belongsToCategory`,
`serviceReferencesMerchant`) are the directly-tested, authoritative unit
of correctness; the page composition is straightforward `if/else`
wiring around them.

**No fake/synthetic merchant was seeded anywhere** — real database or
otherwise. All positive-content component tests use plain in-memory
fixture objects (the same pattern every other Services component test
in this codebase already uses, e.g. `ServiceCard.test.tsx`'s `service()`
helper) — this is standard unit-test fixture practice, not "silently
adding fictional seed data" (which would mean writing invented business
records into the real, shared staging database — never done here).

## 15. Regression coverage

- SERVICES-R1/R2/R3: zero files under `apps/web/src/{app,components}/
  services/**` were modified except the two files R4 legitimately
  extends (`serviceValidation.ts`, `[serviceId]/page.tsx`) — both
  extensions are additive (new function, new conditional block); no
  existing behavior, prop, or export was changed or removed. Full
  existing test suite re-run and green (78/78, including every R1/R2/R3
  test unchanged).
- cardOnly contract: unaffected — `ServiceDetailCardOnly.test.tsx`'s
  original assertions (no full-mode plan-selection copy) still pass
  unchanged, now additionally proven true both with and without a
  Merchant link present.
- Home/Admin: zero files touched (confirmed by `git status` scope,
  §16).

## 16. Files changed

**Application code** (`apps/web/src/**` only):

| File | Change |
|---|---|
| `apps/web/src/lib/services-api.ts` | Added `MerchantDto` + `merchantsApi.getMerchant()` |
| `apps/web/src/components/services/serviceValidation.ts` | Added `serviceReferencesMerchant()` |
| `apps/web/src/components/services/MerchantHero.tsx` | **New** |
| `apps/web/src/components/services/MerchantServicesList.tsx` | **New** |
| `apps/web/src/components/services/MerchantLinkCTA.tsx` | **New** |
| `apps/web/src/app/services/[categoryId]/[serviceId]/[merchantId]/page.tsx` | **New** — the Merchant Detail route |
| `apps/web/src/app/services/[categoryId]/[serviceId]/page.tsx` | Added the conditional `MerchantLinkCTA` entry point (only when `service.merchantId` is non-null) |

**Tests** (`apps/web/src/components/services/**`): `MerchantHero.test.tsx`,
`MerchantServicesList.test.tsx`, `MerchantLinkCTA.test.tsx` (new);
`serviceValidation.test.ts`, `ServiceDetailCardOnly.test.tsx` (extended).

**QA tooling** (`deploy/staging/qa/browser/browser-qa.ts`): `ServiceSnapshot`
extended with the real `merchantId` field; a data-driven positive check
(runs only if a real service with a merchant is ever found — currently
skips honestly, since none exists), a negative check proving today's
real merchantId-less services correctly never show the Merchant link,
and a negative data-integrity check (real Service + Category, a
syntactically-valid but non-existent Merchant UUID → not-found). No
existing assertion was weakened, removed, or given a broader ERR_ABORTED
exemption.

**Backend, Home, Admin: zero files changed** — confirmed by `git status`
scope for the entire stage.

**Docs:** this report.

## 17. Known limitations

| # | Limitation | Class |
|---|---|---|
| 1 | **Merchant Detail is not reachable by any real user today** — 0 of 108 real services have a `merchantId`, so `MerchantLinkCTA` never renders on real staging, and the positive-path browser QA check honestly `skip`s rather than claiming coverage that doesn't exist | Data gap, not an engineering gap — resolving it means seeding a real merchant/link, a product/data decision outside this stage's scope |
| 2 | Live authenticated visual verification (375/390/430/desktop) not performed | Same disclosed limitation as every prior Services stage |
| 3 | No merchant logo image (text/emoji fallback only) | Same pre-existing, already-documented `imageUrl` resolver gap as Category/Service |
| 4 | The positive-path QA check and the Merchant→Service back-navigation check will only ever execute once real merchant data exists | By design — they're written to activate automatically the moment that happens, not hand-authored against a fake fixture now |

## 18. Staging deployment command

```bash
bash deploy/staging/deploy.sh && ./deploy/staging/run-authenticated-qa.sh
```

Expected to preserve the fully-green R3 baseline (API 54/0/0, browser
69/0/0) and add: the new negative Merchant relationship-validation
checks (real data, no fixture needed), and an honest `NOT_TESTED`/skip
for the positive Merchant-render path, which cannot be exercised until
real merchant data exists. This is the run that provides the live,
authenticated, multi-breakpoint visual confirmation §12/§17#2 disclosed
as not yet performed.
