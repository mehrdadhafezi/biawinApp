# Home Final Content Correction Report (Stage 5.14)

Final correction pass before Stage 5.15 (Home Admin Contract). Scope was
strictly the two gaps this stage named — Biawin Cards content and the
"خدمات منتخب بیاوین" section — plus a documentation-only inventory for
Stage 5.15. No Admin UI, no CMS/database abstractions, no redesign.

---

## 1. Biawin Cards — Content Correction

Re-extracted the exact prototype markup fresh this session
(`<article class="credit-card card-earn/card-biawin/card-reward">`,
lines 6986–7018) and compared field-by-field against the current
implementation — not inferred from the React code.

| Field | Prototype | Implementation | Result |
|---|---|---|---|
| Title (all 3) | کارت کسب درآمد / کارت بیاوین / کارت جایزه | same | ✅ match |
| Label | کارت درآمد / کارت اصلی / کارت جایزه | same | ✅ match |
| Subtitle | (verbatim, all 3) | same | ✅ match |
| Card number | 6037 9918 0146 1280 / 6219 8610 4432 1095 / 5029 0801 5538 7421 | same | ✅ match |
| Owner | BIAWIN EARN / BIAWIN CLUB / BIAWIN REWARD | same | ✅ match |
| Gradient | `.card-earn`/`.card-biawin`/`.card-reward` CSS | same hex values | ✅ match |
| Ordering | Earn, Biawin (active), Reward | same | ✅ match |
| Active/default position | index 1 (Biawin) | `activeIndex = 1` | ✅ match |
| Icon | `.card-icon svg` — trend path / **real `<rect rx="3">`** / gift path | trend path / **path approximating a rect with sharp corners** / gift path | ❌ **wrong** — fixed |
| Chip appearance | `.chip` + `:before`/`:after` cross-line overlay | flat gold box, no cross-lines | ❌ **wrong** — fixed |

**Fixes applied**: the "Biawin card" icon now renders a real SVG
`<rect rx={3}>` instead of a hand-drawn path with sharp corners; the
chip now has the `:before`/`:after` 1px cross-line overlay
(`rgba(96,70,0,.22)`) the prototype defines. Everything else was already
correct — confirmed by direct field comparison, not assumed.

### Data classification (per this stage's explicit instruction)

All 3 cards' content (title/subtitle/number/owner) is **(A) visual/demo
card identity from the prototype** — not real financial products, not
tied to any user's actual membership. No fake financial/user-specific
data was introduced; this is the same static demo content the prototype
itself ships. Distinguished clearly from **(B) real backend data**: the
separate `MembershipStoryStrip` component (the 8 tier circles further
down the page) already uses real `GET /subscriptions`/`GET /membership`
data — the two are not conflated.

---

## 2. "خدمات منتخب بیاوین" — Re-verified, Not Missing

Before changing anything, live DOM inspection on staging confirmed this
section **was already present, correctly positioned, and populated**:
`biawin-service-banner-section` (heading "خدمات منتخب بیاوین", 673px
tall, 5 real category tiles with real images) sits directly between the
Credit Power section and "کارت‌های اشتراک بیاوین" — matching the
prototype's own document order (`.services#services`, line 7208–7239,
immediately before `.story-strip-section#membershipStories`, line 7240).
**No blank/empty gap exists.**

The real, verified problem was **visual accuracy**, not presence:
re-reading `.service-banner.theme-*` (lines 774–813) found every tile
using one generic dark overlay instead of the prototype's per-category
tinted gradient, and the wide "گردشگری" tile's overlay running the
wrong direction.

| Field | Prototype | Before this stage | Fixed |
|---|---|---|---|
| Heading | خدمات منتخب بیاوین | same | — (already correct) |
| Subtitle | خرید اقساطی در دسته‌بندی‌های پرکاربرد | same | — (already correct) |
| Tile count/layout | 4 regular + 1 wide, 2-col grid | same | — (already correct) |
| Images | real photos per category | real extracted photos (Stage 5.13) | — (already correct) |
| Overlay tint | per-category `--ov1/--ov2/--ov3` (`theme-auto`/`theme-home`/`theme-fashion`/`theme-gold`/`theme-travel`) | one generic `rgba(2,30,56,.88)` for every tile | ✅ **fixed** — real per-theme values re-applied |
| Wide-tile gradient direction | `90deg` (horizontal) | `180deg` (vertical, same as regular tiles) | ✅ **fixed** |
| Kicker "badge" | pill-shaped (`border-radius:999px`, translucent white bg, blur) | plain text, no pill | ✅ **fixed** |
| CTA | بازگشت به بالا → `#top` | same | — (already correct) |
| Position | before کارت‌های اشتراک بیاوین | same | — (already correct) |

