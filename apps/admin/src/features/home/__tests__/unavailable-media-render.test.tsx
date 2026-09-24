import { renderToStaticMarkup } from "react-dom/server";
import { NewsArticleForm } from "../news/NewsArticleForm";
import { ServiceBannerForm } from "../service-banners/ServiceBannerForm";
import { ServiceMosaicForm } from "../service-mosaic/ServiceMosaicForm";

jest.mock("../api/categories-api", () => ({
  categoriesApi: {
    listAll: jest.fn().mockResolvedValue([]),
    listActive: jest.fn().mockResolvedValue([]),
  },
}));

const common = {
  sortOrder: 0,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const banner = { ...common, id: "b", categoryId: "c", categoryName: "اتومبیل", kicker: "k", theme: "auto" as const, wide: false };
const tile = { ...common, id: "t", categoryId: "c", categoryName: "بیمه", slotType: "half" as const, kicker: "k", title: null, lead: null, theme: "home" as const };
const article = { ...common, id: "n", category: "c", kicker: "k", title: "t", lead: "l", bodySlug: null };

const UNAVAILABLE_NOTICE = "تصویر قبلی در دسترس نیست";
const REPLACE_BUTTON = "انتخاب تصویر جایگزین";
const CLEAR_BUTTON = "پاک‌کردن مرجع تصویر";

/**
 * A Home row whose MediaAsset was soft-deleted comes back with
 * `mediaAssetId` set and `image: null`. The edit forms must say so, offer
 * "replace" and "clear", and (see mediaField.test.ts) never re-submit the old
 * id unless the admin resolves it.
 */
describe.each([
  ["ServiceBannerForm", (image: string | null) => <ServiceBannerForm mode="edit" backHref="/x" onSaved={() => undefined} initial={{ ...banner, mediaAssetId: "m-1", image }} />],
  ["ServiceMosaicForm", (image: string | null) => <ServiceMosaicForm mode="edit" backHref="/x" onSaved={() => undefined} initial={{ ...tile, mediaAssetId: "m-1", image }} />],
  ["NewsArticleForm", (image: string | null) => <NewsArticleForm mode="edit" backHref="/x" onSaved={() => undefined} initial={{ ...article, mediaAssetId: "m-1", image }} />],
])("%s — soft-deleted media reference", (_name, render) => {
  it("shows that the previous image is unavailable and offers replace + clear", () => {
    const html = renderToStaticMarkup(render(null));
    expect(html).toContain(UNAVAILABLE_NOTICE);
    expect(html).toContain(REPLACE_BUTTON);
    expect(html).toContain(CLEAR_BUTTON);
    expect(html).toContain("مرجع قبلی بدون تغییر می‌ماند");
  });

  it("an available image shows no warning and the normal change/remove controls", () => {
    const html = renderToStaticMarkup(render("https://api.example/api/v1/media/x.webp"));
    expect(html).not.toContain(UNAVAILABLE_NOTICE);
    expect(html).not.toContain(REPLACE_BUTTON);
    expect(html).toContain("تغییر تصویر");
    expect(html).toContain("حذف انتخاب");
  });
});
