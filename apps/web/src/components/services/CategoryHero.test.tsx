import { renderToStaticMarkup } from "react-dom/server";
import { CategoryHero } from "./CategoryHero";
import type { CategoryDto } from "../../lib/services-api";

function category(overrides: Partial<CategoryDto>): CategoryDto {
  return {
    id: "c1",
    name: "گردشگری",
    description: "تجربه سفر با پرداخت مرحله‌ای",
    imageKey: null,
    keywords: [],
    sortOrder: 0,
    active: true,
    ...overrides,
  };
}

describe("CategoryHero", () => {
  it("renders the real category name and description", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({})} serviceCount={12} />);
    expect(html).toContain("گردشگری");
    expect(html).toContain("تجربه سفر با پرداخت مرحله‌ای");
  });

  it("renders the real service count in Persian digits (prototype's #categoryItemMeta)", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({})} serviceCount={12} />);
    expect(html).toContain("۱۲ خدمت قابل انتخاب");
  });

  it("never claims a discounted/combined purchase method that has no real PurchaseMethod backing", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({})} serviceCount={0} />);
    expect(html).not.toContain("تخفیفی");
    expect(html).not.toContain("ترکیبی");
  });

  it("renders the real, migrated icon for a category present in the icon map", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({ name: "گردشگری" })} serviceCount={0} />);
    expect(html).toContain("/services/icon-gardeshgari.webp");
  });

  it("falls back to the generic icon for a category not present in the icon map", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({ name: "یک دسته‌ی ناشناخته" })} serviceCount={0} />);
    expect(html).toContain("/services/icon-more.webp");
  });

  it("renders the prototype's verbatim label badge text", () => {
    const html = renderToStaticMarkup(<CategoryHero category={category({})} serviceCount={0} />);
    expect(html).toContain("کارت‌های خدمات بیاوین");
  });
});
