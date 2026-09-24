import { renderToStaticMarkup } from "react-dom/server";
import type { MediaAsset } from "@biawin/types";
import { ApiError } from "../../lib/api-client";
import { MEDIA_PAGE_SIZE, clampPage, totalPages } from "../../lib/media/mediaPagination";
import { MediaLibraryGrid } from "./MediaLibraryGrid";
import { MediaPager } from "./MediaPager";
import { performMediaDelete } from "./mediaDelete";

const asset: MediaAsset = {
  id: "11111111-1111-4111-8111-111111111111",
  fileName: "hero.webp",
  url: "https://api.example/api/v1/media/hero.webp",
  mimeType: "image/webp",
  sizeBytes: 2048,
  width: 10,
  height: 10,
  altText: null,
  uploadedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("media pagination helpers", () => {
  it("page size is 50 and total drives the page count (staging has 180 assets -> 4 pages)", () => {
    expect(MEDIA_PAGE_SIZE).toBe(50);
    expect(totalPages(180)).toBe(4);
    expect(totalPages(50)).toBe(1);
    expect(totalPages(51)).toBe(2);
    expect(totalPages(0)).toBe(1);
  });

  it("clampPage keeps the page within 1..totalPages (e.g. after deleting the last item of the last page)", () => {
    expect(clampPage(0, 180)).toBe(1);
    expect(clampPage(9, 180)).toBe(4);
    expect(clampPage(5, 200)).toBe(4);
    expect(clampPage(3, 101)).toBe(3);
    expect(clampPage(3, 100)).toBe(2);
  });
});

describe("MediaPager", () => {
  const noop = () => undefined;

  it("shows the current page, total pages and total files, with next enabled on the first page", () => {
    const html = renderToStaticMarkup(<MediaPager page={1} totalPages={4} total={180} onPrev={noop} onNext={noop} />);
    expect(html).toContain("صفحه 1 از 4");
    expect(html).toContain("180 فایل");
    expect(html).toContain("قبلی");
    expect(html).toContain("بعدی");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>قبلی<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>بعدی<\/button>/);
  });

  it("disables next on the last page", () => {
    const html = renderToStaticMarkup(<MediaPager page={4} totalPages={4} total={180} onPrev={noop} onNext={noop} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>بعدی<\/button>/);
  });

  it("renders nothing when everything fits on one page", () => {
    expect(renderToStaticMarkup(<MediaPager page={1} totalPages={1} total={12} onPrev={noop} onNext={noop} />)).toBe("");
  });
});

describe("MediaLibraryGrid delete control", () => {
  it("SUPER_ADMIN/CONTENT_EDITOR-equivalent (canManage) sees a delete button per asset", () => {
    const html = renderToStaticMarkup(<MediaLibraryGrid items={[asset]} canManage onRequestDelete={() => undefined} />);
    expect(html).toContain("حذف");
    expect(html).toContain("hero.webp");
  });

  it("SUPPORT_VIEWER-equivalent (read-only) sees no delete control", () => {
    const html = renderToStaticMarkup(<MediaLibraryGrid items={[asset]} canManage={false} onRequestDelete={() => undefined} />);
    expect(html).not.toContain("biawin-media-card-delete\">");
    expect(html).not.toContain(">حذف<");
  });
});

describe("performMediaDelete", () => {
  it("success returns success (the page then refreshes the current page)", async () => {
    const remove = jest.fn().mockResolvedValue({ id: asset.id });
    expect(await performMediaDelete(asset.id, { remove })).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith(asset.id);
  });

  it("409 keeps the asset, is not stale, and explains what still uses it — the request is never retried or bypassed", async () => {
    const remove = jest.fn().mockRejectedValue(
      new ApiError("in use", "CONFLICT", 409, { references: { categoryCards: 3, cardProducts: 1 } }),
    );
    const result = await performMediaDelete(asset.id, { remove });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: false, kind: "in-use", stale: false });
    if (!result.success) {
      expect(result.message).toContain("هنوز در حال استفاده است");
      expect(result.message).toContain("کارت‌های دسته‌بندی: 3");
      expect(result.message).toContain("کارت‌های محصول: 1");
    }
  });

  it("404 (deleted elsewhere) is stale so the list is reconciled", async () => {
    const remove = jest.fn().mockRejectedValue(new ApiError("not found", "NOT_FOUND", 404));
    expect(await performMediaDelete(asset.id, { remove })).toMatchObject({ success: false, kind: "not-found", stale: true });
  });

  it("a network error is a generic, non-stale failure", async () => {
    const remove = jest.fn().mockRejectedValue(new Error("network"));
    expect(await performMediaDelete(asset.id, { remove })).toMatchObject({ success: false, kind: "other", stale: false });
  });
});
