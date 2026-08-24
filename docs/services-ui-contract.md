# Services UI Contract (Stage 9.0 — Analysis Only)

Single source of truth for implementing the Services Marketplace module.
No frontend code, no components, no backend changes, and no edits to
Home/Wallet/Credit/Installment/Landing/Orbit/Auth/AppShell/Navigation
were made to produce this — pure analysis, same discipline as
`docs/wallet-ui-contract.md`, `docs/credit-ui-contract.md`, and
`docs/installment-ui-contract.md`.

**Services is the module the other three were built around.** Wallet,
Credit, and Installment each independently found the same root cause:
`POST /orders` creates a bare `Order` row and does nothing else — no
wallet debit, no credit-limit check, no installment record. This stage
confirms that finding from the *purchase* side rather than the
*financial-account* side: Services is where a real purchase would
originate, and the same gap blocks it here too.

---

## 1. Screen Inventory

Cross-checked against `docs/01-prototype-analysis.md` §2 (the 9-view
prototype route table) and `docs/prototype-to-production-mapping.md`
§A.4–6 and §A.14 (already-written screen-level mapping for this exact
module, produced before this stage existed — reused, not duplicated).

| Screen | Purpose | User goal | Entry point | Exit point | Status |
|---|---|---|---|---|---|
| **Services List** | Full grid of ۱۸+（19 seeded) service categories | "What kinds of things can I buy here?" | Bottom nav "خدمات" · Home Quick Actions (currently disabled, see §9) · Home's `FeaturedServiceBanner` tiles (currently disabled placeholders) | Tap a category → Category View | **PRESENT** — prototype view `services` |
| **Category View** | Products/cards inside one category, with payment-method filter + search | "Show me what's in this category, filtered by how I want to pay" | Services List (tap category) | Tap a product → Service Detail | **PRESENT** — prototype view `service-category`; production route `/services/[categoryId]` already reserved as a Stage 5.2 placeholder |
| **Service Detail** | Full product page: purchase methods, benefits, gallery, steps, FAQ, sticky buy bar | "Decide how to buy this and commit" | Category View · Home search (not yet built) | Selects a method → Purchase Sheet | **PRESENT** — prototype view `service-detail` |
| **Merchant Detail** | A page about the seller of a service | "Who is this from, can I trust them?" | *(none — no prototype entry point)* | *(none)* | **NOT PRESENT IN PROTOTYPE.** No such view exists in the 9-view route table, and `docs/01-prototype-analysis.md` never mentions "merchant" outside the unrelated brand-color token. The backend `Merchant` model exists (§5, §6) but has **zero prototype UI, zero seed rows, and zero services linked to any merchant** (verified live this session — see §9). |
| **Purchase Flow** | Choosing a purchase method (credit/installment/cash/free) for one product | "Pick how I'm paying" | Embedded inside Service Detail (`PurchaseMethodSelector`, 4 cards) | Opens Purchase Sheet | **PRESENT, but not a standalone screen** — it's a selector *inside* Service Detail, not its own route. |
| **Checkout** | A dedicated cart/checkout page | "Review everything and pay" | — | — | **NOT PRESENT IN PROTOTYPE AS A SEPARATE SCREEN.** The closest equivalent is **Purchase Sheet** (`docs/prototype-to-production-mapping.md` §A.14) — a small confirm `BottomSheet` opened directly from Service Detail, not a full page. There is no multi-item cart concept anywhere in the prototype or schema; every purchase is single-service. |
| **Confirmation** | A dedicated "your order succeeded" screen | "Did it work?" | — | — | **NOT PRESENT IN PROTOTYPE AS A DEDICATED SCREEN.** Every other confirmation moment in the prototype (Card Detail activation, §A.3) resolves with a `Toast`, not a full screen. `docs/prototype-to-production-mapping.md` J9 confirms the actual destination after a purchase is **Profile → خریدها** (order history), not a standalone confirmation page. |

**Not requested but worth flagging as adjacent, already-scoped-elsewhere
screens** (do not build here, listed only so this contract doesn't
silently duplicate them): `FeaturedServiceBanner`/`ServiceTicker` on Home
already render category data today (Stage 4.3) — this module's Services
List supersedes them as the "real" destination those tiles should
eventually link to, but changing Home is explicitly out of scope for
this stage.

