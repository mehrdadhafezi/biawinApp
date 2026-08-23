# 13 — Production Orbit Asset Specification (Stage 1.7)

Contract-only document. No images generated, no code/UI/animation/
responsive logic touched. This freezes the exact generation prompt and
metadata for each of the **12** final Orbit items, self-contained enough
that any AI image generator can produce the asset from one prompt block
alone, with no other context needed.

## Catalog change from Stage 1.6 (`docs/12-orbit-item-catalog.md`)

The reference folder structure for this stage names exactly 12 files, not
13 — this supersedes the Stage 1.6 list:

| Change | What happened |
|---|---|
| `grocery` + `meat` | merged into one item: `food` |
| `stationery` | dropped (it was flagged as the weakest category match in Stage 1.6) |
| `sports` | added — maps cleanly to the existing seeded category `باشگاه و ورزش` (no equivalent existed in the Stage 1.6 list) |
| `jewelry`, `appliances`, `cosmetics`, `car` | renamed slugs (`gold-jewelry`, `home-appliance`, `beauty`, `vehicle`) — same items, no concept change |
| `motorcycle`, `carpet` | unchanged, kept as their own distinct items |

This document does not update `orbitItems.ts` — per this stage's explicit
scope, that connection happens in a later stage ("connect them through the
existing `OrbitItem` `imageKey` contract").

## Global Visual Style (applies to all 12 — repeated in each prompt below so every prompt is usable standalone)

**Style: real product photography.** Not 3D render, not illustration, not
cartoon, not CGI, not fantasy art. Every asset must look like it was shot
in the same professional product-photography studio, for a premium
marketplace (comparable to Apple, Zara, or a high-end Amazon listing) —
the 12 images are one visual collection, not 12 unrelated styles.

Shared constants across every prompt:
- Fully transparent background, no floor/ground/reflection surface
- Camera: 3/4 product-photography angle (adapted per object type below)
- Lighting: soft diffused studio softbox, key light from the upper-left
- Shadow: soft realistic contact shadow directly beneath the object only —
  never a hard-edged shadow, never a glow, never a stylized/cartoon shadow
- Object centered, generous negative-space margin on all sides, nothing
  touching the frame edge (required for the circular clip-path — see
  `docs/11-orbit-asset-system.md` §1)
- No text, no logo, no brand mark, no watermark, no people, no background
  elements, no props beyond the one subject
- Photorealistic materials — real texture, real reflections, real fabric/
  metal/glass behavior, not stylized or flattened

## Technical constraints (all 12 items)

| | |
|---|---|
| Canvas | 512 × 512px, square |
| Format | WebP preferred, PNG accepted |
| Background | Transparent (verified alpha channel) |
| Display context | Circular Orbit bubble, rendered at **~120–160px** (see `docs/11-orbit-asset-system.md` §1 for how this range was derived from the actual Stage 1 code) — the object must stay clearly recognizable at that size, not just at full 512px |
| Cropping | The Orbit system does not crop or distort — CSS applies a circular clip at 47.2% radius only; do not pre-crop a circle into the source art (square composition, CSS does the clipping) |

## 1. Final Orbit Asset Specifications

### 01 — Clothing (پوشاک)

- **Category**: پوشاک (`clothing`)
- **Asset Name**: Folded Premium Shirt
- **File Name**: `orbit_01_clothing.webp`
- **Image Generation Prompt**:
  > Professional e-commerce product photography of a single neatly folded premium cotton button-up shirt in navy blue, folded in classic retail-style presentation, floating with no surface visible beneath it, isolated on a fully transparent background, centered composition with generous negative-space margin on all sides, shot from a slight 3/4 elevated angle, soft diffused studio softbox lighting from the upper-left at approximately 45 degrees, soft realistic contact shadow directly beneath the fabric (no hard-edged shadow, no glow), ultra-realistic fabric texture and natural fold creases, premium marketplace quality similar to Zara or Uniqlo product photography. No text, no logo, no tag, no brand mark, no watermark, no human model, no mannequin, no hanger, no background elements, no props — the shirt is the only object in frame.
- **Object Composition**: One folded shirt, single subject, no accessories
- **Camera Angle**: Slight 3/4 elevated angle (standard folded-apparel ecommerce shot)
- **Lighting Setup**: Soft studio softbox, upper-left key, ~45°, no fill-light hotspots
- **Shadow Specification**: Soft contact shadow directly under the fabric edge only
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "clothing",
    "title": "پوشاک",
    "fileName": "orbit_01_clothing.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 1
  }
  ```

### 02 — Vehicle / Car (اتومبیل)

- **Category**: اتومبیل (`vehicle`)
- **Asset Name**: Modern Sedan
- **File Name**: `orbit_02_vehicle.webp`
- **Image Generation Prompt**:
  > Professional automotive product photography of a single modern sedan car in a neutral matte silver or white color, photographed from a 3/4 front angle (classic automotive catalog angle), isolated on a fully transparent background with no floor, ground, or reflection surface visible, centered in frame with breathing room around all edges, soft diffused studio lighting mimicking an automotive photography light tent, soft realistic contact shadow beneath the tires only (no hard shadow, no glow, no light streaks), photorealistic paint reflections and body panel gloss, premium dealership-catalog quality. No license plate text, no brand logo, no background, no road, no other vehicles, no people — the car is the only object in frame.
- **Object Composition**: One sedan, full vehicle in frame, no accessories
- **Camera Angle**: 3/4 front (standard automotive catalog angle)
- **Lighting Setup**: Automotive light-tent style, soft, even, upper-left key
- **Shadow Specification**: Soft contact shadow beneath tires only
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "vehicle",
    "title": "خودرو",
    "fileName": "orbit_02_vehicle.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 2
  }
  ```

