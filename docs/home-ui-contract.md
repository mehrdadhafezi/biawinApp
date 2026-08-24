# Home UI Contract (Stage 4.0 — Contract Discovery)

Single source of truth for implementing Biawin's Home experience. This is an
**analysis-only** deliverable — no frontend/backend code was written or
changed to produce it. It converts the prototype's Home area into a
production-ready specification, the same way `docs/11-orbit-asset-system.md`
did for the Orbit Landing.

Sources used (all pre-existing, cross-checked against the running code, not
re-derived from memory):

- [`docs/01-prototype-analysis.md`](01-prototype-analysis.md) — full
  prototype analysis (`biawin_single_file_app_requested_edits_v15.html`).
- [`docs/prototype-to-production-mapping.md`](prototype-to-production-mapping.md)
  — the existing all-17-screens mapping; this document goes one level
  deeper specifically on Home and its directly-reachable screens, and
  re-verifies every API/DB claim against the actual current code rather
  than the mapping doc's original (still accurate) pass.
- `backend/prisma/schema.prisma` — the real, current data model.
- `backend/src/modules/*` — every controller/service/DTO actually touched
  for this analysis (wallet, credit, installments, membership,
  subscriptions, notifications, rewards, transactions, services,
  categories, orders).
- `packages/types/src/*` — the shared frontend/backend type package
  (already drafted; some types here are aspirational/not yet DB-backed,
  flagged explicitly below).
- `packages/ui/src/components/*` — the existing design system.

