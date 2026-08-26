import { renderToStaticMarkup } from "react-dom/server";
import { ServiceMosaicForm } from "./ServiceMosaicForm";

jest.mock("../api/categories-api", () => ({
  categoriesApi: { listActive: jest.fn().mockResolvedValue([{ id: "cat-1", name: "زیبایی", active: true }]) },
}));

const baseTile = {
  id: "tile-1",
  categoryId: "cat-1",
  categoryName: "زیبایی",
  image: null,
  mediaAssetId: null,
  slotType: "wide" as const,
  kicker: "خانه و زندگی",
  title: "مبلمان و دکوراسیون",
  lead: "خرید منعطف برای خانه‌ای کامل‌تر",
  theme: "home" as const,
  sortOrder: 2,
  active: true,
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ServiceMosaicForm rendering", () => {
  it("renders the slot-type selector, category selector, and media picker", () => {
    const html = renderToStaticMarkup(<ServiceMosaicForm mode="create" backHref="/home/service-mosaic" onSaved={jest.fn()} />);

    expect(html).toContain("نوع جایگاه");
    expect(html).toContain("دسته‌بندی");
    expect(html).toContain("تصویر کاشی");
  });

  it("edit mode pre-fills a wide tile's title/lead", () => {
    const html = renderToStaticMarkup(
      <ServiceMosaicForm mode="edit" initial={baseTile} backHref="/home/service-mosaic" onSaved={jest.fn()} />,
    );

    expect(html).toContain("مبلمان و دکوراسیون");
    expect(html).toContain("خرید منعطف برای خانه‌ای کامل‌تر");
  });
});
