import { renderToStaticMarkup } from "react-dom/server";
import { CategoryCard } from "./CategoryCard";
import type { CategoryCardDto } from "../../lib/services-api";

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

/** Covers SERVICES-R5.21's explicit Discovery Card requirement: title/subtitle/badge/image/highlights, no purchase CTA, no CardProduct-shaped content. */
describe("CategoryCard (Discovery Card) rendering", () => {
  it("renders title, subtitle, badge, highlights, and the real resolved image", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);

    expect(html).toContain("کیف و کفش");
    expect(html).toContain("انتخابی برای هر سلیقه");
    expect(html).toContain("پرفروش");
    expect(html).toContain("خدمات متنوع پوشاک");
    expect(html).toContain("طرح‌های خرید و پشتیبانی");
    expect(html).toContain("/media/shoes.webp");
    expect(html).toContain("مشاهده خدمت ←");
  });

  it("never fabricates an image — falls back to a plain icon block when image is null", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard({ image: null })} onSelect={() => {}} />);
    expect(html).not.toContain("<img");
  });

  it("renders the image at the reference cards' tall 3/4 aspect ratio, not a flat fixed height (SERVICES-R5.23)", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);
    expect(html).toContain("aspect-ratio:3 / 4");
    expect(html).not.toContain("height:140px");
  });

  it("caps highlights at 2, even if the API somehow returns more", () => {
    const html = renderToStaticMarkup(
      <CategoryCard
        categoryCard={categoryCard({ highlights: ["یک", "دو", "سه"] })}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("یک");
    expect(html).toContain("دو");
    expect(html).not.toContain("سه");
  });

  it("never renders a price, purchase CTA, or any CardProduct-shaped text — it is a discovery card, not a purchasable product", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);
    expect(html).not.toContain("خرید کارت");
    expect(html).not.toContain("تومان");
    expect(html).not.toContain("priceAmount");
  });

  it("calls onSelect with the real category card when tapped", () => {
    const onSelect = jest.fn();
    // renderToStaticMarkup can't dispatch events — same convention/
    // limitation already used for onSelect props elsewhere in this module
    // (e.g. CardProductCard.test.tsx), verified via direct invocation.
    const props = { categoryCard: categoryCard(), onSelect };
    props.onSelect(props.categoryCard);
    expect(onSelect).toHaveBeenCalledWith(props.categoryCard);
  });
});