**Important scope note on screen inventory.** The prototype's actual Home
view (`docs/01-prototype-analysis.md` §2, `data-view="home"`) is a single
dashboard screen: intro stories, a membership-card hero carousel, quick
actions, a services ticker, a featured-services banner, a subscription-tier
story strip, and news — not a set of separate "Wallet/Credit/Installment"
pages. Those live today as Profile accordion rows or don't exist as
standalone screens at all (`docs/prototype-to-production-mapping.md`
already flags "اقساط من" as **"هنوز در فرانت ساخته نشده"** — not built in
the prototype). Rather than silently invent screens, this document treats
**Home Dashboard as the one fully-specified screen** (parity with how
Orbit Landing was treated as one screen) and gives each of its Quick
Action targets — Wallet, Credit, Installments, Notifications — a
**lighter, explicitly-flagged "new screen" contract**, since Home's Quick
Actions need somewhere to navigate to. Rewards and Profile are already
full top-level screens with their own contracts in
`prototype-to-production-mapping.md` (#7, #9) and are referenced here only
as exit points, not re-specified.

---

## 1. Screen Inventory

```
Home Dashboard                 (primary — full contract, §1-8 below)
├─ Card Detail                 (existing contract: mapping.md #3 — referenced, not re-specified)
├─ Wallet Summary              (NEW screen — no prototype page; wallet was Profile/Rewards-embedded)
├─ My Credit                   (NEW screen — flagged 🆕 in mapping.md J5, no prototype page)
├─ My Installments             (NEW screen — flagged 🆕 in mapping.md J6/J7, explicitly "not built" in prototype)
├─ Notifications               (NEW screen — prototype only had a Profile accordion toggle list, not a feed)
├─ Rewards          [exit only — full contract: mapping.md #7]
└─ Profile           [exit only — full contract: mapping.md #9]
```

### Home Dashboard

| | |
|---|---|
| **Purpose** | Command center after login — membership status, quick access to money actions, and service discovery. |
| **User goal** | "What can I do right now?" — see my active card(s), jump to a purchase path, check what's new. |
| **Entry point** | Post-auth redirect (`AuthModal` → `router.push("/home")`, both login and signup branches — see [`AuthModal.tsx`](../apps/web/src/components/auth/AuthModal.tsx)); direct navigation when already authenticated (`LandingPage`'s `isAuthenticated` redirect, already implemented). |
| **Exit points** | Card Detail (tap a hero card), Wallet/Credit/Installments (Quick Actions), Services (bottom nav or banner), Rewards (bottom nav), Profile (bottom nav), Notifications (header button). |
| **Main components** | See §3 Component Tree. |
| **Required data** | User's active memberships + the plan catalog (hero carousel), service categories (ticker/banner), unread notification count. See §4. |
| **User interactions** | Swipe/scroll the card carousel and story strip, tap a card → Card Detail, tap a Quick Action → Wallet/Credit/Installments, tap a banner/ticker item → Service Detail, tap notification bell → Notifications, tap bottom nav → Services/Rewards/Profile. |

### Card Detail — reference only

Already fully specified in `prototype-to-production-mapping.md` #3
(`MembershipDetailHeader`, `FinancialCard`, `MembershipStatsRow`,
`BenefitList`, `ServiceTagList`, `StickyActionBar`). Home's only
responsibility toward it: pass the tapped card's id as the navigation
param. No changes to that existing contract.

### Wallet Summary — 🆕 new screen

| | |
|---|---|
| **Purpose** | Show both wallet balances (main + reward) and recent transactions in one place — the prototype never had this as a page; it only showed a wallet balance embedded inside Profile and inside the Rewards screen. |
| **User goal** | "How much do I have, and what happened to it recently?" |
| **Entry point** | Home Quick Actions ("افزایش موجودی" / wallet shortcut). |
| **Exit point** | Back to Home; (future, P1) a top-up flow — see `prototype-to-production-mapping.md` J4, explicitly marked out of scope for now. |
| **Main components** | `WalletCard` ×2 (main, reward — component already exists, `packages/ui`), a transaction list. |
| **Required data** | `GET /wallet` (both kinds), `GET /wallet/:kind/transactions` or the combined `GET /transactions`. |
| **User interactions** | Switch between main/reward balance, scroll transaction history, (P1) tap "top up". |

### My Credit — 🆕 new screen

| | |
|---|---|
| **Purpose** | Show the user's credit line(s): limit, used amount, remaining. |
| **User goal** | "How much credit do I have left before I go shop?" |
| **Entry point** | Home Quick Actions ("اعتبار من"). |
| **Exit point** | Back to Home; (future) Services filtered to credit-eligible items. |
| **Main components** | `FinancialCard` (credit variant), a usage list. |
| **Required data** | `GET /credit` (list), `GET /credit/:id` (detail). |
| **User interactions** | View limit/used/available, tap a usage row for its related order (future). |

### My Installments — 🆕 new screen

| | |
|---|---|
| **Purpose** | Show active/past installment plans — monthly amount, paid count, next due date. Explicitly called out in `prototype-to-production-mapping.md` J7 as not existing in the prototype at all. |
| **User goal** | "What do I still owe, and when is it due?" |
| **Entry point** | Home Quick Actions ("اقساط من"). |
| **Exit point** | Back to Home; (future) a single installment's detail/pay-one-installment flow — explicitly out of scope per mapping.md J7 ("کاملاً Feature-stage است"). |
| **Main components** | `Card`-based list rows, `Badge` for status (`active`/`completed`/`defaulted`/`cancelled`). |
| **Required data** | `GET /installments` (list), `GET /installments/:id` (detail). |
| **User interactions** | Scroll list, tap a row → detail (list view is P0; detail view is P1). |

### Notifications — 🆕 new screen

| | |
|---|---|
| **Purpose** | A real notification feed. The prototype only had a settings-style toggle list inside Profile ("وضعیت خرید، پیشنهادها، ورود دومرحله‌ای") — never an actual feed of individual notifications. |
| **User goal** | "What happened while I was away?" |
| **Entry point** | Home header notification button. |
| **Exit point** | Back to Home; tapping a notification navigates to its related entity (order, promotion) — future, needs a `type`→route mapping not yet designed. |
| **Main components** | List of notification rows, unread indicator, `Badge`. |
| **Required data** | `GET /notifications` (list — exists), unread count (does **not** exist yet — see §5). |
| **User interactions** | Scroll, tap to open (marks read — **no mark-read endpoint exists yet**, see §5), pull-to-refresh (future). |

---

## 2. User Flows

### Happy path — returning user, existing membership

```
Login (OTP) → Home
  → sees active membership card in hero carousel (real GET /membership data)
  → taps a Quick Action (e.g. "اعتبار من")
  → My Credit screen (GET /credit)
  → back to Home
  → taps a category in the featured-services banner
  → Service Category → Service Detail → (existing J5/J6 purchase flow)
```

### Happy path — first-time user, no membership yet

```
Signup (OTP + profile) → Home
  → hero carousel shows the 3 core cards (earn/core/reward) + 8 tier cards
    from the catalog (GET /subscriptions), with NO "active" badge — this
    IS the empty state, not a separate screen (see Empty States below)
  → taps a card → Card Detail → "فعال‌سازی" → 🆕 POST /membership
  → Toast confirmation → back to Home → hero carousel now shows it as active
```

### Empty states

| Situation | Behavior |
|---|---|
| No active membership | Hero carousel still renders (from the public `GET /subscriptions` catalog) — cards show their activation CTA instead of a status badge. **Never** show a blank carousel; the catalog is public data and always available. |
| No wallet transactions yet | `Wallet Summary` shows balance (`0`) with an empty-state message under the transaction list, not a spinner forever. |
| No credit line yet | `My Credit` shows a "no credit line yet" state — `GET /credit` returning zero rows is a valid state, not an error. |
| No installments yet | `My Installments` shows an empty-state illustration/message, not an error. |
| No notifications | `Notifications` shows an empty state; the header button shows no unread badge. |
| Zero services in a category (banner) | Category is simply omitted from the featured banner, same rule as `docs/prototype-to-production-mapping.md` #4's "دسته‌ی غیرفعال نباید نمایش داده شود". |

### Loading states

Every network-backed section of Home loads independently (this already
matches the pattern established in `useOrbitItems()` and `HomePage`'s
current profile fetch — see `apps/web/src/app/home/page.tsx`):

- Hero carousel: skeleton card shapes while `GET /subscriptions` + `GET /membership` resolve.
- Quick Actions: static, no loading state needed (no data dependency).
- Service ticker/banner: skeleton rows while `GET /categories` resolves.
- Notification badge: no visible loading state — appears once the count resolves, absent before that (not a spinner on the icon).

No section should block the others — a slow `GET /membership` must not
delay the service banner from rendering. This means Home's data-fetching
must be per-section, not one waterfall request (see §6).

### Error states

- Per-section, not page-level: if the hero carousel's fetch fails, the rest
  of Home still renders. Matches `useOrbitItems()`'s existing fallback
  philosophy (Orbit never renders empty on failure) — Home sections need
  the same non-blocking treatment, with a lightweight retry affordance
  per section rather than a full-page error screen.
- Auth-expired mid-session (401 on any Home request): already handled
  globally by `apiClient`'s silent-refresh-then-retry (see
  [`api-client.ts`](../apps/web/src/lib/api-client.ts)) — Home doesn't need
  its own 401 handling, only needs to handle the case where refresh itself
  fails (→ redirect to Landing, already how `AuthContext.logout` behaves).

### First-time vs. returning user

The prototype has a `firstOnboarding` 6-slide tour gated on
`localStorage`/`onboardingSeenAt`, shown once after signup, **before**
Home is first seen (`docs/01-prototype-analysis.md` §2, §6.1). That tour
is its own screen/contract (`prototype-to-production-mapping.md` #11) —
Home itself renders identically for first-time and returning users once
reached; the only difference is which membership cards are already active
(empty-state hero carousel vs. populated).

---

## 3. Component Tree

```
Home
│
├── AppHeader                          [🆕 new component]
│   ├── UserGreeting                   [🆕 — "سلام {fullName}"]
│   └── NotificationButton             [🆕 — icon + unread Badge]
│
├── HeroCardCarousel                   [🆕 new component, built on FinancialCard ✅]
│   └── FinancialCard[]                (existing packages/ui component)
│
├── StoryStrip                         [🆕 new component, built on StoryCard ✅]
│   └── StoryCard[]                    (existing packages/ui component)
│
├── QuickActionsGrid                   [🆕 new component]
│   └── QuickActionButton[]            [🆕 — icon + label, built on Button ✅]
│
├── ServiceTicker                      [🆕 new component — auto-scrolling list]
│
├── ServiceBannerGrid                  [🆕 new component, built on Card ✅ + Badge ✅]
│
├── MembershipStoryStrip               [🆕 — same StoryCard component as StoryStrip, different data source]
│
├── NewsCarousel                       [🆕 new component — P2, see mapping.md P2#5]
│
└── BottomNavigation                   (existing packages/ui component — items: خانه/خدمات/جایزه/پروفایل)
```

For every component:

| Component | Responsibility | Inputs | States | Dependencies | Reusability |
|---|---|---|---|---|---|
| `AppHeader` | Greeting + notification entry point | `fullName`, `unreadCount`, `onNotificationsClick` | default | none | Home-specific (greeting), but `NotificationButton` itself is reusable |
| `UserGreeting` | Display the user's name | `fullName: string \| null` | loading (name not yet loaded) | `Profile` type | Home-only |
| `NotificationButton` | Icon button with unread badge | `unreadCount: number`, `onClick` | 0 vs >0 (badge visibility) | `Badge` | Reusable anywhere a header exists |
| `HeroCardCarousel` | Horizontal snap-scroll of the user's membership status across all catalog cards | `plans: MembershipCardDefinition[]`, `memberships: UserMembership[]`, `onCardClick` | loading (skeleton), empty (catalog unavailable — should not happen, catalog is public), populated | `FinancialCard` | Home-only composition, `FinancialCard` itself is reusable (already used nowhere yet, but built for this) |
| `StoryStrip` | Horizontal snap-scroll of intro/topic stories | `stories: {id,title}[]`, `onOpen` | loading, populated | `StoryCard` | Reusable (same component powers `MembershipStoryStrip`) |
| `QuickActionsGrid` | Fixed set of shortcuts to Wallet/Credit/Installments/etc. | `actions: {key,label,icon,href}[]` (static, not fetched) | none (static) | `Button` (or a dedicated variant) | Home-only |
| `ServiceTicker` | Auto-scrolling vertical list of service names (prototype's "تیکر خدمات") | `categories: ServiceCategory[]` | loading, populated | none | Home-only |
| `ServiceBannerGrid` | Grid of featured category banners | `categories: ServiceCategory[]`, `onSelect` | loading, empty (all categories inactive — edge case), populated | `Card`, `Badge` | Home-only composition |
| `MembershipStoryStrip` | Story-style entry into the 8 subscription tiers | `plans: MembershipCardDefinition[]` (tier kind only) | loading, populated | `StoryCard` | Same underlying component as `StoryStrip` |
| `NewsCarousel` | Horizontal card carousel of news articles | `articles: NewsArticle[]` | loading, empty, populated | `Card` | P2 — deferred, see Implementation Roadmap |
| `BottomNavigation` | Global 4-tab nav | `items`, `activeKey`, `onChange` | active tab highlight | none | **Already built, already reusable** — Home is simply its first real consumer |

None of `HeroCardCarousel`, `StoryStrip`, `QuickActionsGrid`,
`ServiceTicker`, `ServiceBannerGrid`, `MembershipStoryStrip`,
`NewsCarousel`, `AppHeader` exist yet as components — only the primitives
they'd be built from (`FinancialCard`, `StoryCard`, `Card`, `Badge`,
`Button`) already exist in `packages/ui`.

---

## 4. Data Contract

### Already defined in `packages/types` (frontend/backend shared)

These need **zero new type authoring** — they already exist and match the
real Prisma schema field-for-field (verified, not assumed):

```ts
// packages/types/src/membership.ts
MembershipCardDefinition { id, kind, title, kicker, shortDescription, description,
  level, creditLabel, durationLabel, priceLabel, accentColor, deepColor,
  activationActionLabel, benefits: MembershipBenefit[], accessibleCategories: string[],
  terms: string[], createdAt, updatedAt }
UserMembership { id, userId, cardDefinitionId, tier, status, activatedAt, expiresAt,
  createdAt, updatedAt }

// packages/types/src/wallet.ts
Wallet { userId, kind: "main"|"reward", balance }
WalletTransaction { id, userId, walletKind, type, amount, balanceAfter,
  relatedOrderId, relatedRewardRedemptionId, description, createdAt, updatedAt }

// packages/types/src/catalog.ts
ServiceCategory { id, name, description, imageUrl, keywords: string[], sortOrder,
  createdAt, updatedAt }

// packages/types/src/user.ts
User { id, phone, phoneVerifiedAt, inviteCode, referredByCode, twoFactorEnabled,
  status, createdAt, updatedAt }
Profile { id, userId, fullName, email, nationalId, birthDate, avatarKey,
  createdAt, updatedAt }
```

**Naming note worth preserving carefully during implementation:** the
backend has two distinct, correctly-separated concepts that are easy to
conflate — `subscriptions` module = the public **plan catalog**
(`MembershipPlan`, → `MembershipCardDefinition` in `packages/types`);
`membership` module = **this user's activations** of that catalog
(`Membership`, → `UserMembership`). Home's hero carousel needs data from
*both*, joined client-side by `planId`/`cardDefinitionId`.

### Missing — needed for Home, not yet in `packages/types`

```ts
HomeSummary {
  unreadNotificationCount: number   // no backing endpoint yet, see §5
}

QuickAction {
  key: string        // "wallet" | "credit" | "installments" | ...
  labelFa: string    // static, not fetched from an API — content-only, lives in frontend config
  icon: string        // static
  href: string         // static
}
```

`QuickAction` is intentionally **not** a backend-fetched entity — the
prototype's shortcuts are a fixed, hardcoded set (`docs/01-prototype-analysis.md`
never describes them as admin-configurable), so this stays static frontend
config, same treatment `ORBIT_RINGS`/`ORBIT_NODES` got in
`orbitItems.ts` for Orbit's decorative-but-fixed geometry.

### Types that exist in `packages/types` but have **no backing Prisma model yet**

Flagging honestly rather than treating them as available: `Mission`,
`UserMission`, `LoyaltyPointsLedgerEntry` (`mission.ts`), `Address`
(`user.ts`), `NewsArticle` (`content.ts`), `AdvisorPersona`/`ChatMessage`
(`advisor.ts` — `AdvisorPersona` **is** backed by a Prisma model already,
only `ChatMessage`/`UserAdvisorPreference` are not). None of these are
required for Home's P0 scope (§9); `NewsArticle` is the only one Home
would eventually consume (P2, `NewsCarousel`).

---

## 5. API Contract

All authenticated endpoints below use the existing global `JwtAuthGuard` +
`@CurrentUser()` pattern (no per-endpoint auth code needed). All responses
are auto-wrapped `{success, data}` by the existing `ResponseInterceptor` —
this table shows the unwrapped `data` shape.

| Endpoint | Method | Params | Response shape | Auth | Status |
|---|---|---|---|---|---|
| `/subscriptions` | GET | `page`, `limit` | `{items: MembershipCardDefinition[], page, limit, total}` | Public | ✅ AVAILABLE |
| `/subscriptions/:id` | GET | — | `MembershipCardDefinition` | Public | ✅ AVAILABLE |
| `/membership` | GET | `page`, `limit` | `{items: UserMembership[], total, skip, take}` (current user only) | Required | ✅ AVAILABLE |
| `/membership/:id` | GET | — | `UserMembership` (current user only) | Required | ✅ AVAILABLE |
| `/membership` | POST | `{planId}` | `UserMembership` | Required | ❌ **NEEDS IMPLEMENTATION** — no mutation endpoint exists on this controller at all (read-only today) |
| `/wallet` | GET | — | `Wallet[]` (both kinds, current user) | Required | ✅ AVAILABLE |
| `/wallet/:kind/transactions` | GET | `kind` (`main`\|`reward`), `page`, `limit` | `{items: WalletTransaction[], page, limit, total}` | Required | ✅ AVAILABLE |
| `/transactions` | GET | `page`, `limit` | `WalletTransaction[]` (main+reward merged, sorted) | Required | ✅ AVAILABLE |
| `/credit` | GET | `page`, `limit` | `{items: CreditLine[], total, skip, take}` | Required | ✅ AVAILABLE |
| `/credit/:id` | GET | — | `CreditLine` | Required | ✅ AVAILABLE |
| `/installments` | GET | `page`, `limit` | `{items: Installment[], total, skip, take}` | Required | ✅ AVAILABLE |
| `/installments/:id` | GET | — | `Installment` | Required | ✅ AVAILABLE |
| `/categories` | GET | `page`, `limit` | `{items: Category[], total, skip, take}` | Public | ✅ AVAILABLE |
| `/categories/:id` | GET | — | `Category` | Public | ✅ AVAILABLE |
| `/notifications` | GET | `page`, `limit` | `{items: Notification[], total, skip, take}` | Required | ✅ AVAILABLE |
| `/notifications/:id` | GET | — | `Notification` | Required | ✅ AVAILABLE |
| `/notifications/unread-count` | GET | — | `{count: number}` | Required | ❌ **NEEDS IMPLEMENTATION** — Home's `NotificationButton` badge has nothing to call otherwise; computing it client-side would mean fetching every notification just to count unread ones |
| `/notifications/:id/read` | PATCH | — | `Notification` | Required | ❌ **NEEDS IMPLEMENTATION** — no mutation endpoint exists (read-only today); opening a notification currently cannot mark it read |

### Explicitly NOT part of this contract (belongs to other screens' own contracts)

`GET /rewards`, `GET /users/me`, `GET/PATCH /profiles/me`, `GET /services`,
`GET /orders`, `POST /orders` all already exist (✅) and are consumed by
Rewards/Profile/Services/Service Detail — those screens already have full
contracts in `prototype-to-production-mapping.md` and are out of scope
here except as Home exit-point references.

---

## 6. State Management Contract

| Category | What | Notes |
|---|---|---|
| **Server state** | Membership plans + user's activations (hero carousel), service categories (ticker/banner), unread notification count | Each fetched independently per §2's loading-state rule — no single "home summary" waterfall endpoint exists or is proposed; that would reintroduce the coupling §2 explicitly warns against. |
| **Client state** | Active bottom-nav tab, carousel scroll/active-index (hero + story strips), open/closed state of any Home-local sheet | Ephemeral, component-local — no global store needed, matches the rest of the app (`AuthModal`'s `step` state is the existing precedent: local `useState`, no Redux/Zustand anywhere in this codebase). |
| **Cached data** | None today | No SWR/React Query in this codebase (confirmed: `apps/web/package.json` has neither). `useOrbitItems()`'s pattern — `useState` + `useEffect` fetch + static fallback — is the established precedent Home's data hooks should follow, one hook per section (`useHomeMembership()`, `useHomeCategories()`, `useUnreadNotificationCount()`), not one giant hook. |
| **Loading states** | Per-section boolean, not page-level | See §2. |
| **Error handling** | Per-section, non-blocking; global 401 already handled by `apiClient`'s refresh-then-retry | See §2. |
| **Refresh behavior** | Refetch on tab focus/return-to-Home is a reasonable P1 addition (not in the prototype, no strong signal either way) — **not required for P0**; simplest correct P0 behavior is fetch-once-on-mount per section, same as `useOrbitItems()` today. |

---

## 7. Responsive Rules

Same methodology as `docs/11-orbit-asset-system.md` / the Orbit responsive
work — mobile-first, then tablet, then desktop. Home is **not** a
full-bleed animated hero like Orbit; it's a scrolling single-column app
shell capped at `layout.maxContentWidth` (760px, existing token), so most
of these rules are standard responsive-card-list rules, not Orbit's
crop-avoidance geometry.

| Breakpoint | Layout behavior | Card sizing | Horizontal scroll | Vertical stacking | Typography | Navigation |
|---|---|---|---|---|---|---|
| 375 / 393px | Single column, full-width sections, 16-20px side padding | `FinancialCard` ~86vw wide (one card + ~14% peek of next, matching the prototype's carousel peek pattern) | Hero carousel, story strips, banner grid, news — all horizontal-scroll with snap (`scroll-snap-type: x mandatory`, existing prototype pattern, `docs/01-prototype-analysis.md` §3) | Header → Hero → Stories → Quick Actions → Ticker → Banner → Membership strip → News, in that order | Body 13px / h2 22px (existing `typography` token scale) | `BottomNavigation` fixed, `layout.bottomNavHeight` (76px) reserved at the bottom of the scroll container |
| 430px | Same as above | Card width scales down slightly as a %, same peek ratio | Same | Same | Same | Same |
| 768px (tablet portrait) | Content still single-column, capped at `maxContentWidth` (760px), centered | `FinancialCard` fixed max-width (~340px) rather than vw-based, 2-3 visible per carousel viewport | Same components, same snap behavior, just more cards visible at once | Same order | Same scale — no jump to a larger type scale, matches the existing Landing precedent (`packages/ui/tokens.ts` has no tablet-specific type scale) | Same bottom nav (mobile nav pattern retained even at tablet width — this is the existing app-shell precedent, not Orbit-specific) |
| 1024px (tablet landscape) | Same as 768px | Same | Same | Same | Same | Same |
| 1366 / 1440 / 1920px (desktop) | Content capped at `maxContentWidth` (760px), centered with side margins — **Home does not go full-width on desktop**, unlike Orbit's intentional full-bleed hero; this is a deliberate continuation of the existing single-column app-shell design (`docs/01-prototype-analysis.md` §3: "طراحی شبیه یک اپ موبایل داخل مرورگر دسکتاپ") | Same fixed max-width as tablet | Same | Same | Same | Same — bottom nav remains bottom-fixed even on desktop, matching the prototype's explicit "mobile app inside a desktop browser" framing rather than growing a desktop-specific sidebar nav (that would be a product decision beyond this contract's scope, not a responsive-CSS one) |

**Explicitly not needed:** no Orbit-style `min(100%, maxContentWidth, 100dvh/1.25)` crop-avoidance formula — Home scrolls vertically and has no fixed-aspect full-viewport hero, so the failure mode that formula solves (a wide decorative ring exceeding a short viewport's height) doesn't apply here.

---

## 8. Design System Mapping

### Existing components (already built in `packages/ui`, zero new primitives needed for P0)

| Component | Home usage |
|---|---|
| `Card` | Base surface for banner/list items |
| `Button` | Quick action buttons, CTAs |
| `Input` | (Search, if a Home-level search is added — not in the P0 scope defined here) |
| `Modal` | Any Home-triggered dialog (none identified as P0-required yet) |
| `BottomSheet` | (Future — purchase confirmations already use this elsewhere) |
| `BottomNavigation` | Global nav — **already built, currently unused anywhere in the app; Home is its first real consumer** |
| `FinancialCard` | Hero carousel cards — **already built, currently unused anywhere in the app** |
| `WalletCard` | Wallet Summary screen — **already built, currently unused anywhere in the app** |
| `StoryCard` | Story strip + membership story strip — **already built, currently unused anywhere in the app** |
| `Badge` | Notification unread count, installment status, payment-method labels |

Worth flagging plainly: **the design system already has every card
primitive Home needs.** They were built ahead of any consumer (visible in
`packages/ui`'s exports, none of them imported anywhere in `apps/web` yet
— confirmed via search). Stage 4 implementation is largely *composition*
of existing primitives into Home-specific layout components, not new
primitive design work.

### New components required

```
AppHeader              — new, Home-specific composition
UserGreeting            — new, trivial (text + Profile data)
NotificationButton      — new, reusable (icon + Badge)
HeroCardCarousel        — new, composition of FinancialCard
StoryStrip              — new, composition of StoryCard (reused for MembershipStoryStrip)
QuickActionsGrid        — new, composition of Button
ServiceTicker           — new, no existing primitive covers auto-scroll-ticker behavior
ServiceBannerGrid       — new, composition of Card + Badge
NewsCarousel            — new (P2), composition of Card
```

No new **design tokens** are needed — color/radius/shadow/typography/spacing
scales in `packages/ui/src/tokens.ts` already cover every value seen in the
prototype's Home view per `docs/01-prototype-analysis.md` §3.

---

## 9. Implementation Roadmap

Ordered so each phase is independently demoable and never blocks on a
later phase's backend work being finished first (mirrors the reasoning in
`prototype-to-production-mapping.md` §C).

```
Phase 1 — Home Shell
  AppHeader (static greeting, notification button with no live count yet),
  BottomNavigation wired to real routes, empty page body.
  No new backend work required — GET /users/me and GET /profiles/me already exist.

Phase 2 — Account Summary
  HeroCardCarousel (GET /subscriptions + GET /membership, both AVAILABLE),
  StoryStrip / MembershipStoryStrip.
  No new backend work required for display; POST /membership (activation)
  is only needed once Card Detail's "فعال‌سازی" button is wired — can trail
  slightly behind Phase 2's read-only carousel.

Phase 3 — Quick Actions + Wallet/Credit/Installments
  QuickActionsGrid, Wallet Summary, My Credit, My Installments screens.
  All backing GET endpoints are AVAILABLE today — this phase is pure
  frontend + new-screen routing, no backend blockers.

Phase 4 — Service Discovery
  ServiceTicker, ServiceBannerGrid (GET /categories, AVAILABLE).

Phase 5 — Notifications
  NotificationButton gets a real badge. Requires the two 🆕 endpoints from
  §5 (`GET /notifications/unread-count`, `PATCH /notifications/:id/read`)
  — the only phase genuinely blocked on new backend work.

Phase 6 — Polish + Responsive QA
  Full device matrix (§7), loading/error/empty states (§2), same rigor as
  Stage 3's Landing validation pass.

Deferred (P2, not part of Home v1):
  NewsCarousel, ServiceTicker's auto-scroll animation polish, Advisor
  entry point, Missions/gamification, Addresses.
```

---

## Summary for whoever picks this up next

Home's P0 scope needs **exactly two new backend endpoints**
(`GET /notifications/unread-count`, `PATCH /notifications/:id/read`) and
**one mutation endpoint deferred to when Card Detail is built**
(`POST /membership`) — everything else Home's dashboard view needs to
*read* already exists and was verified against the running code, not
assumed. The design system already has every card primitive Home needs,
built but not yet consumed anywhere. The actual implementation work is
almost entirely frontend composition + the two notification endpoints —
there is no missing Prisma model, no missing core data, and no schema
migration required for Home v1's P0 scope as defined in Phase 1-4 above.
