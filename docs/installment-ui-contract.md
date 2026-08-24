# Installment UI Contract (Stage 8.0 — Analysis Only)

Single source of truth for implementing the Installment module. No
frontend code, no components, no backend/AppShell/Home/Wallet/Credit/
Landing/Orbit/Auth changes were made to produce this — pure analysis,
same discipline as `docs/wallet-ui-contract.md` and
`docs/credit-ui-contract.md`.

**This module has the weakest prototype precedent of the three financial
modules.** Wallet and Credit at least had embedded UI presence (a balance
figure, a purchase-method button). Installments has neither — checked
directly against `docs/01-prototype-analysis.md` §2 and
`docs/prototype-to-production-mapping.md` J7, which says explicitly, in
its own words, that the installment list screen was *"هنوز در فرانت ساخته
نشده"* (not yet built in the frontend) — not "exists but unstyled," not
"partial," genuinely absent even as a concept in the prototype.

---

## 1. Prototype Installment Screens

| Screen | Prototype status | Notes |
|---|---|---|
| **Installment List / Overview** | **NOT PRESENT IN PROTOTYPE** | `docs/prototype-to-production-mapping.md` J7 explicitly says so. Already partially realized in production code anyway: Home's `InstallmentsCard` (`AccountFinancialCards.tsx`, Stage 4.1) shows a summary list, and `/installments` exists today as Stage 5.2's placeholder page. |
| **Upcoming Payment** | **NOT PRESENT IN PROTOTYPE** | The data exists (`Installment.nextDueDate`) and is already fetched by Home's `InstallmentsCard`, but nothing highlights "what's due next" as its own concept — each installment just shows its own due date inline. |
| **Payment History** | **NOT PRESENT IN PROTOTYPE — and not modeled in the schema at all** | This is the module's biggest gap, more fundamental than a missing screen: `Installment.paidCount` is a plain integer counter, not a log. There is no `InstallmentPayment` table, no per-payment row anywhere in the schema — nothing to list even if a screen existed. Contrast with Wallet, which has a real `WalletTransaction` log table. |
| **Installment Detail** | **NOT PRESENT IN PROTOTYPE as a built screen** | Referenced only as a planning note (`docs/prototype-to-production-mapping.md` J7: *"لمس یک قسط → جزئیات (تعداد پرداخت‌شده، مبلغ ماهانه، تاریخ سررسید بعدی)"*) — a proposed production screen, not prototype content. `GET /installments/:id` exists and returns everything that note describes. |
| **Payment Action** | **NOT PRESENT IN PROTOTYPE — explicitly called out as absent** | Same mapping.md note, verbatim: *"پرداخت یک قسط معوق کاملاً Feature-stage است — در پروتوتایپ هم صفحه‌ی مجزا نداشت"* (paying an overdue installment is entirely Feature-stage work — the prototype had no separate screen for it either). No backend endpoint exists for this either (verified this session — `installments.controller.ts` is read-only, `GET`/`GET :id` only). |
| **Empty state / Error state** | No prototype precedent | Follow the exact pattern already validated for Wallet and Credit — not a new pattern to design. |

**The purchase-time selection step is also incomplete, worth noting even
though it's not this module's scope**: Service Detail's "خرید قسطی"
button (per `docs/prototype-to-production-mapping.md` J6) is meant to let
a user pick 3–36 months before checkout, but `CreateOrderDto`
(`backend/src/modules/orders/dto/create-order.dto.ts`, re-verified this
session) has no `installmentMonths` field at all — there's nowhere to
send that selection even if the UI existed. This is Orders/Service-Detail
work, not Installment-module work, but it means an `Installment` row
today can only ever be created by a backend/seed script, never by a real
user purchase flow.

---

## 2. User Flows

### View Installments — **existing** (buildable now)

```
Home
 ↓ (Quick Action "اقساط من" — today scrolls to Home's own InstallmentsCard,
    same pattern as Wallet/Credit's equivalent actions)
Installment List
 ↓
GET /installments → totalMonths, monthlyAmount, paidCount, status, nextDueDate — per row
```

### Upcoming Payment — **partial**

The *data* exists per-row (`nextDueDate`), but there's no dedicated
"what's due soonest across all my installments" view — that would need
client-side sorting/filtering across the list, not a new endpoint. Buildable
as a derived view of the same `GET /installments` data; not a separate
API concern.

### Payment History — **missing**, and not just an API gap

No `InstallmentPayment`-shaped table exists in the schema at all (see
§1, §4). Nothing to build a contract against until a product/data
decision adds one — this is a schema change, explicitly out of scope
("Do NOT modify backend").

### Installment Detail — **existing** (buildable now)

```
Installment List
 ↓ tap a row
Installment Detail
 ↓
GET /installments/:id → same fields as the list row, just one item
```
Worth asking at implementation time whether a detail screen adds anything
a list row doesn't already show in full — same question Credit's
contract raised about Transaction Detail, and the answer is likely the
same (probably not, for v1).

### Payment Action — **missing**

