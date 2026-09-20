import {
  belongsToCategory,
  cardProductBelongsToService,
  cardProductDetailHref,
  serviceReferencesMerchant,
} from "./serviceValidation";
import type { CardProductDto, ServiceDto } from "../../lib/services-api";

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
    image: null,
    gallery: [],
    description: null,
    usageGuide: [],
    terms: [],
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

function cardProduct(serviceId: string): CardProductDto {
  return {
    id: "card-1",
    serviceId,
    title: "کارت",
    subtitle: null,
    description: null,
    imageKey: null,
    image: null,
    badge: null,
    cardType: "VOUCHER",
    journeyType: "PURCHASE",
    priceAmount: null,
    priceLabel: null,
    valueAmount: null,
    valueDisplayType: null,
    benefits: [],
    validityDays: null,
    status: "ACTIVE",
    sortOrder: 0,
  };
}

describe("cardProductBelongsToService (SERVICES-R5.18)", () => {
  it("returns true when the real card product's serviceId matches the URL's serviceId", () => {
    expect(cardProductBelongsToService(cardProduct("service-a"), "service-a")).toBe(true);
  });

  it("returns false when a real, ACTIVE card product belongs to a DIFFERENT real service", () => {
    expect(cardProductBelongsToService(cardProduct("service-a"), "service-b")).toBe(false);
  });
});

describe("cardProductDetailHref (Category Landing navigation)", () => {
  it("goes STRAIGHT to the CardProduct's own detail route — its owner Service id is a path segment, not a page", () => {
    expect(cardProductDetailHref("cat-1", { id: "card-9", serviceId: "svc-1" })).toBe("/services/cat-1/svc-1/cards/card-9");
  });

  it("always ends at the CardProduct — never at a Service page or a purchase route (the extra layer this replaced)", () => {
    const href = cardProductDetailHref("cat-1", { id: "card-9", serviceId: "svc-1" });
    expect(href.split("/")).toEqual(["", "services", "cat-1", "svc-1", "cards", "card-9"]);
    expect(href).not.toMatch(/\/services\/[^/]+\/[^/]+$/);
  });
});
