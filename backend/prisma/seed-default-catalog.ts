/**
 * SERVICES-R5.26.1 — populates the real default Services catalog using the
 * reference mockups under `docs/prototypes/services/categories/` (moved
 * there from the repository root — see docs/services-r5-26-1-default-
 * catalog-audit.md §2/§9; that directory is reference-only, never read by
 * runtime code — every image this script touches ends up as a real
 * `MediaAsset` row, resolved the normal way).
 *
 * SERVICES CATALOG RESET (business clarification, Sep 2026) — the
 * directory is now the explicit single source of truth for the Services
 * catalog's top-level categories: ALL 14 files (Motor.jpeg included) map
 * 1:1 to a Category, each Category's own thumbnail (`mediaAssetId`) AND
 * its CategoryCard's promotional image are INTENTIONALLY the same file
 * (confirmed business decision — supersedes the prior "Category ≠
 * CategoryCard image" separation this script briefly enforced). Any
 * pre-existing Category with no corresponding prototype image is hidden
 * (`active: false`, never deleted — see `LEGACY_CATEGORIES_TO_HIDE`) so
 * the public catalog shows exactly the 14 prototype-backed categories.
 * `CardProduct.mediaAssetId` is UNCHANGED by this reset — it still must
 * never inherit a CategoryCard's promotional mockup (see
 * `CATEGORY_CARD_ONLY_IMAGES`'s own doc comment).
 *
 * This script never creates a Category or Service on its own initiative
 * beyond what the 14-image reset explicitly calls for — the other 108
 * real Services (under both prototype-backed and hidden categories) are
 * still exclusively `seed.ts`'s responsibility.
 *
 * Idempotent throughout, same discipline as `seed.ts`/`seed-home-media.ts`:
 * a Category whose `slug`+`mediaAssetId` are already set is left untouched
 * (never overwrites Admin-managed content); a CategoryCard is matched by
 * `categoryId`+`title`; a CardProduct by `serviceId`+`title`; a MediaAsset
 * upload is skipped (and the existing row reused) whenever one with the
 * exact same `fileName` already exists — re-running this script after a
 * partial run creates nothing twice.
 *
 * Goes through the real `MediaService.upload()` via a bootstrapped Nest
 * application context — the same architecture `seed-home-media.ts`
 * established, never a filesystem-path/raw-storage-key shortcut.
 *
 * R5.26.2 Legacy CardProduct Cleanup (Sep 2026) — also deactivates known
 * legacy/non-canonical `CardProduct` rows (`status: INACTIVE`, never
 * deleted) — see `LEGACY_CARD_PRODUCTS_TO_DEACTIVATE`'s own doc comment.
 * Runs on every deploy (`deploy/staging/deploy.sh`'s `DEFAULT_CATALOG_CMD`,
 * after `seed.ts`), so this is also where any such staging state belongs —
 * never a manual DB edit.
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

interface NewCategorySeed {
  categoryName: string;
  slug: string;
  description: string;
  keywords: string[];
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
  // No `imageFile` — a CardProduct's purchase-card image is a distinct,
  // not-yet-sourced content decision (Services Asset Assignment Matrix,
  // Sep 2026); it must never be inherited from the CategoryCard's
  // promotional mockup, even after the Category-tier reuse was
  // reinstated by the Services Catalog Reset. Created with
  // `mediaAssetId: null`.
}

/**
 * The 13 CategoryCard-shaped promotional mockups (Motor.jpeg excluded —
 * it has no CardProduct/purchasable Service). Used ONLY to detect and
 * idempotently repair a CardProduct row whose `mediaAssetId` still points
 * at one of these files — the Services Catalog Reset reinstated their use
 * at the Category tier, but never at the CardProduct tier; that boundary
 * is unchanged. Never used to pick or guess a CardProduct's replacement
 * image, since none exists yet.
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
// §0 — Services Catalog Reset: every pre-existing Category with no
// corresponding prototype image is hidden (`active: false`), never
// deleted — their Services/CardProducts/Orders are completely untouched,
// only Category-tier visibility changes. `useServiceCatalog()`
// (apps/web/src/components/services/useServiceCatalog.ts) already filters
// `categories.filter(c => c.active)` client-side, so this alone removes
// them from `/services` and from `/services/[categoryId]` (an inactive
// category's own id no longer resolves in that filtered list) — no
// backend/API change was needed or made. Only clears `active` when it is
// currently `true`, so a category an Admin has already hidden (or
// un-hidden) is never fought over. A name not found in the current
// database (e.g. a category that exists on one environment but not
// another) is logged and skipped, never fabricated.
// ---------------------------------------------------------------------------
const LEGACY_CATEGORIES_TO_HIDE: string[] = [
  'آموزش',
  'اتومبیل',
  'باشگاه و ورزش',
  'تستی',
  'خدمات سازمانی',
  'خرید روزمره',
  'مالی و اعتباری',
  'موبایل و لپ‌تاپ',
  'کارت هدیه',
  'کودک و نوجوان',
];

// ---------------------------------------------------------------------------
// §0b — R5.26.2 Legacy CardProduct Cleanup audit (Sep 2026): a pre-existing,
// non-canonical CardProduct ("کارت اعتباری بیمه شخص ثالث", under Service
// "لوازم نوزاد" / Category "کودک و نوجوان" — one of the categories
// `LEGACY_CATEGORIES_TO_HIDE` above already hides) was created by hand
// through the real Admin API on 2026-09-09, predates this script's own
// canonical catalog entirely, and is NOT one of the 5 real `CARD_PRODUCTS`
// below (see docs/services-r5-26-2-default-catalog-seed-qa-finalization-
// report.md §10.2 — the genuine 5th canonical entry, "کارت بیمه شخص ثالث"
// under Service "بیمه شخص ثالث", is a DIFFERENT row and was added
// specifically so this stray one would never need to be reused or renamed).
//
// The Cleanup audit found 4 real, harmless `pending` Orders referencing it
// (zero payment/fulfillment side effect ever existed), and
// `Order.cardProductId` is `onDelete: Restrict` — so it can never be safely
// hard-deleted while those Orders exist. The correct, reversible fix is
// `status: INACTIVE`, which removes it from every customer-facing/
// purchasable surface without touching those Orders.
//
// Matched by Category+Service+title, never by a hardcoded id — a raw UUID
// is specific to one local database and would never generalize to staging
// or any other environment (Prisma ids aren't reproducible across DBs).
// Same "if it exists" contract as `LEGACY_CATEGORIES_TO_HIDE`: a row not
// found here (this environment never had it, or it was already handled) is
// logged and skipped, never fabricated, never re-created, and never has any
// field but `status` touched.
// ---------------------------------------------------------------------------
const LEGACY_CARD_PRODUCTS_TO_DEACTIVATE: { categoryName: string; serviceTitle: string; title: string }[] = [
  { categoryName: 'کودک و نوجوان', serviceTitle: 'لوازم نوزاد', title: 'کارت اعتباری بیمه شخص ثالث' },
];

// ---------------------------------------------------------------------------
// §1 — Categories that already exist (seed.ts) but were never visually
// finished. Services Catalog Reset (Sep 2026): `mediaAssetId` is
// intentionally the SAME file as the Category's own CategoryCard below —
// a confirmed business decision, not a reversion to an unaudited state.
// اتومبیل is deliberately absent (hidden above, no prototype image maps
// to it).
// ---------------------------------------------------------------------------
const CATEGORY_POPULATIONS: CategoryPopulation[] = [
  { categoryName: 'سلامت', slug: 'salamat', imageFile: 'Dental.jpeg' },
  { categoryName: 'دیجیتال', slug: 'dijital', imageFile: 'Digital.jpeg' },
  { categoryName: 'گردشگری', slug: 'gardeshgari', imageFile: 'tourism.jpeg' },
  { categoryName: 'بیمه', slug: 'bime', imageFile: 'insurance.jpeg' },
  { categoryName: 'مبلمان', slug: 'moblman', imageFile: 'Sofa.jpeg' },
  { categoryName: 'لوازم خانگی', slug: 'lavazem-khanegi', imageFile: 'Home appliances.jpeg' },
  { categoryName: 'طلا و جواهر', slug: 'tala-javaher', imageFile: 'Gold.jpeg' },
  { categoryName: 'زیبایی', slug: 'zibaei', imageFile: 'Cosmetics.jpeg' },
  { categoryName: 'خانه و زندگی', slug: 'khane-zendegi', imageFile: 'Kalakhab.jpeg' },
  { categoryName: 'پوشاک', slug: 'poushak', imageFile: 'Clothes.jpeg' },
];

// ---------------------------------------------------------------------------
// §1b — Services Catalog Reset (Sep 2026): 4 prototype images (Carpet,
// Perfume, Shoes, Motor) have NO existing 1:1 Category today — each
// shares a Category with a sibling image (فرش/کالای خواب both under
// خانه و زندگی; عطر و ادکلن/آرایشی both under زیبایی; کیف و کفش/پوشاک both
// under پوشاک) or has no Category/Service at all (Motor). To reach the
// confirmed "14 images = 14 categories" model, these 4 are created here
// (create-if-missing, idempotent by `name`) — genuinely new Category
// rows, not fabricated from nothing: their name/description/keywords are
// each taken directly from the prototype image's own baked-in title
// (visually confirmed, see the Services Asset Assignment Matrix) or the
// existing CategoryCard/CardProduct copy already live for that exact
// content. Once created, never overwritten (matches every other
// "populate once" write in this script).
// ---------------------------------------------------------------------------
const NEW_CATEGORIES: NewCategorySeed[] = [
  {
    categoryName: 'فرش',
    slug: 'farsh',
    description: 'خدمات متنوع فرش',
    keywords: ['فرش', 'خانه'],
    imageFile: 'Carpet.jpeg',
  },
  {
    categoryName: 'عطر و ادکلن',
    slug: 'atr-adkolan',
    description: 'خدمات متنوع عطر و ادکلن',
    keywords: ['عطر', 'ادکلن', 'زیبایی'],
    imageFile: 'Perfume.jpeg',
  },
  {
    categoryName: 'کیف و کفش',
    slug: 'kif-kafsh',
    description: 'انتخابی برای هر سلیقه',
    keywords: ['کیف', 'کفش', 'پوشاک'],
    imageFile: 'Shoes.jpeg',
  },
  {
    categoryName: 'موتور سیکلت',
    slug: 'motor-siklet',
    description: 'خدمات و اطلاعات موتور سیکلت',
    keywords: ['موتور سیکلت', 'موتور'],
    imageFile: 'Motor.jpeg',
  },
];

// ---------------------------------------------------------------------------
// §1c — Services Catalog Reset (Sep 2026): the 3 real, pre-existing
// Services this reset re-homes onto their own new prototype-backed
// Category (see `NEW_CATEGORIES` above), so each of the 4-way-split
// prototype pairs ends up with its target Service under the SAME
// Category as its own CategoryCard — matching every other CategoryCard's
// invariant ("a CategoryCard only ever points at a Service in its own
// Category", schema.prisma's own CategoryCard doc comment). This moves
// the Service ONLY (`categoryId`); its id, title, price fields, and any
// CardProduct/Order referencing it (by `serviceId`, never by Category)
// are completely unaffected — "کارت خرید کفش ۲۰ میلیونی"'s purchase flow
// keeps working unchanged. Idempotent: a Service already under its
// target Category is left alone.
// ---------------------------------------------------------------------------
const SERVICE_REPARENTING: { serviceTitle: string; fromCategoryName: string; toCategoryName: string }[] = [
  { serviceTitle: 'فرش و کفپوش', fromCategoryName: 'خانه و زندگی', toCategoryName: 'فرش' },
  { serviceTitle: 'عطر و ادکلن', fromCategoryName: 'زیبایی', toCategoryName: 'عطر و ادکلن' },
  { serviceTitle: 'کفش', fromCategoryName: 'پوشاک', toCategoryName: 'کیف و کفش' },
];

// ---------------------------------------------------------------------------
// §1d — Services Catalog Reset (Sep 2026): re-homes the 3 CategoryCard
// rows that move alongside their Service above, onto the same new
// Category — the row itself (id, mediaAssetId, highlights, createdAt) is
// updated in place, never duplicated; `sortOrder` is normalized to 0
// since each becomes the sole card in its own new Category (matching
// every other single-card Category's convention). Idempotent: a
// CategoryCard already under its target Category is left alone (the
// `CATEGORY_CARDS` create/backfill loop below then correctly treats it
// as "already exists").
// ---------------------------------------------------------------------------
const CATEGORY_CARD_REPARENTING: { title: string; fromCategoryName: string; toCategoryName: string }[] = [
  { title: 'فرش', fromCategoryName: 'خانه و زندگی', toCategoryName: 'فرش' },
  { title: 'عطر و ادکلن', fromCategoryName: 'زیبایی', toCategoryName: 'عطر و ادکلن' },
  { title: 'کیف و کفش', fromCategoryName: 'پوشاک', toCategoryName: 'کیف و کفش' },
];

// ---------------------------------------------------------------------------
// §1e — Services Catalog Reset (Sep 2026): Motor.jpeg has no real Service
// anywhere in `seed.ts` (confirmed, repeatedly, across every prior audit
// this engagement ran) — this is the one genuinely NEW Service this
// script creates, a minimal, honestly-labeled placeholder matching the
// image's own baked-in title, with NO invented price/value/purchase
// method (`availableMethods: []`) and NO CardProduct — see Part 7's own
// "NO PURCHASABLE PRODUCT CURRENTLY EXISTS" rule, honored by simply never
// creating one. Idempotent: created once (matched by categoryId+title),
// never re-created or overwritten.
// ---------------------------------------------------------------------------
const MOTOR_SERVICE = {
  categoryName: 'موتور سیکلت',
  title: 'موتور سیکلت',
  groupLabel: 'موتور سیکلت',
  subtitle: 'خدمات و اطلاعات موتور سیکلت',
  badge: '',
  icon: '🏍️',
};

// ---------------------------------------------------------------------------
// §2 — CategoryCards. Services Catalog Reset (Sep 2026): `فرش`/`عطر و
// ادکلن`/`کیف و کفش` now target their OWN new Category (see
// `CATEGORY_CARD_REPARENTING` above) instead of sharing خانه و زندگی/
// زیبایی/پوشاک — everything else about these 3 entries (title,
// highlights, imageFile, targetServiceTitle) is unchanged. `موتور سیکلت`
// is a new entry, added for the same reason. `imageFile` here is the
// tier these 14 reference mockups are always assigned to, regardless of
// whether the Category tier also reuses the same file.
// ---------------------------------------------------------------------------
const CATEGORY_CARDS: CategoryCardSeed[] = [
  {
    categoryName: 'فرش',
    targetServiceTitle: 'فرش و کفپوش',
    title: 'فرش',
    highlights: ['خدمات متنوع فرش', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Carpet.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'پوشاک',
    targetServiceTitle: 'پوشاک مردانه',
    title: 'پوشاک',
    highlights: ['انواع خدمات پوشاک', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Clothes.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'زیبایی',
    targetServiceTitle: 'لوازم آرایشی',
    title: 'آرایشی',
    highlights: ['خدمات متنوع آرایشی', 'طرح‌های زیبایی و پشتیبانی'],
    imageFile: 'Cosmetics.jpeg',
    sortOrder: 0,
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
    categoryName: 'عطر و ادکلن',
    targetServiceTitle: 'عطر و ادکلن',
    title: 'عطر و ادکلن',
    highlights: ['خدمات متنوع عطر و ادکلن', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Perfume.jpeg',
    sortOrder: 0,
  },
  {
    categoryName: 'کیف و کفش',
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
  {
    categoryName: 'موتور سیکلت',
    targetServiceTitle: 'موتور سیکلت',
    title: 'موتور سیکلت',
    highlights: ['خدمات متنوع موتور سیکلت', 'طرح‌های خرید و پشتیبانی'],
    imageFile: 'Motor.jpeg',
    sortOrder: 0,
  },
];

// ---------------------------------------------------------------------------
// §3 — Real, correctly-owned, ACTIVE/PURCHASE/priced CardProducts.
// `priceAmount` = what the customer pays Biawin; `valueAmount` = the
// card's own displayed worth/ceiling — never conflated (SERVICES-R5.19
// rule). Created with NO image (`mediaAssetId: null`) — see
// `CardProductSeed`'s own doc comment; unchanged by the Services Catalog
// Reset. No CardProduct is added for موتور سیکلت — per Part 7's explicit
// rule, no price/value/product is invented where none exists.
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

  console.log('Hiding legacy (non-prototype-backed) categories...');
  for (const name of LEGACY_CATEGORIES_TO_HIDE) {
    const category = await prisma.category.findFirst({ where: { name } });
    if (!category) {
      console.log(`  [skip, not found] ${name}`);
      continue;
    }
    if (!category.active) {
      console.log(`  [skip, already hidden] ${name}`);
      continue;
    }
    await prisma.category.update({ where: { id: category.id }, data: { active: false, updatedBy: admin.id } });
    console.log(`  [hidden] ${name}`);
  }

  console.log('\nPopulating Category slug/media (existing categories)...');
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

  console.log('\nCreating new prototype-backed categories...');
  for (const cat of NEW_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name: cat.categoryName } });
    if (existing) {
      console.log(`  [skip, already exists] ${cat.categoryName}`);
      continue;
    }
    const mediaAssetId = await findOrUploadMedia(mediaService, prisma, cat.imageFile, admin.id);
    await prisma.category.create({
      data: {
        name: cat.categoryName,
        description: cat.description,
        keywords: cat.keywords,
        slug: cat.slug,
        mediaAssetId,
        active: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    console.log(`  [created] ${cat.categoryName} -> slug=${cat.slug}`);
  }

  console.log('\nCreating the موتور سیکلت Service (no real Service pre-exists for it)...');
  {
    const motorCategory = await prisma.category.findFirst({ where: { name: MOTOR_SERVICE.categoryName } });
    if (!motorCategory) {
      console.warn(`  [skip] Category "${MOTOR_SERVICE.categoryName}" not found.`);
    } else {
      const existingService = await prisma.service.findFirst({
        where: { categoryId: motorCategory.id, title: MOTOR_SERVICE.title },
      });
      if (existingService) {
        console.log(`  [skip, already exists] ${MOTOR_SERVICE.title}`);
      } else {
        await prisma.service.create({
          data: {
            categoryId: motorCategory.id,
            title: MOTOR_SERVICE.title,
            groupLabel: MOTOR_SERVICE.groupLabel,
            subtitle: MOTOR_SERVICE.subtitle,
            badge: MOTOR_SERVICE.badge,
            icon: MOTOR_SERVICE.icon,
            availableMethods: [],
            benefits: [],
            galleryKeys: [],
            faq: [],
            tags: [],
            active: true,
            createdBy: admin.id,
            updatedBy: admin.id,
          },
        });
        console.log(`  [created] ${MOTOR_SERVICE.title}`);
      }
    }
  }

  console.log('\nRe-parenting Services onto their own new prototype-backed Category...');
  for (const move of SERVICE_REPARENTING) {
    const fromCategory = await prisma.category.findFirst({ where: { name: move.fromCategoryName } });
    const toCategory = await prisma.category.findFirst({ where: { name: move.toCategoryName } });
    if (!fromCategory || !toCategory) {
      console.warn(`  [skip] Category "${move.fromCategoryName}" or "${move.toCategoryName}" not found.`);
      continue;
    }
    const service = await prisma.service.findFirst({ where: { title: move.serviceTitle, categoryId: toCategory.id } });
    if (service) {
      console.log(`  [skip, already moved] ${move.serviceTitle} -> ${move.toCategoryName}`);
      continue;
    }
    const serviceToMove = await prisma.service.findFirst({ where: { title: move.serviceTitle, categoryId: fromCategory.id } });
    if (!serviceToMove) {
      console.warn(`  [skip] Service "${move.serviceTitle}" not found under "${move.fromCategoryName}" (already moved elsewhere, or missing).`);
      continue;
    }
    await prisma.service.update({ where: { id: serviceToMove.id }, data: { categoryId: toCategory.id, updatedBy: admin.id } });
    console.log(`  [moved] ${move.serviceTitle}: ${move.fromCategoryName} -> ${move.toCategoryName}`);
  }

  console.log('\nRe-parenting CategoryCards onto their own new prototype-backed Category...');
  for (const move of CATEGORY_CARD_REPARENTING) {
    const fromCategory = await prisma.category.findFirst({ where: { name: move.fromCategoryName } });
    const toCategory = await prisma.category.findFirst({ where: { name: move.toCategoryName } });
    if (!fromCategory || !toCategory) {
      console.warn(`  [skip] Category "${move.fromCategoryName}" or "${move.toCategoryName}" not found.`);
      continue;
    }
    const alreadyMoved = await prisma.categoryCard.findFirst({ where: { title: move.title, categoryId: toCategory.id } });
    if (alreadyMoved) {
      console.log(`  [skip, already moved] ${move.title} -> ${move.toCategoryName}`);
      continue;
    }
    const cardToMove = await prisma.categoryCard.findFirst({ where: { title: move.title, categoryId: fromCategory.id } });
    if (!cardToMove) {
      console.warn(`  [skip] CategoryCard "${move.title}" not found under "${move.fromCategoryName}" (already moved elsewhere, or missing).`);
      continue;
    }
    await prisma.categoryCard.update({
      where: { id: cardToMove.id },
      data: { categoryId: toCategory.id, sortOrder: 0, updatedBy: admin.id },
    });
    console.log(`  [moved] ${move.title}: ${move.fromCategoryName} -> ${move.toCategoryName}`);
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
      // Services Asset Assignment Matrix repair (Sep 2026, unaffected by
      // the Services Catalog Reset) — clears a CardProduct's mediaAssetId
      // IF AND ONLY IF it's still exactly a CategoryCard-only mockup;
      // never touches a row already null or already pointing at a
      // genuine distinct asset; never reaches the pre-existing, unrelated
      // stray CardProduct row.
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

  console.log('\nDeactivating known legacy/non-canonical CardProducts (never deleted, never fabricated)...');
  for (const legacy of LEGACY_CARD_PRODUCTS_TO_DEACTIVATE) {
    const category = await prisma.category.findFirst({ where: { name: legacy.categoryName } });
    const service = category
      ? await prisma.service.findFirst({ where: { categoryId: category.id, title: legacy.serviceTitle } })
      : null;
    if (!service) {
      console.log(`  [skip, not found] ${legacy.title} (Service "${legacy.serviceTitle}" under "${legacy.categoryName}" does not exist on this environment)`);
      continue;
    }
    const cardProduct = await prisma.cardProduct.findFirst({ where: { serviceId: service.id, title: legacy.title } });
    if (!cardProduct) {
      console.log(`  [skip, not found] ${legacy.title}`);
      continue;
    }
    if (cardProduct.status !== 'ACTIVE') {
      console.log(`  [skip, already ${cardProduct.status}] ${legacy.title}`);
      continue;
    }
    await prisma.cardProduct.update({ where: { id: cardProduct.id }, data: { status: 'INACTIVE', updatedBy: admin.id } });
    console.log(`  [deactivated] ${legacy.title} -> INACTIVE`);
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
