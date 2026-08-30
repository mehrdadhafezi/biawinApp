import { belongsToCategory, serviceReferencesMerchant } from "./serviceValidation";
import type { ServiceDto } from "../../lib/services-api";

function service(categoryId: string, merchantId: string | null = null): ServiceDto {
  return {
    id: "s1",
    categoryId,
    merchantId,
    title: "خدمت",
    groupLabel: "",
    subtitle: "",
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
  };
}

describe("belongsToCategory", () => {
  it("returns true when the real service's categoryId matches the URL's categoryId", () => {
    expect(belongsToCategory(service("cat-a"), "cat-a")).toBe(true);
  });

  it("returns false when a real, existing service belongs to a DIFFERENT real category", () => {
    expect(belongsToCategory(service("cat-a"), "cat-b")).toBe(false);
  });
});

describe("serviceReferencesMerchant (SERVICES-R4)", () => {
  it("returns true when the real service's merchantId matches the URL's merchantId", () => {
    expect(serviceReferencesMerchant(service("cat-a", "merch-a"), "merch-a")).toBe(true);
  });

  it("returns false when a real service references a DIFFERENT real merchant", () => {
    expect(serviceReferencesMerchant(service("cat-a", "merch-a"), "merch-b")).toBe(false);
  });

  it("returns false when the real service has no merchant at all (null) — never treated as a match", () => {
    expect(serviceReferencesMerchant(service("cat-a", null), "merch-a")).toBe(false);
  });
});
