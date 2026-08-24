# App Shell Contract (Stage 5.0 — Analysis)

Single source of truth for building the shared App Shell. Analysis only —
no code was written or changed to produce this; Home, Landing, Orbit, and
Auth are all untouched. Every claim below was verified against the actual
current code, not assumed.

---

## 1. Current Routing Structure

Next.js App Router, file-based. The entire route tree today is exactly
three files:

```
apps/web/src/app/
├── layout.tsx     — root layout (html/body, font, AuthProvider)
├── page.tsx       — "/"      (Landing)
└── home/
    └── page.tsx    — "/home"  (Home Dashboard)
```

No nested layouts, no `template.tsx`, no `loading.tsx`, no `error.tsx`,
no `middleware.ts` anywhere in the app. Every other route referenced
elsewhere in the app (Services, Rewards, Profile, Wallet, Credit,
Installments, Notifications, Card Detail, ...) does not exist as a route
yet — confirmed via `docs/home-final-spec.md`'s "Known Future Gaps" and a
fresh filesystem check for this analysis.

---

## 2. Current Layout Architecture

There is no shared page-shell component. Each of the two existing pages
independently builds its own root wrapper inline:

- **Landing** (`page.tsx`): renders `<OrbitLanding>` full-bleed, no
  max-width cap (Orbit is intentionally full-viewport), plus `<AuthModal>`
  as a sibling overlay.
- **Home** (`home/page.tsx`): builds its own `<div>` capped at
  `layout.maxContentWidth` (760px), centered, with a `color.ice`
  background bleeding outside the cap and `<BottomNavigation>` rendered
  as a sibling outside the capped column (so the nav itself spans full
  viewport width — a known, already-documented tradeoff).

Both patterns are hand-rolled per page, not derived from one shared
layout. If a third page is added today, it would have to reinvent this a
third time.

---

## 3. Existing Header Components

**There is no shared header component.** The only header-shaped component
in the codebase is `HomeHeader`
(`apps/web/src/components/home/HomeHeader.tsx`) — and it is Home-specific
by design: it renders the signed-in user's greeting (`fullName` prop) and
a disabled notification bell. It lives under `components/home/`, not in
`packages/ui`, and isn't exported for reuse.

For a shell-level `GlobalHeader`, this needs generalizing, not reusing
verbatim — a shell header has to work on pages that don't have a
"greeting" concept at all (e.g. a Service Category listing needs a title +
back button, not a greeting). Concretely: extract the sticky/blurred
header shell (position, backdrop-filter, border, height) as the reusable
part, and make the *content* (greeting vs. page title vs. back button) a
slot/children prop per page — `HomeHeader` becomes one specific
composition of the generic shell, not the shell itself.

---

## 4. Existing BottomNavigation Component

Already built in `packages/ui` (`BottomNavigation.tsx`), already generic —
takes `items`, `activeKey`, `onChange`, no Home-specific assumptions baked
in. This is genuinely reusable as-is.

What's **not** reusable today: the actual 4-item array (`خانه`/`خدمات`/
`جایزه`/`پروفایل`) and the "only navigate for routes that exist" guard
logic are both defined inline inside `home/page.tsx`, not shared. Every
future page that wants the bottom nav would currently have to copy that
array and that logic by hand. This is the clearest, lowest-risk extraction
candidate for the shell: one shared nav-items config + one shared
navigate-or-noop handler, used by the shell itself rather than by each
page.

---

## 5. Authentication Guard Requirements

`useAuth()` (`apps/web/src/lib/auth/auth-context.tsx`) exposes
`isAuthenticated: boolean | null` — `null` specifically means "the
client-side token check hasn't run yet" (avoids an SSR flash), not "not
authenticated." Both existing pages independently re-implement the same
shape of guard, in opposite directions:

- **Landing**: `if (isAuthenticated) router.replace("/home")` — redirect
  *away* if already signed in.
- **Home**: `if (isAuthenticated === false) router.replace("/")` —
  redirect *away* if not signed in.

