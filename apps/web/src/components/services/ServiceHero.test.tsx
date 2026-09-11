import { renderToStaticMarkup } from "react-dom/server";
import { ServiceHero } from "./ServiceHero";
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
    icon: "🛍️",
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

describe("ServiceHero", () => {
  it("renders the real, backend-resolved image when set (SERVICES-R5.22)", () => {
    const html = renderToStaticMarkup(
      <ServiceHero service={service({ image: "https://cdn.test/services/service-1.jpg" })} />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("https://cdn.test/services/service-1.jpg");
  });

  it("falls back to the icon emoji when no image is set — never a fabricated one", () => {
    const html = renderToStaticMarkup(<ServiceHero service={service({ image: null, icon: "🚗" })} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("🚗");
  });
});
