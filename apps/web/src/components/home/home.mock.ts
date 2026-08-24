/**
 * Temporary static content for Home sections that have no backing admin
 * API yet — verbatim from `biawin_single_file_app_requested_edits_v15.html`'s
 * `#view-home` (the pixel-perfect migration's single source of truth).
 * Replace each block with a real Admin CMS fetch once that API exists;
 * until then this is the literal prototype copy, not placeholder text.
 */

export interface HomeStoryItem {
  topic: string;
  title: string;
}

/** `.home-stories` — 8 bubbles, prototype's exact order and copy (icons are in `HomeStories.tsx`, matching how icons are inlined everywhere else in this codebase). */
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

/** `.credit-power-section` — 16 category names split into two ticker columns (up / down), matching the prototype 1:1. */
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

/** No imageKey→imageUrl resolution exists for Category yet (docs/services-ui-contract.md §6 Gap #3) — same emoji-fallback pattern ServiceCard/FeaturedServiceBanner already use instead of the prototype's embedded photos. */
export const CATEGORY_TICKER_ICON: Record<string, string> = {
  خودرو: "🚗",
  "لوازم خانگی": "🧊",
  زیبایی: "💄",
  بیمه: "🛡",
  سلامت: "🩺",
  مبلمان: "🛋",
  مالی: "🏦",
  کودک: "🧸",
  طلا: "🏅",
  پوشاک: "👗",
  گردشگری: "🧳",
  دیجیتال: "📱",
  ورزش: "🏋️",
  آموزش: "📚",
  "خرید روزمره": "🛒",
  "کارت هدیه": "🎁",
};

export interface NewsArticle {
  category: string;
  kicker: string;
  title: string;
  lead: string;
}

/** `.news-sketch-section` — 8 articles, verbatim prototype copy. No `NewsArticle` backend model exists yet (docs/prototype-to-production-mapping.md P2 item). */
export const NEWS_ARTICLES: NewsArticle[] = [
  {
    category: "معرفی بیاوین",
    kicker: "راهنمای عضویت",
    title: "بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟",
    lead: "از انتخاب خدمت تا استفاده از اعتبار و دریافت مزایای عضویت، همه مراحل در یک مسیر ساده و منظم قرار گرفته‌اند.",
  },
  {
    category: "قرعه‌کشی بیاوین",
    kicker: "خبر ویژه",
    title: "هر خرید می‌تواند یک شانس تازه برای دریافت جایزه باشد",
    lead: "در کمپین‌های قرعه‌کشی بیاوین، اعضا با خرید اشتراک یا استفاده از خدمات منتخب، شانس حضور در قرعه‌کشی جوایز را به دست می‌آورند.",
  },
  {
    category: "جوایز رایگان",
    kicker: "مزایای عضویت",
    title: "جوایزی که تجربه عضویت در بیاوین را ارزشمندتر می‌کنند",
    lead: "جوایز مناسبتی، هدیه‌های کاربردی و مزایایی که با خرید اشتراک و استفاده از خدمات به اعضا تعلق می‌گیرند.",
  },
  {
    category: "اعتبار اقساطی",
    kicker: "راهنمای کاربردی",
    title: "چطور اعتبار بیاوین را برای خریدهای مهم مدیریت کنیم؟",
    lead: "با انتخاب درست خدمت و برنامه‌ریزی مبلغ پرداخت، می‌توان از اعتبار بیاوین برای خریدهای بزرگ‌تر و کاربردی‌تر استفاده کرد.",
  },
  {
    category: "خدمات زیبایی",
    kicker: "تازه‌های خدمات",
    title: "خدمات زیبایی و مراقبتی بیاوین برای تجربه‌ای کامل‌تر",
    lead: "از محصولات مراقبتی تا خدمات زیبایی منتخب، اعضا می‌توانند متناسب با نیاز خود گزینه‌های متنوع‌تری را بررسی کنند.",
  },
  {
    category: "خانه و زندگی",
    kicker: "پیشنهاد منتخب",
    title: "چطور خرید مبلمان و لوازم خانگی را راحت‌تر برنامه‌ریزی کنیم؟",
    lead: "خدمات خانه و زندگی بیاوین برای خریدهای ضروری و بزرگ طراحی شده‌اند تا فشار پرداخت یک‌باره کاهش پیدا کند.",
  },
  {
    category: "سفر و گردشگری",
    kicker: "تجربه تازه",
    title: "سفرهای برنامه‌ریزی‌شده با انتخاب‌های متنوع‌تر",
    lead: "اعضای بیاوین می‌توانند تورها، هتل‌ها و تجربه‌های سفر را مقایسه کنند و متناسب با بودجه خود تصمیم بگیرند.",
  },
  {
    category: "کارت‌های اشتراک",
    kicker: "راهنمای انتخاب",
    title: "کدام کارت اشتراک بیاوین برای شما مناسب‌تر است؟",
    lead: "کارت شروع، پلاس، خانواده، پرایم، هدیه، سفر، سبک زندگی و سازمانی هرکدام برای یک نوع نیاز و الگوی استفاده طراحی شده‌اند.",
  },
];
