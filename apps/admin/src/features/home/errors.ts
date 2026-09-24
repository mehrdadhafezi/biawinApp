import { ApiError } from "../../lib/api-client";

/**
 * Stage 5.17-B — turns a backend failure into a message an admin can act on.
 *
 * The Stage 5.16 backend maps errors deliberately: 400 malformed/invalid
 * input (English `class-validator` text), 404 missing row, 409 unique
 * conflict (`cardKey`/`bodySlug`) or in-use media, 422 invalid reference
 * (unknown category/media/reorder id, with structured `details`). The
 * backend's own Persian messages are already specific, so they pass through
 * unchanged; this layer only (a) prefixes untranslated 400 text, (b) uses
 * the structured `details` that `ApiError` used to discard, (c) hints at
 * "changed elsewhere" for 404, and (d) never surfaces a raw 5xx message
 * (the backend sends `exception.message` for unexpected errors, which could
 * be internal text) — those get the action's generic fallback instead.
 */

const PERSIAN = /[؀-ۿ]/;

/** Persian labels for the backend's `details.references` keys (media-delete 409; `MediaService.countReferences`). */
export const MEDIA_REFERENCE_LABEL: Record<string, string> = {
  homeServiceBanners: "بنرهای خدمات صفحه خانه",
  homeServiceMosaicTiles: "کاشی‌های موزاییک صفحه خانه",
  homeNewsArticles: "اخبار صفحه خانه",
  categories: "دسته‌بندی‌ها",
  categoryCards: "کارت‌های دسته‌بندی",
  services: "خدمات",
  serviceGalleries: "گالری خدمات",
  cardProducts: "کارت‌های محصول",
};

function detailsRecord(error: ApiError): Record<string, unknown> | null {
  return error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : null;
}

export function unknownIdsOf(error: ApiError): string[] {
  const ids = detailsRecord(error)?.unknownIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** `details.references` as `[label, count]` pairs (only positive integer counts; unknown keys keep their raw key as the label). */
export function referencesOf(error: ApiError): Array<[string, number]> {
  const refs = detailsRecord(error)?.references;
  if (!refs || typeof refs !== "object") return [];
  return Object.entries(refs as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([key, count]) => [MEDIA_REFERENCE_LABEL[key] ?? key, count]);
}

export function describeHomeError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const raw = (error.message ?? "").trim();

  if (error.status >= 500) return fallback;
  if (error.status === 429) return "تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.";
  if (error.status === 403) return "شما دسترسی لازم برای این عملیات را ندارید.";
  if (error.status === 404) {
    return `${raw || "مورد موردنظر یافت نشد."} (ممکن است در جای دیگری حذف شده باشد.)`;
  }
  if (error.status === 400) {
    if (!raw) return fallback;
    return PERSIAN.test(raw) ? raw : `اطلاعات واردشده معتبر نیست: ${raw}`;
  }
  if (error.status === 422) {
    const unknown = unknownIdsOf(error);
    const base = raw || fallback;
    return unknown.length > 0 ? `${base} (${unknown.length} مورد نامعتبر — احتمالاً در جای دیگری حذف شده است.)` : base;
  }
  return raw || fallback;
}

/** 404, or a 422 that names unknown ids — the row(s) this action targeted no longer exist, so the on-screen list is stale and must be refetched. */
export function isStaleRecordError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 404) return true;
  return error.status === 422 && unknownIdsOf(error).length > 0;
}

export type MediaDeleteFailureKind = "in-use" | "not-found" | "other";

/** Media delete: explains a 409 (asset still referenced) with what references it, and flags 404 as stale. */
export function describeMediaDeleteError(error: unknown): { kind: MediaDeleteFailureKind; message: string } {
  const fallback = "حذف فایل با خطا مواجه شد.";
  if (!(error instanceof ApiError)) return { kind: "other", message: fallback };

  if (error.status === 409) {
    const refs = referencesOf(error);
    const where = refs.length > 0 ? ` (${refs.map(([label, count]) => `${label}: ${count}`).join("، ")})` : "";
    return {
      kind: "in-use",
      message: `این تصویر هنوز در حال استفاده است و حذف نمی‌شود${where}. ابتدا آن را از محتوای مربوطه جدا کنید.`,
    };
  }
  if (error.status === 404) {
    return { kind: "not-found", message: "این فایل دیگر وجود ندارد (ممکن است در جای دیگری حذف شده باشد)." };
  }
  return { kind: "other", message: describeHomeError(error, fallback) };
}