Both also gate their render on the same value (`if (isAuthenticated)
return null` / `if (!isAuthenticated) return null`) to avoid a content
flash before the redirect fires.

**Important constraint for the shell**: this is a purely client-side
guard, because auth tokens live in `localStorage`
(`lib/auth/token-storage.ts`), which a Next.js `middleware.ts` (runs at
the edge, no `localStorage` access) cannot read. A shell-level route guard
therefore has to stay a client-side pattern too — e.g. a
`<RequireAuth>`/`<RequireGuest>` wrapper or a `useAuthGuard(mode)` hook
built on the exact same `useAuth()` value, not a middleware rewrite. This
is the second clear extraction candidate: today's guard logic is
duplicated across 2 pages in slightly different shapes; every new
authenticated page (Wallet, Credit, Services, ...) would otherwise
duplicate it a third, fourth, fifth time.

---

## 6. Page Transition Requirements

None exist today — confirmed no `template.tsx`, no Next.js View
Transitions usage, no CSS transition between route changes anywhere in
the app. The only precedent for a *component*-level enter transition in
this codebase is `Modal`'s CSS keyframe animation (Stage 3) — scoped
`<style>`, `prefers-reduced-motion` respected, no JS animation library.
If the shell adds page-to-page transitions, that's the established
pattern to follow (lightweight CSS, not a new dependency), not something
to design from scratch.

---

## 7. Responsive Shell Behavior

The pattern is already consistent across Orbit Landing and Home, just
duplicated rather than shared:

- Content capped at `layout.maxContentWidth` (760px), centered via
  `marginInline: auto`.
- A light background (`color.ice`) fills the space outside the cap on
  wider viewports rather than leaving it stark white.
- This holds at every width including 1920px — verified in Stage 4.4 QA —
  matching the deliberate "mobile app inside a desktop browser" framing
  from `docs/01-prototype-analysis.md` §3, not a responsive reflow to a
  wider desktop layout.
- `BottomNavigation` is the one exception: it spans the full viewport
  width even on desktop, because it's fixed-positioned outside the capped
  column. Already flagged as a known tradeoff in `docs/home-final-spec.md`
  — the shell should decide once whether to fix this (cap the nav too) or
  formally keep it as accepted behavior, rather than leaving it an
  unresolved per-page inconsistency.

---

## App Shell Component Tree

```
AppShell                              [new — the extraction target]
│
├── AuthGuard                         [new — wraps useAuth(), replaces the
│                                       per-page redirect-and-null-render
│                                       pattern in Landing/Home]
│
├── GlobalHeader                      [new — generalized from HomeHeader;
│   │                                   sticky/blurred shell + a per-page
│   │                                   content slot]
│   └── (per-page content slot)        e.g. HomeHeader's greeting,
│                                       or a page title + back button
│
├── PageContainer                     [new — the capped-760px-centered
│                                       wrapper, extracted from Home's
│                                       inline div]
│   └── {page content}
│
└── BottomNavigation                  [existing, packages/ui — reused as-is]
```

`AppShell` is not a replacement for Landing (Landing's Orbit hero is
intentionally full-bleed, outside this cap) — it's what every
*authenticated, app-shell-style* page (Home, and everything in the route
map below) mounts inside.

---

## Route Map

```
/                    Landing        existing, outside AppShell (full-bleed Orbit)
/home                Home Dashboard existing, first AppShell consumer

/wallet              Wallet Detail       🆕 — needed, Home's Quick Action already points here
/credit              Credit Detail       🆕 — needed, same
/installments         Installment Detail  🆕 — needed, same (not in the user's example list, but
                                          documented as a gap in home-final-spec.md alongside
                                          Wallet/Credit — omitting it would be inconsistent)
/services             Services list        🆕 — needed, bottom nav + Quick Action + banner/ticker
/services/[categoryId] Service Category     🆕 — needed once Services exists (per
                                          prototype-to-production-mapping.md #5)
/rewards             Rewards             🆕 — needed, bottom nav
/profile              Profile              🆕 — needed, bottom nav
/notifications         Notifications feed  🆕 — needed, Home header bell — also blocked on the
                                          two missing backend endpoints already documented in
                                          home-final-spec.md, independent of the shell itself
```