### 03 — Gold & Jewelry (طلا و جواهر)

- **Category**: طلا و جواهر (`gold-jewelry`)
- **Asset Name**: Elegant Gold Necklace
- **File Name**: `orbit_03_gold-jewelry.webp`
- **Image Generation Prompt**:
  > Professional luxury jewelry product photography of a single elegant 18k gold necklace with a delicate pendant, arranged in a gentle curved presentation as if floating, isolated on a fully transparent background, centered composition with generous margin, close macro-style framing that still leaves breathing room at every edge, soft diffused studio lighting from the upper-left producing gentle warm metallic highlights without harsh glare or blown-out reflections, soft realistic contact shadow beneath the piece, ultra-realistic gold texture and subtle craftsmanship detail, premium luxury-marketplace quality similar to a high-end jewelry retailer's product page. No text, no logo, no gemstone sparkle overlay effects, no background, no jewelry box, no display stand, no human hand or neck — the necklace is the only object in frame.
- **Object Composition**: One necklace with pendant, gently curved, no stand
- **Camera Angle**: Close macro-style, still centered with margin
- **Lighting Setup**: Soft upper-left key, warm metallic highlight, no glare/bloom
- **Shadow Specification**: Soft contact shadow beneath the piece
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "gold-jewelry",
    "title": "طلا و جواهر",
    "fileName": "orbit_03_gold-jewelry.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 3
  }
  ```

### 04 — Tourism (گردشگری)

- **Category**: گردشگری (`tourism`)
- **Asset Name**: Premium Travel Suitcase
- **File Name**: `orbit_04_tourism.webp`
- **Image Generation Prompt**:
  > Professional e-commerce product photography of a single premium hardshell travel suitcase in a neutral color (navy blue or sand beige), photographed from a 3/4 angle showing both the front and one side, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left, soft realistic contact shadow beneath the suitcase wheels, photorealistic shell texture and metal zipper/handle details, premium travel-retailer quality similar to an Away or Samsonite product page. No text, no logo, no luggage tag, no stickers, no background, no airport props, no people — the suitcase is the only object in frame.
- **Object Composition**: One hardshell suitcase, upright, no tags/stickers
- **Camera Angle**: 3/4, front + one side visible
- **Lighting Setup**: Soft upper-left key, clean shell highlights
- **Shadow Specification**: Soft contact shadow beneath the wheels
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "tourism",
    "title": "گردشگری",
    "fileName": "orbit_04_tourism.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 4
  }
  ```

### 05 — Home Appliance (لوازم خانگی)

- **Category**: لوازم خانگی (`home-appliance`)
- **Asset Name**: Stainless-Steel Refrigerator
- **File Name**: `orbit_05_home-appliance.webp`
- **Image Generation Prompt**:
  > Professional appliance product photography of a single modern stainless-steel refrigerator with a sleek minimalist design, photographed from a 3/4 front angle, isolated on a fully transparent background, centered composition with generous margin around all edges, soft diffused studio lighting from the upper-left producing clean metallic highlights without harsh glare, soft realistic contact shadow beneath the appliance, photorealistic brushed-steel texture and clean door seams, premium appliance-retailer quality similar to a Samsung or LG product catalog page. No text, no brand logo, no display panel content, no background, no kitchen setting, no people — the refrigerator is the only object in frame.
