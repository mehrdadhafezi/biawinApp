# SERVICES-R5.26.1 — Default Catalog & Reference Asset Migration — Audit

Pre-implementation audit, per this stage's own explicit instruction. No catalog/seed code was written before this document was complete.

## 1. Current Architecture (confirmed by reading the schema and Admin CMS source)

Domain chain, unchanged, confirmed intact:

```
Category  →  CategoryCard  →  Service  →  CardProduct
```

- `Category` (`backend/prisma/schema.prisma:458`): `name` (unique), `description`, `keywords`, `slug` (nullable, unique — R5.21, powers `/categories/[slug]`), `mediaAssetId` (nullable FK to `MediaAsset` — R5.22 hero image), `active`.
- `CategoryCard` (`:644`): `categoryId` → `Category`, `targetServiceId` → `Service` (never `CardProduct` — confirmed, no such FK exists on this model), `title`, `subtitle`, `badge`, `mediaAssetId`, `highlights` (Json string[], capped at 2 by the Admin form), `sortOrder`, `active`.
- `Service` (`:550`): `categoryId` → `Category`, `title`, `groupLabel`, `subtitle`, `badge`, `mediaAssetId`, `priceFrom`, `availableMethods`, `benefits`, `faq`, `tags`, `active`.
- `CardProduct` (`:782`): `serviceId` → `Service`, `title`, `cardType` (enum), `journeyType` (enum — `PURCHASE` is the only one this stage's flow (R5.26) activates a CTA for), `priceAmount` (what the customer pays — never conflate with `valueAmount`), `valueAmount`/`valueDisplayType` (the card's own worth/ceiling), `benefits`, `validityDays`, `status` (`DRAFT|ACTIVE|INACTIVE|EXPIRED` — only `ACTIVE` is public), `sortOrder`.
- `MediaAsset` (`:1135`): `id`, `fileName`, `key` (unique, real object-storage key), real relations to `Category`/`Service`/`CardProduct`/`CategoryCard`.

No CategoryCard → CardProduct relation exists anywhere in the schema — the strict chain is intact and was never at risk.

## 2. The `categories/` Reference Directory — Contents

14 unique JPEGs + `categories.zip` (confirmed via `unzip -l`: the zip is a pure duplicate bundle of the same 14 files, zero additional content — not extracted, not used).

**Every image was opened and visually inspected** (not guessed from filename — filenames turned out to be misleading in two cases, confirmed below). Each is a polished vertical mockup card: `خدمات` badge, hero photo, title, icon, and exactly 2 highlight bullets — i.e. each image **is a CategoryCard mockup**, not a Category-hero-only banner.

| File | Actual title in image | Filename vs. content |
|---|---|---|
| Carpet.jpeg | فرش | matches |
| Clothes.jpeg | پوشاک | matches |
| Cosmetics.jpeg | آرایشی | matches |
| Dental.jpeg | دندان پزشکی | matches |
| Digital.jpeg | کالای دیجیتال | matches |
| Gold.jpeg | طلا | matches |
| Home appliances.jpeg | لوازم خانگی | matches |
| Kalakhab.jpeg | کالای خواب | matches (Kalakhab = کالای خواب, transliterated) |
| Motor.jpeg | موتور سیکلت | matches |
| Perfume.jpeg | عطر و ادکلن | matches |
| **Shoes.jpeg** | **کیف و کفش** | **mismatch — filename says "shoes", image shows a bag AND heels, titled "bags and shoes"** |
| Sofa.jpeg | مبلمان | matches (broader "furniture", not just "sofa") |
| insurance.jpeg | بیمه | matches |
| tourism.jpeg | گردشگری | matches |

## 3. Current Database State (queried directly, not assumed)

19 `Category` rows exist, all created by the existing `backend/prisma/seed.ts` (confirmed — every category name/description below matches that file verbatim). 109 `Service` rows exist, also all from that same seed. **This seed already ran** in this environment; the Category→Service skeleton for all 19 categories, including every target Service this stage needs, already exists.

Of the 19 Categories, **8 were already fully populated** (slug + `mediaAssetId` + one `CategoryCard`, each using one of these exact 14 reference images, uploaded as real `MediaAsset` rows on 2026-09-11T09:39 — real `media/<uuid>.jpg` object-storage keys, not filesystem paths) **before this audit began**:

