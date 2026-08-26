/**
 * Stage 5.21 update — this file now serves TWO different roles depending on
 * the export:
 *
 * 1. `HOME_STORIES`, `CATEGORY_TICKER_UP`/`DOWN`/`IMAGE`, `MEMBERSHIP_TIER_IMAGE`
 *    are still the PRIMARY, live source for their sections
 *    (`HomeStories`/`CategoriesSection`/`MembershipStoryStrip`) — none of
 *    these are managed by the Stage 5.19 Home CMS (`docs/home-admin-
 *    contract.md` §2 deferred `HomeStories`/`BrandIntroduction`/
 *    `QuickActions`; `CategoriesSection`'s ticker and the membership tier
 *    images were *originally scoped* for CMS management in that same
 *    contract, but Stage 5.19's actual backend work only shipped
 *    `HomeHeroCard`/`HomeServiceBanner`/`HomeServiceMosaicTile`/
 *    `HomeNewsArticle` — per Stage 5.21's own instruction to use the real,
 *    as-shipped Stage 5.19 contract rather than the earlier planning
 *    document, these two sections keep their pre-existing static/live-
 *    non-CMS sources unchanged).
 *
 * 2. `SERVICE_BANNERS`, `SERVICE_MOSAIC_HALVES`/`WIDE`, `NEWS_ARTICLES`, and
 *    `HERO_CARDS` (new this stage) are now FALLBACK-ONLY content —
 *    `apps/web/src/components/home/useHomeCms.ts` renders these only if
 *    the live `GET /home/**` API is unreachable or returns no usable rows.
 *    The primary path is `homeCmsAdapter.ts` mapping real CMS DTOs into the
 *    same view-model shapes these arrays already match. Remove this half of
 *    the file once Stage 5.22 staging QA confirms CMS parity and the
 *    fallback path is no longer needed (`docs/customer-home-cms-integration-
 *    report.md` §7).
 *
 * Images referenced below (`/home/...`) are real photos extracted
 * verbatim from the prototype's inline base64 `<img>` tags — see
 * `docs/home-prototype-asset-map.md` for the full extraction mapping. The
 * same files are now also registered as `MediaAsset` rows and served by the
 * CMS (`backend/prisma/seed-home-media.ts`) — this file's copies are what
 * the fallback path (and the CMS seed data itself) both originated from.
 */

export interface HomeStoryItem {
  topic: string;
  title: string;
}

/** `.home-stories` — 8 bubbles, prototype's exact order and copy (icons are in `HomeStories.tsx`, matching how icons are inlined everywhere else in this codebase — these are line-icon SVGs in the prototype too, not photos, so no extraction was needed here). */
export const HOME_STORIES: HomeStoryItem[] = [
  { topic: "why", title: "چرا بیاوین" },
  { topic: "business", title: "کسب‌وکار با بیاوین" },
  { topic: "special", title: "خاص‌ترین‌های بیاوین" },
  { topic: "cards", title: "کارت‌های عضویت" },
  { topic: "credit", title: "اعتبار من" },
  { topic: "installment", title: "اقساط من" },
  { topic: "services", title: "خدمات منتخب" },
  { topic: "wallet", title: "کیف پول" },
];

/** `.credit-power-section` `.credit-tickers` — 16 category names + real extracted photos, split into two ticker columns (up / down), matching the prototype 1:1. */
export const CATEGORY_TICKER_UP = [
  "خودرو",
  "لوازم خانگی",
  "زیبایی",
  "بیمه",
  "سلامت",
  "مبلمان",
  "مالی",
  "کودک",
] as const;

export const CATEGORY_TICKER_DOWN = [
  "طلا",
  "پوشاک",
  "گردشگری",
  "دیجیتال",
  "ورزش",
  "آموزش",
  "خرید روزمره",
  "کارت هدیه",
] as const;

/** Real `.credit-service-photo img` assets extracted from the prototype (`apps/web/public/home/categories/`) — no `imageUrl` resolution exists for `Category.imageKey` yet (docs/services-ui-contract.md §6 Gap #3), so these are static files, not backend-served. */
export const CATEGORY_TICKER_IMAGE: Record<string, string> = {
  خودرو: "/home/categories/item-01.webp",
  "لوازم خانگی": "/home/categories/item-02.webp",
  زیبایی: "/home/categories/item-03.webp",
  بیمه: "/home/categories/item-04.webp",
  سلامت: "/home/categories/item-05.webp",
  مبلمان: "/home/categories/item-06.webp",
  مالی: "/home/categories/item-07.webp",
  کودک: "/home/categories/item-08.webp",
  طلا: "/home/categories/item-09.webp",
  پوشاک: "/home/categories/item-10.webp",
  گردشگری: "/home/categories/item-11.webp",
  دیجیتال: "/home/categories/item-12.webp",
  ورزش: "/home/categories/item-13.webp",
  آموزش: "/home/categories/item-14.webp",
  "خرید روزمره": "/home/categories/item-15.webp",
  "کارت هدیه": "/home/categories/item-16.webp",
};

