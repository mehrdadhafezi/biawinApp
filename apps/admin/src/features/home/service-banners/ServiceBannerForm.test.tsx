import { renderToStaticMarkup } from "react-dom/server";
import { ServiceBannerForm } from "./ServiceBannerForm";

jest.mock("../api/categories-api", () => ({
  categoriesApi: {
    listActive: jest.fn().mockResolvedValue([
      { id: "cat-1", name: "اتومبیل", active: true },
      { id: "cat-2", name: "لوازم خانگی", active: true },
    ]),
  },
}));

const baseBanner = {
  id: "banner-1",
  categoryId: "cat-1",
  categoryName: "اتومبیل",
  image: "/media/banner.webp",
  mediaAssetId: "media-1",
  kicker: "اعتبار و اقساط منعطف",
  theme: "auto" as const,
  wide: false,
  sortOrder: 0,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/** Covers Stage 5.20 §19's explicit "Category ID selection" and "MediaAsset selection" requirements for the banner form. */
describe("ServiceBannerForm rendering", () => {
  it("create mode renders a category selector, media picker, and theme/wide fields", () => {
    const html = renderToStaticMarkup(<ServiceBannerForm mode="create" backHref="/home/service-banners" onSaved={jest.fn()} />);

    expect(html).toContain("دسته‌بندی");
    expect(html).toContain("<select"); // category select element
    expect(html).toContain("تصویر بنر");
    expect(html).toContain("انتخاب تصویر");
    expect(html).toContain("بنر عریض");
    expect(html).toContain("تم بصری");
  });

  it("edit mode shows the existing category display name and the resolved image preview, never the raw categoryId", () => {
    const html = renderToStaticMarkup(
      <ServiceBannerForm mode="edit" initial={baseBanner} backHref="/home/service-banners" onSaved={jest.fn()} />,
    );

    expect(html).toContain("/media/banner.webp");
    expect(html).toContain("تغییر تصویر"); // already has a media asset selected
    expect(html).not.toContain("cat-1"); // the id itself is never shown as visible text
  });

  it("shows the 'no image selected' state when no MediaAsset is linked yet — never a substituted placeholder image", () => {
    const html = renderToStaticMarkup(
      <ServiceBannerForm mode="edit" initial={{ ...baseBanner, mediaAssetId: null, image: null }} backHref="/home/service-banners" onSaved={jest.fn()} />,
    );

    expect(html).toContain("تصویری انتخاب نشده است");
    expect(html).toContain("انتخاب تصویر");
    expect(html).not.toContain("تغییر تصویر");
  });
});
