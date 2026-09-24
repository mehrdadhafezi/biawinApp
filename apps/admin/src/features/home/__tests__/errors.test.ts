import { ApiError } from "../../../lib/api-client";
import { describeHomeError, describeMediaDeleteError, isStaleRecordError, referencesOf, unknownIdsOf } from "../errors";

const FALLBACK = "ذخیره‌سازی با خطا مواجه شد.";

describe("describeHomeError", () => {
  it("400 with an untranslated backend message is prefixed so the admin knows it is an input problem", () => {
    const error = new ApiError("bodySlug must contain only lowercase letters, digits and single hyphens", "BAD_REQUEST", 400);
    expect(describeHomeError(error, FALLBACK)).toBe(
      "اطلاعات واردشده معتبر نیست: bodySlug must contain only lowercase letters, digits and single hyphens",
    );
  });

  it("400 with a Persian backend message passes through unchanged", () => {
    expect(describeHomeError(new ApiError("دسته‌بندی نامعتبر است.", "BAD_REQUEST", 400), FALLBACK)).toBe("دسته‌بندی نامعتبر است.");
  });

  it("404 keeps the backend message and hints that the row may have been deleted elsewhere", () => {
    const message = describeHomeError(new ApiError("مقاله یافت نشد.", "NOT_FOUND", 404), FALLBACK);
    expect(message).toContain("مقاله یافت نشد.");
    expect(message).toContain("در جای دیگری حذف شده");
  });

  it("409 duplicate cardKey / bodySlug shows the backend's specific Persian message unchanged", () => {
    expect(describeHomeError(new ApiError("این کلید کارت قبلاً استفاده شده است.", "CONFLICT", 409), FALLBACK)).toBe(
      "این کلید کارت قبلاً استفاده شده است.",
    );
    expect(describeHomeError(new ApiError("این نامک مقاله قبلاً استفاده شده است.", "CONFLICT", 409), FALLBACK)).toBe(
      "این نامک مقاله قبلاً استفاده شده است.",
    );
  });

  it("422 unknown category / media identifies the invalid reference through the backend message", () => {
    expect(describeHomeError(new ApiError("دسته‌بندی انتخاب‌شده معتبر نیست.", "UNPROCESSABLE_ENTITY", 422), FALLBACK)).toBe(
      "دسته‌بندی انتخاب‌شده معتبر نیست.",
    );
    expect(describeHomeError(new ApiError("رسانه انتخاب‌شده معتبر نیست.", "UNPROCESSABLE_ENTITY", 422), FALLBACK)).toBe(
      "رسانه انتخاب‌شده معتبر نیست.",
    );
  });

  it("422 reorder with unknown ids uses the structured details that ApiError now preserves", () => {
    const error = new ApiError("برخی از موارد انتخاب‌شده برای تغییر ترتیب یافت نشدند.", "UNPROCESSABLE_ENTITY", 422, {
      unknownIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    });
    const message = describeHomeError(error, FALLBACK);
    expect(message).toContain("برخی از موارد انتخاب‌شده");
    expect(message).toContain("2 مورد نامعتبر");
    expect(unknownIdsOf(error)).toHaveLength(2);
  });

  it("403 and 429 get their own Persian messages", () => {
    expect(describeHomeError(new ApiError("Forbidden resource", "FORBIDDEN", 403), FALLBACK)).toBe("شما دسترسی لازم برای این عملیات را ندارید.");
    expect(describeHomeError(new ApiError("ThrottlerException: Too Many Requests", "TOO_MANY_REQUESTS", 429), FALLBACK)).toContain("بیش از حد مجاز");
  });

  it("500 never shows the raw server message (it can be internal text) — the action's generic fallback is used", () => {
    const error = new ApiError("Invalid `prisma.homeNewsArticle.create()` invocation: connection string postgres://user:secret@db", "INTERNAL_ERROR", 500);
    const message = describeHomeError(error, FALLBACK);
    expect(message).toBe(FALLBACK);
    expect(message).not.toContain("postgres");
  });

  it("a non-ApiError (network failure) uses the fallback", () => {
    expect(describeHomeError(new Error("fetch failed"), FALLBACK)).toBe(FALLBACK);
  });
});

describe("isStaleRecordError", () => {
  it("is true for 404 and for a 422 that names unknown ids", () => {
    expect(isStaleRecordError(new ApiError("x", "NOT_FOUND", 404))).toBe(true);
    expect(isStaleRecordError(new ApiError("x", "UNPROCESSABLE_ENTITY", 422, { unknownIds: ["a"] }))).toBe(true);
  });

  it("is false for other 422s, 400, 409, 500 and non-ApiErrors", () => {
    expect(isStaleRecordError(new ApiError("x", "UNPROCESSABLE_ENTITY", 422))).toBe(false);
    expect(isStaleRecordError(new ApiError("x", "BAD_REQUEST", 400))).toBe(false);
    expect(isStaleRecordError(new ApiError("x", "CONFLICT", 409))).toBe(false);
    expect(isStaleRecordError(new ApiError("x", "INTERNAL_ERROR", 500))).toBe(false);
    expect(isStaleRecordError(new Error("x"))).toBe(false);
  });
});

describe("describeMediaDeleteError", () => {
  it("409 explains the asset is still in use and lists what references it (from details.references)", () => {
    const error = new ApiError("این رسانه در حال استفاده است و قابل حذف نیست.", "CONFLICT", 409, {
      references: { homeServiceBanners: 1, cardProducts: 2, categories: 0 },
    });
    const result = describeMediaDeleteError(error);
    expect(result.kind).toBe("in-use");
    expect(result.message).toContain("هنوز در حال استفاده است");
    expect(result.message).toContain("بنرهای خدمات صفحه خانه: 1");
    expect(result.message).toContain("کارت‌های محصول: 2");
    expect(result.message).not.toContain("دسته‌بندی‌ها"); // zero counts are not listed
    expect(referencesOf(error)).toHaveLength(2);
  });

  it("409 without details still explains that the asset is in use", () => {
    const result = describeMediaDeleteError(new ApiError("in use", "CONFLICT", 409));
    expect(result.kind).toBe("in-use");
    expect(result.message).toContain("هنوز در حال استفاده است");
  });

  it("404 is reported as not-found (stale list)", () => {
    expect(describeMediaDeleteError(new ApiError("فایل رسانه یافت نشد.", "NOT_FOUND", 404)).kind).toBe("not-found");
  });

  it("other failures fall back to the generic delete message", () => {
    expect(describeMediaDeleteError(new ApiError("boom", "INTERNAL_ERROR", 500))).toEqual({ kind: "other", message: "حذف فایل با خطا مواجه شد." });
    expect(describeMediaDeleteError(new Error("network"))).toEqual({ kind: "other", message: "حذف فایل با خطا مواجه شد." });
  });
});