export type BannerTheme = "auto" | "home" | "fashion" | "gold" | "travel";

export interface ServiceBannerTile {
  categoryName: string;
  image: string;
  kicker: string;
  /** `.service-banner.theme-*` — the per-category tinted-overlay class the prototype actually applies (verified against the raw `<a class="service-banner theme-X" data-category="...">` markup this session — Stage 5.14 correction; the first pass ignored this and used one generic dark overlay for every tile). */
  theme: BannerTheme;
  wide?: boolean;
}

/** `.services .banner-grid .service-banner img` — real extracted photos (`apps/web/public/home/banners/`), matched to real seeded `Category` rows by name. */
export const SERVICE_BANNERS: ServiceBannerTile[] = [
  { categoryName: "اتومبیل", image: "/home/banners/item-01.webp", kicker: "اعتبار و اقساط منعطف", theme: "auto" },
  { categoryName: "لوازم خانگی", image: "/home/banners/item-02.webp", kicker: "برندهای معتبر و متنوع", theme: "home" },
  { categoryName: "پوشاک", image: "/home/banners/item-03.webp", kicker: "خرید از برندهای منتخب", theme: "fashion" },
  { categoryName: "طلا و جواهر", image: "/home/banners/item-04.webp", kicker: "خرید مطمئن و هدفمند", theme: "gold" },
  { categoryName: "گردشگری", image: "/home/banners/item-05.webp", kicker: "تجربه سفر با پرداخت مرحله‌ای", theme: "travel", wide: true },
];

/** `.story-strip-section .story-circle-inner img` — real extracted photos (`apps/web/public/home/membership/`), keyed by the exact `MembershipPlanDto.title` string the real API returns for each tier. */
export const MEMBERSHIP_TIER_IMAGE: Record<string, string> = {
  "کارت شروع": "/home/membership/item-01.webp",
  "کارت پلاس": "/home/membership/item-02.webp",
  "کارت خانواده": "/home/membership/item-03.webp",
  "کارت پرایم": "/home/membership/item-04.webp",
  "کارت هدیه": "/home/membership/item-05.webp",
  "کارت سفر": "/home/membership/item-06.webp",
  "سبک زندگی": "/home/membership/item-07.webp",
  "کارت سازمانی": "/home/membership/item-08.webp",
};

export type MosaicTheme = "beauty" | "insurance" | "home" | "digital";

export interface ServiceMosaicHalfTile {
  categoryName: string;
  image: string;
  kicker: string;
  theme: MosaicTheme;
}

export interface ServiceMosaicWideSlide {
  categoryName: string;
  image: string;
  kicker: string;
  title: string;
  lead: string;
  theme: MosaicTheme;
}

/** `.sketch-continuation .service-mosaic-card img` — real extracted photos (`apps/web/public/home/mosaic/`). `theme` re-verified against the raw `<a class="service-mosaic-card ... theme-beauty" data-category="زیبایی">` markup this session (Stage 5.14 correction — the first pass had no theme overlay at all). */
export const SERVICE_MOSAIC_HALVES: ServiceMosaicHalfTile[] = [
  { categoryName: "زیبایی", image: "/home/mosaic/item-01.webp", kicker: "زیبایی و مراقبت", theme: "beauty" },
  { categoryName: "بیمه", image: "/home/mosaic/item-02.webp", kicker: "آرامش بیشتر", theme: "insurance" },
];

/** `.sketch-continuation .service-wide-slide img` — real extracted photos (`apps/web/public/home/mosaic/`). */
export const SERVICE_MOSAIC_WIDE: ServiceMosaicWideSlide[] = [
  { categoryName: "مبلمان", image: "/home/mosaic/item-03.webp", kicker: "خانه و زندگی", title: "مبلمان و دکوراسیون", lead: "خرید منعطف برای خانه‌ای کامل‌تر", theme: "home" },
  { categoryName: "دیجیتال", image: "/home/mosaic/item-04.webp", kicker: "انتخاب هوشمند", title: "کالای دیجیتال", lead: "گوشی، لپ‌تاپ و لوازم کاربردی", theme: "digital" },
];

export interface NewsArticle {
  category: string;
  image: string;
  kicker: string;
  title: string;
  lead: string;
}

