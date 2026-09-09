import { renderToStaticMarkup } from "react-dom/server";
import { CardProductHero } from "./CardProductHero";
import { CardProductInfo } from "./CardProductInfo";
import { DisabledCardPurchaseCTA } from "./DisabledCardPurchaseCTA";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "کارت اعتباری بیمه شخص ثالث",
    subtitle: "پوشش کامل خودرو",
    description: "توضیحات کامل این کارت اعتباری برای بیمه شخص ثالث.",
    imageKey: null,
    badge: "پرفروش",
    cardType: "CREDIT_CARD",
    journeyType: "PURCHASE",
    priceAmount: 300000000,
    priceLabel: null,
    valueAmount: 300000000,
    valueDisplayType: "UP_TO",
    benefits: ["تخفیف ویژه اعضا", "فعال‌سازی آنی"],
    validityDays: 365,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

/**
 * SERVICES-R5.18 — the exact composition
 * `app/services/[categoryId]/[serviceId]/cards/[cardProductId]/page.tsx`
 * renders once a card product loads, mirroring
 * `ServiceDetailCardOnly.test.tsx`'s established convention for the
 * sibling Service Detail route.
 */
describe("Card Product Detail composition", () => {
  it("renders title, description, benefits, validity, and price — the CTA is disabled and does nothing when tapped", () => {
    const html = renderToStaticMarkup(
      <>
        <CardProductHero cardProduct={cardProduct()} />
        <CardProductInfo cardProduct={cardProduct()} />
        <DisabledCardPurchaseCTA />
      </>,
    );

    expect(html).toContain("کارت اعتباری بیمه شخص ثالث");
    expect(html).toContain("توضیحات کامل این کارت اعتباری برای بیمه شخص ثالث.");
    expect(html).toContain("تخفیف ویژه اعضا");
    expect(html).toContain("365 روز از فعال‌سازی");
    expect(html).toContain("تا سقف");
    expect(html).toContain("disabled");
    expect(html).toContain("خرید کارت");
    expect(html).toContain("به‌زودی");
  });

  it("renders the value from valueAmount/valueDisplayType, never from priceAmount (SERVICES-R5.19)", () => {
    const html = renderToStaticMarkup(
      <CardProductHero cardProduct={cardProduct({ priceAmount: 999999999, valueAmount: 300000000, valueDisplayType: "UP_TO" })} />,
    );
    expect(html).toContain("تا سقف 30,000,000 تومان اعتبار");
    expect(html).not.toContain("999,999,999");
  });

  it("never renders a 'usage guide' or 'terms' section — no such field exists on the real CardProduct model", () => {
    const html = renderToStaticMarkup(<CardProductInfo cardProduct={cardProduct()} />);
    expect(html).not.toContain("راهنمای استفاده");
    expect(html).not.toContain("شرایط و ضوابط");
  });

  it("CardProductInfo renders nothing at all when a card product genuinely has no benefits and no validity period", () => {
    const html = renderToStaticMarkup(
      <CardProductInfo cardProduct={cardProduct({ benefits: [], validityDays: null })} />,
    );
    expect(html).toBe("");
  });
});
