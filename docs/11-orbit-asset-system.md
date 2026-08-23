# 11 — Orbit Asset System

Contract-only document (Stage 1.5). No images created, no Admin UI built, no
Landing code changed here — this freezes the spec that Stage 2+ (asset
creation) and the eventual Admin/API work build against. Grounded directly
in the actual Stage 1 code (`apps/web/src/components/landing/orbitItems.ts`,
`OrbitBubble.tsx`), not abstract numbers.

## 1. Orbit Asset Technical Specification

### Format

- **WebP**, lossy, quality 80–85 — the delivered format. Wide support on
  every browser this project targets; meaningfully smaller than PNG at
  visually-equal quality for photographic/rendered product art.
- Source/working file from the designer or generation pipeline may be PNG
  (easier for most tools to produce with clean alpha); export to WebP as
  the final delivered asset.
- **Transparent background is mandatory** (alpha channel, not a white or
  colored fill).
- Target file size ceiling: **≤ 80KB** per asset. Cheap to hit at 512×512
  with WebP unless the source has heavy noise/grain — flag and re-export if
  a single asset comes in far over this.

### Dimensions — why these numbers, not round guesses

The bubble's *rendered* CSS size is `19.4%` of the orbit stage container
(`OrbitBubble.tsx`), and the container itself is capped at
`min(100%, 760px, 100dvh/1.25)` (`OrbitLanding.tsx`, Stage 1). Working that
through the full device matrix Stage 1 was tested against, the bubble's
rendered diameter never exceeds **~150px CSS pixels**, on any breakpoint —
desktop included, because desktop is capped at the same 760px container
width as everything else. This is a direct, load-bearing consequence of the
Stage 1 responsive fix, and it means:

- **One asset size covers every breakpoint.** There is no meaningful
  "mobile art vs. desktop art" size difference to design around, because
  the container itself doesn't grow past 760px anywhere.
- For 2x-density (Retina) sharpness at a ~150px max render size, the source
  needs to be **≥300px**. Rounding up for safety margin and headroom for a
  future larger orbit variant:

| | Size |
|---|---|
| **Delivered canvas** | **512 × 512px**, square |
| Effective render range | ~76px (smallest phone) – ~150px (desktop/tablet cap) |
| Retina factor covered | up to ~3.4x at the smallest render size |

- **Mobile-specific / desktop-specific source sizes are not required by
  default.** The Media Library model (§4) still carries optional
  `mobileImageKey` / `desktopImageKey` override fields for a future
  campaign that genuinely wants different art per breakpoint, but a normal
  orbit item needs exactly one 512×512 asset.

### The circle comes from CSS, not from the image

`OrbitBubble.tsx` already applies `clip-path: circle(47.2% at 50% 50%)` to
whatever image is placed in the bubble. **Do not hand-mask a circle into
the source art.** Deliver a square, transparent-background image with the
subject centered — CSS does the circular crop. Designing a pre-cropped
circular PNG wastes work and will double-crop/look wrong once CSS clips it
again.

## 2. Asset Visual Rules

