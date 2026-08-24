# Installment v1 Implementation Report (Stage 8.1)

Implements the scope approved in `docs/installment-ui-contract.md`:
Installment List, Installment Summary, Installment Detail, Due
Information, Status Display, loading/empty/error states. Payment Action,
Payment Gateway, Payment History, Installment Creation Flow, and Purchase
Flow are all out of scope — there is no UI for any of them, matching the
contract's findings that Payment History has no backing table at all and
Payment Action has zero prototype/backend precedent.

---

## What was built

```
app/installments/page.tsx
├── AppShell                [existing, reused unmodified]
├── InstallmentSummaryCard  [🆕 components/installment/ — active count + total monthly commitment]
├── InstallmentList         [🆕 components/installment/ — loading/empty/error/populated]
│   └── InstallmentItem     [🆕 components/installment/ — one row, tap to select]
├── InstallmentDetail       [🆕 components/installment/ — GET /installments/:id, read-only]
└── InstallmentStates       [🆕 components/installment/ — InstallmentEmptyState / InstallmentErrorState]
```

New API layer: `apps/web/src/lib/installment-api.ts` — imports
`InstallmentDto` from `home-api.ts` (type-only, doesn't modify it, same
pattern `wallet-api.ts` and `credit-api.ts` established) and adds
`installmentApi.listInstallments()` / `installmentApi.getInstallment(id)`.

Shared status/date helpers live in
`components/installment/installmentStatus.ts` (`INSTALLMENT_STATUS_LABEL`,
`INSTALLMENT_STATUS_TONE`, `formatDueDate`) rather than duplicating the
label/tone maps inside both `InstallmentItem` and `InstallmentDetail`.

## Detail is a client-side state toggle, not a new route

The approved scope named a single route (`Create: /installments`) and
listed `InstallmentDetail` as a flat sibling in the component tree, not
nested under a dynamic segment. `app/installments/page.tsx` holds
`selectedId: string | null` and renders `InstallmentDetail` in place of
the summary+list when set, with a "بازگشت به فهرست" button to clear it.
This avoids inventing an unrequested `/installments/[id]` route while
still genuinely exercising `GET /installments/:id`.

## Response shapes verified live before coding, per this stage's instruction

Both endpoints matched the already-defined `InstallmentDto` exactly, no
surprises:

- `GET /installments` (empty): `{"items":[],"total":0,"skip":0,"take":20}`
- `GET /installments` (populated, after inserting test data): full
  `InstallmentDto[]` inside the same envelope
- `GET /installments/:id`: returns the single object directly, unwrapped

Unlike Wallet's transactions endpoint (found to be a plain array instead
of the assumed paginated envelope, corrected in Stage 6.1), Installment's
contract assumptions were accurate on the first check.

## InstallmentSummaryCard is a genuinely new concept

Neither Wallet nor Credit needed an aggregate summary — Wallet has
exactly two wallets, Credit typically has one line. `Installment.orderId`
is `@unique`, so a single user can accumulate many installment rows (one
per installment purchase). `InstallmentSummaryCard` computes active count
and total active monthly commitment client-side from the same
`GET /installments` response — no new endpoint, matching the contract's
`InstallmentSummary` being a derived view rather than a fetched one.

## Loading / empty / error states

One shared fetch at the page level for the list (`installments: T[] |
null`, `null` = loading), matching Credit's single-source pattern rather
than Wallet's two-independent-sources pattern — Installment has exactly
one list endpoint. `InstallmentDetail` has its own independent
loading/error handling scoped to the selected id, since it's a separate
fetch triggered on demand rather than on page mount.

## Verification performed (not just written, actually run)

The test account had no installments, so a temporary `Order`
(`method: 'installment'`) and `Installment` row were inserted directly
into the local dev database to verify the populated view:

- `monthlyAmount: 2,000,000` Rial, `totalMonths: 12`, `paidCount: 4`,
  `status: 'active'` → correctly rendered `"200,000 تومان / ماه"`, Badge
  "در حال پرداخت", `"4 از 12 قسط پرداخت‌شده"`, due date
  `"۱۲ شهریور ۱۴۰۵"`
- `InstallmentSummaryCard` correctly showed `"200,000 تومان"` total
  monthly commitment and `"1 قسط فعال از مجموع 1 خرید اقساطی"`
- Tapping the item opened `InstallmentDetail` with all four fields
  (amount/status/paid-count/due-date) matching the list row; "بازگشت به
  فهرست" returned to the list+summary view correctly
- Deleted the test rows, reloaded: empty-state message "هنوز خرید
  اقساطی‌ای ثبت نشده." rendered correctly, with `InstallmentSummaryCard`
  correctly suppressed (no "0 of 0" card shown for an empty list)
- Network trace confirmed the standard silent-refresh-then-retry
  behavior on the initial 401 (expected — same pattern as every other
  module), followed by real 200 responses
- Temporary test rows deleted again after responsive validation; local
  dev database left clean

## Responsive validation

All 8 required widths checked live this session, both empty and
populated states:

| Width | Result |
|---|---|
| 375×812 | ✅ no overflow |
| 393×852 | ✅ no overflow |
| 430×932 | ✅ no overflow |
| 768×1024 | ✅ no overflow |
| 1024×768 | ✅ no overflow |
| 1366×768 | ✅ no overflow |
| 1440×900 | ✅ no overflow |
| 1920×1080 | ✅ no overflow, `<main>` measured at exactly 760px wide, centered (580px on each side) — correctly capped inside the `AppShell` column |

Single-column layout at every breakpoint, no multi-column grid — matches
the contract's reasoning that installment lists are variable-length and
sequential, unlike Wallet's small fixed set of two wallets.

## One lint fix during validation

`InstallmentDetail`'s initial draft called `setInstallment(null)` /
`setError(null)` synchronously at the top of its `useEffect` before
fetching — flagged by `react-hooks/set-state-in-effect`. Removed rather
than suppressed: the component is always freshly mounted (the page
conditionally renders it only once `selectedId` is set), so its initial
`useState(null)` values already cover the loading state and the resets
were redundant.

## Validation

- `tsc --noEmit` — clean
- `eslint` (full `src` sweep on the new files) — clean after the fix above
- `next build` — succeeds; `/installments` listed as a static route

## Scope discipline

`git status` confirms the only new paths are `app/installments/`,
`components/installment/`, and `lib/installment-api.ts`. Landing, Orbit,
Home, Wallet, Credit, Auth, `components/shell/` (AppShell/Navigation),
and the backend are all untouched. (`apps/web/src/app/home/page.tsx` and
`packages/ui/src/components/Modal.tsx` show as modified in `git status`
but predate this stage and were not touched during this implementation.)

---

## Status: Installment Module v1 — IMPLEMENTED

Installment List, Summary, and read-only Detail (due date/status/paid
count/monthly amount) are real, live-data features. Payment Action,
Payment Gateway, Payment History, Installment Creation Flow, and Purchase
Flow remain explicitly out of scope, per `docs/installment-ui-contract.md`
— no UI for any of them exists on this page.
