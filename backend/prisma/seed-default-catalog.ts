/**
 * SERVICES-R5.26.1 — populates the real default Services catalog using the
 * reference mockups under `docs/prototypes/services/categories/` (moved
 * there from the repository root — see docs/services-r5-26-1-default-
 * catalog-audit.md §2/§9; that directory is reference-only, never read by
 * runtime code — every image this script touches ends up as a real
 * `MediaAsset` row, resolved the normal way).
 *
 * Every Category/Service this script targets already exists — created by
 * `seed.ts`, which already ran in every environment this script is meant to
 * run in (local, staging). This script never creates a Category or Service;
 * it only:
 *   1. sets `slug` on the few Categories that exist but never had one, and
 *   2. adds the CategoryCard rows + a small set of real, correctly-owned,
 *      ACTIVE/PURCHASE/priced CardProducts the reference mockups call for.
 *
 * SERVICES ASSET ASSIGNMENT MATRIX (Sep 2026) — every file under
 * `docs/prototypes/services/categories/` was visually confirmed to be a
 * composited CategoryCard promotional mockup (badge + product photo +
 * baked-in title text that exactly matches one CategoryCard.title + 2
 * bullet highlights + icon), never a plain, role-agnostic photo. An earlier
 * pass of this script incorrectly reused these same 13 files as
 * `Category.mediaAssetId` (the small `/services` grid thumbnail) and as
 * `CardProduct.mediaAssetId` (the purchasable-card image) too. Ownership is
 * now strict: these 13 files belong to `CategoryCard.mediaAssetId` ONLY.
 * `CATEGORY_CARD_ONLY_IMAGES` below both documents that boundary and powers
 * this script's own idempotent repair of the two prior mis-assignments —
 * see its own doc comment.
 *
 * Idempotent throughout, same discipline as `seed.ts`/`seed-home-media.ts`:
 * a Category whose `slug` is already set is left untouched (never overwrites
 * Admin-managed content); a CategoryCard is matched by `categoryId`+`title`;
 * a CardProduct by `serviceId`+`title`; a MediaAsset upload is skipped (and
 * the existing row reused) whenever one with the exact same `fileName`
 * already exists — re-running this script after a partial run (or after
 * this exact reference set was already uploaded by hand, as happened once
 * in this environment — see the audit's §3) creates nothing twice.
 *
 * Goes through the real `MediaService.upload()` via a bootstrapped Nest
 * application context — the same architecture `seed-home-media.ts`
 * established, never a filesystem-path/raw-storage-key shortcut.
 *
 * Motor.jpeg (موتور سیکلت) is deliberately NOT referenced anywhere in this
 * script — no real Category/Service exists for it, and inventing one would
 * be fabricating business content this script has no authority to decide.
 * See the audit's §5.
 *
 * Run: `pnpm --filter @biawin/backend seed:default-catalog`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { MediaService } from '../src/modules/media/media.service';

// Same cwd-anchoring rationale as seed-home-media.ts: both `ts-node` (local)
// and the compiled `dist/prisma/` invocation (staging) are always run with
// cwd = `backend/`.
const REFERENCE_DIR = join(process.cwd(), '..', 'docs', 'prototypes', 'services', 'categories');

interface CategoryPopulation {
  categoryName: string;
  slug: string;
}

interface CategoryCardSeed {
  categoryName: string;
  targetServiceTitle: string;
  title: string;
  highlights: [string, string];
  imageFile: string;
  sortOrder: number;
}

interface CardProductSeed {
  serviceTitle: string;
  title: string;
  cardType: 'CREDIT_CARD';
  priceAmount: number;
  valueAmount: number;
  valueDisplayType: 'FIXED' | 'UP_TO';
  benefits: string[];
  validityDays: number;
  // No `imageFile` — a CardProduct's purchase-card image is a distinct,
  // not-yet-sourced content decision (Services Asset Assignment Matrix,
  // Sep 2026); it must never be inherited from the CategoryCard's
  // promotional mockup. Created with `mediaAssetId: null`.
}

/**
 * The 13 usable reference filenames under `docs/prototypes/services/
 * categories/` (Motor.jpeg excluded — never referenced by anything).
 * Every one was visually confirmed to be a CategoryCard-shaped promotional
 * mockup, never a Category-thumbnail- or CardProduct-shaped asset (Services
 * Asset Assignment Matrix, Sep 2026). Used ONLY to detect and idempotently
 * repair a Category or CardProduct row whose `mediaAssetId` still points at
 * one of these files (an earlier pass of this script's own bug) — never to
 * pick or guess a *replacement* image for either tier, since none exists.
 */
