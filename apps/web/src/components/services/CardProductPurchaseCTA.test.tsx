import { renderToStaticMarkup } from "react-dom/server";
import { CardProductPurchaseCTA } from "./CardProductPurchaseCTA";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "کارت اعتباری بیمه شخص ثالث",
    subtitle: null,
    description: null,
    imageKey: null,
    image: null,
    badge: null,
    cardType: "CREDIT_CARD",
    journeyType: "PURCHASE",
    priceAmount: 1000000,
    priceLabel: null,
    valueAmount: 30000000,
    valueDisplayType: "UP_TO",
    benefits: [],
    validityDays: null,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

/**
 * SERVICES-R5.26 — only the NOT-purchasable branch is unit-testable here:
 * the purchasable branch renders `PurchaseSheet`, which calls `useRouter()`
 * and throws under `renderToStaticMarkup` in this workspace's Node-only
 * Jest environment (verified directly — the same reason `AuthModal.tsx`,
 * the closest prior-art `useRouter()` consumer, has no unit test either).
 * The eligibility DECISION itself (`isCardProductPurchasable`) is fully
 * covered in `cardProductPresentation.test.ts`; the purchasable branch's
 * actual rendering/behavior is proven live in the browser instead (see
 * docs/services-r5-26-purchase-flow-report.md §11).
 */
describe("CardProductPurchaseCTA — not-purchasable branch", () => {
  it("renders the disabled CTA (never a fake-looking real one) when journeyType is not PURCHASE", () => {
    const html = renderToStaticMarkup(<CardProductPurchaseCTA cardProduct={cardProduct({ journeyType: "LEAD" })} />);
    expect(html).toContain("disabled");
    expect(html).toContain("خرید کارت");
    expect(html).toContain("به‌زودی");
  });

  it("renders the disabled CTA when priceAmount is null, even for a PURCHASE journey", () => {
    const html = renderToStaticMarkup(
      <CardProductPurchaseCTA cardProduct={cardProduct({ journeyType: "PURCHASE", priceAmount: null })} />,
    );
    expect(html).toContain("disabled");
  });

  it("renders the disabled CTA when priceAmount is zero", () => {
    const html = renderToStaticMarkup(
      <CardProductPurchaseCTA cardProduct={cardProduct({ journeyType: "PURCHASE", priceAmount: 0 })} />,
    );
    expect(html).toContain("disabled");
  });
});