- **Object Composition**: One refrigerator, full unit, doors closed
- **Camera Angle**: 3/4 front
- **Lighting Setup**: Soft upper-left key, clean brushed-metal highlight
- **Shadow Specification**: Soft contact shadow beneath the unit
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "home-appliance",
    "title": "لوازم خانگی",
    "fileName": "orbit_05_home-appliance.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 5
  }
  ```

### 06 — Beauty (زیبایی)

- **Category**: زیبایی (`beauty`)
- **Asset Name**: Premium Perfume Bottle
- **File Name**: `orbit_06_beauty.webp`
- **Image Generation Prompt**:
  > Professional cosmetics product photography of a single premium glass perfume bottle with a minimalist elegant design and a metallic cap, photographed upright from a slight 3/4 angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left producing gentle glass refraction and clean highlights without harsh glare, soft realistic contact shadow beneath the bottle, photorealistic glass and liquid texture, premium beauty-retailer quality similar to a Sephora product page. No text, no brand label, no logo, no background, no box, no other cosmetic items, no people — the perfume bottle is the only object in frame.
- **Object Composition**: One perfume bottle, upright, capped, no box
- **Camera Angle**: Slight 3/4, upright
- **Lighting Setup**: Soft upper-left key, controlled glass refraction, no glare
- **Shadow Specification**: Soft contact shadow beneath the bottle base
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "beauty",
    "title": "زیبایی",
    "fileName": "orbit_06_beauty.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 6
  }
  ```

### 07 — Digital (دیجیتال)

- **Category**: دیجیتال (`digital`)
- **Asset Name**: Modern Smartphone
- **File Name**: `orbit_07_digital.webp`
- **Image Generation Prompt**:
  > Professional consumer-electronics product photography of a single modern smartphone with a minimalist edge-to-edge screen, photographed upright from a slight 3/4 angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left producing a clean subtle reflection on the glass screen without harsh glare, soft realistic contact shadow beneath the device, photorealistic aluminum/glass body texture, screen in a neutral dark/off state (no app icons, no visible UI, no on-screen branding), premium tech-retailer quality similar to an Apple product page. No text, no brand logo on the body, no background, no charging cable, no box, no people — the smartphone is the only object in frame.
- **Object Composition**: One smartphone, upright, screen off/neutral
- **Camera Angle**: Slight 3/4, upright
- **Lighting Setup**: Soft upper-left key, subtle controlled screen reflection
- **Shadow Specification**: Soft contact shadow beneath the device
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "digital",
    "title": "دیجیتال",
    "fileName": "orbit_07_digital.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 7
  }
  ```

### 08 — Insurance (بیمه)

- **Category**: بیمه (`insurance`)
- **Asset Name**: Premium Umbrella (protection symbol)
- **File Name**: `orbit_08_insurance.webp`
- **Image Generation Prompt**:
  > Professional product photography of a single premium closed umbrella with a sleek matte black canopy and a wooden or brushed-metal handle, photographed upright from a slight 3/4 angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left, soft realistic contact shadow beneath the umbrella tip, photorealistic fabric and handle material texture, premium retailer quality. No text, no logo, no background, no rain props, no people — the umbrella is the only object in frame, used as a real-photography stand-in for protection/coverage since insurance has no literal product form.
- **Object Composition**: One closed umbrella, upright
- **Camera Angle**: Slight 3/4, upright
- **Lighting Setup**: Soft upper-left key
- **Shadow Specification**: Soft contact shadow beneath the tip
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "insurance",
    "title": "بیمه",
    "fileName": "orbit_08_insurance.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 8
  }
  ```

### 09 — Motorcycle (اتومبیل)

- **Category**: اتومبیل (`motorcycle`) — shares the same broad seeded category as `vehicle`; distinct product within it
- **Asset Name**: Modern Motorcycle
- **File Name**: `orbit_09_motorcycle.webp`
- **Image Generation Prompt**:
  > Professional automotive product photography of a single modern motorcycle in a neutral matte black or dark grey color, photographed from a 3/4 front-side angle (classic motorcycle catalog angle), isolated on a fully transparent background with no floor or ground surface visible, centered composition with breathing room around all edges, soft diffused studio lighting mimicking a motorcycle showroom light tent, soft realistic contact shadow beneath the wheels only, photorealistic metal/chrome and tire texture, premium dealership-catalog quality. No license plate text, no brand logo, no background, no rider, no people — the motorcycle is the only object in frame.