| Rule | Requirement |
|---|---|
| **Background** | Fully transparent. No baked-in circle, no background shape/color of any kind. |
| **Shadow** | Real, in-image shadow — but *soft and self-contained* (subtle contact shadow under/behind the object for grounding, not a hard cast shadow). `OrbitBubble.tsx` already applies `filter: drop-shadow(0 8px 13px rgba(45,112,183,.10))` in CSS for the ambient "floating bubble" effect — that stays as-is and is separate from any shadow baked into the art. Don't try to replace the CSS shadow with the image; the two are complementary (in-image = object depth, CSS = floating-bubble depth). |
| **Lighting direction** | Consistent top-left soft key light across all 13 (and all future) items — matches the light source direction already used elsewhere in the design (the center CTA's `radial-gradient(circle at 43% 34%, ...)` highlights from the upper-left). |
| **Lighting intensity** | Soft/diffused, no harsh specular highlights or hard-edged shadows — matches the app's generally soft, rounded visual language. |
| **Perspective/camera** | Same angle and framing scale across the whole set (e.g. a consistent 3/4 product-shot angle). The 13 bubbles read as one cohesive family; a mismatched angle on one item is immediately visible next to the other 12. |
| **Object placement** | Centered in the 512×512 canvas, with **≥12% padding** from every edge to the subject's visual bounding box (i.e. the subject occupies roughly the inner 76% of the canvas). Nothing touches the canvas edge. |

## 3. Naming Convention

```
orbit_{category}_{slug}_{version}.webp
```

- `{category}` — broad grouping, used for future filtering/theming (see §6
  category list below).
- `{slug}` — matches the existing `OrbitItem.id` values in
  `orbitItems.ts` exactly (`grocery`, `clothing`, `motorcycle`, `car`,
  `jewelry`, `tourism`, `appliances`, `carpet`, `cosmetics`, `digital`,
  `insurance`, `stationery`, `meat`) — this is what makes today's mock data
  a drop-in replacement once real files exist, no id remapping needed.
- `{version}` — `v1`, `v2`, ... — bump on any replacement so a stale CDN/
  browser cache never silently serves old art under the same key; the DB
  row's `imageKey` simply points at the new filename.

Examples: `orbit_food_grocery_v1.webp`, `orbit_fashion_clothing_v1.webp`,
`orbit_finance_insurance_v1.webp`.

Localization: if a future locale needs different art (not just different
text), append a locale segment before the version:
`orbit_{category}_{slug}_{locale}_{version}.webp` (e.g. `..._fa_v1.webp`).
Not needed today — Persian is the only locale — but the slot is reserved so
it doesn't require a naming-scheme migration later.

## 4. Media Library Data Model

Follows this codebase's existing conventions exactly (see
`backend/prisma/schema.prisma`'s `Category` model): UUID `id`, `sortOrder`
not `order`, `imageKey` (an object-storage key resolved to a full URL by
the existing `StorageProvider`, not a raw stored URL) matching
`Category.imageKey`'s own pattern.

```prisma
model OrbitAsset {
  id          String   @id @default(uuid())
  title       String
  slug        String   @unique          // matches OrbitItem.id today — see §3
  category    String                    // see §6 for the controlled list
  imageKey    String?                   // null until a real asset is uploaded
  thumbnailKey String?                  // optional smaller preview for the Admin grid — see §6

  // Optional per-breakpoint overrides — unset for a normal item (§1: one
  // asset covers every breakpoint by default).
  mobileImageKey  String?
  desktopImageKey String?

  sortOrder   Int      @default(0)
  active      Boolean  @default(true)

  // Positioning: `slotIndex` (0-12) maps to the fixed, non-overlapping
  // ring layout already defined in orbitItems.ts's ORBIT geometry — this
  // is the default and the only thing a normal Admin edit needs to touch
  // (via drag-and-drop reordering, not raw numbers). `positionOverride` is
  // an escape hatch for a future custom arrangement; leave it null for
  // anything using the standard 13-slot layout, since free-form percentage
  // positioning risks bubble overlap if set carelessly.
  slotIndex        Int?
  positionOverride Json?   // { leftPercent: number, topPercent: number } | null

  // Animation — same shape as OrbitItem.animation in orbitItems.ts today.
  animationVariant      String  @default("a") // "a" | "b" | "c" | "d"
  animationDelaySeconds Float   @default(0)

  // Future multi-campaign/theme support (§ context: "Multiple campaigns/
  // themes in future"). Null = the default/always-on orbit set.
  campaignId String?
  campaign   OrbitCampaign? @relation(fields: [campaignId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("orbit_assets")
}

/// Optional grouping for a future seasonal/promotional orbit variant —
/// e.g. a Nowruz campaign swapping in different bubbles for two weeks.
/// Not needed for the current single always-on orbit; the table exists so
/// adding campaigns later doesn't require a schema migration that touches
/// OrbitAsset itself.
model OrbitCampaign {
  id        String   @id @default(uuid())
  name      String
  active    Boolean  @default(false)
  startsAt  DateTime?
  endsAt    DateTime?

  assets OrbitAsset[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("orbit_campaigns")
}
```

**Frontend mapping**: `useOrbitItems()` (today: mock data) becomes a fetch
against §5's `GET` endpoint; the API response's `image`/`title`/`order`/
`active` map directly onto today's `OrbitItem.image`/`.title`/`.order`/
`.active` fields with no shape change on the consuming side — `position`
and `animation` are derived from `slotIndex`/`positionOverride` and
`animationVariant`/`animationDelaySeconds` server-side before the response
is sent, so `OrbitStage`/`OrbitBubble` never need to know about slots vs.
overrides at all.

## 5. API Contract

Contract only — no implementation. Mirrors this codebase's existing
`/api/v1` + NestJS-versioned-route conventions (`docs/03-api.md`).

### Public (consumed by `useOrbitItems()`)

```
GET /api/v1/landing/orbit-items
```
Returns only `active: true` items, pre-sorted by `sortOrder`, with
`imageKey`/`thumbnailKey` already resolved to full URLs and
position/animation already flattened — exactly the shape `OrbitItem`
expects today:

```json
[
  { "id": "grocery", "title": "سبد مواد غذایی", "image": "https://.../orbit_food_grocery_v1.webp", "order": 1, "active": true,
    "position": { "leftPercent": 29.2, "topPercent": 29.0 },
    "animation": { "variant": "a", "delaySeconds": 0 } }
]
```

### Admin (authenticated, not public)

```
GET    /api/v1/admin/orbit-items                 # full list, inactive included
POST   /api/v1/admin/orbit-items                 # create — title, slug, category required; image optional at creation
GET    /api/v1/admin/orbit-items/:id
PATCH  /api/v1/admin/orbit-items/:id              # title, category, active, animation, positionOverride
DELETE /api/v1/admin/orbit-items/:id

PATCH  /api/v1/admin/orbit-items/reorder          # body: [{ id, sortOrder }, ...] — one call for drag-and-drop, not N individual PATCHes

POST   /api/v1/admin/orbit-items/:id/image        # multipart upload → sets imageKey (+ auto-derived thumbnailKey)
DELETE /api/v1/admin/orbit-items/:id/image        # clears imageKey — item falls back to OrbitBubble's placeholder
```

Upload goes through the same `StorageProvider` abstraction already used
elsewhere in the backend (Interface → Factory → MinIO/S3, see
`docs/01-architecture.md`) — no new storage mechanism needed.

## 6. Admin Requirements

Minimum required Admin UI capabilities (not built in this stage):

- **Upload** — file picker with client-side preview before save; enforce
  square-ish aspect ratio and a max upload size client-side as a first
  guard (server-side validation is the real gate).
- **Replace** — same upload flow on an existing item; bump the filename's
  `{version}` automatically rather than overwriting the same key, so a CDN/
  browser cache can't serve stale art (§3).
- **Preview** — render the uploaded image through the *actual* circular
  clip-path + drop-shadow CSS (§1/§2), not a plain square `<img>` — a flat
  preview hides exactly the edge-cropping issues (§1's "no baked circle")
  this contract exists to prevent.
- **Enable/Disable** — a single `active` toggle; disabled items are
  excluded from the public endpoint entirely, not just hidden client-side.
- **Drag & Drop ordering** — updates `sortOrder` for the affected items via
  the `reorder` endpoint (§5); the standard 13-slot `slotIndex` layout
  means reordering is safe by construction (no manual coordinate entry, no
  overlap risk).
- **Title / category edit** — category from a controlled dropdown (§3's
  category list), not free text, to keep naming/filtering consistent.

Minimum required fields on the Admin form: **title, category, image
upload, active**. Everything else (`slug`, `sortOrder`, `slotIndex`,
animation) has a sensible default and doesn't need to be in the primary
form — expose animation variant/positionOverride only in an "advanced"
section, since most edits should never need them (§4).

## 7. Responsive Rules

- **Default (no override set)**: one asset, one URL, used at every
  breakpoint. The 512×512 source scales via the existing CSS percentage
  sizing (`width:19.4%` of the container, `20.4%` under 430px) — this is
  already fully responsive with zero extra work per §1's finding that the
  container itself never exceeds 760px.
- **Override path**: if `mobileImageKey`/`desktopImageKey` is set for a
  specific item (a future campaign use case, not routine), the frontend
  picks between them via the same `breakpoint.sm` cutoff the Modal
  refactor (Stage 1) already uses, for consistency with the rest of the
  responsive system rather than inventing a second breakpoint convention.
- **Scaling**: always CSS percentage-based, never a fixed pixel size — this
  is already how `OrbitBubble.tsx` works and nothing here changes it.

## 8. Production Asset Checklist

For a designer or an AI image-generation pipeline producing one orbit
asset:

```
[ ] 512×512px canvas, square
[ ] Transparent background (verified alpha, not white-that-looks-transparent)
[ ] No baked-in circle crop — square composition, CSS clips it
[ ] Subject centered, ≥12% padding from every edge
[ ] Soft self-shadow only (no hard cast shadow) — CSS adds the ambient drop-shadow separately
[ ] Light source top-left, soft/diffused, consistent with the other 12 items in the set
[ ] Same camera angle/perspective as the rest of the set
[ ] No text or wordmarks baked into the image
[ ] Exported as WebP, ≤80KB
[ ] Filename follows orbit_{category}_{slug}_{version}.webp
[ ] Rendered at ~76px (smallest phone) — subject still legible, not muddy
[ ] Rendered at ~150px (desktop cap) — no visible upscale blur/artifacts
```

---

## Summary

| Deliverable | Location in this document |
|---|---|
| 1. Orbit Asset Specification | §1, §2, §3, §8 |
| 2. Media Library Data Model | §4 |
| 3. API Contract | §5 |
| 4. Admin Requirements | §6 |
| 5. Designer/AI Asset Creation Guidelines | §8 (checklist) + §1/§2 (the rules the checklist enforces) |

Nothing in this document has been implemented — no migration, no Admin UI,
no Landing code change, no images. This is the frozen contract Stage 2
(actual asset creation) and the eventual Admin/API build both work against.
