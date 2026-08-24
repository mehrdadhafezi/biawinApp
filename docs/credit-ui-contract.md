# Credit UI Contract (Stage 7.0 — Analysis Only)

Single source of truth for implementing the Credit module. No frontend
code, no components, no backend/AppShell/Home/Wallet/Landing/Orbit/Auth
changes were made to produce this — pure analysis, same discipline as
`docs/wallet-ui-contract.md`.

**Same finding as Wallet, and more pronounced here**: there is no
dedicated Credit screen anywhere in the prototype. Checked directly
against `docs/01-prototype-analysis.md` §2 (the full 9-screen prototype
map) — Credit appears only as **one of four purchase-method buttons** on
Service Detail (اعتباری/اقساطی/پرداخت کامل/رایگان) and as descriptive
text on the "کارت بیاوین" membership card ("اعتبار متناسب با پروفایل").
Every screen below is marked per the explicit instruction — nothing is
invented.

---

## 1. Screen Inventory

| Screen | Prototype status | Notes |
|---|---|---|
| **Credit Overview** | **NOT PRESENT IN PROTOTYPE** | Only a post-prototype planning note (`docs/prototype-to-production-mapping.md` J5: *"🆕 صفحه‌ی «اعتبار من»"*) — a proposed production screen, not prototype content. Already partially realized: Home's `CreditCard` (`AccountFinancialCards.tsx`) shows a summary, and `/credit` exists today as Stage 5.2's placeholder page. |
| **Available Credit** | **NOT PRESENT IN PROTOTYPE** as a dedicated display | Implied only indirectly — the membership card's "اعتبار متناسب با پروفایل" text and Service Detail's credit-purchase option being available/unavailable per user. No screen shows a "available credit" figure in the prototype. |
| **Credit Detail** (single line) | **NOT PRESENT IN PROTOTYPE** | `GET /credit/:id` exists on the backend, but nothing renders it — most users will only ever have one `CreditLine`, so a list-vs-detail distinction may not even be product-necessary (see §9). |
| **Credit Usage** (list of `CreditUsage` rows) | **NOT PRESENT IN PROTOTYPE** | No screen; also **no API to list them** — see §5, this is a real gap, not just a missing screen. |
| **Purchase with Credit** | **PARTIALLY PRESENT** | The purchase-method *selector* ("خرید اعتباری" button on Service Detail's buy-bar) is real prototype content. What happens after selecting it is not: confirmed by reading `backend/src/modules/orders/orders.service.ts` this session — `POST /orders` with `method:"credit"` creates a plain `pending` Order row and does **not** check `CreditLine.usedAmount` against `limitAmount`, does **not** write a `CreditUsage` row, and does **not** reject an order that exceeds available credit. The doc comment in that file says so explicitly: *"Wiring this up to actually debit a wallet/credit line... is Feature-stage work."* |
| **Repayment** | **NOT PRESENT IN PROTOTYPE — and not modeled in the schema at all** | `CreditLine` has no due-date/schedule field (unlike `Installment`, which has `nextDueDate`, `monthlyAmount`, `paidCount`). Credit here is a revolving-limit concept, not a repayment-schedule concept — see §6. There is nothing to build a "Repayment" screen against yet, at any layer. |
| **Credit History** | **NOT PRESENT IN PROTOTYPE**, same as Credit Usage above | If "history" means transaction-style usage log, it's the same gap as Credit Usage. If it means order history filtered to credit purchases, `GET /orders` already exists (unfiltered) — see §5. |
| **Credit Status** | **NOT PRESENT IN PROTOTYPE as a screen** | The data exists (`CreditLineStatus`: `active`/`suspended`/`closed`, already returned by `GET /credit`) and is already surfaced as a `Badge` on Home's `CreditCard` — just never as its own screen. |
| **Empty state** | No prototype precedent (prototype never shows a user with zero credit) | Follow the exact pattern already validated for Wallet/Home — not a new pattern to design. |
| **Error state** | No prototype precedent | Same — established pattern, not new. |

---

## 2. Credit User Flows

### View Available Credit — **existing** (buildable now, nothing blocks it)

```
Home
 ↓ (Quick Action "اعتبار من" — today scrolls to Home's own CreditCard,
    same as Wallet's equivalent action)
Credit Overview
 ↓
GET /credit → limit, used, available, status
```

### Use Credit — **partial**

```
Service Detail  [NOT PRESENT IN PROTOTYPE AS A BUILT SCREEN — see docs/prototype-to-production-mapping.md #6,
                 the purchase-method selector itself IS prototype content]
 ↓
Select "خرید اعتباری"
 ↓
Purchase Sheet → POST /orders {method:"credit"}   [existing endpoint, but performs no credit check/deduction — see §1]
 ↓
Confirmation   [order created in "pending" status — real completion/limit-enforcement logic doesn't exist]
```
This entire flow depends on Service Detail / Purchase Sheet, neither of
which exist yet either (both are separate, larger modules, explicitly
out of scope for Credit). Not buildable as a real end-to-end flow from
the Credit module alone — **missing**, at both the Credit-module layer
and the Services-module layer it depends on.

### Repayment — **missing**, not designable yet

No data model, no endpoint, no prototype reference. Nothing to build a
contract against — see §1 and §6.

### Credit History / Usage — **missing**

No endpoint lists `CreditUsage` rows (see §5). `GET /credit`/`GET /credit/:id`
return the `CreditLine` itself, which has no embedded usage list (the
`usages` relation exists in Prisma but isn't selected/exposed by
`credit.service.ts`).

---

## 3. Component Tree

Only the **existing** flow (View Available Credit) has enough backing to
implement now. Component tree scoped to that:

```
app/credit/page.tsx  (replaces Stage 5.2's PlaceholderContent body)
│
├── AppShell                    [existing — reused as-is, same as Wallet's Stage 6.1 pattern]
│   activeNavKey="home"  pageLabel="اعتبار من"
│   │
│   ├── PageHeader               [existing, via AppShell]
│   ├── PageContainer            [existing, via AppShell]
│   │   │
│   │   ├── CreditSummaryCard    [🆕 credit-specific — limit/used/available + status Badge]
│   │   │   └── UsageProgress    [🆕 — see §8, no `Progress` primitive exists in packages/ui yet]
│   │   ├── CreditStates         [🆕 — empty/error, same shared-helper pattern as Wallet's `WalletStates`]
│   │   │
│   │   └── (Credit History / repayment section) — NOT BUILT: no API, no data (see §1, §5)
│   │
│   └── BottomNavigation         [existing, via AppShell]
```

| Element | Existing design-system component | New component required | Reusable or module-specific |
|---|---|---|---|
| Balance/limit figures | `FinancialCard` or plain text (see note) | — | — |
| Usage bar | — | `UsageProgress` | Could be promoted to `packages/ui` later — the exact same bar already exists as inline markup in Home's `CreditCard`, duplicated once already; worth extracting once a second consumer needs it (same reasoning that moved `SkeletonBlock` to `components/common` in Stage 5.2) |
| Status | `Badge` | — | Reusable |
| Loading | `SkeletonBlock` (`components/common`) | — | Reusable |
| Empty/error | `Card` + typography tokens | `CreditStates` (thin wrapper, same shape as `WalletStates`) | Module-specific wrapper, shared *pattern* |

**Note on `FinancialCard` vs `WalletCard`**: `WalletCard` fit Wallet
directly (it's literally a balance-display component). `FinancialCard`
is shaped for the *membership card* visual (bank-card aspect ratio, brand
name, masked number) — it doesn't fit a credit-limit summary well. Home's
existing `CreditCard` doesn't use either; it's a plain `Card` with a bold
amount + `Badge` + a manual progress bar. Recommend continuing that
pattern for `CreditSummaryCard` rather than forcing `FinancialCard` to
fit a shape it wasn't designed for.

---

## 4. Data Contracts

Real, verified shapes (not the illustrative example in this stage's
prompt, which doesn't match the actual schema — corrected below):

```ts
interface CreditLineDto {
  id: string;
  userId: string;
  limitAmount: number;    // Rial
  usedAmount: number;     // Rial
  status: "active" | "suspended" | "closed";
  expiresAt: string | null;
}
```
(Already defined and in use — `apps/web/src/lib/home-api.ts`'s
`CreditLineDto`, verified against the live API in Stage 4.1.)

**Correction to this stage's example `CreditTransaction { id, amount,
merchant, date, status }`**: the real backend model (`CreditUsage`) has
**no `merchant` field and no `status` field**. Its actual shape:

```ts
interface CreditUsageDto {
  id: string;
  creditLineId: string;
  orderId: string | null;
  amount: number;       // Rial
  description: string;  // server-generated, same pattern as WalletTransaction.description
  createdAt: string;
}
```

Not exposed by any endpoint yet (see §5) — this interface documents what
the *data* looks like once an endpoint exists, not something to build
against today.

### Loading / empty / error states
Same established pattern as Wallet (`docs/wallet-v1-implementation-report.md`):
one `SkeletonBlock` while loading, a `Card`+muted-text empty message
("هنوز خط اعتباری فعالی نداری." — already the exact wording Home uses
today), inline red error text, independent per section so one failing
fetch doesn't block another.

---

## 5. API Contract

Verified directly against `backend/src/modules/credit/credit.controller.ts`
this session — not assumed.

| Endpoint | Method | Request | Response | Auth | Status |
|---|---|---|---|---|---|
| `/credit` | GET | `page`, `limit` | `{items: CreditLineDto[], total, skip, take}` | Required | ✅ **AVAILABLE** |
| `/credit/:id` | GET | — | `CreditLineDto` | Required | ✅ **AVAILABLE** |
| `/credit/history` or any Credit-usage list | GET | — | — | — | ❌ **MISSING** |
| Credit-check/deduction on order creation | — | — | — | — | ❌ **MISSING** — `POST /orders` exists but performs no credit logic at all (verified in `orders.service.ts` this session) |

**On the missing usage-history endpoint**: `CreditUsage` rows exist in
the schema and Prisma models the relation (`CreditLine.usages`), but
`credit.service.ts`'s `list()`/`findOneOrThrow()` never select or expose
it. Adding a `GET /credit/:id/usages`-shaped endpoint (mirroring
`GET /wallet/:kind/transactions`'s existing pattern) is real, scoped
backend work — not invented, just not done.

**On order-level credit enforcement**: this is the larger gap. Real
"Use Credit" as a working purchase flow needs `OrdersService.create()` to
check `CreditLine.usedAmount + amount <= limitAmount` and write a
`CreditUsage` row atomically (the same pattern `WalletService.credit()`/
`debit()` already establishes for wallets) — none of that exists. This
is Orders-module work as much as Credit-module work, and is explicitly
**not** requested for this stage.

---

## 6. Relationship Analysis: Credit / Wallet / Installments

**Credit is a standalone module, structurally distinct from both.**
Verified by comparing the three Prisma models directly:

| | Wallet | Credit | Installments |
|---|---|---|---|
| Core shape | `balance` (a number that moves up/down) | `limitAmount` + `usedAmount` (a ceiling and how much of it is used) | `totalMonths` + `monthlyAmount` + `paidCount` + `nextDueDate` (a schedule) |
| Transaction log | `WalletTransaction` (`type`: topup/spend/refund/gateway_settlement) | `CreditUsage` (just `amount`+`description`, no type enum) | None — progress is tracked on the `Installment` row itself (`paidCount`), no per-payment transaction rows |
| Has a due date? | No | No (`expiresAt` is the credit line's own expiry, not a payment due date) | Yes — `nextDueDate` |
| Linked to an `Order`? | Indirectly (`relatedOrderId` on transactions) | Yes (`CreditUsage.orderId`) | Yes, directly — `Installment.orderId` is a required 1:1 with `Order` |

**They're connected only through `Order`** — a purchase's `method` field
(`credit`/`installment`/`cash`/`free`) determines which of Credit or
Installments a given `Order` touches; Wallet is separate again (used for
Rewards redemption and general spend, not tied to `Order.method` the same
way). None of the three own or embed each other.

### Recommended frontend ownership model

```
Credit:
  owns: "how much can I still buy on credit" (limit/used/available/status)
  does NOT show: repayment schedule (that's Installments' concept, and
    Credit's schema has no schedule to show even if it wanted to)

Installments:
  owns: repayment schedule for orders bought with method:"installment"
  does NOT show: credit limit (unrelated concept, unrelated schema)

Wallet:
  owns: balance + wallet-transaction history (topup/spend/refund)
  does NOT show: credit limit or installment schedules
```

Each module fetches its own data from its own endpoint
(`GET /credit`, `GET /installments`, `GET /wallet`) — exactly the
pattern already established by Home's `AccountFinancialCards`, which
already renders all three side by side as three *independent* sections,
not a merged "financial summary" data model. Continue that: **no shared
"FinancialAccount" abstraction, no cross-fetching one from another.**

---

## 7. Responsive Rules

Credit reuses `AppShell` verbatim (same as Wallet), so every shell-level
rule is already solved. Content-specific rules, matching Wallet's
already-validated pattern (`docs/wallet-v1-implementation-report.md`):

| Width | Cards | Progress bar | Lists | Actions | Scrolling |
|---|---|---|---|---|---|
| 375 / 393 / 430 (mobile) | Single `CreditSummaryCard`, full width | Full-width bar under the amount, same as Home's existing `CreditCard` | N/A for v1 (no usage list exists yet — §1/§5) | None in v1 (no purchase/repayment actions exist yet) | Single page-level scroll |
| 768 / 1024 (tablet) | Same card, no multi-column need — there's only ever one `CreditLine` per user today (unlike Wallet's 2 cards, which is why Wallet got a 2-column grid) | Same | — | — | Same |
| 1366 / 1440 / 1920 (desktop) | Same, capped at 760px shell, no reflow to a wider layout — same "mobile app in a desktop browser" rule as everywhere else | Same | — | — | Same |

No responsive complexity beyond what a single summary card needs — this
is a simpler layout than Wallet's, not because of less effort but because
there's genuinely only one `CreditLine` object per user to show.

---

## 8. Design System Mapping

| Element | Component | Status |
|---|---|---|
| Limit/used/available display | Plain `Card` + typography tokens (not `FinancialCard`/`WalletCard` — see §3's note on why) | ✅ existing |
| Status | `Badge` | ✅ existing |
| Loading | `SkeletonBlock` (`components/common`, not `packages/ui` — same precision worth stating as in the Wallet contract) | ✅ existing |
| Usage bar | **No `Progress` primitive exists in `packages/ui`** | ❌ **missing primitive** — Home's `CreditCard` already hand-rolls one (`<div>` with a `width: {percent}%` inner bar); Credit's `UsageProgress` would be the second place doing the same thing, which is exactly the threshold this codebase has used before (Stage 5.2) to decide something belongs in a shared location. Not extracting it now (that touches Home, out of scope for analysis) — flagging it as the implementation-time move. |
| Buttons | `Button` | ✅ existing, but nothing to wire it to yet (no purchase/repayment action exists) |

---

## 9. Security Considerations

- **Authenticated access**: already enforced — `credit.controller.ts` has
  no `@Public()` anywhere; `AppShell`'s `AuthGuard` adds the same
  client-side layer Wallet already has. Nothing new needed.
- **User ownership**: `credit.service.ts`'s `findOneOrThrow()` scopes by
  `{ id, userId }` — a user cannot fetch another user's `CreditLine` by
  guessing an id. Verified by reading the service, not assumed.
- **Sensitive financial data**: a credit limit is arguably more sensitive
  than a wallet balance (it's tied to a real underwriting/eligibility
  decision, not just spendable cash) — same as Wallet, no masking
  convention exists anywhere in this app today, and there's no prototype
  precedent requiring one. Worth the same "nice-to-have, not v1
  requirement" flag Wallet's contract gave.
- **What Credit must never do**: display or imply a real credit
  *decision* (approval/denial/limit-increase eligibility) — none of that
  logic exists on the backend (confirmed: no risk-scoring, no
  underwriting model anywhere in this schema), so the UI must only ever
  reflect the `CreditLine` row as-is, never suggest the user can request
  a change from this screen (no endpoint would back that action).

---

## Credit Module v1 Contract

**Status: READY FOR IMPLEMENTATION** — for exactly one screen: Credit
Overview showing limit/used/available/status, backed entirely by the
already-verified `GET /credit` endpoint. This is a smaller v1 than
Wallet's (Wallet had two real sections — balance and transactions; Credit
has one, because the transaction-equivalent — usage history — has no
backing endpoint).

**Everything else is BLOCKED, precisely and separately:**
- Credit Usage / History — blocked on a missing endpoint (real, scoped backend work, not designed yet)
- Purchase with Credit — blocked on both a missing endpoint (order-level credit enforcement) and on Services/Service-Detail/Purchase-Sheet not existing yet as modules
- Repayment — blocked at the schema level, not just the API level; there's no due-date/schedule concept on `CreditLine` to build against, and no prototype or product decision has defined what "credit repayment" (as opposed to installment repayment, which already has one) would even mean in this product
