import { renderToStaticMarkup } from "react-dom/server";
import { CategoryCardForm } from "./CategoryCardForm";

jest.mock("../../home/api/categories-api", () => ({
  categoriesApi: {
    listActive: jest.fn().mockResolvedValue([
      { id: "cat-1", name: "پوشاک", active: true },
      { id: "cat-2", name: "زیبایی", active: true },
    ]),
  },
}));

jest.mock("../api/services-admin-api", () => ({
  servicesAdminApi: {
    list: jest.fn().mockResolvedValue({
      items: [{ id: "svc-1", title: "کفش" }],
      total: 1,
      skip: 0,
      take: 100,
    }),
  },
}));

const baseCard = {
  id: "card-1",
  categoryId: "cat-1",
  category: { id: "cat-1", name: "پوشاک" },
  targetServiceId: "svc-1",
  targetService: { id: "svc-1", title: "کفش" },
  title: "کیف و کفش",
  subtitle: "انتخابی برای هر سلیقه",
  badge: "پرفروش",
  mediaAssetId: "media-1",
  image: "/media/shoes.webp",
  highlights: ["خدمات متنوع پوشاک", "طرح‌های خرید و پشتیبانی"],
  sortOrder: 0,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * SERVICES-R5.21 — covers the task's explicit Admin CMS field list
 * (title/subtitle/badge/image/highlights/display order/active/target
 * service) and asserts no pricing/CardProduct-shaped control ever renders.
 */
describe("CategoryCardForm rendering", () => {
  it("create mode renders category selector, target-service selector, media picker, and highlight fields", () => {
    const html = renderToStaticMarkup(
      <CategoryCardForm mode="create" backHref="/catalog/category-cards" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسته‌بندی");
    expect(html).toContain("خدمت هدف");
    expect(html).toContain("تصویر کارت");
    expect(html).toContain("ویژگی برجسته ۱");
    expect(html).toContain("ویژگی برجسته ۲");
    expect(html).toContain("ترتیب نمایش");
    expect(html).toContain("فعال");
  });

  it("edit mode pre-fills title/subtitle/badge/highlights/image from the existing card", () => {
    const html = renderToStaticMarkup(
      <CategoryCardForm mode="edit" initial={baseCard} backHref="/catalog/category-cards" onSaved={jest.fn()} />,
    );

    expect(html).toContain("کیف و کفش");
    expect(html).toContain("انتخابی برای هر سلیقه");
    expect(html).toContain("پرفروش");
    expect(html).toContain("خدمات متنوع پوشاک");
    expect(html).toContain("طرح‌های خرید و پشتیبانی");
    expect(html).toContain("/media/shoes.webp");
  });

  it("never renders a pricing, status, or CardProduct-shaped field (RBAC boundary)", () => {
    const html = renderToStaticMarkup(
      <CategoryCardForm mode="edit" initial={baseCard} backHref="/catalog/category-cards" onSaved={jest.fn()} />,
    );

    expect(html).not.toContain("مبلغ (ریال)");
    expect(html).not.toContain("نوع کارت");
    expect(html).not.toContain("وضعیت");
    expect(html).not.toContain("priceAmount");
  });

  it("readOnly mode disables the fieldset and hides the submit control", () => {
    const html = renderToStaticMarkup(
      <CategoryCardForm mode="edit" initial={baseCard} readOnly backHref="/catalog/category-cards" onSaved={jest.fn()} />,
    );

    expect(html).toContain("دسترسی شما فقط مشاهده است");
  });
});
