import type { ReorderEntry } from "./types";

/**
 * Stage 5.17-B — client-side validation that mirrors the VERIFIED Stage 5.16
 * backend contract (`backend/src/modules/home/dto/*.ts` and
 * `home-dto.decorators.ts`). The limits below are copies of the backend's
 * constants, not new policy; the backend remains the authority and still
 * validates everything — this only stops obviously invalid submissions
 * before a round trip.
 */
export const HOME_LIMITS = {
  hero: { label: 100, title: 200, subtitle: 500, displayNumber: 50, ownerLabel: 100 },
  banner: { kicker: 200 },
  mosaic: { kicker: 200, title: 200, lead: 500 },
  news: { category: 100, kicker: 200, title: 300, lead: 1000, bodySlug: 100 },
  sortOrderMax: 100_000,
} as const;

/** Same pattern as the backend's `BODY_SLUG_PATTERN`. */
export const BODY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function requiredText(label: string, value: string, max: number): string | null {
  if (value.trim() === "") return `${label} الزامی است.`;
  if (value.trim().length > max) return `${label} نباید بیشتر از ${max} نویسه باشد.`;
  return null;
}

function optionalText(label: string, value: string, max: number): string | null {
  if (value.trim().length > max) return `${label} نباید بیشتر از ${max} نویسه باشد.`;
  return null;
}

function collect<K extends string>(entries: Array<[K, string | null]>): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  for (const [key, message] of entries) if (message) errors[key] = message;
  return errors;
}

/** A selected media id must be a uuid; `null`/`undefined` (no image, or "leave unchanged") is always valid. */
export function validateMediaAssetId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return isUuid(value) ? null : "شناسه تصویر انتخاب‌شده معتبر نیست.";
}

export function validateCategoryId(value: string): string | null {
  if (!value) return "انتخاب دسته‌بندی الزامی است.";
  return isUuid(value) ? null : "شناسه دسته‌بندی معتبر نیست.";
}

export type HeroField = "label" | "title" | "subtitle" | "displayNumber" | "ownerLabel";
export function validateHeroCard(v: Record<HeroField, string>): FieldErrors<HeroField> {
  const l = HOME_LIMITS.hero;
  return collect<HeroField>([
    ["label", requiredText("برچسب", v.label, l.label)],
    ["title", requiredText("عنوان", v.title, l.title)],
    ["subtitle", requiredText("زیرعنوان", v.subtitle, l.subtitle)],
    ["displayNumber", requiredText("شماره نمایشی", v.displayNumber, l.displayNumber)],
    ["ownerLabel", requiredText("برچسب صاحب کارت", v.ownerLabel, l.ownerLabel)],
  ]);
}

export type BannerField = "categoryId" | "kicker" | "mediaAssetId";
export function validateServiceBanner(v: { categoryId: string; kicker: string; mediaAssetId: string | null | undefined }): FieldErrors<BannerField> {
  return collect<BannerField>([
    ["categoryId", validateCategoryId(v.categoryId)],
    ["kicker", requiredText("متن کوتاه", v.kicker, HOME_LIMITS.banner.kicker)],
    ["mediaAssetId", validateMediaAssetId(v.mediaAssetId)],
  ]);
}

export type MosaicField = "categoryId" | "kicker" | "title" | "lead" | "mediaAssetId";
/** `title`/`lead` stay optional for every slot type (BD-5) — only their length is checked. */
export function validateServiceMosaic(v: {
  categoryId: string;
  kicker: string;
  title: string;
  lead: string;
  mediaAssetId: string | null | undefined;
}): FieldErrors<MosaicField> {
  const l = HOME_LIMITS.mosaic;
  return collect<MosaicField>([
    ["categoryId", validateCategoryId(v.categoryId)],
    ["kicker", requiredText("متن کوتاه", v.kicker, l.kicker)],
    ["title", optionalText("عنوان", v.title, l.title)],
    ["lead", optionalText("توضیح", v.lead, l.lead)],
    ["mediaAssetId", validateMediaAssetId(v.mediaAssetId)],
  ]);
}

export type NewsField = "category" | "kicker" | "title" | "lead" | "bodySlug" | "mediaAssetId";
export function validateNewsArticle(v: {
  category: string;
  kicker: string;
  title: string;
  lead: string;
  bodySlug: string;
  mediaAssetId: string | null | undefined;
}): FieldErrors<NewsField> {
  const l = HOME_LIMITS.news;
  const slug = v.bodySlug.trim();
  let slugError: string | null = null;
  if (slug !== "") {
    if (slug.length > l.bodySlug) slugError = `شناسه لینک نباید بیشتر از ${l.bodySlug} نویسه باشد.`;
    else if (!BODY_SLUG_PATTERN.test(slug)) {
      slugError = "شناسه لینک فقط می‌تواند شامل حروف کوچک انگلیسی، عدد و خط تیره (بدون خط تیره‌ی پشت‌سرهم یا در ابتدا/انتها) باشد.";
    }
  }
  return collect<NewsField>([
    ["category", requiredText("دسته‌بندی خبر", v.category, l.category)],
    ["kicker", requiredText("متن کوتاه", v.kicker, l.kicker)],
    ["title", requiredText("عنوان", v.title, l.title)],
    ["lead", requiredText("متن مقدمه", v.lead, l.lead)],
    ["bodySlug", slugError],
    ["mediaAssetId", validateMediaAssetId(v.mediaAssetId)],
  ]);
}

export function validateSortOrder(value: number): string | null {
  if (!Number.isInteger(value)) return "ترتیب باید عدد صحیح باشد.";
  if (value < 0 || value > HOME_LIMITS.sortOrderMax) return `ترتیب باید بین ۰ و ${HOME_LIMITS.sortOrderMax} باشد.`;
  return null;
}

/**
 * Guard for the reorder payload the UI is about to send — mirrors the
 * backend `ReorderHomeItemsDto`: non-empty, every id a uuid, no duplicate
 * ids, no duplicate positions, every position an integer in 0..100000.
 */
export function validateReorderEntries(entries: ReorderEntry[]): string | null {
  if (entries.length === 0) return "فهرست ترتیب خالی است.";
  const ids = new Set<string>();
  const positions = new Set<number>();
  for (const entry of entries) {
    if (!isUuid(entry.id)) return "شناسه یکی از موارد نامعتبر است؛ صفحه را دوباره بارگذاری کنید.";
    const positionError = validateSortOrder(entry.sortOrder);
    if (positionError) return positionError;
    if (ids.has(entry.id)) return "شناسه تکراری در فهرست ترتیب وجود دارد.";
    if (positions.has(entry.sortOrder)) return "جایگاه تکراری در فهرست ترتیب وجود دارد.";
    ids.add(entry.id);
    positions.add(entry.sortOrder);
  }
  return null;
}

/** First message, plus a count when there are more — used by the form-level banner. */
export function summarizeErrors(errors: Record<string, string | undefined>): string | null {
  const messages = Object.values(errors).filter((m): m is string => Boolean(m));
  if (messages.length === 0) return null;
  return messages.length === 1 ? messages[0] : `${messages[0]} (و ${messages.length - 1} مورد دیگر)`;
}
