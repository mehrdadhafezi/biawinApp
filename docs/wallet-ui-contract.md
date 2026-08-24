# Wallet UI Contract (Stage 6.0 — Analysis Only)

Single source of truth for implementing the Wallet module. No frontend
code was written, no components created, no backend or shell/Home/
Landing/Orbit/Auth code touched to produce this — pure analysis, same
discipline as `docs/home-ui-contract.md` and `docs/app-shell-contract.md`.

**Important finding up front**: there is no dedicated "Wallet prototype."
Checked directly against `docs/01-prototype-analysis.md` §2 (the full
9-screen prototype map) — Wallet was never one of the prototype's screens.
Wallet only ever appeared as a balance figure embedded inside **Profile**
and inside **Rewards**' redeem modal, plus one unwired button. This
document is honest about that throughout rather than inventing prototype
precedent that doesn't exist — matching how the Home contract handled
Wallet/Credit/Installments (§4 there flagged the same thing).

---

## 1. Screen Inventory

| Screen | Prototype precedent? | Purpose | User goal | Entry points | Exit points |
|---|---|---|---|---|---|
| **Wallet Overview** | 🆕 No dedicated screen — balance shown inline in Profile/Rewards only | Show both wallet balances (main + reward) and recent activity in one place | "How much do I have?" | Home Quick Action "کیف پول" (currently scroll-anchors within Home — see §2), bottom nav has no Wallet tab (not in `BOTTOM_NAV_ITEMS`, reached only via Home) | Back to Home; Transactions (same screen, scrolled); (future, blocked) Increase Balance |
| **Transactions (list)** | 🆕 No screen — `WalletTransaction` exists as a DB model/API only, never rendered as a list anywhere yet | Full transaction history, not just Home's balance summary | "What happened to my money?" | Wallet Overview (same page, or a dedicated sub-view — see §3 for the recommendation) | Back to Wallet Overview |
| **Transaction Detail** | Not present in prototype or data model beyond what a list row already shows | — | — | — | — |
| **Deposit / Increase Balance** | Referenced only as an unwired button — `docs/prototype-to-production-mapping.md` J4: *"این کل فلو در پروتوتایپ فقط یک دکمه بود بدون فرم واقعی"* (the entire flow in the prototype was just a button, no real form) | — | — | — | — |
| **Withdraw** | **Does not exist anywhere** — not in the prototype, not in `docs/01-prototype-analysis.md`, not in the backend schema/API, not in any prior contract doc | — | — | — | — |
| **Empty state** | No prototype precedent, but an established in-app pattern (Home's `AccountFinancialCards`) | Zero transactions yet | — | — | — |
| **Error state** | Established in-app pattern | Fetch failed | — | — | — |

**Transaction Detail is not a real v1 screen** — a `WalletTransaction`
row (`type`, `amount`, `balanceAfter`, `description`, `createdAt`) has no
additional data behind it that a list row doesn't already show in full.
Listed as a Future Gap (§8), not a screen to build now.

**Deposit and Withdraw are both blocked**, for different reasons — see
§5's API Contract. Their "screens" in this v1 contract are a single
disabled button with a "به‌زودی" caption (the exact pattern already
established for every other not-yet-backed action in this app — Stage
4.3's `ComingSoonCaption`, reused, not reinvented), not real flows.

---

## 2. User Flows

### View Wallet Balance (buildable now)

```
Home
 ↓ (Quick Action "کیف پول" — today scrolls to Home's own WalletsCard;
    once /wallet is a real page, this should link there instead — a
    1-line change to QuickActionsGrid, not in scope for this stage)
Wallet Overview
 ↓
Balance (main + reward, GET /wallet)
```

### Transaction History (buildable now)

```
Wallet Overview
 ↓
Transactions (GET /wallet/:kind/transactions or GET /transactions — see §5)
```
No Transaction Detail step — see §1.

### Increase Wallet (blocked)

```
Wallet Overview
 ↓
"افزایش موجودی" — disabled, "به‌زودی" caption
 ✕ dead end by design (no backend endpoint exists to go anywhere)
```

### Withdraw

Not mapped — no evidence this flow is planned. Recommend not
speculatively designing it; revisit only once product defines it.

### Empty / Error states

```
Wallet Overview → GET /wallet succeeds, both balances 0, zero transactions
  → same "هنوز ... نداری" message pattern Home already uses, not a blank screen

Wallet Overview → any wallet request fails
  → inline error text, same red (#c0392b) already used everywhere else,
    rest of the page (whichever section didn't fail) still renders
```

---

## 3. Component Tree

Wallet is a consumer of the existing shell — `AppShell`, `PageHeader`
(via `AppShell`'s props), `PageContainer`, `BottomNavigation` are all
reused completely unmodified, per this stage's explicit restriction. Only
the content inside `PageContainer` is new.

```
app/wallet/page.tsx  (replaces Stage 5.2's PlaceholderContent body)
│
├── AppShell                          [existing — reused as-is]
│   activeNavKey="home"  pageLabel="کیف پول"
│   │
│   ├── PageHeader                    [existing, via AppShell]
│   ├── PageContainer                 [existing, via AppShell]
│   │   │
│   │   ├── WalletBalanceSection      [🆕 wallet-specific]
│   │   │   └── WalletCard × 2        [existing, packages/ui — main + reward]
│   │   │
│   │   ├── WalletQuickActions        [🆕 wallet-specific]
│   │   │   └── Button (disabled)     [existing, packages/ui — "افزایش موجودی"]
│   │   │   └── ComingSoonCaption     [existing, components/common]
│   │   │
│   │   ├── TransactionList           [🆕 wallet-specific]
│   │   │   ├── TransactionListItem   [🆕 wallet-specific, × N]
│   │   │   │   └── Badge             [existing, packages/ui — status/type]
│   │   │   └── EmptyState            [🆕 — but just the established Card+message convention, not a new pattern]
│   │   │
│   │   └── SkeletonBlock             [existing, components/common — loading, all sections]
│   │
│   └── BottomNavigation              [existing, via AppShell]
```

**Extraction note for implementation time (not done now)**: Home's
`AccountFinancialCards.tsx` already has a private `WalletsCard` function
rendering exactly this balance-card pattern (`WalletCard` × 2). Building
Wallet Overview will either duplicate that or — better — extract it into
a shared `WalletBalanceSection` both Home and Wallet import. That touches
`components/home/AccountFinancialCards.tsx`, which is why it's flagged
here rather than done now: this stage's restrictions include "Do not
modify Home."

---

## 4. Data Contracts

Already-established shapes (from `apps/web/src/lib/home-api.ts`, real
Prisma-backed, verified against the running API in Stage 4.1):

```ts
interface WalletDto {
  id: string;
  userId: string;
  kind: "main" | "reward";
  balance: number;   // Rial, integer — display via formatToman() (÷10)
}
```

**Not yet defined anywhere — needed for this module**:

```ts
interface WalletTransactionDto {
  id: string;
  walletId: string;
  type: "topup" | "spend" | "refund" | "gateway_settlement";
  amount: number;          // Rial
  balanceAfter: number;    // Rial — balance immediately after this transaction
  relatedOrderId: string | null;
  relatedRewardClaimId: string | null;
  description: string;     // server-generated, not user input — see §8
  createdAt: string;       // ISO date
}
```

**Real data-contract gap worth flagging**: the merged `GET /transactions`
endpoint (`transactions.controller.ts`) returns `WalletTransaction` rows
tagged only with `walletId`, **not** `kind` — it fetches both wallets'
transactions and concatenates them, but never annotates which wallet each
row came from. A frontend showing "همه تراکنش‌ها" (all transactions, both
wallets merged) needs to cross-reference each row's `walletId` against
`GET /wallet`'s result (which does have `kind`) to know whether a given
row is main or reward. This is a real implementation detail, not
insurmountable, but worth designing for explicitly rather than
discovering at implementation time.

### Loading states
One `SkeletonBlock` per section (balance cards, transaction list) —
exact pattern already established and normalized across Home
(`docs/home-final-spec.md`'s Loading States section). Not a new
convention to invent.

### Empty states
- Both balances `0`, zero transactions: still render the real `WalletCard`s (showing "۰ تومان", not hidden) + a `Card` with muted text, e.g. "هنوز تراکنشی ثبت نشده." — mirrors `AccountFinancialCards`' existing `CreditCard`/`InstallmentsCard` empty-state wording exactly.

### Error states
Per-section, non-blocking — if transactions fail to load but balance
succeeded, balance still renders. Same philosophy `docs/home-ui-contract.md`
§2 established and Home's actual implementation follows.

---

## 5. API Contract

Verified directly against `backend/src/modules/wallet/wallet.controller.ts`
and `transactions.controller.ts` this session — not assumed, not carried
over from memory.

| Endpoint | Method | Request | Response | Auth | Status |
|---|---|---|---|---|---|
| `/wallet` | GET | — | `WalletDto[]` (both kinds, current user) | Required | ✅ **AVAILABLE** |
| `/wallet/:kind/transactions` | GET | `kind` (`main`\|`reward`), `page`, `limit` | `{items: WalletTransactionDto[], page, limit, total}` | Required | ✅ **AVAILABLE** |
| `/transactions` | GET | `page`, `limit` | `WalletTransactionDto[]` (main+reward merged, sorted, **not kind-tagged** — see §4) | Required | ✅ **AVAILABLE** |
| `/wallet/deposit` (top-up) | POST | — | — | — | ❌ **MISSING / NEEDS BACKEND WORK** |
| Withdraw (any shape) | — | — | — | — | ❌ **MISSING — not even designed, no prototype/schema precedent** |

**On the missing deposit endpoint**: `WalletService.credit()` exists
internally (`backend/src/modules/wallet/wallet.service.ts`) and can
already atomically increase a balance + write the audit transaction row —
but nothing calls it from a user-initiated HTTP route. Per
`docs/prototype-to-production-mapping.md` J4, real top-up also needs a
payment-gateway round trip (`POST /wallet/topup` → redirect to IPG →
`POST /wallet/topup/callback`), which is explicitly out of Foundation
scope and was never designed past that one sentence. **Not inventing this
API** — flagging it as backend work required before "افزایش موجودی" can
be anything but a disabled button.

**On withdraw**: no backend model, no `WalletTxType` value for it, no
mention anywhere in this codebase's history. This isn't a gap to fill —
it's a feature that would need a product decision before any contract
work makes sense. Recommend leaving it out of the route map entirely
until that happens, rather than speculatively designing an unrequested
financial feature.

---

## 6. Responsive Rules

Wallet reuses `AppShell` verbatim, so every shell-level responsive rule
(760px capped column, `BottomNavigation` capped to that column from
tablet up, sticky `PageHeader`) is already solved — verified across all
8 required widths in Stage 5.2 for the shell itself. Only the
Wallet-specific content needs new rules:

| Width | Card behavior | Layout | Nav |
|---|---|---|---|
| 375 / 393 / 430 (mobile) | `WalletCard` × 2 stacked vertically, full width | Single column, matches `AccountFinancialCards`' mobile behavior exactly | Full-width, fixed bottom (shell default) |
| 768 / 1024 (tablet) | `WalletCard` × 2 side by side | 2-column grid for the balance cards (mirrors `AccountFinancialCards`' `768px → repeat(3,1fr)` breakpoint, here `repeat(2,1fr)` since there are only 2 wallets, not 3 sections) | Capped to 760px (shell default) |
| 1366 / 1440 / 1920 (desktop) | Same 2-column balance cards | Content stays capped at 760px — **no reflow to a wider desktop layout**, same "mobile app in a desktop browser" rule as everywhere else in this app | Capped to 760px (shell default) |

Transaction list: single column at every width (a list doesn't benefit
from a grid), same as Home's `InstallmentsCard`/`CreditCard` list
rendering. Scrolling: single page-level scroll, no nested scroll
container — matches the established rule (`docs/home-ui-contract.md` §2)
against nested-scroll traps.

---

## 7. Design System Mapping

**Existing, reusable as-is — zero new design-system primitives needed:**

| Component | Source | Wallet usage |
|---|---|---|
| `WalletCard` | `packages/ui` | Balance display, main + reward |
| `Card` | `packages/ui` | Transaction rows, empty-state message |
| `Badge` | `packages/ui` | Transaction type/status |
| `Button` | `packages/ui` | Disabled "افزایش موجودی" |
| `SkeletonBlock` / `SkeletonStyles` | `apps/web/components/common` (**app-level, not `packages/ui`** — worth being precise about, since the example in this stage's prompt listed "Skeleton" alongside `packages/ui` names) | Loading state, all sections |
| `ComingSoonCaption` | `apps/web/components/common` | "به‌زودی" under the disabled deposit button |
| `AppShell`, `PageHeader`, `PageContainer` | `apps/web/components/shell` | The whole page frame — reused untouched |

**New, Wallet-specific (to be created at implementation time, not now):**
`WalletBalanceSection`, `WalletQuickActions`, `TransactionList`,
`TransactionListItem`. None of these are generic enough to belong in
`packages/ui` — they're compositions specific to this one screen, same
tier as Home's `AccountFinancialCards`/`BenefitsSection`.

---

## 8. Security / Permission Considerations

- **Authenticated access**: already double-enforced — `AppShell`'s
  `AuthGuard` (client-side redirect) and the backend's global
  `JwtAuthGuard` (`wallet.controller.ts` has no `@Public()` anywhere).
  Nothing new needed here.
- **Sensitive financial data**: balance figures are shown in the open
  today (Profile, Rewards, Home's `WalletsCard`) — no masking/reveal-toggle
  pattern exists anywhere in this app currently. Worth considering for a
  dedicated Wallet screen (common fintech-app convention: mask by
  default, tap to reveal) but there's no prototype or product precedent
  requiring it — flagged as a nice-to-have, not a v1 requirement.
- **Transaction privacy**: `WalletTransaction.description` is
  server-generated by whichever domain calls `WalletService.credit()`/
  `debit()` (confirmed reading `wallet.service.ts` — the caller always
  supplies `description` as a parameter; it's never user-submitted free
  text), so there's no injection/XSS surface from transaction descriptions.
- **Payment data**: not applicable to this v1 scope (no deposit/withdraw
  flow is being built) — but worth stating now for whoever eventually
  builds the deposit flow: per the existing precedent elsewhere in this
  app (Reward redeem modal's gateway step), **card/payment details must
  never be sent to this app's own backend** — only to the real payment
  gateway. `PaymentProvider` (`wallet` | `gateway`) already models this
  distinction in the schema.

---

## Wallet Module v1 Contract

**Status: READY FOR IMPLEMENTATION**

— for the scope that's actually backed by real APIs: Wallet Overview
(balance display) and Transaction List. Every endpoint they need already
exists and was verified live this session.

**Deposit/Increase Balance is explicitly BLOCKED** for anything beyond a
disabled button — no backend endpoint, no payment-gateway integration
designed. **Withdraw is not in scope at all** — no prototype, schema, or
product precedent exists for it; recommend not building it until a
product decision defines what it should even do.
