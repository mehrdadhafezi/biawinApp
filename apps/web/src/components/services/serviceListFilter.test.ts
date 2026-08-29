import { filterServicesForCategory } from "./serviceListFilter";
import type { ServiceDto } from "../../lib/services-api";

function service(overrides: Partial<ServiceDto>): ServiceDto {
  return {
    id: overrides.id ?? "s",
    categoryId: "cat-a",
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
    ...overrides,
  };
}

const CATALOG: ServiceDto[] = [
  service({ id: "1", categoryId: "cat-a", title: "تور کیش", subtitle: "سفر تابستانی", availableMethods: ["credit"] }),
  service({ id: "2", categoryId: "cat-a", title: "تور دبی", subtitle: "سفر زمستانی", availableMethods: ["installment"] }),
  service({ id: "3", categoryId: "cat-a", title: "بلیط هواپیما", subtitle: "پرواز داخلی", availableMethods: ["credit", "cash"] }),
  service({ id: "4", categoryId: "cat-b", title: "تور کیش ویژه", subtitle: "بسته دیگر دسته", availableMethods: ["credit"] }),
];

describe("filterServicesForCategory", () => {
  it("never leaks a Service from another Category", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "");
    expect(result.map((s) => s.id).sort()).toEqual(["1", "2", "3"]);
    expect(result.some((s) => s.categoryId !== "cat-a")).toBe(false);
  });

  it('"همه" (all) returns every real Service in the category', () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "");
    expect(result).toHaveLength(3);
  });

  it("a specific real PurchaseMethod returns the exact real subset", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "credit", "");
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("a method with zero matches in the category returns an empty array, not an error", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "free", "");
    expect(result).toEqual([]);
  });

  it("partial search matches a substring of the title", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "کیش");
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it("partial search also matches a substring of the subtitle", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "زمستانی");
    expect(result.map((s) => s.id)).toEqual(["2"]);
  });

  it("search never matches another category's Service even with an identical-looking title", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "ویژه");
    expect(result).toEqual([]);
  });

  it("clearing the search query (empty string) restores the full method-filtered subset", () => {
    const withSearch = filterServicesForCategory(CATALOG, "cat-a", "credit", "کیش");
    expect(withSearch.map((s) => s.id)).toEqual(["1"]);
    const cleared = filterServicesForCategory(CATALOG, "cat-a", "credit", "");
    expect(cleared.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("search + method filter compose as an intersection, not a union", () => {
    // "تور" matches services 1 and 2 by title; only credit (service 1) should survive the intersection with credit.
    const result = filterServicesForCategory(CATALOG, "cat-a", "credit", "تور");
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it('selecting "همه" preserves the current search query across all real methods in the category', () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "تور");
    expect(result.map((s) => s.id).sort()).toEqual(["1", "2"]);
  });

  it("produces no duplicate cards for any composition", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "");
    const ids = result.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a search query that matches nothing real returns an empty array", () => {
    const result = filterServicesForCategory(CATALOG, "cat-a", "all", "نامنطبق‌ترین‌عبارت‌ممکن");
    expect(result).toEqual([]);
  });
});
