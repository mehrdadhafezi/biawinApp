import { belongsToCategory } from "./serviceValidation";
import type { ServiceDto } from "../../lib/services-api";

function service(categoryId: string): ServiceDto {
  return {
    id: "s1",
    categoryId,
    merchantId: null,
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