const CATEGORY_CARD_ONLY_IMAGES = new Set<string>([
  'Carpet.jpeg',
  'Clothes.jpeg',
  'Cosmetics.jpeg',
  'Dental.jpeg',
  'Digital.jpeg',
  'Gold.jpeg',
  'Home appliances.jpeg',
  'Kalakhab.jpeg',
  'Perfume.jpeg',
  'Shoes.jpeg',
  'Sofa.jpeg',
  'insurance.jpeg',
  'tourism.jpeg',
]);

// ---------------------------------------------------------------------------
// §1 — Categories that already exist (seed.ts) but never had a Landing-page
// `slug`. اتومبیل stays untouched (no reference image maps to it, see the
// audit's §5). Sets `slug` ONLY — a Category's own thumbnail
// (`mediaAssetId`) is a separate, not-yet-sourced content decision (see
// `CATEGORY_CARD_ONLY_IMAGES` above); this array used to also assign one of
// the 13 CategoryCard mockups here, which the Services Asset Assignment
// Matrix (Sep 2026) confirmed was wrong — corrected below, see the repair
// pass in `main()`.
//
// SERVICES-R5.26.2 catalog-gap fix (2nd pass) — this array used to have only
// `سلامت`/`دیجیتال`. The other 7 categories below (`پوشاک` was already fixed
// in the prior pass) LOOKED fully populated on every local database this
// script was ever run against, but that was leftover, undocumented manual
// state from before this script existed — never actually produced by this
// array. On a genuinely fresh database (confirmed: real staging, per its own
// reported `Category "پوشاک" slug=NULL mediaAssetId=NULL` evidence) NONE of
// these 7 ever got their Category-level slug, because nothing in source
// control ever set it. `CATEGORY_CARDS` below referencing e.g. `طلا و جواهر`
// by name still worked (the Category row itself exists via `seed.ts`) —
// only the Category's OWN `slug` field was the gap, a different field than
// any CategoryCard's own `mediaAssetId`. Every mapping below was
// independently re-verified against `seed.ts`'s real committed
// Category/Service arrays before being added (see
// docs/services-r5-26-2-default-catalog-seed-qa-finalization-report.md for
// the full forensic table) — none invented from filenames alone.
// ---------------------------------------------------------------------------
const CATEGORY_POPULATIONS: CategoryPopulation[] = [
  { categoryName: 'سلامت', slug: 'salamat' },
  { categoryName: 'دیجیتال', slug: 'dijital' },
  { categoryName: 'گردشگری', slug: 'gardeshgari' },
  { categoryName: 'بیمه', slug: 'bime' },
  { categoryName: 'مبلمان', slug: 'moblman' },
  { categoryName: 'لوازم خانگی', slug: 'lavazem-khanegi' },
  { categoryName: 'طلا و جواهر', slug: 'tala-javaher' },
  { categoryName: 'زیبایی', slug: 'zibaei' },
  { categoryName: 'خانه و زندگی', slug: 'khane-zendegi' },
  { categoryName: 'پوشاک', slug: 'poushak' },
];

