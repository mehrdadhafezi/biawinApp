# Orbit Assets

Source images for the Landing page's Orbit — the 13 (implemented) /
12 (frozen production list, see below) floating category bubbles on
`https://staging.biawin.ir`.

## Purpose

This folder is the **canonical, version-controlled home for the original
production-quality Orbit images** — reviewable via normal git diffs/PRs,
independent of however they end up being served to the running app. It is
not itself the runtime asset-serving mechanism (see "How the frontend
consumes these" below).

Full specification, visual rules, and the exact generation prompt for each
item: [`docs/13-production-orbit-asset-spec.md`](../../docs/13-production-orbit-asset-spec.md).
Underlying system contract (Media Library data model, API contract, Admin
requirements): [`docs/11-orbit-asset-system.md`](../../docs/11-orbit-asset-system.md).

## Structure

```
assets/orbit/
├── source/    final production assets — exactly 12 files, see below
├── preview/   review-only material (JPG previews, contact sheets,
│              before/after comparisons) — never consumed by the app
└── README.md  this file
```

## Naming convention

```
orbit_{number}_{category}.webp
```

Two-digit zero-padded sequence + category slug, e.g. `orbit_01_clothing.webp`.
**Frozen — do not rename after generation.** The filename becomes the
asset's initial storage key (`docs/11-orbit-asset-system.md` §3/§4's
`imageKey`); renaming later breaks that reference wherever it's already
been consumed.

The 12 final filenames (`docs/13-production-orbit-asset-spec.md` §1 has
the full generation prompt + metadata for each):

```
orbit_01_clothing.webp
orbit_02_vehicle.webp
orbit_03_gold-jewelry.webp
orbit_04_tourism.webp
orbit_05_home-appliance.webp
orbit_06_beauty.webp
orbit_07_digital.webp
orbit_08_insurance.webp
orbit_09_motorcycle.webp
orbit_10_carpet.webp
orbit_11_food.webp
orbit_12_sports.webp
```

## Image requirements (summary — full detail in doc 13)

- 512×512px, WebP (PNG accepted), transparent background
- Real product photography style — not 3D render, not illustration
- Centered subject, generous margin, nothing touching the frame edge
  (CSS applies a circular clip at 47.2% radius — don't pre-crop a circle
  into the source art)
- Soft studio lighting, soft realistic contact shadow, no text/logo/
  watermark/people/background/extra props
- Must stay recognizable at ~120–160px (the actual rendered bubble size —
  see `docs/11-orbit-asset-system.md` §1 for how that range was derived)

## How the frontend consumes these (current state vs. target state)

**Today**: it doesn't yet. `apps/web/src/components/landing/orbitItems.ts`'s
`useOrbitItems()` returns mock data with every item's `image` field unset,
and `OrbitBubble.tsx` renders a placeholder in that case. Nothing in this
folder is wired into the running app.

**Once these 12 files exist here**, connecting them is explicitly a
*separate, later stage* (per Stage 1.7's scope) — not decided in this
document. The two realistic paths, for whoever picks this up:

1. **Interim static path**: copy/symlink the files into
   `apps/web/public/orbit/` so they're served as plain Next.js static
   assets (`/orbit/orbit_01_clothing.webp`), and set each mock item's
   `image` field to that path directly. Fastest to wire up, no backend
   change — but bypasses the Media Library entirely.
2. **Target path** (per `docs/11-orbit-asset-system.md`): upload through
   the existing `StorageProvider` (MinIO/S3) abstraction, store the
   resulting object key as `OrbitAsset.imageKey` per the frozen Prisma
   model, and serve `GET /api/v1/landing/orbit-items` with resolved URLs —
   `useOrbitItems()`'s body becomes a fetch against that endpoint instead
   of the mock array, with no change needed in `OrbitStage`/`OrbitBubble`.

Neither is implemented by this stage; this section exists so the next
stage doesn't have to rediscover the two options from scratch.

## Future Media Library migration plan

Once the Admin/API described in `docs/11-orbit-asset-system.md` exists,
`assets/orbit/source/` stops being where *new* assets originate — new
uploads happen through the Admin UI, land directly in object storage, and
never need a git commit. This folder then serves as:

- The historical/audit record of the original 12 (and any later) assets
- A local fallback/seed source if the Media Library ever needs reseeding
- Where a designer drops a *replacement* version for review before an
  Admin uploads it (bump `{version}`/sequence per the naming convention,
  never overwrite a filename in place)
