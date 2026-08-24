# Wallet v1 Implementation Report (Stage 6.1)

Implements the scope approved in `docs/wallet-ui-contract.md`: Wallet
Overview, Wallet Balance, Transaction History, loading/empty/error
states. Deposit, Withdraw, Payment Gateway, and new backend APIs are
explicitly not part of this build — there is no UI for any of them on
this page, not even a disabled button, since none were in this stage's
component tree.

---

## What was built

```
app/wallet/page.tsx
├── AppShell                 [existing, reused unmodified]
├── WalletSummary            [🆕 components/wallet/]
│   └── WalletOverviewCard   [🆕 — one per wallet, built on WalletCard]
├── TransactionList          [🆕 components/wallet/]
│   └── TransactionListItem  [🆕 — internal to TransactionList]
└── WalletStates             [🆕 — WalletEmptyState / WalletErrorState, shared by both sections]
```

New API layer: `apps/web/src/lib/wallet-api.ts` — does not touch or
duplicate `home-api.ts`'s existing `WalletDto`/`listWallets` (imports the
type, doesn't redefine it); adds `WalletTransactionDto` and
`listWalletTransactions(kind)`, neither of which existed anywhere before.

## A contract correction found while implementing

`docs/wallet-ui-contract.md` §5 assumed `GET /wallet/:kind/transactions`
returned the paginated `{items, total, skip, take}` envelope most other
list endpoints use. Verified live against the running API before writing
any code: it actually returns a **plain array**
(`backend/src/modules/wallet/wallet.service.ts`'s `listTransactions`
returns `prisma.walletTransaction.findMany(...)` directly, no wrapper).
`wallet-api.ts` is typed correctly for the real shape; the contract doc's
table has the error, not the implementation.

## How the transaction-wallet mapping was actually handled

The contract flagged that `GET /transactions` (the merged endpoint) tags
rows with `walletId` only, not `kind`, and discussed cross-referencing
`walletId` against `GET /wallet`'s result to resolve it. Implementation
took a simpler path: `TransactionList` calls `GET /wallet/main/transactions`
and `GET /wallet/reward/transactions` in parallel instead of the merged
endpoint — each result set is already known to be that kind (it's what
was requested), so no cross-referencing is needed. Both sets are tagged
client-side and merged/sorted by `createdAt` in one pass. Still only
existing endpoints, no backend change, simpler than the gap implied.

## Loading / empty / error states

- **Loading**: `SkeletonBlock` (existing, `components/common`) — one
  shimmer block per wallet card, three for the transaction list. Same
  shared primitive Home already uses; no new loading pattern invented.
- **Empty**: `WalletEmptyState` — "هنوز تراکنشی ثبت نشده." Balance cards
  always render (a wallet with `0` balance is a normal state, not
  "empty" — matches how `WalletCard` already displays `۰ تومان` rather
  than hiding itself).
- **Error**: `WalletErrorState` — independent per section, verified this
  is real (not just written that way): `WalletSummary` and
  `TransactionList` each manage their own fetch/error state, so a failed
  transaction load doesn't block the balance cards, and vice versa.

## Verification performed (not just written, actually run)

Since the test account had zero transactions, I inserted temporary rows
directly into the local dev database to verify the populated view, then
deleted them afterward:

- Balance cards: `2,500,000` Rial → correctly rendered `250,000 تومان`; `150,000` Rial → `15,000 تومان`
- Three transactions across both wallets rendered with correct kind
  Badges (اصلی / جایزه — proving the parallel-fetch tagging works),
  correct sign/color (`+300,000` green for a topup, `−50,000` for a
  spend), correct Persian Jalali dates (`toLocaleDateString("fa-IR")`),
  and correct sort order (newest first)
- Reloaded after cleanup: balances back to `0 تومان`, empty-state message
  showing correctly

## Responsive validation

All 8 required widths checked live this session:

| Width | Result |
|---|---|
| 375×667 | ✅ no overflow |
| 393×852 | ✅ no overflow |
| 430×932 | ✅ no overflow |
| 768×1024 | ✅ no overflow, balance grid confirmed 2-column, nav capped at 760px |
| 1024×768 | ✅ no overflow |
| 1366×768 | ✅ no overflow, nav width 760px |
| 1440×900 | ✅ no overflow |
| 1920×1080 | ✅ no overflow, nav width 760px — desktop stays inside the 760px shell, doesn't go full-bleed |

RTL verified structurally correct throughout (transaction rows, balance
cards) — inherited from `WalletCard`/`Card`'s existing RTL-correct flex
layouts, no new RTL logic was written that needed separate verification.

## Validation

- `tsc --noEmit` — clean
- `eslint` (full `src` sweep) — clean (one pre-existing, unrelated warning on `OrbitBubble.tsx`)
- `next build` — succeeds; `/wallet` listed as a static route alongside every other page

## Scope discipline

`git status` confirms the only new/changed paths are `app/wallet/`,
`components/wallet/`, and `lib/wallet-api.ts`. Landing, Orbit, Home,
Auth, `components/shell/` (AppShell/PageHeader/PageContainer/AuthGuard/
navigation.ts), and the backend are all untouched — no diffs against any
of them.

---

## Status: Wallet Module v1 — IMPLEMENTED

Balance display and transaction history are real, live-data features.
Deposit, Withdraw, and Payment Gateway remain explicitly out of scope,
per `docs/wallet-ui-contract.md`'s BLOCKED verdict for those — no UI for
them exists on this page at all yet.