No endpoint, no prototype reference, explicitly called out as
Feature-stage in the one planning note that mentions it at all. Nothing
to design a contract against.

---

## 3. Component Tree

Scoped to what's actually backed by real data — the List/Detail flow:

```
app/installments/page.tsx  (replaces Stage 5.2's PlaceholderContent body)
│
├── AppShell                  [existing — reused as-is, same pattern as Wallet/Credit]
│   activeNavKey="home"  pageLabel="اقساط من"
│   │
│   ├── PageHeader              [existing, via AppShell]
│   ├── PageContainer           [existing, via AppShell]
│   │   │
│   │   ├── SummaryCard         [🆕 — aggregate: count of active installments, total monthly commitment]
│   │   ├── InstallmentList     [🆕 — fetches GET /installments, renders N rows]
│   │   │   └── InstallmentItem [🆕 — × N]
│   │   │       ├── DueDate      [🆕 — small formatted-date sub-piece]
│   │   │       └── PaymentStatus [existing `Badge`, not a new component — see below]
│   │   └── States               [🆕 — empty/error, same shared-helper pattern as WalletStates/CreditStates]
│   │
│   └── BottomNavigation        [existing, via AppShell]
```

| Element | Existing design-system component | New component required |
|---|---|---|
| Per-installment amount/progress | `Card` + typography tokens (same reasoning as Credit — no `FinancialCard`/`WalletCard` fit) | `InstallmentItem` |
| Status | `Badge` | — (reusable as-is, 4-value `InstallmentStatus` enum maps directly to existing `Badge` tones, same as Wallet/Credit already do) |
| Due date | — | `DueDate` — trivial (a formatted date string), but worth its own component since it's the one truly Installment-specific display concern (Wallet/Credit have no due-date concept at all) |
| Loading | `SkeletonBlock` (`components/common`) | — |
| Empty/error | `Card` + typography tokens | `States` (or `InstallmentStates`, matching `WalletStates`/`CreditStates` naming) |

**`SummaryCard` is a genuinely new concept, not present in Wallet or
Credit's v1s** — those modules each had exactly one thing to summarize
(one set of balances, one credit line). Installments can have *multiple*
rows per user (`Installment.orderId` is `@unique` — one installment per
order, and a user can have many orders), so an aggregate summary (how
many active, total monthly commitment) is worth its own card above the
list, not just a list.

---

## 4. Data Contracts

Real, verified shape (already defined and in use —
`apps/web/src/lib/home-api.ts`'s `InstallmentDto`, verified against the
live API in Stage 4.1, re-confirmed against the schema this session):

```ts
interface InstallmentDto {
  id: string;
  orderId: string;
  userId: string;
  totalMonths: number;
  monthlyAmount: number;   // Rial
  paidCount: number;
  status: "active" | "completed" | "defaulted" | "cancelled";
  nextDueDate: string | null;
}
```

**This stage's requested `PaymentSchedule` and `PaymentHistory` models
cannot be defined against real data** — neither has a backing table.
Documenting what they'd need rather than inventing a shape:

- A **PaymentSchedule** (which of the `totalMonths` payments are due
  when) isn't stored — only `paidCount` (how many, not which ones, not
  when they were each due) and `nextDueDate` (just the next one) exist.
  Reconstructing a full schedule would require either storing one
  explicitly or computing it from `createdAt` + `totalMonths` on the fly
  (assuming perfectly regular monthly intervals, which the schema doesn't
  guarantee).
- A **PaymentHistory** (list of individual past payments) has zero
  backing data — see §1.

Both are **Future Gaps**, not v1 data contracts.

### Derived summary (frontend-computed, no new endpoint needed)

```ts
interface InstallmentSummary {
  activeCount: number;        // installments.filter(i => i.status === "active").length
  totalMonthlyCommitment: number;  // sum of monthlyAmount for active installments
}
```
Computed client-side from the same `GET /installments` response — not a
new API, just a derived view, same as Wallet's "combine two wallet
transaction fetches" approach in Stage 6.1.

### Loading / empty / error states
Same established pattern as Wallet/Credit: `SkeletonBlock` while loading,
a `Card`+muted-text empty message ("هنوز خرید اقساطی‌ای ثبت نشده." —
already the exact wording Home uses today), inline red error text.

---

## 5. API Contract

Verified directly against
`backend/src/modules/installments/installments.controller.ts` this
session.

| Endpoint | Method | Request | Response | Auth | Status |
|---|---|---|---|---|---|
| `/installments` | GET | `page`, `limit` | `{items: InstallmentDto[], total, skip, take}` | Required | ✅ **AVAILABLE** |
| `/installments/:id` | GET | — | `InstallmentDto` | Required | ✅ **AVAILABLE** |
| Payment history (any shape) | — | — | — | — | ❌ **MISSING — no backing table, schema change required** |
| Payment action (pay an installment) | — | — | — | — | ❌ **MISSING — no endpoint, no prototype precedent** |
| `installmentMonths` on order creation | — | — | — | — | ❌ **MISSING** — `CreateOrderDto` has no such field (Orders-module gap, not Installments-module, noted for completeness) |

