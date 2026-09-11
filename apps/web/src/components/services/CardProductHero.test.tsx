import { renderToStaticMarkup } from "react-dom/server";
import { CardProductHero } from "./CardProductHero";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "ووچر تخفیف خرید",
    subtitle: "قابل استفاده در فروشگاه‌های منتخب",
    description: null,
    imageKey: null,
    image: null,
    badge: null,
    cardType: "VOUCHER",
    journeyType: "PURCHASE",
    priceAmount: 500000,
    priceLabel: null,
    valueAmount: 500000,
    valueDisplayType: "FIXED",
    benefits: [],
    validityDays: null,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

describe("CardProductHero", () => {
  it("renders the real, backend-resolved image when set (SERVICES-R5.22)", () => {
    const html = renderToStaticMarkup(
      <CardProductHero cardProduct={cardProduct({ image: "https://cdn.test/card-products/card-1.jpg" })} />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("https://cdn.test/card-products/card-1.jpg");
  });

  it("falls back to the cardType icon when no image is set — never a fabricated one", () => {
    const html = renderToStaticMarkup(<CardProductHero cardProduct={cardProduct({ image: null })} />);
    expect(html).not.toContain("<img");
  });
});