// ---------------------------------------------------------------------------
// §2 — CategoryCards. `فرش`/`پوشاک`/`آرایشی` land under Categories that get
// a SECOND discovery card here (خانه و زندگی also gets `کالای خواب` below;
// پوشاک also gets `کیف و کفش` below; زیبایی also gets `عطر و ادکلن` below) —
// the reference mockups clearly intend two distinct cards per Category in
// these three cases, not a replacement. The other 8 entries below
// (`طلا`/`لوازم خانگی`/`کالای خواب`/`عطر و ادکلن`/`کیف و کفش`/`مبلمان`/
// `بیمه`/`گردشگری`) are each a Category's ONLY/first CategoryCard —
// SERVICES-R5.26.2 (2nd pass) addition, same "never captured in source
// control, only ever existed as local leftover manual state" gap as
// `CATEGORY_POPULATIONS` above; every targetService re-verified against
// `seed.ts`'s real committed source before being added.
//
// `imageFile` here is the ONLY tier these 13 reference mockups are ever
// assigned to (Services Asset Assignment Matrix, Sep 2026) — unchanged by
// the current fix, confirmed correct.
// ---------------------------------------------------------------------------
const CATEGORY_CARDS: CategoryCardSeed[] = [
  {
    categoryName: 'خانه و زندگی',
    targetServiceTitle: 'فرش و کفپوش',
    title: 'فرش',
    highlights: ['خدمات متنوع فرش', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Carpet.jpeg',
    sortOrder: 1,
  },
  {
    // SERVICES-R5.26.2 root-cause fix — `targetServiceTitle` used to say
    // 'خرید پوشاک', which is NOT one of `seed.ts`'s real پوشاک Services
    // (verified directly against its own source array: `مانتو و کت زنانه`,
    // `پوشاک مردانه`, `کفش`, `کیف`, `پوشاک کودک`, `لباس ورزشی` — no
    // "خرید پوشاک" anywhere). That fictional title only ever resolved
    // locally because a Service by that exact name happened to exist there
    // too, as leftover state from the same undocumented, pre-this-script
    // manual bootstrap that also gave پوشاک its slug/hero/first CategoryCard
    // (see the audit's §3) — never present on a database seeded only
    // through the real, committed `seed.ts` + this script. On a genuinely
    // fresh database this Service lookup returned null, silently `continue`d
    // before ever calling `findOrUploadMedia('Clothes.jpeg', ...)` — this is
    // the exact, confirmed reason staging's prototype-image-coverage QA
    // found no MediaAsset for `Clothes.jpeg` while every other entry (whose
    // target Services all really do exist in `seed.ts`) succeeded.
    categoryName: 'پوشاک',
    targetServiceTitle: 'پوشاک مردانه',
    title: 'پوشاک',
    highlights: ['انواع خدمات پوشاک', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Clothes.jpeg',
    sortOrder: 1,
  },
  {
    categoryName: 'زیبایی',
    targetServiceTitle: 'لوازم آرایشی',
    title: 'آرایشی',
    highlights: ['خدمات متنوع آرایشی', 'طرح‌های زیبایی و پشتیبانی'],
    imageFile: 'Cosmetics.jpeg',
    sortOrder: 1,
  },
  {
    categoryName: 'سلامت',
    targetServiceTitle: 'دندانپزشکی',
    title: 'دندان پزشکی',
    highlights: ['خدمات متنوع دندان پزشکی', 'طرح‌های درمان و پشتیبانی'],
    imageFile: 'Dental.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'دیجیتال',
    targetServiceTitle: 'گوشی موبایل',
    title: 'کالای دیجیتال',
    highlights: ['انواع خدمات کالای دیجیتال', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Digital.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'طلا و جواهر',
    targetServiceTitle: 'شمش طلا',
    title: 'طلا',
    highlights: ['انواع خدمات طلا', 'طرح‌های خرید و پشتیبانی طلا'],
    imageFile: 'Gold.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'لوازم خانگی',
    targetServiceTitle: 'یخچال و فریزر',
    title: 'لوازم خانگی',
    highlights: ['انواع خدمات لوازم خانگی', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Home appliances.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'خانه و زندگی',
    targetServiceTitle: 'کالای خواب',
    title: 'کالای خواب',
    highlights: ['خدمات متنوع کالای خواب', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Kalakhab.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'زیبایی',
    targetServiceTitle: 'عطر و ادکلن',
    title: 'عطر و ادکلن',
    highlights: ['خدمات متنوع عطر و ادکلن', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Perfume.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'پوشاک',
    targetServiceTitle: 'کفش',
    title: 'کیف و کفش',
    highlights: ['خدمات متنوع پوشاک', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Shoes.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'مبلمان',
    targetServiceTitle: 'مبل راحتی',
    title: 'مبلمان',
    highlights: ['خدمات متنوع مبلمان', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Sofa.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'بیمه',
    targetServiceTitle: 'بیمه شخص ثالث',
    title: 'بیمه',
    highlights: ['خدمات متنوع بیمه', 'طرح‌های پوشش و پشتیبانی'],
    imageFile: 'insurance.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'گردشگری',
    targetServiceTitle: 'تور کیش',
    title: 'گردشگری',
    highlights: ['خدمات متنوع گردشگری', 'طرح‌های سفر و پشتیبانی'],
    imageFile: 'tourism.jpeg',
    sortOrder: 0,
  },
];

// ---------------------------------------------------------------------------
// §3 — Real, correctly-owned, ACTIVE/PURCHASE/priced CardProducts, one per
// already-populated Category, so R5.26 (and R5.27 later) has more than the
// single pre-existing, mis-owned test row to discover (see the audit's §8).
// `priceAmount` = what the customer pays Biawin; `valueAmount` = the card's
// own displayed worth/ceiling — never conflated (SERVICES-R5.19 rule).
//
// Created with NO image (`mediaAssetId: null`) — this array used to reuse
// its sibling CategoryCard's `imageFile` here too, which the Services Asset
// Assignment Matrix (Sep 2026) confirmed was wrong (that mockup belongs to
// the CategoryCard alone). No CardProduct-specific asset exists yet; never
// inventing one is preferred over reusing a mismatched one — see the repair
// pass in `main()` for existing rows already carrying the wrong image.
// ---------------------------------------------------------------------------
const CARD_PRODUCTS: CardProductSeed[] = [
  {
    serviceTitle: 'کفش',
    title: 'کارت خرید کفش ۲۰ میلیونی',
    cardType: 'CREDIT_CARD',
    priceAmount: 10_000_000,
    valueAmount: 20_000_000,
    valueDisplayType: 'FIXED',
    benefits: ['اعتبار خرید کفش از فروشگاه‌های منتخب', 'قابل استفاده تا سقف مبلغ کارت'],
    validityDays: 365,
  },
  {
    serviceTitle: 'شمش طلا',
    title: 'کارت اعتباری خرید شمش طلا',
    cardType: 'CREDIT_CARD',
    priceAmount: 25_000_000,
    valueAmount: 50_000_000,
    valueDisplayType: 'UP_TO',
    benefits: ['اعتبار خرید شمش طلا با وزن‌های متنوع', 'تحویل امن و بسته‌بندی استاندارد'],
    validityDays: 180,
  },
  {
    serviceTitle: 'تور کیش',
    title: 'کارت اعتباری تور کیش',
    cardType: 'CREDIT_CARD',
    priceAmount: 5_000_000,
    valueAmount: 15_000_000,
    valueDisplayType: 'UP_TO',
    benefits: ['اعتبار رزرو تور کیش', 'قابل استفاده برای اقامت و خدمات سفر'],
    validityDays: 270,
  },
  {
    serviceTitle: 'یخچال و فریزر',
    title: 'کارت اعتباری خرید لوازم خانگی',
    cardType: 'CREDIT_CARD',
    priceAmount: 8_000_000,
    valueAmount: 25_000_000,
    valueDisplayType: 'UP_TO',
    benefits: ['اعتبار خرید یخچال و فریزر از برندهای معتبر', 'قابل ترکیب با طرح‌های اقساطی'],
    validityDays: 365,
  },
  {
    // SERVICES-R5.26.2 catalog-gap fix — this section's own comment above
    // already said "one per already-populated Category", but بیمه (fully
    // populated since R5.26.1 — real slug, real Category hero, real
    // CategoryCard) never actually got its own CardProduct. Root cause of
    // the "found 4, need >=5" QA gap: this array only ever had 4 entries;
    // the 5th CardProduct some local dev databases show
    // (`کارت اعتباری بیمه شخص ثالث`, id=4381a567..., wrongly owned by
    // Service "لوازم نوزاد"/Category "کودک و نوجوان", `createdAt` two full
    // days before this script's own rows) was never created by any seed —
    // leftover manual test data from earlier R5.19/R5.26 QA work, which is
    // exactly why it only ever existed on that one local database and
    // never on staging. This row is a genuine, correctly-owned addition
    // (the real `بیمه شخص ثالث` Service under `بیمه`) — it does not
    // replace, touch, or reference that old stray row in any way.
    serviceTitle: 'بیمه شخص ثالث',
    title: 'کارت بیمه شخص ثالث',
    cardType: 'CREDIT_CARD',
    priceAmount: 3_000_000,
    valueAmount: 10_000_000,
    valueDisplayType: 'UP_TO',
    benefits: ['اعتبار خرید بیمه شخص ثالث خودرو', 'قابل استفاده نزد نمایندگی‌های منتخب بیمه'],
    validityDays: 365,
  },
];

async function findOrUploadMedia(
  mediaService: MediaService,
  prisma: PrismaService,
  fileName: string,
  adminId: string,
): Promise<string> {
  const existing = await prisma.mediaAsset.findFirst({ where: { fileName } });
  if (existing) {
    console.log(`  [media] already uploaded: ${fileName} -> ${existing.id}`);
    return existing.id;
  }
  const buffer = readFileSync(join(REFERENCE_DIR, fileName));
  const asset = await mediaService.upload(
    { originalname: fileName, mimetype: 'image/jpeg', size: buffer.length, buffer },
    { altText: fileName.replace(/\.jpeg$/i, '') },
    adminId,
    {},
  );
  console.log(`  [media] uploaded: ${fileName} -> ${asset.id}`);
  return asset.id;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const mediaService = app.get(MediaService);

  const admin = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.error('No SUPER_ADMIN found — run `prisma db seed` first.');
    await app.close();
    process.exit(1);
  }

  console.log('Populating Category slug...');
  for (const pop of CATEGORY_POPULATIONS) {
    const category = await prisma.category.findFirst({ where: { name: pop.categoryName } });
    if (!category) {
      console.warn(`  [skip] Category "${pop.categoryName}" not found — run seed.ts first.`);
      continue;
    }
    if (category.slug) {
      console.log(`  [skip, slug already set] ${pop.categoryName}`);
      continue;
    }
    await prisma.category.update({
      where: { id: category.id },
      data: { slug: pop.slug, updatedBy: admin.id },
    });
    console.log(`  [populated] ${pop.categoryName} -> slug=${pop.slug}`);
  }

  console.log('\nRepairing Category thumbnails incorrectly assigned a CategoryCard-only image...');
  // SERVICES ASSET ASSIGNMENT MATRIX (Sep 2026) — an earlier pass of this
  // script assigned one of the 13 CategoryCard mockups to `Category.
  // mediaAssetId` too. This clears it — and ONLY it: a Category's
  // `mediaAssetId` is nulled IF AND ONLY IF it currently points at a
  // filename in `CATEGORY_CARD_ONLY_IMAGES`. A Category whose thumbnail was
  // since deliberately set to something else by an Admin (a real, distinct
  // asset) is never touched — this is a targeted repair of one specific
  // known-wrong value, never a blanket reset. Idempotent: a Category
  // already null, or already pointing at a genuine distinct asset, is a
  // no-op every subsequent run. No MediaAsset row or file is ever deleted —
  // only the Category's *reference* to it is cleared.
  const categoriesWithMedia = await prisma.category.findMany({
    where: { mediaAssetId: { not: null } },
    include: { mediaAsset: true },
  });
  for (const category of categoriesWithMedia) {
    if (category.mediaAsset && CATEGORY_CARD_ONLY_IMAGES.has(category.mediaAsset.fileName)) {
      await prisma.category.update({
        where: { id: category.id },
        data: { mediaAssetId: null, updatedBy: admin.id },
      });
      console.log(`  [repaired] ${category.name} thumbnail cleared (was ${category.mediaAsset.fileName}, a CategoryCard-only image)`);
    }
  }

  console.log('\nCreating CategoryCards...');
  for (const cardSeed of CATEGORY_CARDS) {
    const category = await prisma.category.findFirst({ where: { name: cardSeed.categoryName } });
    if (!category) {
      console.warn(`  [skip] Category "${cardSeed.categoryName}" not found.`);
      continue;
    }
    const targetService = await prisma.service.findFirst({
      where: { categoryId: category.id, title: cardSeed.targetServiceTitle },
    });
    if (!targetService) {
      console.warn(
        `  [skip] Service "${cardSeed.targetServiceTitle}" not found under "${cardSeed.categoryName}".`,
      );
      continue;
    }
    const existing = await prisma.categoryCard.findFirst({
      where: { categoryId: category.id, title: cardSeed.title },
    });
    if (existing) {
      if (!existing.mediaAssetId) {
        // SERVICES-R5.26.2 — same backfill-if-missing discipline as the
        // CardProduct section below: an existing row is otherwise left
        // untouched (never overwrites Admin-managed content), but a real
        // gap in the one field this script itself owns (its own default
        // image) is still worth healing — this exact field is what the
        // authenticated QA's "every active CategoryCard's image resolves"
        // check asserts on every row.
        const mediaAssetId = await findOrUploadMedia(mediaService, prisma, cardSeed.imageFile, admin.id);
        await prisma.categoryCard.update({
          where: { id: existing.id },
          data: { mediaAssetId, updatedBy: admin.id },
        });
        console.log(`  [backfilled image] ${cardSeed.categoryName} / ${cardSeed.title}`);
      } else {
        console.log(`  [skip, already exists] ${cardSeed.categoryName} / ${cardSeed.title}`);
      }
      continue;
    }
    const mediaAssetId = await findOrUploadMedia(mediaService, prisma, cardSeed.imageFile, admin.id);
    await prisma.categoryCard.create({
      data: {
        categoryId: category.id,
        targetServiceId: targetService.id,
        title: cardSeed.title,
        mediaAssetId,
        highlights: cardSeed.highlights,
        sortOrder: cardSeed.sortOrder,
        active: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`  [created] ${cardSeed.categoryName} / ${cardSeed.title} -> ${cardSeed.targetServiceTitle}`);
  }

  console.log('\nCreating default purchasable CardProducts (no image — see the class doc comment)...');
  for (const cp of CARD_PRODUCTS) {
    const service = await prisma.service.findFirst({ where: { title: cp.serviceTitle } });
    if (!service) {
      console.warn(`  [skip] Service "${cp.serviceTitle}" not found.`);
      continue;
    }
    const existing = await prisma.cardProduct.findFirst({
      where: { serviceId: service.id, title: cp.title },
      include: { mediaAsset: true },
    });
    if (existing) {
      // SERVICES ASSET ASSIGNMENT MATRIX repair (Sep 2026) — this row was
      // previously created (or backfilled) with its sibling CategoryCard's
      // mockup. Clears it IF AND ONLY IF it's still exactly that known-wrong
      // value — never invents/backfills a replacement (no CardProduct-
      // specific asset exists yet), and never touches a row already null or
      // already pointing at a genuine distinct asset. Scoped EXCLUSIVELY to
      // the 5 CardProducts this script's own CARD_PRODUCTS array
      // creates/owns (matched by the same serviceId+title lookup as
      // always) — the separate, pre-existing, unrelated stray CardProduct
      // row that happens to reuse the same insurance.jpeg (see the Services
      // Asset Assignment Matrix report §5/§9) is deliberately never reached
      // by this loop and is left completely untouched.
      if (existing.mediaAsset && CATEGORY_CARD_ONLY_IMAGES.has(existing.mediaAsset.fileName)) {
        await prisma.cardProduct.update({
          where: { id: existing.id },
          data: { mediaAssetId: null, updatedBy: admin.id },
        });
        console.log(`  [repaired] ${cp.serviceTitle} / ${cp.title} image cleared (was ${existing.mediaAsset.fileName}, a CategoryCard-only image)`);
      } else {
        console.log(`  [skip, already exists] ${cp.serviceTitle} / ${cp.title}`);
      }
      continue;
    }
    await prisma.cardProduct.create({
      data: {
        serviceId: service.id,
        title: cp.title,
        cardType: cp.cardType,
        journeyType: 'PURCHASE',
        priceAmount: cp.priceAmount,
        valueAmount: cp.valueAmount,
        valueDisplayType: cp.valueDisplayType,
        benefits: cp.benefits,
        validityDays: cp.validityDays,
        status: 'ACTIVE',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`  [created] ${cp.serviceTitle} / ${cp.title}`);
  }

  // The generic "backfill any ACTIVE/PURCHASE CardProduct still missing an
  // image with a thematic CategoryCard mockup" pass that used to run here
  // (SERVICES-R5.26.2) has been REMOVED — it was the exact CardProduct-tier
  // instance of the mis-assignment the Services Asset Assignment Matrix
  // (Sep 2026) identified, and it is also the mechanism that gave the
  // pre-existing stray row (`کارت اعتباری بیمه شخص ثالث`, Service
  // `لوازم نوزاد`) its current `insurance.jpeg`. Removing it stops the
  // pattern from being reproduced or spread to any future CardProduct; it
  // does NOT touch that stray row's already-set value — this script has no
  // authority over data it didn't create, and that row is intentionally
  // left exactly as it is (a separate, unrelated, already-reported
  // data-quality issue).

  console.log('\nDone.');
  await app.close();
  // Same MinIO-keep-alive-socket rationale as seed-home-media.ts.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
