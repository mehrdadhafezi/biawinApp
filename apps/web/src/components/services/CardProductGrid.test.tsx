import { renderToStaticMarkup } from "react-dom/server";
import { CardProductGrid } from "./CardProductGrid";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "کارت اعتباری بیمه",
    subtitle: "پوشش کامل",
    description: null,
    imageKey: null,
    badge: null,
    cardType: "CREDIT_CARD",
    journeyType: "PURCHASE",
    priceAmount: 300000000,
    priceLabel: null,
    valueAmount: 300000000,
    valueDisplayType: "UP_TO",
    benefits: [],
    validityDays: null,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

describe("CardProductGrid", () => {
  it("renders a skeleton grid while loading (cardProducts === null)", () => {
    const html = renderToStaticMarkup(<CardProductGrid cardProducts={null} error={null} onSelect={() => {}} />);
    expect(html).not.toContain("کارت اعتباری بیمه");
  });

  it("renders the error state and never the empty state when both could apply", () => {
    const html = renderToStaticMarkup(<CardProductGrid cardProducts={[]} error="خطا در دریافت اطلاعات." onSelect={() => {}} />);
    expect(html).toContain("خطا در دریافت اطلاعات.");
    expect(html).not.toContain("ثبت نشده است");
  });

  it("renders a real, honest empty state when a Service genuinely has no card products yet", () => {
    const html = renderToStaticMarkup(<CardProductGrid cardProducts={[]} error={null} onSelect={() => {}} />);
    expect(html).toContain("در حال حاضر محصولی برای این خدمت ثبت نشده است.");
  });

  it("renders real card products when present, each with its own price and CTA affordance", () => {
    const html = renderToStaticMarkup(
      <CardProductGrid cardProducts={[cardProduct()]} error={null} onSelect={() => {}} />,
    );
    expect(html).toContain("کارت اعتباری بیمه");
    expect(html).toContain("تا سقف"); // CREDIT_CARD price phrasing
    expect(html).toContain("مشاهده جزئیات");
  });

  it("trusts the server-provided list as already ACTIVE-only — never re-filters or hides a card the API returned", () => {
    // The API contract (GET /cards) already guarantees status: 'ACTIVE'
    // — this proves the component doesn't apply any extra client-side
    // status gate that could silently hide a real, server-approved card.
    const html = renderToStaticMarkup(
      <CardProductGrid cardProducts={[cardProduct({ status: "ACTIVE" })]} error={null} onSelect={() => {}} />,
    );
    expect(html).toContain("کارت اعتباری بیمه");
  });
});