---

## 2. User Journeys

Reusing `docs/prototype-to-production-mapping.md` §B's already-verified
journey definitions (J5, J6, J9) rather than re-deriving them, and
re-checking each backend claim live this session.

### Browse Services — **exists in prototype, partially exists in backend**

```
Home / Bottom Nav
 ↓
Services List           GET /categories                    ✅ exists
 ↓
Category View            GET /services?categoryId=&method=  ❌ missing — no filter param on GET /services today
 ↓
Service Detail            GET /services/:id                 ✅ exists
```

### Purchase (cash / free) — **exists in prototype, partial in backend**

```
Service Detail
 ↓ select method (cash | free)
Purchase Sheet (confirm)
 ↓
POST /orders {serviceId, method, amount}   ✅ endpoint exists
                                            ❌ but only creates a bare
                                               `pending` Order — no
                                               payment actually happens,
                                               no wallet debit for a
                                               real "cash" charge
```

### Credit Purchase — **exists in prototype, blocked in backend**

```
Service Detail
 ↓ select "اعتباری" (credit)
Purchase Sheet
 ↓
POST /orders {method:"credit"}   ✅ endpoint exists
                                  ❌ never checks CreditLine.limitAmount
                                     vs usedAmount, never writes a
                                     CreditUsage row — confirmed again
                                     this session in
                                     orders.service.ts (unchanged since
                                     Stage 7.0's identical finding)
 ↓
Installment                       — n/a for credit method
```

### Installment Purchase — **exists in prototype, blocked in backend (two separate gaps)**

```
Service Detail
 ↓ select "اقساطی" (installment), pick 3–36 months
Purchase Sheet
 ↓
POST /orders {method:"installment", installmentMonths}
                                  ❌ CreateOrderDto has no
                                     `installmentMonths` field at all
                                     (re-confirmed this session,
                                     unchanged since Stage 8.0's
                                     identical finding) — nowhere to
                                     send the month selection even if
                                     the UI existed
 ↓
Order created (pending)           ✅ Order row is created
 ↓
Installment record                ❌ orders.service.ts never creates an
                                     `Installment` row — confirmed this
                                     session; this is the same root
                                     cause Stage 8.0 already identified
                                     from the Installment module's side
```

### Merchant lookup — **missing on both sides**

No prototype screen, no seed data, no service-to-merchant links exist.
Not a journey that can be defined against anything real (§1).

**Summary against the requested exists/backend/partial/missing
taxonomy:**

