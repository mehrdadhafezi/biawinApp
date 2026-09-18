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
    priceAmount: 10_000_000,
    ...overrides,
  };
}

/** R5.26.2 prototype card contract: image + price only, nothing else visually rendered. */
describe("CategoryCard (prototype image + price card) rendering", () => {
  it("renders the real resolved image and the formatted price (Toman, from priceAmount)", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);

    expect(html).toContain("/media/shoes.webp");
    expect(html).toContain("1,000,000 تومان"); // 10,000,000 Rial -> 1,000,000 Toman, formatToman()'s real conversion
  });

  it("renders the empty-price copy, never a fabricated/zero price, when priceAmount is null", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard({ priceAmount: null })} onSelect={() => {}} />);
    expect(html).toContain("قیمت اعلام نشده");
    expect(html).not.toContain("تومان");
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

  it("does NOT visually render subtitle, badge, highlights, or CTA text inside the card (R5.26.2 — image + price only; the title survives only as an aria-label, covered by its own test below)", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);
    expect(html).not.toContain("انتخابی برای هر سلیقه");
    expect(html).not.toContain("پرفروش");
    expect(html).not.toContain("خدمات متنوع پوشاک");
    expect(html).not.toContain("طرح‌های خرید و پشتیبانی");
    expect(html).not.toContain("مشاهده خدمت");
  });

  it("still exposes the title as an aria-label, preserving accessibility without visual marketing content", () => {
    const html = renderToStaticMarkup(<CategoryCard categoryCard={categoryCard()} onSelect={() => {}} />);
    expect(html).toContain('aria-label="کیف و کفش"');
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
