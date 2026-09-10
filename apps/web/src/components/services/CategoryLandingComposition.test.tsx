import { renderToStaticMarkup } from "react-dom/server";
import { CategoryHero } from "./CategoryHero";
import { CategoryCardGrid } from "./CategoryCardGrid";
import type { CategoryDto, CategoryCardDto } from "../../lib/services-api";

/**
 * SERVICES-R5.21 — the exact composition `app/categories/[slug]/page.tsx`
 * renders once a Category loads, mirroring
 * `ServiceDetailCardOnly.test.tsx`'s established convention for the
 * sibling Service Detail route.
 */
const category: CategoryDto = {
  id: "cat-1",
  name: "پوشاک",
  description: "خرید از برندهای منتخب",
  imageKey: null,
  slug: "poushak",
  keywords: [],
  sortOrder: 0,
  active: true,
};

function categoryCard(overrides: Partial<CategoryCardDto> = {}): CategoryCardDto {
  return {
    id: "card-1",
    categoryId: "cat-1",
    targetServiceId: "svc-1",
    title: "کیف و کفش",
    subtitle: "انتخابی برای هر سلیقه",
    badge: "پرفروش",
    image: "/media/shoes.webp",
    highlights: ["خدمات متنوع پوشاک", "طرح‌های خرید و پشتیبانی"],
    sortOrder: 0,
    ...overrides,
  };
}

describe("Category Landing composition", () => {
  it("renders the real category hero and its real discovery cards", () => {
    const html = renderToStaticMarkup(
      <>
        <CategoryHero category={category} serviceCount={1} />
        <CategoryCardGrid categoryCards={[categoryCard()]} error={null} onSelect={() => {}} />
      </>,
    );

    expect(html).toContain("پوشاک");
    expect(html).toContain("خرید از برندهای منتخب");
    expect(html).toContain("کیف و کفش");
    expect(html).toContain("طرح‌های خرید و پشتیبانی");
  });

  it("never renders a purchase CTA, price, or CardProduct-shaped text anywhere in this composition — CategoryCard is a discovery card, not a purchasable product", () => {
    const html = renderToStaticMarkup(
      <>
        <CategoryHero category={category} serviceCount={1} />
        <CategoryCardGrid categoryCards={[categoryCard()]} error={null} onSelect={() => {}} />
      </>,
    );
    expect(html).not.toContain("خرید کارت");
    expect(html).not.toContain("خرید این خدمت");
    expect(html).not.toContain("priceAmount");
  });

  it("renders the honest empty state when a real Category genuinely has no discovery cards yet", () => {
    const html = renderToStaticMarkup(
      <>
        <CategoryHero category={category} serviceCount={0} />
        <CategoryCardGrid categoryCards={[]} error={null} onSelect={() => {}} />
      </>,
    );
    expect(html).toContain("در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است.");
  });
});
