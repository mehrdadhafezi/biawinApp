import { renderToStaticMarkup } from "react-dom/server";
import { ServiceDescription } from "./ServiceDescription";
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

describe("ServiceDescription", () => {
  it("renders the real description when set", () => {
    const html = renderToStaticMarkup(
      <ServiceDescription service={service({ description: "توضیحات کامل تستی" })} />,
    );
    expect(html).toContain("توضیحات کامل تستی");
    expect(html).toContain("درباره این خدمت");
  });

  it("renders nothing when description is empty (never a fabricated section)", () => {
    const html = renderToStaticMarkup(<ServiceDescription service={service({ description: null })} />);
    expect(html).toBe("");
  });
});
