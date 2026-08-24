# Home Final Spec (Stage 4.4 — Frozen)

This document is the single source of truth for the **built** Home Dashboard
— not the pre-implementation plan (`docs/home-ui-contract.md`, Stage 4.0),
but what actually shipped after Stages 4.1–4.3. Every claim below was
verified against the running code and live browser output during Stage
4.4's QA pass, not carried over unverified from earlier docs.

---

## Screen Structure

One screen: **Home Dashboard** (`apps/web/src/app/home/page.tsx`). Section
order follows the prototype's own Home order
(`docs/01-prototype-analysis.md` §2) for prototype-sourced sections, with
the Stage 4.1 financial/benefits cards — which have no position in the
original prototype — appended after:

```
HomeHeader
HomeStories
HeroCardCarousel
QuickActionsGrid
ServiceTicker
FeaturedServiceBanner
MembershipStories
AccountFinancialCards   (Wallet / Credit / Installments)
BenefitsSection
BottomNavigation
```

Single-column app shell, capped at `layout.maxContentWidth` (760px) and
centered — same "mobile app inside a desktop browser" framing as Orbit
Landing, verified at 1920px: shell stays 760px, doesn't go full-bleed.

---

## Component Tree

```
HomePage
├── HomeHeader                    [new] greeting + disabled notification button
├── main
│   ├── HomeStories                [new] StoryCard × 4, static content, disabled
│   ├── HeroCardCarousel           [new] FinancialCard × 3 (core plans), disabled
│   ├── QuickActionsGrid           [new] Button × 4 (3 live, 1 disabled)
│   ├── ServiceTicker              [new] auto-scroll marquee, non-interactive
│   ├── FeaturedServiceBanner      [new] Card × 6, disabled
│   ├── MembershipStories          [new] StoryCard × 8 (tier plans), disabled
│   ├── AccountFinancialCards      [Stage 4.1, kept]
│   │   ├── WalletsCard            WalletCard × 2 (main, reward)
│   │   ├── CreditCard             Card + Badge, per credit line
│   │   └── InstallmentsCard       Card + Badge, per installment
│   └── BenefitsSection            [Stage 4.1, kept] active plan's benefit list
└── BottomNavigation                4 tabs — only "home" navigates
```

Shared internals (not prototype sections, just implementation plumbing):
`useMembershipSummary` (one fetch, shared by `HeroCardCarousel`,
`MembershipStories`, `BenefitsSection`), `useCategories` (one fetch, shared
by `ServiceTicker`, `FeaturedServiceBanner`), `SkeletonBlock` (one loading
primitive used everywhere), `ComingSoonCaption` (one disabled-state label
used everywhere).

---

## Data Contracts

Real backend response shapes, as verified against the running API — see
`apps/web/src/lib/home-api.ts` for the exact TypeScript interfaces
(`MembershipPlanDto`, `MembershipDto`, `WalletDto`, `CreditLineDto`,
`InstallmentDto`, `CategoryDto`). All are raw Prisma-shaped JSON (field
names match the database columns, e.g. `planId` not `cardDefinitionId`) —
deliberately not forced into `packages/types`' more aspirational shapes,
to avoid a silent field-name mismatch at runtime.

Amounts are Rial in the API, Toman on screen (`formatToman()`, ÷10, Latin
digit grouping — matches every hardcoded `priceLabel` already in
`prisma/seed.ts`).

---

## API Dependencies

| Endpoint | Used by | Auth |
|---|---|---|
| `GET /subscriptions` | HeroCardCarousel, MembershipStories, BenefitsSection | Public |
| `GET /membership` | same three | Required |
| `GET /wallet` | AccountFinancialCards | Required |
| `GET /credit` | AccountFinancialCards | Required |
| `GET /installments` | AccountFinancialCards | Required |
| `GET /categories` | ServiceTicker, FeaturedServiceBanner | Public |
| `GET /profiles/me` | HomeHeader (greeting) | Required |

**Zero new backend work was needed for any of this** — every endpoint
already existed before Stage 4 began. No API gap blocked implementation.

---

## Loading States

One shared primitive, `SkeletonBlock` (pulsing placeholder,
`prefers-reduced-motion`-aware), used by every section with a network
dependency: HeroCardCarousel, MembershipStories, WalletsCard, CreditCard,
InstallmentsCard, BenefitsSection, ServiceTicker, FeaturedServiceBanner,
and the header's greeting. This replaced Stage 4.1's inconsistent mix of
skeleton blocks in some places and plain `"…"` text in others (Stage 4.2
finding, fixed in Stage 4.3).

---

## Empty States

| Section | Empty condition | Behavior |
|---|---|---|
| HeroCardCarousel | no active membership | Cards still render from the public catalog, show "غیرفعال" |
| CreditCard | zero credit lines | "هنوز خط اعتباری فعالی نداری." |
| InstallmentsCard | zero installments | "هنوز خرید اقساطی‌ای ثبت نشده." |
| BenefitsSection | no active core plan | Activation prompt, not a blank section |
| ServiceTicker / FeaturedServiceBanner | categories fetch fails | Section renders nothing (`return null`), rather than a broken/partial UI |

---

## Responsive Rules

Verified live this session at all 9 required widths — **zero horizontal
overflow at any of them**:

| Width | Class | Result |
|---|---|---|
| 375×667 | iPhone SE | ✅ |
| 393×852 | iPhone 15 | ✅ |
| 360×800 | Android | ✅ |
| 430×932 | Large mobile | ✅ |
| 768×1024 | iPad portrait | ✅ — financial-cards grid reflows 1→3 columns here |
| 1024×768 | iPad landscape | ✅ |
| 1366×768 | Desktop | ✅ |
| 1440×900 | Desktop | ✅ |
| 1920×1080 | Desktop | ✅ — shell stays capped at 760px, doesn't go full-bleed |

RTL horizontal carousels (HomeStories, HeroCardCarousel, MembershipStories)
verified with real `getBoundingClientRect()` measurement, not assumed: the
first DOM item sits at the right edge (visible on load), the last DOM item
sits off-screen to the left (reachable by scrolling) — correct RTL
carousel start position.

**Known tradeoff, not a defect**: `BottomNavigation` itself spans the full
viewport width at desktop sizes rather than staying within the 760px
shell — it's reused unmodified from the design system, and changing that
means editing a shared component used elsewhere.

---

## Known Future Gaps

Screens/features with no page yet — tapping their entry point on Home
correctly shows a disabled `به‌زودی` state rather than a dead-end or a 404:

- **Services** (bottom nav, "خدمات" quick action, every FeaturedServiceBanner/ServiceTicker item)
- **Rewards** (bottom nav)
- **Profile** (bottom nav)
- **Notifications** feed (header bell) — also needs two backend endpoints that don't exist yet: `GET /notifications/unread-count`, `PATCH /notifications/:id/read`
- **Wallet Detail** (beyond the Home summary card)
- **Credit Detail** (beyond the Home summary card)
- **Installment Detail** (beyond the Home summary card)
- **Card Detail** (tapping any HeroCardCarousel/MembershipStories card) — including real `POST /membership` activation, which also doesn't exist yet
- **Story Viewer** (tapping a HomeStories bubble)
- **News carousel** — deferred since Stage 4.0's contract (P2), no prototype urgency

None of these are Home Dashboard defects — they're the natural next
modules, correctly fenced off behind a `disabled` + "به‌زودی" affordance
rather than built prematurely or left silently broken.