| Flow | Prototype | Backend | Verdict |
|---|---|---|---|
| Browse (List → Category → Detail) | Exists | Partial (List + Detail work; Category needs a filter) | **Partial** |
| Purchase — cash/free | Exists | Partial (creates a row, doesn't actually transact) | **Partial** |
| Purchase — credit | Exists | Partial (creates a row, no credit enforcement) | **Partial** |
| Purchase — installment | Exists | Missing (2 gaps: no `installmentMonths` field, no `Installment` row created) | **Missing** |
| Merchant browsing | Missing | Missing (endpoint exists, zero usable data) | **Missing** |

---

## 3. Service Module Boundary

Ownership, following the same "who owns what" exercise
`docs/installment-ui-contract.md` §6 already ran for
Wallet/Credit/Installment, extended here with Services/Categories/Merchants:

```
Categories:    taxonomy — grouping metadata for discovery only
               (name, description, keywords, sortOrder, active)

Services:      catalog — product identity, pricing display, purchase-
               method eligibility, content (benefits/gallery/FAQ)
               NOT: whether a purchase is allowed to succeed — that's
               Orders/Credit/Installment's job, and today none of them
               actually enforce anything (see §9)

Merchants:     attribution only — who sells a service (optional,
               nullable link). No products, no orders, no financial
               data of its own. Currently unused in practice (§1, §9).

Orders:        the single owner of "did a user attempt/complete a
               purchase" — one Order row per purchase, references
               exactly one Service, one User, one method, one amount

Credit:        owns limit/used/available/status only — does not (yet)
               get mutated by Orders

Installments:  owns per-order repayment terms only — does not (yet)
               get created by Orders
```

**The critical finding, stated plainly:** `Order` is architecturally
meant to be the fulcrum connecting Service ↔ Wallet/Credit/Installment,
but as of this session, **creating an Order cascades into none of the
other three** — `orders.service.ts` (re-read this session) does exactly
one thing: `prisma.order.create({...status:'pending'})`, nothing else.
This is the same Foundation-level gap Wallet (Stage 6.0), Credit (Stage
7.0), and Installment (Stage 8.0) each found independently from their
own side — this stage confirms it's the same single root cause, visible
from the Orders side too, not three unrelated gaps.

---

## 4. Component Tree

```
app/services/page.tsx                        [🆕 replaces Stage 5.2's PlaceholderContent]
│
├── AppShell                                  [existing — reused as-is]
│   activeNavKey="services"  pageLabel="خدمات"
│   │
│   ├── PageHeader                            [existing, via AppShell]
│   ├── PageContainer                         [existing, via AppShell]
│   │   │
│   │   ├── SearchInput                       [🆕 — no existing search component; `Input` exists but not a search-styled variant]
│   │   ├── CategoryGrid                      [🆕 — 2-col grid, same layout `FeaturedServiceBanner` already validates on Home]
│   │   │   └── CategoryTile                  [🆕 — Card + category name, tappable → Category View]
│   │   └── States                            [🆕 — empty/error, same shared-helper pattern as every prior module]
│   │
│   └── BottomNavigation                      [existing, via AppShell]

app/services/[categoryId]/page.tsx            [🆕 replaces Stage 5.2's PlaceholderContent — route already reserved]
│
├── AppShell  activeNavKey="services"  pageLabel="<category name>"
│   ├── SearchInput                           [🆕 — same component as above, reused]
│   ├── FilterChipRow                         [🆕 — no Chip/segmented-control primitive exists anywhere in `packages/ui` today]
│   ├── ServiceGrid                           [🆕]
│   │   └── ServiceCard                       [🆕 — Card + Badge(method) + price]
│   └── States                                [🆕]

app/services/[categoryId]/[serviceId]/page.tsx  [🆕 — NEW route, not reserved by Stage 5.2; proposed here]
│
├── AppShell  activeNavKey="services"  pageLabel="<service title>"
│   ├── ServiceHero                           [🆕 — image/icon + title + subtitle + badge]
│   ├── Gallery                               [🆕 — no image-gallery/carousel primitive exists; `HeroCardCarousel` is Home-specific, not reusable]
│   ├── Description / FeatureList             [🆕 — benefits[] as a plain list, `Card` + typography]
│   ├── PurchaseMethodSelector                [🆕 — 4 cards (credit/installment/cash/free), built from `Card` + `Button`, no primitive gap]
│   ├── ProcessSteps                          [🆕 — simple ordered list, no primitive gap]
│   ├── FaqAccordion                          [🆕 — no Accordion primitive exists in `packages/ui`; `docs/prototype-to-production-mapping.md` §A.9 (Profile) also needs one — a second, independent consumer]
│   └── StickyBuyBar                          [🆕 — flex bar + `Button`; see §7 for a real layout conflict with `BottomNavigation`]
```

| Component | Existing design-system fit | New component required | Reusable elsewhere? |
|---|---|---|---|
| `CategoryTile` | `Card` (body) | Yes | Same shape `FeaturedServiceBanner` already uses on Home — a genuine extraction candidate once Home is back in scope |
| `ServiceCard` | `Card` + `Badge` | Yes | Module-specific |
| `SearchInput` | `Input` (base) | Yes (styled wrapper) | Reusable — Home's search box (mapping.md §A.2) needs the exact same thing and doesn't have it yet either |
| `FilterChipRow` | **none** | Yes — new primitive gap | Reusable — any future filterable list |
| `Gallery` | **none** | Yes — new primitive gap | Module-specific for now |
| `FaqAccordion` | **none** | Yes — new primitive gap | Reusable — Profile's 7-section accordion (mapping.md §A.9) is a second real consumer |
| `PurchaseMethodSelector` | `Card` + `Button` | Yes (composition only) | Module-specific |
| `StickyBuyBar` | `Button` | Yes | Module-specific |

---

## 5. Data Contracts

Pulled directly from `backend/prisma/schema.prisma` (re-read this
session) — no invented fields, same discipline as every prior contract.

```ts
interface CategoryDto {              // GET /categories — already defined in home-api.ts, reused verbatim
  id: string;
  name: string;
  description: string;
  imageKey: string | null;
  keywords: unknown;                 // string[] at runtime, stored as Json
  sortOrder: number;
  active: boolean;
}

interface MerchantDto {              // GET /merchants — not yet defined anywhere in frontend
  id: string;
  name: string;
  description: string | null;
  logoKey: string | null;
  active: boolean;
}

interface ServiceDto {               // GET /services, GET /services/:id — not yet defined anywhere in frontend
  id: string;
  categoryId: string;
  merchantId: string | null;
  title: string;
  groupLabel: string;
  subtitle: string;
  badge: string;
  icon: string | null;
  imageKey: string | null;
  priceFrom: number | null;          // Rial
  priceLabel: string | null;
  availableMethods: ("credit" | "installment" | "cash" | "free")[];
  installmentMinMonths: number | null;
  installmentMaxMonths: number | null;
  creditMultiplierLabel: string | null;
  benefits: string[];
  galleryKeys: string[];
  faq: { question: string; answer: string }[];
  tags: string[];
  active: boolean;
}
```

**`OrderPreview` (the shape requested by this stage) cannot be a fetched
model — there is no preview endpoint.** It's a frontend-only, locally
computed value, same pattern as Installment's `InstallmentSummary`
(Stage 8.0 §4):

```ts
interface OrderPreview {             // 🆕 client-side only, built from ServiceDto + user selection
  service: ServiceDto;
  amount: number;                    // service.priceFrom, or a user-entered amount if the product allows one
  paymentMethod: "credit" | "installment" | "cash" | "free";
  installmentMonths?: number;        // only when paymentMethod === "installment" — cannot actually be
                                      // submitted yet, see §6/§9 (CreateOrderDto has no matching field)
}
```

**A real mismatch worth flagging now, before it becomes a filter-UI
bug:** the prototype's Category View filter chips are "همه / اقساطی /
اعتباری / تخفیفی / ترکیبی" (all / installment / credit / **discounted**
/ **combined**). The schema's `PurchaseMethod` enum is only `credit |
installment | cash | free` — there is no "discounted" or "combined"
concept anywhere in the data model. Building those two filter chips
verbatim would mean every result for them is permanently empty; this
needs a product decision (drop them, or define what they mean against
real fields) before Category View's filter row is implemented, not
something the frontend can resolve on its own.

### Loading / empty / error states

Same established pattern reused, no new design needed:
`SkeletonBlock` while loading, `Card` + muted text for empty
(e.g. a category with zero active services — a real, reachable state at
19 categories / 108 services, not just theoretical; also reachable
immediately by the "discounted"/"combined" filter mismatch above),
inline red text for errors — identical to Wallet/Credit/Installment.

---

## 6. API Contract

Verified directly against
`backend/src/modules/{services,categories,merchants,orders}` this session.

| Endpoint | Method | Request | Response | Auth | Frontend usage | Status |
|---|---|---|---|---|---|---|
| `/categories` | GET | `skip`, `limit` | `{items: CategoryDto[], total, skip, take}` | Public | Services List | ✅ **AVAILABLE NOW** |
| `/categories/:id` | GET | — | `CategoryDto` | Public | Category View header | ✅ **AVAILABLE NOW** |
| `/services` | GET | `skip`, `limit` **only** | `{items: ServiceDto[], total, skip, take}` | Public | Category View, Home search | 🟡 **PARTIALLY AVAILABLE** — no `categoryId`, `method`, or `q` filter param exists (`ListServicesQueryDto` re-read this session — it's `PaginationQueryDto` with zero extra fields) |
| `/services/:id` | GET | — | `ServiceDto` | Public | Service Detail | ✅ **AVAILABLE NOW** |
| `/merchants` | GET | `skip`, `limit` | `{items: MerchantDto[], total, skip, take}` | Public | Merchant Detail | ✅ **AVAILABLE NOW, but empty** — 0 rows seeded (verified live) |
| `/merchants/:id` | GET | — | `MerchantDto` | Public | Merchant Detail | ✅ **AVAILABLE NOW, but unreachable** — no service links to any merchant, so there's no real path a user could take to land on a merchant id |
| `POST /orders` | POST | `{serviceId, method, amount}` | `Order` (pending) | Required | Purchase confirm | 🟡 **PARTIALLY AVAILABLE** — creates the row, but see §9 for everything it doesn't do |
| `GET /orders`, `GET /orders/:id` | GET | `skip`, `limit` / — | `{items: Order[], ...}` / `Order` | Required | Confirmation → Profile purchases | ✅ **AVAILABLE NOW** |
| Category-filtered service list | — | — | — | — | ❌ **MISSING** |
| Full-text service search | — | — | — | — | ❌ **MISSING** — same gap blocks Home's not-yet-built search box (mapping.md §A.2) |
| `installmentMonths` on order creation | — | — | — | — | ❌ **MISSING** — re-confirmed identical to Stage 8.0's finding |
| Image URL resolution for `imageKey`/`logoKey` | — | — | — | — | ❌ **MISSING** — `OrbitItem.imageKey` already resolves to `imageUrl` server-side (`orbit-items.service.ts`); `Category`, `Service`, and `Merchant` all have the identical raw-key field but no equivalent resolver. `FeaturedServiceBanner`'s own code comment (Stage 4.3) already flagged this for categories; confirmed here it's the same gap for services and merchants too. |

No APIs invented — every ✅/🟡/❌ above reflects code actually read this
session, not an assumption.

---

## 7. Payment & Credit Relationship

What exists today, what's UI-only, what needs backend — answering the
three questions this stage explicitly requires.

| Method | Purchase-method selector UI | `POST /orders` accepts it | Actually moves money / creates a record | Verdict |
|---|---|---|---|---|
| Cash | Buildable (4th `PurchaseMethodSelector` card) | Yes (`method:"cash"`) | No — no payment gateway call exists anywhere in the codebase | **UI only** |
| Free | Buildable | Yes (`method:"free"`) | N/A by definition — but still just creates a `pending` Order, nothing marks it fulfilled | **UI only, and even "free" doesn't reach a terminal state today** |
| Wallet | *(not one of the 4 `PurchaseMethod` enum values — cash/free are the closest, wallet as a distinct payment rail doesn't exist in the schema)* | — | — | **Needs backend** — and a product decision on whether "wallet" is really a 5th `PurchaseMethod` or is meant to fold into "cash" |
| Credit | Buildable | Yes (`method:"credit"`) | No — no `CreditLine.usedAmount` check, no `CreditUsage` row written | **Needs backend** |
| Installment | Buildable *except* the month-count field has nowhere to go | Yes, but `installmentMonths` can't be sent | No — no `Installment` row written even for the fields that could be sent | **Needs backend** (two separate gaps, §5/§6) |

**Important, per this stage's explicit instruction — do not expose fake
flows:** every purchase method today would let a user tap "buy," see a
`Purchase Sheet`, and get a `pending` Order back that *looks* successful
but changed nothing about their actual credit, wallet, or installment
state. Shipping a live "Purchase" button in v1 would be presenting a
non-functional flow as if it worked — recommended against in §10.

---

## 8. Responsive Rules

Reuses `AppShell` verbatim (same as every prior module) — shell-level
rules already solved. Content-specific rules across the required matrix:

| Width | Services List (CategoryGrid) | Category View (ServiceGrid) | Service Detail |
|---|---|---|---|
| 375 / 393 / 430 (mobile) | 2 columns — same grid `FeaturedServiceBanner` already validates on Home at this width | 1 column (product cards carry more content — price, badge, method tags — than a category tile) | Single column, full-width; `FilterChipRow` (Category View) scrolls horizontally if it overflows |
| 768 / 1024 (tablet) | 3 columns | 2 columns | Single column, capped at 760px shell — no reflow to a 2-column detail layout |
| 1366 / 1440 / 1920 (desktop) | 3–4 columns, still capped inside the 760px shell (same containing-block behavior every prior module already validated) | 2 columns | Same single column |

**A real, unresolved layout conflict, flagged here rather than silently
designed around:** the prototype's `StickyBuyBar` on Service Detail is
meant to pin to the bottom of the viewport — but every route in this app
already has `BottomNavigation` pinned to the bottom of the 760px shell
column (`AppShell`'s `translateZ(0)` containing-block trick,
Stage 5.1). Two fixed-bottom bars would either overlap or need one to
stack above the other, shrinking the visible product content further on
mobile. This needs an implementation-time decision (stack the buy bar
directly above the nav, or hide the nav on Service Detail — a
`AppShell`-level change, itself out of scope for this stage) — not
something this analysis can resolve without touching `AppShell`.

---

## 9. Design System Mapping

| `packages/ui` primitive | Used by this module? | Notes |
|---|---|---|
| `Card` | Yes — `CategoryTile`, `ServiceCard`, FAQ items, etc. | ✅ existing |
| `Badge` | Yes — purchase-method tag on `ServiceCard`, status if needed | ✅ existing |
| `Button` | Yes — `StickyBuyBar`, `PurchaseMethodSelector` cards, filter actions | ✅ existing |
| `Input` | Partial — base for `SearchInput`, but no search-styled variant exists | 🟡 needs a thin wrapper, not a new primitive |
| `SkeletonBlock` | Yes — loading state everywhere | ✅ existing (`components/common`) |
| `FinancialCard` | No — shaped for a bank-card visual (brand/masked-number/fixed aspect), doesn't fit a product tile, same reasoning Credit's contract already used to reject it (Stage 7.0 §3) | N/A |
| `WalletCard` | No — wallet-shaped, no fit here | N/A |
| `StoryCard` | No — story-shaped, no fit here | N/A |
| **Chip / segmented control** | Needed for `FilterChipRow` | ❌ **missing primitive** — does not exist anywhere in `packages/ui` today |
| **Accordion** | Needed for `FaqAccordion` | ❌ **missing primitive** — also independently needed by Profile's 7-section accordion (mapping.md §A.9), a second real consumer worth building it once, not twice |
| **Gallery / image carousel** | Needed for Service Detail's `galleryKeys` | ❌ **missing primitive** — `HeroCardCarousel` is Home-specific (built around `MembershipPlanDto`), not a generic reusable carousel |
| **Progress bar** | Not needed by this module | Already flagged missing by Credit (Stage 7.0) and Installment (Stage 8.0) — not re-flagged here, just noted as still outstanding |

Three new primitives are needed (Chip row, Accordion, Gallery) — all
three have at least one other real, already-identified consumer beyond
Services, so building them as genuine `packages/ui` additions (not
module-local one-offs) is the correct call at implementation time.

---

## 10. Security / Business Rules

| Concern | Current state (verified this session) | Risk |
|---|---|---|
| **Service ownership** | No ownership concept — all services are globally visible to every authenticated (and unauthenticated — endpoints are `@Public()`) user. Matches the prototype's catalog model; not a gap. | None — by design |
| **Inactive-row visibility** | `CategoriesService.list()`, `ServicesService.list()`, and `MerchantsService.findOneOrThrow()` (all re-read this session) **do not filter `active: true`** anywhere. An inactive category/service/merchant is still returned by `list()` and still directly fetchable by id. Home's `useCategories` hook already has to work around this client-side (`.filter(c => c.active)`, Stage 4.3) — every future consumer, including this module, would have to remember to do the same filtering itself instead of the backend guaranteeing it once. | **Real gap** — inactive/retired catalog items can leak into any screen that forgets the client-side filter |
| **Merchant visibility** | Every merchant row (`active` or not) is exposed identically to every category/service — no distinct visibility rule exists or is needed today, since 0 rows exist | None currently reachable, same inactive-filter gap applies once data exists |
| **Price display** | `priceFrom`/`priceLabel` are both public, unauthenticated fields — no user-specific pricing exists anywhere in the schema (no per-user discounts, no membership-tier pricing) | None — matches prototype, which also shows one universal price per product |
| **Credit eligibility** | Confirmed again this session: `POST /orders` performs **zero** check against `CreditLine.limitAmount`/`usedAmount` before accepting `method:"credit"`. Any authenticated user can create a `credit` order for any amount regardless of their actual credit line's balance, or even with no `CreditLine` at all. | **Real gap, same one Stage 7.0 already flagged** — restated here because Services/Service Detail is literally where this would first be user-triggered |
| **Order permissions** | `GET /orders/:id` correctly scopes by `userId` (`orders.service.ts findOneOrThrow(id, userId)`, re-verified) — a user cannot read another user's order by guessing an id. `POST /orders` correctly attributes the order to `currentUser.userId`, not a client-supplied field. | ✅ Correct as-is, no gap |

---

## Backend Gaps (consolidated)

Every ❌/🟡 item from §5–§10 in one place, for implementation planning:

1. `GET /services` has no `categoryId`/`method`/`q` filter — blocks a
   real Category View and any Home search.
2. `list()`/`findOneOrThrow()` for categories, services, and merchants
   never filter `active: true` server-side.
3. No `imageUrl` resolution for `Category.imageKey`, `Service.imageKey`,
   or `Merchant.logoKey` — `OrbitItem` already has this exact pattern to
   copy.
4. `CreateOrderDto` has no `installmentMonths` field.
5. `POST /orders` performs no credit-limit check against `CreditLine`.
6. `POST /orders` never debits a `Wallet`, never writes a `CreditUsage`,
   never creates an `Installment` — a purchase today is a single
   isolated `Order` row and nothing else, regardless of `method`.
7. `Merchant` has 0 seed rows and 0 services linked to any merchant —
   Merchant Detail has no real content to show even if built.
8. The prototype's "تخفیفی"/"ترکیبی" (discounted/combined) filter
   options have no representation in the `PurchaseMethod` enum or
   anywhere else in the schema — needs a product decision, not a
   frontend workaround.

None of these are frontend-solvable; all require either a backend
change or a product decision, consistent with this stage's "Do NOT
modify backend" boundary — they're documented, not worked around.

---

## Implementation Roadmap

Tiered by what's genuinely buildable without touching the backend or
shipping a non-functional "buy" button (§7's explicit constraint):

**Tier 1 — buildable now, no backend change needed:**
- **Services List** — `GET /categories` already works exactly as Home's
  `useCategories` already proves.
- **Category View** — the missing `categoryId` filter (Gap #1) can be
  worked around the same way `useCategories` already works around
  missing `active` filtering: fetch the small full `GET /services` set
  client-side (108 rows total, confirmed via direct query this session
  — well within a single unfiltered page) and filter by `categoryId` in
  the browser. Not ideal long-term, but genuinely buildable today
  without a backend change.
- **Service Detail** — `GET /services/:id` already returns every field
  the screen needs, read-only.

**Tier 2 — blocked, needs a backend change first:**
- **Purchase Flow / Purchase Sheet / Confirmation** — technically
  postable today (`POST /orders` accepts the request), but doing so
  would create an `Order` that looks successful while silently doing
  nothing to the user's actual wallet/credit/installment state (Gap #5,
  #6). Per this stage's explicit "do not expose fake flows" instruction,
  **a live purchase button should not ship in v1** until at least Gap #5
  and #6 are addressed in the Orders module.
- **Installment purchase specifically** — additionally blocked on Gap
  #4 (`installmentMonths` has nowhere to go) even before Gap #6.

**Tier 3 — blocked, no real content to show:**
- **Merchant Detail** — 0 seed data, 0 links, no prototype precedent
  (§1). Not worth building until Merchant is actually populated and
  wired to services by a product/data decision.

**Deferred, needs an `AppShell`-level decision, not this module's call:**
- The `StickyBuyBar` vs. `BottomNavigation` layout conflict (§8) should
  be resolved before Service Detail's buy bar is built, but resolving it
  means touching `AppShell`, which is out of scope for this stage.

---

## Services Module v1 Contract

**Status: READY FOR IMPLEMENTATION — narrowly scoped to Services List,
Category View, and Service Detail as a read-only browse experience.**
This mirrors exactly where Wallet, Credit, and Installment v1 each
landed: real data, real navigation, no money-moving action exposed
until the underlying Orders-module gap is closed.

**Purchase Flow, Checkout, and Confirmation remain BLOCKED** — not
because the screens are hard to build, but because `POST /orders`
creating an inert `pending` row while claiming to complete a
credit/installment purchase would be exactly the "fake flow" this stage
was explicitly told not to expose. Closing that requires backend work in
the Orders module (Gaps #4–#6), which is out of scope here.

**Merchant Detail remains BLOCKED** on missing data, independent of any
backend code change — no amount of frontend or Orders-module work makes
this screen worth building without seeded `Merchant` rows and real
`Service.merchantId` links.