**Same class of bug also found and fixed in Service Mosaic**
(`.service-mosaic-card.theme-*`/`.service-wide-slide.theme-*`, the
sibling component using the identical theming mechanism) — زیبایی
(`theme-beauty`), بیمه (`theme-insurance`), مبلمان (`theme-home`),
دیجیتال (`theme-digital`) now use their real per-category tint instead
of one flat overlay, plus the same badge-pill fix on
`.service-mosaic-copy small`. This wasn't a separate, unrelated section
— it's `ServiceBannerGrid`'s direct sibling, sharing the exact CSS
mechanism this stage's re-audit already had open, so fixing both
together avoided leaving the identical bug in a component one file over.

---

## 3. Data Strategy — Selected Services

Inspected the real Services backend (`GET /categories`,
`docs/services-ui-contract.md`) before making any change. **All 5 tile
categories already map to real seeded `Category` rows by name** —
`اتومبیل`, `لوازم خانگی`, `پوشاک`, `طلا و جواهر`, `گردشگری` all exist
verbatim in the live catalog (confirmed again this session via the
`/services` chip list on staging). Tiles link to the real
`/services/[categoryId]` route.

**What is NOT backend-derived, and was deliberately left that way**:
*which 5 categories are featured*, their *display order*, *kicker
copy*, and *theme* are a hardcoded array in `home.mock.ts`. There is no
"Featured Home Services" concept anywhere in the schema, and per this
stage's explicit instruction, **no speculative fields
(`featured`/`showOnHome`/`homePosition`) were added**. This selection
stays frontend-only for this stage.

**FUTURE ADMIN-MANAGED CONTENT** (for Stage 5.15 to define the real
contract for): which categories appear in this section, their order,
kicker copy, and theme assignment.

---

## 4. Section Order — Verified

Confirmed live on staging via DOM traversal of `<main>`'s children:
Credit Power → **خدمات منتخب بیاوین** → کارت‌های اشتراک بیاوین → Service
Mosaic → News — matches the prototype's own document order exactly. No
unexplained blank section.

---

## 5. Responsive QA

All 9 required widths re-tested, both locally and live on staging (375px
and 1920px explicitly re-verified on the live domain):

| Width | Result |
|---|---|
| 360 | ✅ no overflow |
| 375 | ✅ no overflow (local + staging) |
| 390 | ✅ no overflow |
| 430 | ✅ no overflow |
| 768 | ✅ no overflow |
| 1024 | ✅ no overflow |
| 1366 | ✅ no overflow |
| 1440 | ✅ no overflow |
| 1920 | ✅ no overflow (local + staging), `<main>` capped at 760px |

No blank space, no card-carousel regression, no image cropping issues —
none of the fixes this stage touched layout/sizing, only overlay colors
and two small SVG/CSS details, so no new responsive risk was introduced.

## 6. Regression

Smoke-checked (clean console, both locally and on staging):
`/wallet`, `/credit`, `/installments`, `/services`, `/profile`,
`/rewards`. Header/BottomNavigation unchanged this stage (not touched) —
still shared via `AppShell` across every page. AuthGuard unchanged and
implicitly exercised by every authenticated page load throughout this
session's verification.

---

## 7. Home Admin Candidates (input for Stage 5.15 — documentation only, nothing implemented)

```
HomeAdminCandidates {
  stories:            STATIC
  biawinCards:         STATIC
  selectedServices:    BACKEND-DERIVED (category/image/link) + STATIC (selection/order/kicker/theme — FUTURE ADMIN-MANAGED)
  creditPowerItems:    STATIC
  membershipStories:   BACKEND-DERIVED + USER-DERIVED
  serviceMosaic:       BACKEND-DERIVED (category/image/link) + STATIC (selection/order/kicker/theme — FUTURE ADMIN-MANAGED)
  news:                STATIC
}
```