/** `.news-sketch-section .news-sketch-media img` — real extracted photos (`apps/web/public/home/news/`), verbatim prototype copy. No `NewsArticle` backend model exists yet (docs/prototype-to-production-mapping.md P2 item). */
export const NEWS_ARTICLES: NewsArticle[] = [
  {
    category: "معرفی بیاوین",
    image: "/home/news/item-01.webp",
    kicker: "راهنمای عضویت",
    title: "بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟",
    lead: "از انتخاب خدمت تا استفاده از اعتبار و دریافت مزایای عضویت، همه مراحل در یک مسیر ساده و منظم قرار گرفته‌اند.",
  },
  {
    category: "قرعه‌کشی بیاوین",
    image: "/home/news/item-02.webp",
    kicker: "خبر ویژه",
    title: "هر خرید می‌تواند یک شانس تازه برای دریافت جایزه باشد",
    lead: "در کمپین‌های قرعه‌کشی بیاوین، اعضا با خرید اشتراک یا استفاده از خدمات منتخب، شانس حضور در قرعه‌کشی جوایز را به دست می‌آورند.",
  },
  {
    category: "جوایز رایگان",
    image: "/home/news/item-03.webp",
    kicker: "مزایای عضویت",
    title: "جوایزی که تجربه عضویت در بیاوین را ارزشمندتر می‌کنند",
    lead: "جوایز مناسبتی، هدیه‌های کاربردی و مزایایی که با خرید اشتراک و استفاده از خدمات به اعضا تعلق می‌گیرند.",
  },
  {
    category: "اعتبار اقساطی",
    image: "/home/news/item-04.webp",
    kicker: "راهنمای کاربردی",
    title: "چطور اعتبار بیاوین را برای خریدهای مهم مدیریت کنیم؟",
    lead: "با انتخاب درست خدمت و برنامه‌ریزی مبلغ پرداخت، می‌توان از اعتبار بیاوین برای خریدهای بزرگ‌تر و کاربردی‌تر استفاده کرد.",
  },
  {
    category: "خدمات زیبایی",
    image: "/home/news/item-05.webp",
    kicker: "تازه‌های خدمات",
    title: "خدمات زیبایی و مراقبتی بیاوین برای تجربه‌ای کامل‌تر",
    lead: "از محصولات مراقبتی تا خدمات زیبایی منتخب، اعضا می‌توانند متناسب با نیاز خود گزینه‌های متنوع‌تری را بررسی کنند.",
  },
  {
    category: "خانه و زندگی",
    image: "/home/news/item-06.webp",
    kicker: "پیشنهاد منتخب",
    title: "چطور خرید مبلمان و لوازم خانگی را راحت‌تر برنامه‌ریزی کنیم؟",
    lead: "خدمات خانه و زندگی بیاوین برای خریدهای ضروری و بزرگ طراحی شده‌اند تا فشار پرداخت یک‌باره کاهش پیدا کند.",
  },
  {
    category: "سفر و گردشگری",
    image: "/home/news/item-07.webp",
    kicker: "تجربه تازه",
    title: "سفرهای برنامه‌ریزی‌شده با انتخاب‌های متنوع‌تر",
    lead: "اعضای بیاوین می‌توانند تورها، هتل‌ها و تجربه‌های سفر را مقایسه کنند و متناسب با بودجه خود تصمیم بگیرند.",
  },
  {
    category: "کارت‌های اشتراک",
    image: "/home/news/item-08.webp",
    kicker: "راهنمای انتخاب",
    title: "کدام کارت اشتراک بیاوین برای شما مناسب‌تر است؟",
    lead: "کارت شروع، پلاس، خانواده، پرایم، هدیه، سفر، سبک زندگی و سازمانی هرکدام برای یک نوع نیاز و الگوی استفاده طراحی شده‌اند.",
  },
];

export interface HeroCardMock {
  key: "earn" | "biawin" | "reward";
  label: string;
  title: string;
  subtitle: string;
  number: string;
  owner: string;
  gradient: string;
  iconChip: "trend" | "card" | "gift";
}

/**
 * `.hero .credit-card` fallback — moved here from `BiawinCardsCarousel.tsx`
 * (Stage 5.21) alongside the other 3 CMS-fallback arrays above; the CMS
 * path builds these exact gradient/iconChip pairs from `colorPreset` via
 * `homeCmsAdapter.ts`'s `HERO_VISUAL_BY_COLOR` instead.
 */
export const HERO_CARDS_FALLBACK: HeroCardMock[] = [
  {
    key: "earn",
    label: "کارت درآمد",
    title: "کارت کسب درآمد",
    subtitle: "فرصت درآمدزایی از معرفی و فعالیت در اکوسیستم بیاوین",
    number: "6037 9918 0146 1280",
    owner: "BIAWIN EARN",
    gradient: "linear-gradient(135deg,#27384a 0%,#173957 52%,#0d608b 100%)",
    iconChip: "trend",
  },
  {
    key: "biawin",
    label: "کارت اصلی",
    title: "کارت بیاوین",
    subtitle: "عضویت اصلی برای دسترسی به اعتبار، خدمات و مزایای باشگاه",
    number: "6219 8610 4432 1095",
    owner: "BIAWIN CLUB",
    gradient: "linear-gradient(135deg,#0f94ec 0%,#0879dc 54%,#064e91 100%)",
    iconChip: "card",
  },
  {
    key: "reward",
    label: "کارت جایزه",
    title: "کارت جایزه",
    subtitle: "دریافت هدایا، امتیازها و تجربه‌های ویژه اعضای بیاوین",
    number: "5029 0801 5538 7421",
    owner: "BIAWIN REWARD",
    gradient: "linear-gradient(135deg,#29a5a6 0%,#137e98 52%,#0b587d 100%)",
    iconChip: "gift",
  },
];
