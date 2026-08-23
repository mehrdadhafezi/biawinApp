# 14 — Orbit Asset QA Report (connecting the first production batch)

The 12 generated images placed in `assets/orbit/source/` were inspected
against the frozen contract (`docs/13-production-orbit-asset-spec.md`)
before connecting anything. **4 of 12 pass and are now live; 8 fail and
were deliberately not connected** — their items keep `OrbitBubble`'s
existing placeholder instead of a broken or wrong asset.

## Pass (4) — resized to 512×512, converted to WebP, wired into `orbitItems.ts`

| File | Item (`id`) | Result |
|---|---|---|
| `orbit_01_clothing.png` | `clothing` | ✅ Single subject, real transparency, real photography — 71KB WebP |
| `orbit_02_vehicle.png` | `car` | ✅ Single subject, real transparency, real photography — 43KB WebP |
| `orbit_09_motorcycle.png` | `motorcycle` | ✅ Single subject, real transparency, real photography — 72KB WebP |
| `orbit_10_carpet.png` | `carpet` | ✅ Single subject, real transparency, real photography — 78KB WebP |

## Fail (8) — not connected, item keeps its placeholder

| File | Item (`id`) | Why it failed |
|---|---|---|
| `orbit_03_gold-jewelry.png` | `jewelry` | Multiple objects (necklace + earrings + ring-in-box + bracelet + display bust) — spec requires one object; also includes a display bust and a ring box, both explicitly forbidden. Visible red/yellow halo artifacts from background removal. |
| `orbit_04_tourism.png` | `tourism` | Multiple objects (suitcase + hat + camera + passport wallet + toy airplane + headphones + sunglasses). Halo artifacts. |
| `orbit_05_home-appliance.png` | `appliances` | No real alpha channel (RGB, not RGBA) — background is a **baked-in fake checkerboard graphic**, not real transparency. Also 9 separate appliances in one image, not one. |
| `orbit_06_beauty.png` | `cosmetics` | Multiple objects (10+ items — bottles, jar, brushes, lipstick, towel, flower, stones). Halo artifacts. |
| `orbit_07_digital.png` | `digital` | No real alpha (baked-in fake checkerboard). 6 separate devices in one image (laptop, tablet, phone, watch, headphones, earbuds), not one. |
| `orbit_08_insurance.png` | `insurance` | No real alpha (baked-in fake checkerboard). Multiple objects (umbrella + shield + house + car + coins + clipboard). Also reads as a 3D-rendered/CGI icon set, not real photography — violates the frozen style rule directly. |
| `orbit_11_food.png` | *(would map to `grocery`)* | **Wrong content entirely** — shows a living-room furniture set (sofa, armchair, coffee table, lamp, plant), not food. Also a baked-in black background, not transparency. |
| `orbit_12_sports.png` | *(no matching item in the current 13 — reserved for the future `sports` item, Stage 1.7)* | **Wrong content entirely** — shows kitchen appliances (espresso machine, blender, air fryer, vacuum, kettle), not sports equipment. Baked-in black background. |

## What this means right now

- `orbitItems.ts` still has its original 13-item list (Stage 1) — this
  connection pass did not touch item identities/positions/animation, only
  added `image` to the 4 items above. The Stage 1.7 12-item catalog
  (merged `food`, dropped `stationery`, added `sports`) is still only a
  documented plan, not applied to the code — a separate step, out of scope
  for "connect what's real."
- The Orbit currently renders a natural mix: 4 real photographed items and
  9 neutral placeholder circles (`OrbitBubble.tsx`'s existing fallback,
  unchanged). This is expected, not a bug.
- Regenerating the 8 failed items against the exact prompts in
  `docs/13-production-orbit-asset-spec.md` §1 (same filenames — the
  contract says don't rename) and dropping the replacements into
  `assets/orbit/source/` is enough to connect them the same way; no code
  change beyond adding their `image` field will be needed.
