# Credit v1 Implementation Report (Stage 7.1)

Implements the scope approved in `docs/credit-ui-contract.md`: Credit
Overview — limit/used/available amounts, status, loading/empty/error
states. Usage History, Purchase-with-Credit, Repayment, Installment flow,
and Payment Gateway are all out of scope — there is no UI for any of
them on this page, matching the contract's BLOCKED verdict for each.

---

## What was built

```
app/credit/page.tsx
├── AppShell               [existing, reused unmodified]
├── CreditOverviewCard     [🆕 components/credit/ — headline available amount + CreditProgress]
├── CreditProgress         [🆕 components/credit/ — usage bar, local (see below)]
├── CreditStatusCard       [🆕 components/credit/ — status Badge + expiry]
└── CreditStates           [🆕 components/credit/ — CreditEmptyState / CreditErrorState]
```

New API layer: `apps/web/src/lib/credit-api.ts` — imports `CreditLineDto`
from `home-api.ts` (type-only, doesn't modify it, same pattern
`wallet-api.ts` established in Stage 6.1) and adds `creditApi.listCreditLines()`.

## Response shape verified live before coding, per this stage's instruction

`GET /credit` returns the standard `{items, total, skip, take}` envelope
— confirmed with both an empty and a populated response before writing
any code. Unlike Wallet's transactions endpoint (which turned out to be
a plain array, a correction made in Stage 6.1), Credit's contract
assumption for this endpoint was accurate.

## Two deliberate deviations from this stage's suggested reuse list, both following the approved contract

1. **`FinancialCard` was not used.** `docs/credit-ui-contract.md` §3
   explicitly recommended against it (shaped for a bank-card visual —
   brand name, masked number, fixed aspect ratio — not a credit-limit
   summary) in favor of the plain `Card` + typography-token pattern
   Home's existing `CreditCard` already uses. `CreditOverviewCard` and
   `CreditStatusCard` both follow that.
2. **No `Progress` primitive exists in `packages/ui`** (verified again
   this session — the export list is unchanged since Stage 6.0/7.0's
   check). `CreditProgress` is a local, self-contained component in
   `components/credit/`, not a shared design-system addition — extracting
   one would mean touching Home's `AccountFinancialCards.tsx` (which
   already hand-rolls the identical bar), explicitly out of scope for
   this stage.

## Loading / empty / error states

Unlike Wallet (two independent data sources — balance and transactions —
each with its own fetch/loading/error), Credit has exactly **one** data
source (`GET /credit`), so there's one shared loading/empty/error state
at the page level rather than per-section ones. This was a deliberate
choice, not an oversight — matches the contract's own reasoning in §7
for why Credit's layout is simpler than Wallet's.

## Verification performed (not just written, actually run)

The test account had no credit line, so I inserted one directly into the
local dev database to verify the populated view, then deleted it:

- `limitAmount: 80,000,000` Rial, `usedAmount: 25,000,000` Rial →
  correctly rendered available `5,500,000 تومان`, progress text
  `"2,500,000 تومان از 8,000,000 تومان استفاده‌شده (31٪)"` (25M/80M =
  31.25%, rounds to 31 — correct), status Badge "فعال", `expiresAt: null`
  → "بدون تاریخ انقضا"
- Deleted the test row, reloaded: empty-state message "هنوز خط اعتباری
  فعالی نداری." rendered correctly
- `role="progressbar"` with correct `aria-valuenow`/`aria-valuemin`/
  `aria-valuemax` on the usage bar

## Responsive validation

All 8 required widths checked live this session:

| Width | Result |
|---|---|
| 375×667 | ✅ no overflow |
| 393×852 | ✅ no overflow |
| 430×932 | ✅ no overflow |
| 768×1024 | ✅ no overflow, nav capped at 760px |
| 1024×768 | ✅ no overflow |
| 1366×768 | ✅ no overflow, nav width 760px |
| 1440×900 | ✅ no overflow |
| 1920×1080 | ✅ no overflow, nav width 760px — stays inside the 760px shell |

No multi-column layout was needed at any width (unlike Wallet's 2-card
grid) — there's only ever one `CreditLine` to show, per the contract's
own responsive-rules reasoning.

## Validation

- `tsc --noEmit` — clean
- `eslint` (full `src` sweep) — clean after fixing one unused import
  (`spacing` in `CreditStatusCard.tsx`, caught by the lint pass itself)
- `next build` — succeeds; `/credit` listed as a static route

## Scope discipline

`git status` confirms the only new paths are `app/credit/`,
`components/credit/`, and `lib/credit-api.ts`. Landing, Orbit, Home,
Wallet, Auth, `components/shell/`, and the backend are all untouched.

---

## Status: Credit Module v1 — IMPLEMENTED

Credit Overview (limit/used/available/status) is a real, live-data
feature. Usage History, Purchase-with-Credit, Repayment, and Installment
flow remain explicitly out of scope, per `docs/credit-ui-contract.md`'s
BLOCKED verdict for each — no UI for any of them exists on this page.
