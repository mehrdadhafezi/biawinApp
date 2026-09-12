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
 *   1. sets `slug`/`mediaAssetId` on the few Categories that exist but were
 *      never visually finished, and
 *   2. adds the CategoryCard rows + a small set of real, correctly-owned,
 *      ACTIVE/PURCHASE/priced CardProducts the reference mockups call for.
 *
 * Idempotent throughout, same discipline as `seed.ts`/`seed-home-media.ts`:
 * a Category whose `slug`/`mediaAssetId` is already set is left untouched
 * (never overwrites Admin-managed content); a CategoryCard is matched by
 * `categoryId`+`title`; a CardProduct by `serviceId`+`title`; a MediaAsset
 * upload is skipped (and the existing row reused) whenever one with the
 * exact same `fileName` already exists — re-running this script after a
 * partial run (or after this exact reference set was already uploaded by
 * hand, as happened once in this environment — see the audit's §3) creates
 * nothing twice.
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
  imageFile: string;
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
  /** Reuses the same category-relevant reference photo as its CategoryCard/Category — real, resolvable, never left null. */
  imageFile: string;
}

// ---------------------------------------------------------------------------
// §1 — Categories that already exist (seed.ts) but were never visually
// finished. سلامت/دیجیتال only — اتومبیل stays untouched (no reference image
// maps to it, see the audit's §5).
// ---------------------------------------------------------------------------
const CATEGORY_POPULATIONS: CategoryPopulation[] = [
  { categoryName: 'سلامت', slug: 'salamat', imageFile: 'Dental.jpeg' },
  { categoryName: 'دیجیتال', slug: 'dijital', imageFile: 'Digital.jpeg' },
];

// ---------------------------------------------------------------------------
// §2 — New CategoryCards. Two land under already-populated Categories as a
// genuine SECOND discovery card (خانه و زندگی already has "کالای خواب";
// پوشاک already has "کیف و کفش"; زیبایی already has "عطر و ادکلن") — the
// reference mockups clearly intend two distinct cards per Category in these
// cases, not a replacement.
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
    categoryName: 'پوشاک',
    targetServiceTitle: 'خرید پوشاک',
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
];

// ---------------------------------------------------------------------------
// §3 — Real, correctly-owned, ACTIVE/PURCHASE/priced CardProducts, one per
// already-populated Category, so R5.26 (and R5.27 later) has more than the
// single pre-existing, mis-owned test row to discover (see the audit's §8).
// `priceAmount` = what the customer pays Biawin; `valueAmount` = the card's
// own displayed worth/ceiling — never conflated (SERVICES-R5.19 rule).
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
    imageFile: 'Shoes.jpeg',
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
    imageFile: 'Gold.jpeg',
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
    imageFile: 'tourism.jpeg',
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
    imageFile: 'Home appliances.jpeg',
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

  console.log('Populating Category slug/media...');
  for (const pop of CATEGORY_POPULATIONS) {
    const category = await prisma.category.findFirst({ where: { name: pop.categoryName } });
    if (!category) {
      console.warn(`  [skip] Category "${pop.categoryName}" not found — run seed.ts first.`);
      continue;
    }
    if (category.slug && category.mediaAssetId) {
      console.log(`  [skip, already populated] ${pop.categoryName}`);
      continue;
    }
    const mediaAssetId = await findOrUploadMedia(mediaService, prisma, pop.imageFile, admin.id);
    await prisma.category.update({
      where: { id: category.id },
      data: {
        slug: category.slug ?? pop.slug,
        mediaAssetId: category.mediaAssetId ?? mediaAssetId,
        updatedBy: admin.id,
      },
    });
    console.log(`  [populated] ${pop.categoryName} -> slug=${pop.slug}`);
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

  console.log('\nCreating default purchasable CardProducts...');
  for (const cp of CARD_PRODUCTS) {
    const service = await prisma.service.findFirst({ where: { title: cp.serviceTitle } });
    if (!service) {
      console.warn(`  [skip] Service "${cp.serviceTitle}" not found.`);
      continue;
    }
    const existing = await prisma.cardProduct.findFirst({
      where: { serviceId: service.id, title: cp.title },
    });
    const mediaAssetId = await findOrUploadMedia(mediaService, prisma, cp.imageFile, admin.id);
    if (existing) {
      if (!existing.mediaAssetId) {
        await prisma.cardProduct.update({
          where: { id: existing.id },
          data: { mediaAssetId, updatedBy: admin.id },
        });
        console.log(`  [backfilled image] ${cp.serviceTitle} / ${cp.title}`);
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
        mediaAssetId,
        benefits: cp.benefits,
        validityDays: cp.validityDays,
        status: 'ACTIVE',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`  [created] ${cp.serviceTitle} / ${cp.title}`);
  }

  console.log('\nBackfilling images for any other ACTIVE/PURCHASE CardProduct still missing one...');
  // SERVICES-R5.26.2 — generalized, idempotent backfill: catches ANY
  // real, publicly-purchasable CardProduct left with `mediaAssetId: null`,
  // not just the ones this script itself created above. Found via this
  // stage's own data-integrity pass: one pre-existing row from earlier
  // R5.19/R5.26 QA work (`کارت اعتباری بیمه شخص ثالث`) was real,
  // ACTIVE/PURCHASE/priced/valued, but had never been given an image —
  // left alone by R5.26.1 as "not this stage's data" (see its own audit
  // §8), but this stage's explicit job is to finalize the catalog into a
  // fully healthy, deployable state, so every real purchasable card gets a
  // real image now. Never touches title/service/price/value — additive
  // only, same "backfill what's missing, never overwrite what's set"
  // discipline as every other write in this script. Matched by a keyword
  // in the title, not hardcoded to one id — reusable if another such gap
  // is ever found.
  const stillMissingImage = await prisma.cardProduct.findMany({
    where: { status: 'ACTIVE', journeyType: 'PURCHASE', mediaAssetId: null },
  });
  for (const cp of stillMissingImage) {
    const fallbackImage = /بیمه/.test(cp.title) ? 'insurance.jpeg' : null;
    if (!fallbackImage) {
      console.log(`  [skip, no thematic reference image known] ${cp.title}`);
      continue;
    }
    const mediaAssetId = await findOrUploadMedia(mediaService, prisma, fallbackImage, admin.id);
    await prisma.cardProduct.update({ where: { id: cp.id }, data: { mediaAssetId, updatedBy: admin.id } });
    console.log(`  [backfilled image] ${cp.title} -> ${fallbackImage}`);
  }

  console.log('\nDone.');
  await app.close();
  // Same MinIO-keep-alive-socket rationale as seed-home-media.ts.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
