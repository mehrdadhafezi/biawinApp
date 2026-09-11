import { renderToStaticMarkup } from "react-dom/server";
import { CategoryForm } from "./CategoryForm";

const baseCategory = {
  id: "cat-1",
  name: "خودرو",
  description: "توضیحات دسته خودرو",
  imageKey: "categories/auto.webp",
  mediaAssetId: "media-1",
  image: "https://cdn.test/categories/auto.webp",
  slug: "khodro",
  keywords: ["خودرو", "ماشین"],
  sortOrder: 0,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("CategoryForm rendering", () => {
  it("create mode renders name/description/image-key/keywords/active fields, all required inputs marked required", () => {
    const html = renderToStaticMarkup(<CategoryForm mode="create" backHref="/catalog/categories" onSaved={jest.fn()} />);

    expect(html).toContain("نام");
    expect(html).toContain("توضیحات");
    expect(html).toContain("تصویر دسته‌بندی");
    expect(html).toContain("کلیدواژه‌ها");
    expect(html).toContain("فعال");
    // The two required fields (name, description) render with the required attribute.
    expect(html).toMatch(/<input[^>]*required[^>]*>/);
    expect(html).toMatch(/<textarea[^>]*required[^>]*><\/textarea>/);
  });

  it("edit mode pre-fills from the existing category, joining keywords with the Persian comma", () => {
    const html = renderToStaticMarkup(
      <CategoryForm mode="edit" initial={baseCategory} backHref="/catalog/categories" onSaved={jest.fn()} />,
    );

    expect(html).toContain("خودرو، ماشین");
    expect(html).toContain("khodro");
    // The imageKey text field is gone — image management now goes through
    // the Media Picker only (SERVICES-R5.22); the resolved preview renders instead.
    expect(html).toContain("https://cdn.test/categories/auto.webp");
  });

  it("renders the slug field (SERVICES-R5.21 Category Landing route)", () => {
    const html = renderToStaticMarkup(
      <CategoryForm mode="create" backHref="/catalog/categories" onSaved={jest.fn()} />,
    );
    expect(html).toContain("شناسه آدرس");
  });

  it("readOnly mode disables the fieldset and hides the submit control", () => {
    const html = renderToStaticMarkup(
      <CategoryForm mode="edit" initial={baseCategory} readOnly backHref="/catalog/categories" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسترسی شما فقط مشاهده است");
    expect(html).not.toContain('type="submit"');
  });
});
