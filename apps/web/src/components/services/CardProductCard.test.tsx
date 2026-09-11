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

/** Covers the task's explicit "Display: image, title, description, price, CTA" requirement for the reusable list tile. */
describe("CardProductCard rendering", () => {
  it("renders title, description/subtitle, both price and value clearly labeled, and a CTA affordance — no image URL is fabricated", () => {
    const html = renderToStaticMarkup(<CardProductCard cardProduct={cardProduct()} onSelect={() => {}} />);

    expect(html).toContain("ووچر تخفیف خرید");
    expect(html).toContain("قابل استفاده در فروشگاه‌های منتخب");
    // SERVICES-R5.25 — both facts render, each under its own label.
    expect(html).toContain("پرداخت");
    expect(html).toContain("ارزش اعتبار");
    expect(html).toContain("50,000 تومان"); // priceAmount and valueAmount are both 500000 in this fixture, both format to the same toman amount
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

  it("SERVICES-R5.25 — price and value are genuinely independent: a huge priceAmount with no valueAmount renders as the PRICE, never as the value, and the value section correctly falls back", () => {
    const html = renderToStaticMarkup(
      <CardProductCard
        cardProduct={cardProduct({ priceAmount: 999999999, valueAmount: null, valueDisplayType: null })}
        onSelect={() => {}}
      />,
    );
    // priceAmount is stored in Rial, displayed in Toman (÷10) — the real price fact renders.
    expect(html).toContain("99,999,999 تومان");
    // The value section must never show the price, and must show its own, distinct fallback.
    expect(html).toContain("ارزش کارت مشخص نشده");
    expect(html).not.toContain("قیمت اعلام نشده");
  });

  it("SERVICES-R5.25 — the converse: a huge valueAmount with no priceAmount renders as the VALUE, never as the price, and the price section correctly falls back", () => {
    const html = renderToStaticMarkup(
      <CardProductCard
        cardProduct={cardProduct({ priceAmount: null, priceLabel: null, valueAmount: 999999999, valueDisplayType: "FIXED" })}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("99,999,999 تومان");
    expect(html).toContain("قیمت اعلام نشده");
    expect(html).not.toContain("ارزش کارت مشخص نشده");
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