| Category | slug | CategoryCard title | Reference image used |
|---|---|---|---|
| گردشگری | gardeshgari | گردشگری | tourism.jpeg |
| بیمه | bime | بیمه | insurance.jpeg |
| مبلمان | moblman | مبلمان | Sofa.jpeg |
| لوازم خانگی | lavazem-khanegi | لوازم خانگی | Home appliances.jpeg |
| طلا و جواهر | tala-javaher | طلا | Gold.jpeg |
| زیبایی | zibaei | عطر و ادکلن | Perfume.jpeg (card) / Cosmetics.jpeg (category hero) |
| خانه و زندگی | khane-zendegi | کالای خواب | Kalakhab.jpeg |
| پوشاک | poushak | کیف و کفش | Shoes.jpeg (card) / Clothes.jpeg (category hero) |

This is genuine prior progress on this exact stage (not committed to git — confirmed via `git log`/`git stash list`, both clean — this is live, uncommitted local database state). It uses the real Media Library mechanism correctly (real `MediaService.upload()`-shaped rows) and is not QA test debris. This audit treats it as a valid starting point to build on, not something to redo.

**3 more images were uploaded as `MediaAsset` rows but never attached to anything**: Carpet.jpeg, Dental.jpeg, Digital.jpeg — orphaned uploads, no Category/CategoryCard references them yet.

**1 image was never uploaded at all: Motor.jpeg.**

## 4. Gap Analysis — Image → Mapping Table

| Reference image | Classification | Target Category | Target Service (existing) | Action needed |
|---|---|---|---|---|
| Gold.jpeg | A + B (already done) | طلا و جواهر | شمش طلا | none |
| Home appliances.jpeg | A + B (already done) | لوازم خانگی | یخچال و فریزر | none |
| Kalakhab.jpeg | A + B (already done) | خانه و زندگی | کالای خواب | none |
| Perfume.jpeg | B (already done) | زیبایی | عطر و ادکلن | none |
| Shoes.jpeg | B (already done) | پوشاک | کفش | none |
| Sofa.jpeg | A + B (already done) | مبلمان | مبل راحتی | none |
| insurance.jpeg | A + B (already done) | بیمه | بیمه شخص ثالث | none |
| tourism.jpeg | A + B (already done) | گردشگری | تور کیش | none |
| **Carpet.jpeg** | B (media uploaded, card missing) | خانه و زندگی (already populated — needs a **2nd** card) | فرش و کفپوش | create CategoryCard "فرش" |
| **Clothes.jpeg** | B (media uploaded as category hero, card missing) | پوشاک (already populated — needs a **2nd** card) | خرید پوشاک | create CategoryCard "پوشاک" |
| **Cosmetics.jpeg** | B (media uploaded as category hero, card missing) | زیبایی (already populated — needs a **2nd** card) | لوازم آرایشی | create CategoryCard "آرایشی" |
| **Dental.jpeg** | B (media uploaded, Category itself unpopulated) | سلامت (exists, no slug/media/card) | دندانپزشکی | populate Category (slug+media) + create CategoryCard |
| **Digital.jpeg** | B (media uploaded, Category itself unpopulated) | دیجیتال (exists, no slug/media/card) | گوشی موبایل | populate Category (slug+media) + create CategoryCard |
| **Motor.jpeg** | **D — unresolved/orphan** | — | — | **left as reference-only, not injected — see §5** |

## 5. Motor.jpeg — Documented as Unresolved, Not Forced

