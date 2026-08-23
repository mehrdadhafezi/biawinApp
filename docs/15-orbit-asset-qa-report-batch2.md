# 15 — Orbit Asset QA Report, Batch 2 (Stage 1.8)

Second generation batch — 8 of the 12 items were regenerated after
`docs/14-orbit-asset-qa-report.md`'s first-batch findings. Same rigor as
batch 1: every image opened and visually inspected against
`docs/13-production-orbit-asset-spec.md` before connecting anything, not
just checked by filename or file properties.

## Result: 7 of 8 pass, 1 fails

| File | Item connected as | Result |
|---|---|---|
| `orbit_03_gold-jewelry.png` | `jewelry` | ✅ Single object, real transparency, correct category. Minor visible red/yellow edge fringe from background removal — a real but non-blocking cosmetic imperfection, noted for awareness. |
| `orbit_04_tourism.png` | `tourism` | ✅ Single object, clean edges, real transparency. |
| `orbit_05_home-appliance.png` | `appliances` | ✅ Single object (espresso machine — a reasonable substitution within the home-appliance category), clean edges. |
| `orbit_06_beauty.png` | `cosmetics` | ✅ Single object, clean edges, very minor tinge only. |
| `orbit_07_digital.png` | `digital` | ✅ Accepted with a note: shows the same phone from front and back (one product, two angles), not strictly "one object" — judged close enough to the spirit of the rule to connect. Screen shows a wallpaper-style graphic rather than fully off/neutral — minor deviation, no visible UI/app icons. |
| `orbit_08_insurance.png` | *(not connected — `insurance` keeps its placeholder)* | ❌ **Fails again.** Real alpha transparency this time (fixed from batch 1), but still shows **two distinct objects** — a leather notebook/planner plus a separate shield-and-checkmark badge. The frozen spec requires one object; this needs another regeneration. |
| `orbit_11_food_final.png` | `grocery` (see mapping note below) | ✅ Matches the spec's own example almost exactly — a woven basket with bread, vegetables, pasta, milk, and an apple, as one cohesive composition. Correct content this time (batch 1 showed unrelated furniture). |
| `orbit_12_sports.png` | *(processed, not wired in — see below)* | ✅ Single running shoe, clean, real photography. Passes on its own, but has no corresponding item in the current 13-item `orbitItems.ts` list. |

## Mapping note: `food` → `grocery`, not a new item

The current `orbitItems.ts` still has its original 13 items (`grocery` and
`meat` as separate entries, no `sports` entry) — Stage 1.8 explicitly asks
to keep title/order/position/animation/active unchanged, so this pass did
not restructure the list. The regenerated "food" image (a grocery basket)
was wired into the `grocery` item, whose title "سبد مواد غذایی" (grocery
basket) it matches almost exactly — better than `meat` ("مرغ، گوشت و
ماهی", poultry/meat/fish), which shows no meat/poultry/fish and stays on
its placeholder. No asset has been generated for `stationery` either.

`orbit_12_sports.webp` was processed (512×512, WebP, transparent, ~53KB)
and placed in `apps/web/public/orbit/` so it's ready, but intentionally
**not** referenced by any current item — connecting it needs the
13-to-12-item catalog change from `docs/12-orbit-item-catalog.md` /
`docs/13-production-orbit-asset-spec.md` (merge `grocery`+`meat` into
`food`, drop `stationery`, add `sports`), which is a separate, larger
change than "swap an image reference" and wasn't requested in this stage.

## Running total across both batches

**10 of 13 current items now have a real, QA'd asset**: `clothing`, `car`,
`motorcycle`, `carpet` (batch 1) + `jewelry`, `tourism`, `appliances`,
`cosmetics`, `digital`, `grocery` (batch 2). `insurance`, `stationery`,
`meat` remain on `OrbitBubble`'s placeholder.
