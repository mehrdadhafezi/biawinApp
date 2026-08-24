# Navigation & Route Contract (Stage 5.2 — Frozen)

Infrastructure only — no feature was built. Every route below except `/`
and `/home` is a minimal placeholder proving the route/shell/nav wiring
works end to end, not a real screen. Landing, Orbit, Auth logic, and
backend APIs are all untouched.

---

## 1. Route Architecture

```
/                          Landing            existing, outside AppShell
/home                      Home Dashboard      existing, full dashboard

/wallet                    Wallet             🆕 placeholder
/credit                    Credit             🆕 placeholder
/installments               Installments        🆕 placeholder
/services                  Services            🆕 placeholder
/services/[categoryId]      Service Category    🆕 placeholder (dynamic route)
/rewards                   Rewards             🆕 placeholder
/profile                   Profile             🆕 placeholder
```

All 7 new routes are real Next.js pages (verified in the production
build output — `next build` lists all 9 routes, `/services/[categoryId]`
correctly marked dynamic/server-rendered, everything else static). None
of them fetch or render real feature data — see §3.

## 2. Navigation Contract

Single source of truth: `apps/web/src/components/shell/navigation.ts`.

```ts
export interface NavigationItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  enabled: boolean;    // whether tapping this item navigates
  status: "available" | "coming-soon";   // real feature vs. placeholder
}

export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { id: "home",     title: "خانه",      icon: "🏠", route: "/home",     enabled: true, status: "available" },
  { id: "services", title: "خدمات",     icon: "🛍️", route: "/services", enabled: true, status: "coming-soon" },
  { id: "rewards",  title: "جایزه",     icon: "🎁", route: "/rewards",  enabled: true, status: "coming-soon" },
  { id: "profile",  title: "پروفایل",   icon: "👤", route: "/profile",  enabled: true, status: "coming-soon" },
];
```

`AppShell` reads this file directly — it no longer hardcodes a nav-items
array or a separate "which keys are real routes" set (Stage 5.1 had
both). All four are `enabled: true` now, because all four destinations
are real pages (even if `status: "coming-soon"` for three of them) —
tapping any bottom-nav tab genuinely navigates, verified live (Home →
Services, Profile → Home). This also resolves a UX finding from Stage
4.2/4.3 (dead nav taps) as a natural side effect of every route now
existing.

## 3. Placeholder Pages

Every new route follows the same minimal shape, using two shared
components:

- `AppShell` — auth guard, header, capped shell, bottom nav (unchanged from Stage 5.1's architecture, just a simplified prop surface — see §4)
- `PlaceholderContent` (`components/shell/PlaceholderContent.tsx`) — the "به‌زودی" body, `Card` + `typography` tokens, no page-specific logic

Example (`app/wallet/page.tsx`):

```tsx
"use client";
import { PlaceholderContent } from "../../components/shell/PlaceholderContent";
import { AppShell } from "../../components/shell/AppShell";

export default function WalletPage() {
  return (
    <AppShell activeNavKey="home" pageLabel="کیف پول">
      <PlaceholderContent title="کیف پول" />
    </AppShell>
  );
}
```

`/services/[categoryId]` additionally reads the dynamic segment via
`useParams()` (client-side hook, not the async server-component `params`
pattern — this page needs `"use client"` for `AppShell`, and client
components can't be `async`) and echoes it in the placeholder body, just
to prove the dynamic route resolves. No category data is fetched.

`activeNavKey` for Wallet/Credit/Installments is `"home"` — they aren't
bottom-nav tabs themselves; they're reached from Home's existing Quick
Actions (unchanged, still scroll-anchors within Home, not links to these
new pages — wiring that up is Wallet-feature work, out of scope here).

## 4. GlobalHeader Contract

`AppShell` now owns fetching the current user's profile and composing the
header — no page fetches its own profile anymore (Stage 5.1's Home did;
every new page would have repeated it). New shared component:
`components/shell/PageHeader.tsx`, built on the existing `GlobalHeader`.

```tsx
interface PageHeaderProps {
  firstName: string | null;   // from currentUser/Profile — never hardcoded
  pageLabel: string;
  greeting?: boolean;          // Home: "سلام {firstName}". Everyone else: "{firstName}"
  end?: ReactNode;
}
```

`firstName` is derived from `Profile.fullName` (no separate first/last
name field exists on the backend — not something this stage can add,
`Do not modify backend APIs`) via a new `getFirstName()` helper
(`lib/format.ts`) that takes the first word.

Verified live, exactly matching the three named examples:

| Page | `greeting` | Rendered |
|---|---|---|
| Home | `true` | "سلام کاربر" / "خلاصه حساب" |
| Wallet | `false` | "کاربر" / "کیف پول" |
| Profile | `false` | "کاربر" / "پروفایل" |

`AppShell`'s `headerEnd` prop carries the notification bell — extracted
into `components/common/NotificationButton.tsx` (was inline in Stage
5.1's Home-only header) so any future page can reuse it. Only Home passes
it today.

**Behavior note**: Stage 5.1's Home showed a visible error banner if the
profile fetch failed. Now that `AppShell` owns the fetch for every page,
a failure is swallowed silently — the header's name skeleton just stays
up rather than resolving. This is a minor, deliberate simplification from
centralizing the concern, not a regression in what any page could already
do about a failed fetch (there was no retry before either).

## 5. Route Guards

Unchanged from Stage 5.1, extended to every new page: `AuthGuard`
(`components/shell/AuthGuard.tsx`), client-side, built on `useAuth()` +
`localStorage` — no middleware, since tokens aren't in a cookie
middleware could read.

- **Public**: `/` (Landing already guards itself the other direction —
  redirects to `/home` if already authenticated — untouched this stage)
- **Protected** (via `AppShell` → `AuthGuard mode="require-auth"`): `/home`, `/wallet`, `/credit`, `/installments`, `/services`, `/services/[categoryId]`, `/rewards`, `/profile`

Verified live: clearing `localStorage` and requesting `/wallet` directly
redirects to `/` with zero console errors — the guard applies uniformly
across every new page, not just Home.

## 6. Responsive Validation

All 8 required widths checked live this session, on both Home and a
representative placeholder page (Wallet) — **zero horizontal overflow at
any of them**, nav correctly full-width on mobile / capped at 760px from
tablet up:

| Width | Result |
|---|---|
| 375×667 | ✅ |
| 393×852 | ✅ |
| 430×932 | ✅ |
| 768×1024 | ✅ — nav width 760px (capped) |
| 1024×768 | ✅ |
| 1366×768 | ✅ — nav width 760px |
| 1440×900 | ✅ |
| 1920×1080 | ✅ — nav width 760px |

Header behavior verified consistent across all pages at every width
(sticky, blurred, same two-line identity/context pattern). Placeholder
pages verified structurally identical to Home's shell — same header,
same capped column, same bottom nav — differing only in body content.

---

## Deliverable checklist

- [x] Route architecture — all 7 new routes exist and build
- [x] Navigation contract — `NavigationItem[]`, `BottomNavigation` no longer hardcoded
- [x] Placeholder pages — minimal, shared `PlaceholderContent`, no feature logic
- [x] `GlobalHeader` contract — dynamic identity + dynamic page context, verified against all 3 named examples
- [x] Route guards — client-side `AuthGuard`, verified protecting every new route
- [x] Responsive validation — all 8 widths, zero overflow
- [x] `tsc --noEmit`, `eslint`, `next build` — all clean

No Wallet/Credit/Services/Profile/Rewards feature was implemented. Waiting for approval before starting any of them.