`موتور سیکلت` (motorcycle) has no matching Category or Service anywhere in the current catalog. The one plausible home, `اتومبیل` (Automobile), is explicitly car-only by both its own seed `description` ("خرید خودرو با اعتبار بیاوین") and its 8 real Services (فیدلیتی پرایم, تیگو ۷ پرو, لاماری ایما, جک JS4, شاهین اتومات, دنا پلاس — all car models — plus two car-service items). Forcing a motorcycle CategoryCard to target a car-model Service would misrepresent it (Step 5's strict ownership rule); inventing a brand-new "موتور سیکلت" Service under `اتومبیل` would be a genuine new business-content decision this audit has no authority to make silently.

Independent corroboration: whoever populated the 8 categories above (§3) reached the exact same conclusion — Motor.jpeg is the *only* one of the 14 images never even uploaded to the Media Library, despite every other image (including the three "half-done" ones) already being there. This stage follows that same precedent: **Motor.jpeg stays in the reference directory, undocumented as a Category/Service/CardProduct, not fabricated.**

## 6. Existing Seed/Default-Data Mechanism (reused, not reinvented)

Two existing, idempotent scripts define the convention this stage must follow — found by inspection, not assumed:

- **`backend/prisma/seed.ts`** — upserts all 19 Categories by unique `name`, find-or-create Services by `categoryId+title`. Already ran; this is *why* all 109 Services already exist. This stage does not touch this file (the Category/Service skeleton it produces is correct and complete).
- **`backend/prisma/seed-home-media.ts`** — the exact right precedent for uploading real reference images: bootstraps a real Nest application context (`NestFactory.createApplicationContext(AppModule)`), resolves `MediaService` from it, and calls the real `mediaService.upload()` (never reimplements storage/validation logic, never writes a raw storage key). Idempotent (skips any row whose `mediaAssetId` is already set). Requires a seeded `SUPER_ADMIN` to attribute uploads to (`uploadedBy`).

This stage's new script, `backend/prisma/seed-default-catalog.ts`, follows the second script's exact architecture (bootstrapped app context, real `MediaService.upload()`), extended with idempotent Category/CategoryCard/CardProduct upsert logic matching `seed.ts`'s own find-or-create pattern. A new `package.json` script entry, `seed:default-catalog`, is added alongside the existing `seed:home-media` — same convention, not a new one.

## 7. Admin CMS — Already Correct, Confirmed by Reading Source (no changes needed)

- `CategoryForm.tsx` (`apps/admin/src/features/catalog/categories/CategoryForm.tsx`): uses `MediaPickerField` — no raw `imageKey`/storage-key input anywhere.
- `CategoryCardForm.tsx`: uses `MediaPickerField` for the card image; `targetServiceId` uses a category-scoped `ServiceSelect` that "only offers Services under the currently-selected Category" (its own doc comment) — Step 16's UI-level narrowing already exists; server-side ownership (`CategoryCardsService.assertOwnership`) is the real boundary regardless.
- `ServiceForm.tsx` / `CardProductForm.tsx`: confirmed (R5.26 audit + this one) to use `MediaPickerField` and real `mediaAssetId`, never a raw key.

**No Admin CMS code changes are needed this stage.** This audit confirms rather than assumes it, per the task's own Step 15 instruction ("verify — don't necessarily change").

## 8. CardProducts — Current State

Exactly **one** `CardProduct` row exists in the entire database: `کارت اعتباری بیمه شخص ثالث`, `status=ACTIVE`, `journeyType=PURCHASE`, `priceAmount=1,000,000`, `valueAmount=30,000,000` — but its `serviceId` points to **لوازم نوزاد** (baby products, under "کودک و نوجوان"), a Service completely unrelated to its own title (which is about third-party car insurance). This is leftover data from the R5.19/R5.26 purchase-flow QA work (that Service was `discoverPurchasableCardProduct()`'s target because it was simply the first/only `ACTIVE`+`PURCHASE`+priced row to exist, not because it was placed there deliberately). It is left untouched by this stage — R5.26's authenticated QA discovers CardProducts dynamically by query, not by hardcoded id, so nothing breaks either way, and deleting/moving pre-existing data outside this stage's own scope risks an unrequested side effect. Flagged here for visibility, not "fixed."

This stage adds several new, correctly-owned, real `ACTIVE`/`PURCHASE`/priced CardProducts under real, unambiguous Services (see §9 plan) — giving R5.26/R5.27 QA more than one real purchasable option, across different categories.

## 9. Plan

1. **Move reference images**: `categories/*.jpeg` → `docs/prototypes/services/categories/` (no existing `docs/` subdirectory convention was found for reference assets — the repo's own actual prototype HTML file was never committed, only analysis docs about it — so this stage adopts the location the task itself suggests). `categories.zip` is dropped (pure duplicate, zero unique content, would only be dead weight). Root `categories/` is removed once the move is verified.
2. **New seed script** `backend/prisma/seed-default-catalog.ts` (Nest app-context + real `MediaService.upload()`, idempotent throughout):
   - Set `slug`/`mediaAssetId` on `سلامت` (slug `salamat`) and `دیجیتال` (slug `dijital`) — only if currently null, never overwrites Admin-set values.
   - Create 5 new `CategoryCard` rows: فرش (→خانه و زندگی/فرش و کفپوش), پوشاک (→پوشاک/خرید پوشاک), آرایشی (→زیبایی/لوازم آرایشی), دندان پزشکی (→سلامت/دندانپزشکی), کالای دیجیتال (→دیجیتال/گوشی موبایل) — idempotent by `categoryId+title`.
   - Create ~4 new, correctly-owned, real `ACTIVE`/`PURCHASE`/priced `CardProduct` rows under existing Services (کفش, شمش طلا, تور کیش, یخچال و فریزر) — idempotent by `serviceId+title`.
3. **QA**: extend `authenticated-qa-runner.ts` and `browser-qa.ts` per the task's explicit checklist — all dynamic, no hardcoded UUIDs/counts.
4. **No backend business logic, Admin CMS, or schema changes** — confirmed unnecessary by §7/§1.
5. **No Payment/Gateway work** — out of scope, not touched.
