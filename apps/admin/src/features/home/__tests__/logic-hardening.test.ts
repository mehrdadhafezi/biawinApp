import { ApiError } from "../../../lib/api-client";
import { performReorder, performRemove, performSave, performToggleActive } from "../logic";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/**
 * Stage 5.17-B: failures caused by a record that changed/was deleted
 * elsewhere are flagged `stale` so the list screens refetch instead of
 * leaving stale rows on screen; local state is never treated as if the
 * action had succeeded.
 */
describe("stale-record failures (404 / 422 unknown ids)", () => {
  const notFound = () => new ApiError("مقاله یافت نشد.", "NOT_FOUND", 404);
  const unknownIds = () =>
    new ApiError("برخی از موارد انتخاب‌شده برای تغییر ترتیب یافت نشدند.", "UNPROCESSABLE_ENTITY", 422, { unknownIds: [A] });

  it("toggle on a deleted row: failure + stale, message says it may be deleted elsewhere", async () => {
    const update = jest.fn().mockRejectedValue(notFound());
    const result = await performToggleActive(A, true, { update });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stale).toBe(true);
    expect(result.message).toContain("مقاله یافت نشد.");
    expect(result.message).toContain("در جای دیگری حذف شده");
  });

  it("delete of an already-deleted row: failure + stale (the screen closes the dialog and refetches)", async () => {
    const remove = jest.fn().mockRejectedValue(notFound());
    const result = await performRemove(A, { remove });
    expect(result).toMatchObject({ success: false, stale: true });
  });

  it("reorder with an id deleted elsewhere (422 + unknownIds): failure + stale, no re-fetch attempted, no success reported", async () => {
    const reorder = jest.fn().mockRejectedValue(unknownIds());
    const list = jest.fn();
    const result = await performReorder([{ id: A, sortOrder: 0 }], { reorder, list });
    expect(result).toMatchObject({ success: false, stale: true });
    expect(list).not.toHaveBeenCalled();
    if (!result.success) expect(result.message).toContain("1 مورد نامعتبر");
  });

  it("edit save of a deleted row: failure + stale", async () => {
    const update = jest.fn().mockRejectedValue(notFound());
    const result = await performSave("edit", A, { kicker: "x" }, { update });
    expect(result).toMatchObject({ success: false, stale: true });
  });

  it("non-stale failures (409 / 400 / 500) are NOT flagged stale", async () => {
    for (const status of [400, 409, 500]) {
      const remove = jest.fn().mockRejectedValue(new ApiError("x", "E", status));
      expect(await performRemove(A, { remove })).toMatchObject({ success: false, stale: false });
    }
  });
});

describe("error display per status through performSave", () => {
  it("409 duplicate cardKey tells the admin the key is already used", async () => {
    const create = jest.fn().mockRejectedValue(new ApiError("این کلید کارت قبلاً استفاده شده است.", "CONFLICT", 409));
    expect(await performSave("create", null, {}, { create })).toEqual({
      success: false,
      message: "این کلید کارت قبلاً استفاده شده است.",
      stale: false,
    });
  });

  it("409 duplicate bodySlug tells the admin the slug is already used", async () => {
    const create = jest.fn().mockRejectedValue(new ApiError("این نامک مقاله قبلاً استفاده شده است.", "CONFLICT", 409));
    const result = await performSave("create", null, {}, { create });
    expect(result).toMatchObject({ success: false, message: "این نامک مقاله قبلاً استفاده شده است." });
  });

  it("422 unknown category / unknown media identifies the invalid reference", async () => {
    const category = jest.fn().mockRejectedValue(new ApiError("دسته‌بندی انتخاب‌شده معتبر نیست.", "UNPROCESSABLE_ENTITY", 422));
    const media = jest.fn().mockRejectedValue(new ApiError("رسانه انتخاب‌شده معتبر نیست.", "UNPROCESSABLE_ENTITY", 422));
    expect(await performSave("create", null, {}, { create: category })).toMatchObject({ message: "دسته‌بندی انتخاب‌شده معتبر نیست." });
    expect(await performSave("create", null, {}, { create: media })).toMatchObject({ message: "رسانه انتخاب‌شده معتبر نیست." });
  });

  it("400 malformed id / validation shows an input-problem message; 500 shows only the generic fallback", async () => {
    const bad = jest.fn().mockRejectedValue(new ApiError("Validation failed (uuid is expected)", "BAD_REQUEST", 400));
    const result = await performSave("edit", "x", {}, { update: bad });
    expect(result).toMatchObject({ success: false });
    if (!result.success) expect(result.message).toContain("اطلاعات واردشده معتبر نیست");

    const boom = jest.fn().mockRejectedValue(new ApiError("Prisma exploded at /srv/app/secret.ts:12", "INTERNAL_ERROR", 500));
    expect(await performSave("edit", "x", {}, { update: boom })).toEqual({
      success: false,
      message: "ذخیره‌سازی با خطا مواجه شد.",
      stale: false,
    });
  });
});

describe("performReorder never sends an invalid payload", () => {
  const reorder = jest.fn();
  const list = jest.fn();
  beforeEach(() => {
    reorder.mockReset();
    list.mockReset();
  });

  it.each([
    ["empty", []],
    ["malformed uuid", [{ id: "not-a-uuid", sortOrder: 0 }]],
    [
      "duplicate ids",
      [
        { id: A, sortOrder: 0 },
        { id: A, sortOrder: 1 },
      ],
    ],
    [
      "duplicate positions",
      [
        { id: A, sortOrder: 2 },
        { id: B, sortOrder: 2 },
      ],
    ],
    ["negative position", [{ id: A, sortOrder: -1 }]],
    ["position above 100000", [{ id: A, sortOrder: 100001 }]],
  ])("%s → rejected client-side, no request, no refetch", async (_label, entries) => {
    const result = await performReorder(entries, { reorder, list });
    expect(result).toMatchObject({ success: false, stale: false });
    expect(reorder).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("a valid partial (single-item) and full-list payload still go through", async () => {
    reorder.mockResolvedValue(undefined);
    list.mockResolvedValue({ items: [] });
    expect((await performReorder([{ id: A, sortOrder: 5 }], { reorder, list })).success).toBe(true);
    expect(
      (
        await performReorder(
          [
            { id: A, sortOrder: 0 },
            { id: B, sortOrder: 1 },
          ],
          { reorder, list },
        )
      ).success,
    ).toBe(true);
  });
});
