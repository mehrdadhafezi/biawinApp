import { renderToStaticMarkup } from "react-dom/server";
import { ServiceTerms } from "./ServiceTerms";
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

describe("ServiceTerms", () => {
  it("renders each term", () => {
    const html = renderToStaticMarkup(<ServiceTerms service={service({ terms: ["شرط یک", "شرط دو"] })} />);
    expect(html).toContain("شرط یک");
    expect(html).toContain("شرط دو");
    expect(html).toContain("شرایط و ضوابط");
  });

  it("renders nothing when terms is empty", () => {
    const html = renderToStaticMarkup(<ServiceTerms service={service({ terms: [] })} />);
    expect(html).toBe("");
  });
});
