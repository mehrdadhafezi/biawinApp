/**
 * Real prototype assets, migrated from `biawin_single_file_app_requested_edits_v15.html`'s
 * `data-view="services"` section (base64-embedded WEBP images, extracted and
 * decoded to real static files this stage — see
 * docs/services-r1-fidelity-report.md "Asset mapping"). Treated as static
 * assets, not Media Library/CMS content — Category is domain data, not
 * CMS-managed content (SERVICES-R1 product decision #3).
 *
 * The prototype reuses a small set of generic icon images across many
 * category slots rather than having one unique icon per category (verified
 * by content-hash comparison of the decoded images — this is the
 * prototype's own real behavior, not a production simplification). Only
 * `کفش` (shoes) has no real backend `Category` row (19 real categories vs.
 * the prototype's 20 labels) — its icon was extracted but is intentionally
 * unused here, since real category IDs/names drive this map, not the
 * prototype's static label list (SERVICES-R1 product decision #2: do not
 * port prototype synthetic content into production).
 */
export const CATEGORY_ICON: Record<string, string> = {
  "گردشگری": "/services/icon-gardeshgari.webp",
  "اتومبیل": "/services/icon-otomobil.webp",
  "لوازم خانگی": "/services/icon-lavazem-khanegi.webp",
  "طلا و جواهر": "/services/icon-tala-javaher.webp",
  "پوشاک": "/services/icon-poushak.webp",
  "زیبایی": "/services/icon-zibaei.webp",
  "بیمه": "/services/icon-otomobil.webp",
  "دیجیتال": "/services/icon-lavazem-khanegi.webp",
  "سلامت": "/services/icon-zibaei.webp",
  "باشگاه و ورزش": "/services/icon-poushak.webp",
  "کارت هدیه": "/services/icon-tala-javaher.webp",
  "موبایل و لپ‌تاپ": "/services/icon-lavazem-khanegi.webp",
  "خانه و زندگی": "/services/icon-lavazem-khanegi.webp",
  "مبلمان": "/services/icon-lavazem-khanegi.webp",
  "آموزش": "/services/icon-poushak.webp",
  "خدمات سازمانی": "/services/icon-more.webp",
  "خرید روزمره": "/services/icon-tala-javaher.webp",
  "مالی و اعتباری": "/services/icon-more.webp",
  "کودک و نوجوان": "/services/icon-gardeshgari.webp",
};

/** Fallback for any category name not in the map above (should not happen against the current real 19 categories, but a real name is not guaranteed to stay in sync with the prototype's forever). */
export const CATEGORY_ICON_FALLBACK = "/services/icon-more.webp";

/**
 * The prototype's exact category grid order (`#serviceGrid`'s 12 default +
 * `#extraServices`'s 8 "بیشتر"-revealed — `کفش` omitted, no real Category
 * row exists for it). Real categories are matched into this order by name;
 * any real category NOT in this list (should not happen today) is appended
 * at the end, alphabetically, rather than dropped.
 */
export const CATEGORY_GRID_ORDER: string[] = [
  "گردشگری",
  "اتومبیل",
  "لوازم خانگی",
  "طلا و جواهر",
  "پوشاک",
  "زیبایی",
  "بیمه",
  "دیجیتال",
  "سلامت",
  "باشگاه و ورزش",
  "کارت هدیه",
  "موبایل و لپ‌تاپ",
  "خانه و زندگی",
  "مبلمان",
  "آموزش",
  "خدمات سازمانی",
  "خرید روزمره",
  "مالی و اعتباری",
  "کودک و نوجوان",
];

/** How many categories show by default before the "بیشتر" (more) toggle — matches the prototype's `#serviceGrid` (12 slots, one of which was `کفش`, which has no real category, so 11 real categories land in the default set). */
export const CATEGORY_GRID_DEFAULT_COUNT = 11;

/** Per-category accent theme, exact hex values mined from `service-category`'s `openServiceCategory()` (`style.setProperty('--category-accent', ...)`). Categories not listed use the default (blue) theme. */
export const CATEGORY_ACCENT: Record<string, { accent: string; deep: string; soft: string }> = {
  "زیبایی": { accent: "#d64b8a", deep: "#a92b67", soft: "#fff0f7" },
  "گردشگری": { accent: "#27955b", deep: "#17643c", soft: "#eefaf2" },
  "طلا و جواهر": { accent: "#b78618", deep: "#7e5a0b", soft: "#fff8e7" },
  "اتومبیل": { accent: "#4d5965", deep: "#20262c", soft: "#f0f2f4" },
};

export const CATEGORY_ACCENT_DEFAULT = { accent: "#0879dc", deep: "#064d91", soft: "#eef7ff" };

export function getCategoryAccent(categoryName: string) {
  return CATEGORY_ACCENT[categoryName] ?? CATEGORY_ACCENT_DEFAULT;
}
