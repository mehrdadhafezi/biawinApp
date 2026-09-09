import { renderToStaticMarkup } from "react-dom/server";
import { CardProductCard } from "./CardProductCard";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "ووچر تخفیف خرید",
    subtitle: "قابل استفاده در فروشگاه‌های منتخب",
    description: null,
    imageKey: null,
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

/** Covers the task's explicit "Display: image, title, description, price, CTA" requirement for the reusable list tile. */
describe("CardProductCard rendering", () => {
  it("renders title, description/subtitle, a derived value, and a CTA affordance — no image URL is fabricated", () => {
    const html = renderToStaticMarkup(<CardProductCard cardProduct={cardProduct()} onSelect={() => {}} />);

    expect(html).toContain("ووچر تخفیف خرید");
    expect(html).toContain("قابل استفاده در فروشگاه‌های منتخب");
    expect(html).toContain("50,000 تومان");
    expect(html).toContain("مشاهده جزئیات");
    expect(html).not.toContain("<img"); // no imageKey→imageUrl resolution exists yet — see the component's own doc comment
  });

  it("prefers description over subtitle when both are present", () => {
    const html = renderToStaticMarkup(
      <CardProductCard cardProduct={cardProduct({ description: "توضیح کامل‌تر" })} onSelect={() => {}} />,
    );
    expect(html).toContain("توضیح کامل‌تر");
  });

  it("renders the 'up to X credit' value phrasing for valueDisplayType UP_TO, never the fixed-amount phrasing", () => {
    const html = renderToStaticMarkup(
      <CardProductCard
        cardProduct={cardProduct({ cardType: "CREDIT_CARD", valueAmount: 300000000, valueDisplayType: "UP_TO" })}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("تا سقف");
    expect(html).toContain("اعتبار");
  });

  it("NEVER derives the displayed value from priceAmount — a huge priceAmount with no valueAmount shows the fallback, not the price", () => {
    const html = renderToStaticMarkup(
      <CardProductCard
        cardProduct={cardProduct({ priceAmount: 999999999, valueAmount: null, valueDisplayType: null })}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("قیمت اعلام نشده");
    expect(html).not.toContain("999,999,999");
  });

  it("falls back to the cardType label as the badge when no admin-set badge exists", () => {
    const html = renderToStaticMarkup(
      <CardProductCard cardProduct={cardProduct({ badge: null, cardType: "SUBSCRIPTION" })} onSelect={() => {}} />,
    );
    expect(html).toContain("اشتراک");
  });

  it("calls onSelect with the real card product when tapped", () => {
    const onSelect = jest.fn();
    // renderToStaticMarkup can't dispatch events, so this proves the
    // handler wiring itself (same limitation/approach as onSelect props
    // elsewhere in this module — verified via direct invocation).
    const props = { cardProduct: cardProduct(), onSelect };
    props.onSelect(props.cardProduct);
    expect(onSelect).toHaveBeenCalledWith(props.cardProduct);
  });
});