All 🆕 routes are out of scope to build in this stage — listed here only
so the shell is designed against the real, complete route set rather than
the shorter illustrative list, and so `AppShell`/`GlobalHeader`/
`BottomNavigation`'s nav-items config has a correct target shape from day
one instead of being redesigned per new page.

---

## Shared Components

**Existing, reusable as-is:**
- `BottomNavigation` (`packages/ui`) — generic, already takes the right props
- `Card`, `Badge`, `Button`, `FinancialCard`, `WalletCard`, `StoryCard`, `Modal`, `BottomSheet`, `Input`, `OtpInput`, `Countdown`, `Toast` — all design-system primitives, none shell-specific, none need touching for this work
- `SkeletonBlock`, `ComingSoonCaption` (`components/home/`) — currently Home-scoped but genuinely generic (loading placeholder, disabled-state caption); worth relocating to a shared location once a second page needs them, not duplicating

**Need extraction (exist today, but only as page-specific implementations):**
- The capped-760px-centered wrapper → `PageContainer`
- `HomeHeader`'s sticky/blurred shell → `GlobalHeader` (generalized, content becomes a slot)
- The bottom-nav items array + navigate-or-noop handler → owned by `AppShell`, not copy-pasted per page
- The Landing/Home redirect-and-null-render guard pattern → `AuthGuard` (or a `useAuthGuard` hook)

**Should remain page-specific (do not extract):**
- `HomeStories`, `HeroCardCarousel`, `QuickActionsGrid`, `ServiceTicker`, `FeaturedServiceBanner`, `MembershipStories`, `AccountFinancialCards`, `BenefitsSection` — all Home content, not shell
- `OrbitLanding`/`OrbitStage`/`OrbitBubble`/`OrbitRing` — Landing-only, explicitly frozen, not part of the app shell at all (Landing sits outside `AppShell`)
- `AuthModal` and its steps — Auth flow, explicitly out of scope for this stage

---

## Responsive Rules

- **Mobile** (< `breakpoint.md`, 768px): `PageContainer` at `100%` width, no cap needed (viewport is already narrower than 760px). `BottomNavigation` full-width, fixed bottom, `layout.bottomNavHeight` reserved in `PageContainer`'s bottom padding — exact pattern Home already uses.
- **Tablet** (`breakpoint.md`–`breakpoint.lg`, 768–1024px): `PageContainer` caps at 760px, centered — verified holding correctly today at both 768 and 1024.
- **Desktop** (≥ 1366px): same 760px cap, centered, background fills the remainder — verified holding at 1366/1440/1920 today. `AppShell` should make this the *only* place this rule is expressed, rather than each page re-deciding it.
- `GlobalHeader` stays `position: sticky; top: 0` at every width (matches the prototype's documented repeated header pattern, `docs/01-prototype-analysis.md` §3).
- Open decision for implementation: whether `BottomNavigation` gets capped to `PageContainer`'s width at desktop (visual consistency with the rest of the shell) or stays full-width (current behavior, arguably fine since it's a fixed-position system chrome element, not content) — flagged, not resolved, in this analysis.

---

## Implementation Plan (not started)

1. `PageContainer` — extract Home's capped-760px wrapper into a shared component.
2. `AuthGuard` — extract the Landing/Home redirect pattern into one shared guard, parameterized by direction (require-auth vs. require-guest).
3. `GlobalHeader` — generalize `HomeHeader`'s shell (sticky/blur/border) with a content slot; migrate `HomeHeader` to be one composition of it, not a rewrite of Home's visual output.
4. `AppShell` — compose `AuthGuard` + `GlobalHeader` + `PageContainer` + `BottomNavigation` with the full route-map's nav-items config, so `/home` becomes its first real consumer without changing Home's rendered output.
5. Only after 1–4 are reviewed: begin building the actual new routes (`/wallet`, `/credit`, `/services`, ...) on top of `AppShell`.

No code changes happen until this contract is approved, per the stage instructions.
