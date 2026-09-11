import { renderToStaticMarkup } from "react-dom/server";
import { ServiceUsageGuide } from "./ServiceUsageGuide";
import type { ServiceDto } from "../../lib/services-api";

function service(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    id: "s1",
    categoryId: "c1",
    merchantId: null,
    title: "خرید پوشاک",
    groupLabel: "پوشاک",
    subtitle: "خرید کارت هدیه پوشاک",
    badge: "پرفروش",
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
    image: null,
    gallery: [],
    description: null,
    usageGuide: [],
    terms: [],
    active: true,
    ...overrides,
  };
}

describe("ServiceUsageGuide", () => {
  it("renders each step with a Persian-digit ordinal, in order", () => {
    const html = renderToStaticMarkup(
      <ServiceUsageGuide
        service={service({ usageGuide: ["خرید کارت", "ورود به سایت مقصد", "استفاده از اعتبار"] })}
      />,
    );
    expect(html).toContain("۱. خرید کارت");
    expect(html).toContain("۲. ورود به سایت مقصد");
    expect(html).toContain("۳. استفاده از اعتبار");
  });

  it("renders nothing when usageGuide is empty", () => {
    const html = renderToStaticMarkup(<ServiceUsageGuide service={service({ usageGuide: [] })} />);
    expect(html).toBe("");
  });
});