No APIs invented — the two available endpoints are exactly what's real;
everything else is documented as missing with its precise reason.

---

## 6. Relationship Model: Wallet / Credit / Installment

Extends `docs/credit-ui-contract.md` §6's comparison table with
Installments:

| | Wallet | Credit | Installment |
|---|---|---|---|
| Core shape | `balance` | `limitAmount` + `usedAmount` | `totalMonths` + `monthlyAmount` + `paidCount` |
| Cardinality per user | Exactly 2 (`main`, `reward`) | Typically 1 | **N — one per installment-purchase order** |
| Transaction/payment log | `WalletTransaction` (real table) | `CreditUsage` (real table, no status/type breakdown) | **None — `paidCount` is just a counter** |
| Has a due date? | No | No | **Yes — `nextDueDate`** |
| Linked to `Order`? | Indirectly | Yes (`CreditUsage.orderId`, nullable, many CreditUsages can share... actually 1 usage per order typically) | **Yes, directly and uniquely — `Installment.orderId @unique`, exactly one row per order** |

**Ownership boundaries** (extending Credit's contract's recommendation,
same principle applied a third time):

```
Wallet:       owns balance + wallet-transaction history
Credit:       owns credit limit/used/available/status
Installment:  owns per-order repayment terms (months, monthly amount,
              progress, next due date) for orders bought with
              method:"installment"
```

Each fetches its own data from its own endpoint independently — no
merged "financial summary" model, continuing the same pattern
`AccountFinancialCards` already established and both prior contracts
recommended. The one genuine cross-reference: `Installment.orderId`
points at the same `Order` that `CreditUsage.orderId` can also point at
— but never the *same* order twice (an order is bought with exactly one
`method`), so there's no overlap to reconcile, just a shared parent
they'll never both claim.

---

## 7. Responsive Rules

Installments reuses `AppShell` verbatim (same as Wallet/Credit) — every
shell-level rule already solved. Content-specific rules:

| Width | SummaryCard | InstallmentList | Scrolling |
|---|---|---|---|
| 375 / 393 / 430 (mobile) | Single card, full width | Single column, one `InstallmentItem` per row — same list pattern Home's `InstallmentsCard` already validates | Single page-level scroll |
| 768 / 1024 (tablet) | Same single card (an aggregate summary doesn't benefit from a grid the way Wallet's 2 distinct wallets did) | Same single column — a list of variable-length installment rows doesn't suit a multi-column grid either | Same |
| 1366 / 1440 / 1920 (desktop) | Same, capped at 760px shell, no reflow | Same | Same |

Unlike Wallet (which got a 2-column balance grid at tablet+, because
there are exactly 2 distinct wallets worth showing side by side),
Installments' list is inherently variable-length and sequential (sorted
by `createdAt` or `nextDueDate`) — a single column is the correct layout
at every width, not a simplification.

---

## 8. Design System Mapping

| Element | Component | Status |
|---|---|---|
| Summary card | Plain `Card` + typography tokens | ✅ existing |
| Per-installment card | Plain `Card` + typography tokens (not `FinancialCard`/`WalletCard` — same reasoning as Credit §3) | ✅ existing |
| Status | `Badge` | ✅ existing |
| Loading | `SkeletonBlock` (`components/common`) | ✅ existing |
| Empty/error | `Card` + typography tokens | ✅ existing pattern |
| Progress-of-payments indicator (e.g. "3 of 12 paid") | Text only in Home's current `InstallmentsCard` (no bar) — a visual bar here would hit the same **missing `Progress` primitive** Credit's contract already flagged in `packages/ui` | ❌ same missing primitive as Credit, not re-flagging as new |

No new primitives needed beyond what Credit's contract already
identified as missing.

---

## Installment Module v1 Contract

**Status: READY FOR IMPLEMENTATION** — for the List + Detail flow,
backed entirely by the two verified, already-live endpoints
(`GET /installments`, `GET /installments/:id`). This is a genuinely
buildable v1, same tier as Wallet's and Credit's.

**Everything else is BLOCKED, precisely and separately:**
- **Payment History** — blocked at the schema level, not just missing an
  endpoint; there is no payment-log table to expose, same class of gap
  as Credit's Repayment finding
- **Payment Action** — blocked entirely; no endpoint, no prototype
  reference, explicitly named as future work in the one planning note
  that mentions it
- **Installment purchase (creating new installments from a real
  purchase)** — blocked on `CreateOrderDto` missing an `installmentMonths`
  field, which is Orders-module scope, not Installment-module scope

Given none of these three gaps can be closed without either a schema
change or work in a different module (Orders), a v1 Installment module
built now would necessarily be **read-only** — showing installments that
already exist (from seed data or seed-script-created test orders), with
no way for a real user to create or pay one yet. That's consistent with
where Wallet and Credit v1 landed too (both are read-only for their
"missing" pieces), not a special limitation unique to this module.
