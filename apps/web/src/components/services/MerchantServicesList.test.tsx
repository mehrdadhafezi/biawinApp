import { renderToStaticMarkup } from "react-dom/server";
import { MerchantServicesList } from "./MerchantServicesList";
import type { ServiceDto } from "../../lib/services-api";

function service(overrides: Partial<ServiceDto>): ServiceDto {
  return {
    id: "s1",
    categoryId: "c1",
    merchantId: "m1",
    title: "خدمت دیگر",
    groupLabel: "",
    subtitle: "زیرعنوان",
    badge: "",
    icon: null,
    imageKey: null,
    priceFrom: null,
    priceLabel: null,
    availableMethods: [],
    installmentMinMonths: null,
    installmentMaxMonths: null,
    creditMultiplierLabel: null,
    benefits: [],
    galleryKeys: [],
    faq: [],
    tags: [],
    active: true,
    ...overrides,
  };
}

describe("MerchantServicesList (SERVICES-R4)", () => {
  it("shows the honest real-data empty state when the merchant has no other real services — the actual state for every real merchant today", () => {
    const html = renderToStaticMarkup(<MerchantServicesList services={[]} onSelect={() => {}} />);
    expect(html).toContain("خدمت دیگری از این فروشنده ثبت نشده است.");
  });

  it("renders real other services from the same merchant when present", () => {
    const html = renderToStaticMarkup(<MerchantServicesList services={[service({})]} onSelect={() => {}} />);
    expect(html).toContain("خدمت دیگر");
    expect(html).not.toContain("خدمت دیگری از این فروشنده ثبت نشده است.");
  });
});