| Field | Classification | Why |
|---|---|---|
| `stories` | STATIC | 8 topic/title pairs, `home.mock.ts`, no backend, purely decorative (all bubbles `disabled`) |
| `biawinCards` | STATIC | Prototype demo content (§1) — not real financial products, no user tie-in |
| `selectedServices` | BACKEND-DERIVED + STATIC | Category/image/link are real (`GET /categories`); *which* categories/order/copy/theme is hardcoded — **FUTURE ADMIN-MANAGED** |
| `creditPowerItems` | STATIC | Mock category names + statically extracted images, no live category linkage at all |
| `membershipStories` | BACKEND-DERIVED + USER-DERIVED | Real `GET /subscriptions` (tier catalog) + `GET /membership` (this user's activation status) |
| `serviceMosaic` | BACKEND-DERIVED + STATIC | Same shape as `selectedServices` — **FUTURE ADMIN-MANAGED** for selection/order/theme |
| `news` | STATIC | No `NewsArticle` backend model exists at all (`docs/prototype-to-production-mapping.md` P2) |

This inventory is a documentation deliverable only — no schema, no
Admin UI, no `featured`/`showOnHome`/`homePosition` fields were added
this stage, per explicit instruction.

---

## Local Validation

- `tsc --noEmit` — clean
- `eslint` (`src/components/home`) — clean, same 6 pre-existing
  informational `@next/next/no-img-element` warnings as Stage 5.13
- `next build` — succeeds, all 10 routes listed
- All fixes confirmed via live computed styles: chip cross-line
  pseudo-elements present, card icon `rect[rx="3"]` present, `--ov1`/
  `--ov2`/`--ov3` correct per banner/mosaic theme, wide-banner `--ov3`
  correct, badge pill `border-radius: 999px`
- Full 9-width responsive matrix — zero overflow
- Regression smoke check — 6 shared-shell pages, clean console

## Commit / Push / Deploy

| Step | Result |
|---|---|
| Commit | `19c659f` — "fix(web): Home content corrections — card chip/icon fidelity, theme overlays" |
| Push | `origin/main` advanced `c437329..19c659f` |
| Staging deploy | `deploy.sh` completed all 6 steps — images rebuilt, migrations (none pending), seed re-ran clean, containers cut over, health check passed first attempt |

## Live Staging Verification

- Logged in against the live staging backend (real OTP request/verify).
- **Both specific issues confirmed visibly fixed on staging** via
  computed-style checks read directly from the live DOM:
  - Chip cross-line element present (`.biawin-credit-card-chip:before/:after`)
  - Card icon uses a real `<rect rx="3">` (not a sharp-corner path)
  - Banner tile 1 (اتومبیل): `--ov1: rgba(66,66,72,.10)` (theme-auto) ✅
  - Wide banner (گردشگری): `--ov3: rgba(18,74,30,.88)` (theme-travel) ✅
  - Mosaic tile (زیبایی): `--ov1: rgba(255,107,149,.05)` (theme-beauty) ✅
  - Kicker badge `border-radius: 999px` present on live tiles
- **Section order re-confirmed live**: "خدمات منتخب بیاوین" sits
  directly between the Credit Power section and "کارت‌های اشتراک
  بیاوین" on the actual deployed page — read via DOM traversal, not
  assumed.
- Responsive: 375px and 1920px re-verified live on staging, zero
  overflow at both.
- Regression: `/wallet` and `/services` re-checked live on staging,
  clean console on both.
- Fresh-tab re-checks used to rule out the documented stale-console
  artifact — the one 401 observed was confirmed gone in a new tab.

---

## Final Verdict: **HOME CONTENT PARITY PASS**

Both gaps named in this stage's brief were re-verified against the
prototype's actual source (not inferred from the prior React code), and
resolved:

1. **Biawin Cards** — content (title/subtitle/number/owner/gradient/
   order/active-position) was already exact; the icon and chip's visual
   details were not, and are now corrected.
2. **"خدمات منتخب بیاوین"** — was never actually missing or empty (a
   real, live check on staging confirmed this before any change was
   made); its per-category theme overlay was generic instead of
   prototype-accurate, and is now corrected, along with the identical
   bug in the adjacent Service Mosaic component.

No Admin UI, no CMS abstractions, and no Home redesign were introduced.
The Stage 5.15 input inventory (§7) is documentation-only.