- **Object Composition**: One motorcycle, full vehicle, no rider
- **Camera Angle**: 3/4 front-side
- **Lighting Setup**: Showroom light-tent style, soft, upper-left key
- **Shadow Specification**: Soft contact shadow beneath wheels only
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "motorcycle",
    "title": "موتورسیکلت",
    "fileName": "orbit_09_motorcycle.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 9
  }
  ```

### 10 — Carpet (خانه و زندگی)

- **Category**: خانه و زندگی (`carpet`)
- **Asset Name**: Rolled Premium Area Rug
- **File Name**: `orbit_10_carpet.webp`
- **Image Generation Prompt**:
  > Professional home-goods product photography of a single premium area rug, partially rolled or neatly folded to reveal its woven pattern and texture, photographed from a slight elevated 3/4 angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left, soft realistic contact shadow beneath the rug, photorealistic woven-fiber texture and visible pattern detail, premium home-retailer quality similar to a West Elm or IKEA product page. No text, no logo, no background, no floor setting, no furniture, no people — the rug is the only object in frame.
- **Object Composition**: One rug, partially rolled, pattern visible
- **Camera Angle**: Slight elevated 3/4
- **Lighting Setup**: Soft upper-left key, texture-revealing
- **Shadow Specification**: Soft contact shadow beneath the roll
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "carpet",
    "title": "فرش",
    "fileName": "orbit_10_carpet.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 10
  }
  ```

### 11 — Food (خرید روزمره)

- **Category**: خرید روزمره (`food`) — merges the Stage 1.6 `grocery` + `meat` items
- **Asset Name**: Fresh Grocery Basket
- **File Name**: `orbit_11_food.webp`
- **Image Generation Prompt**:
  > Professional grocery product photography of a single premium woven wicker basket filled with fresh everyday groceries (a loaf of bread, a few vegetables, and eggs), arranged as one cohesive still-life composition, photographed from a slight 3/4 elevated angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left, soft realistic contact shadow beneath the basket, photorealistic textures for bread crust, vegetable skin, and woven basket fiber, premium grocery-retailer quality similar to a Whole Foods product feature. No text, no logo, no packaging labels, no background, no kitchen setting, no people — the filled basket is the only object in frame.
- **Object Composition**: One woven basket, filled with bread/vegetables/eggs as a single cohesive still-life
- **Camera Angle**: Slight 3/4 elevated
- **Lighting Setup**: Soft upper-left key, natural food tones (no oversaturation)
- **Shadow Specification**: Soft contact shadow beneath the basket
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "food",
    "title": "خرید روزمره",
    "fileName": "orbit_11_food.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 11
  }
  ```

### 12 — Sports (باشگاه و ورزش)

- **Category**: باشگاه و ورزش (`sports`)
- **Asset Name**: Premium Dumbbell Pair
- **File Name**: `orbit_12_sports.webp`
- **Image Generation Prompt**:
  > Professional fitness-equipment product photography of a single pair of premium matte-black rubber-coated dumbbells, arranged neatly side by side, photographed from a slight 3/4 angle, isolated on a fully transparent background, centered composition with generous negative-space margin, soft diffused studio lighting from the upper-left producing subtle highlights on the rubber coating and metal end caps, soft realistic contact shadow beneath the dumbbells, photorealistic rubber and brushed-metal texture, premium fitness-retailer quality similar to a Nike or Rogue Fitness product page. No text, no logo, no background, no gym setting, no people — the dumbbells are the only object in frame.
- **Object Composition**: One pair of dumbbells, side by side
- **Camera Angle**: Slight 3/4
- **Lighting Setup**: Soft upper-left key, controlled rubber/metal highlights
- **Shadow Specification**: Soft contact shadow beneath both dumbbells
- **Resolution Requirements**: 512×512px, WebP, transparent, legible at 120–160px
- **Media Library Metadata**:
  ```json
  {
    "type": "orbit_asset",
    "category": "sports",
    "title": "باشگاه و ورزش",
    "fileName": "orbit_12_sports.webp",
    "mimeType": "image/webp",
    "width": 512,
    "height": 512,
    "transparent": true,
    "style": "real_product_photography",
    "status": "active",
    "sortOrder": 12
  }
  ```

## Naming convention (frozen)

```
orbit_{number}_{category}.webp
```

Two-digit zero-padded sequence number + category slug. Filenames above are
final — do not rename later; the filename becomes the asset's initial
storage key (`docs/11-orbit-asset-system.md` §3/§4's `imageKey`).

## What happens after this document is approved

1. Generate the 12 images against the prompts above.
2. Place them in `assets/orbit/source/` using the exact filenames above.
3. A later stage connects them through the existing `OrbitItem`/`imageKey`
   contract (`orbitItems.ts`, `docs/11-orbit-asset-system.md`) — not part
   of this stage.
