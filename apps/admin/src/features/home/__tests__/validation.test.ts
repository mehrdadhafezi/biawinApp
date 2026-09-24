import {
  BODY_SLUG_PATTERN,
  HOME_LIMITS,
  isUuid,
  summarizeErrors,
  validateCategoryId,
  validateHeroCard,
  validateMediaAssetId,
  validateNewsArticle,
  validateReorderEntries,
  validateServiceBanner,
  validateServiceMosaic,
  validateSortOrder,
} from "../validation";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

const validHero = { label: "L", title: "T", subtitle: "S", displayNumber: "1234", ownerLabel: "O" };

describe("limits mirror the verified Stage 5.16 backend DTOs", () => {
  it("has exactly the backend's max lengths and sortOrder ceiling", () => {
    expect(HOME_LIMITS.hero).toEqual({ label: 100, title: 200, subtitle: 500, displayNumber: 50, ownerLabel: 100 });
    expect(HOME_LIMITS.banner).toEqual({ kicker: 200 });
    expect(HOME_LIMITS.mosaic).toEqual({ kicker: 200, title: 200, lead: 500 });
    expect(HOME_LIMITS.news).toEqual({ category: 100, kicker: 200, title: 300, lead: 1000, bodySlug: 100 });
    expect(HOME_LIMITS.sortOrderMax).toBe(100000);
  });
});

describe("validateHeroCard", () => {
  it("accepts a fully valid card", () => {
    expect(validateHeroCard(validHero)).toEqual({});
  });

  it.each(["", "   "])("rejects blank required text (%j) on every field", (blank) => {
    const errors = validateHeroCard({ label: blank, title: blank, subtitle: blank, displayNumber: blank, ownerLabel: blank });
    expect(Object.keys(errors).sort()).toEqual(["displayNumber", "label", "ownerLabel", "subtitle", "title"]);
  });

  it("enforces max length at the boundary (100 ok, 101 rejected for label; 50/51 for displayNumber)", () => {
    expect(validateHeroCard({ ...validHero, label: "ا".repeat(100) })).toEqual({});
    expect(validateHeroCard({ ...validHero, label: "ا".repeat(101) }).label).toBeDefined();
    expect(validateHeroCard({ ...validHero, displayNumber: "1".repeat(50) })).toEqual({});
    expect(validateHeroCard({ ...validHero, displayNumber: "1".repeat(51) }).displayNumber).toBeDefined();
  });
});

describe("validateServiceBanner", () => {
  it("accepts a valid banner with and without media (nullable mediaAssetId)", () => {
    expect(validateServiceBanner({ categoryId: U1, kicker: "k", mediaAssetId: null })).toEqual({});
    expect(validateServiceBanner({ categoryId: U1, kicker: "k", mediaAssetId: U2 })).toEqual({});
  });

  it("treats an omitted mediaAssetId (unresolved unavailable image) as valid", () => {
    expect(validateServiceBanner({ categoryId: U1, kicker: "k", mediaAssetId: undefined })).toEqual({});
  });

  it("requires a category and rejects a malformed category / media uuid", () => {
    expect(validateServiceBanner({ categoryId: "", kicker: "k", mediaAssetId: null }).categoryId).toContain("الزامی");
    expect(validateServiceBanner({ categoryId: "not-a-uuid", kicker: "k", mediaAssetId: null }).categoryId).toBeDefined();
    expect(validateServiceBanner({ categoryId: U1, kicker: "k", mediaAssetId: "nope" }).mediaAssetId).toBeDefined();
  });

  it("rejects a blank or over-long kicker (200 max)", () => {
    expect(validateServiceBanner({ categoryId: U1, kicker: "  ", mediaAssetId: null }).kicker).toBeDefined();
    expect(validateServiceBanner({ categoryId: U1, kicker: "k".repeat(200), mediaAssetId: null })).toEqual({});
    expect(validateServiceBanner({ categoryId: U1, kicker: "k".repeat(201), mediaAssetId: null }).kicker).toBeDefined();
  });
});

describe("validateServiceMosaic", () => {
  const base = { categoryId: U1, kicker: "k", title: "", lead: "", mediaAssetId: null };

  it("BD-5: title and lead stay optional (blank is valid)", () => {
    expect(validateServiceMosaic(base)).toEqual({});
  });

  it("checks title/lead length only (200 / 500)", () => {
    expect(validateServiceMosaic({ ...base, title: "t".repeat(201) }).title).toBeDefined();
    expect(validateServiceMosaic({ ...base, lead: "l".repeat(501) }).lead).toBeDefined();
    expect(validateServiceMosaic({ ...base, title: "t".repeat(200), lead: "l".repeat(500) })).toEqual({});
  });

  it("requires category and kicker", () => {
    const errors = validateServiceMosaic({ ...base, categoryId: "", kicker: "" });
    expect(errors.categoryId).toBeDefined();
    expect(errors.kicker).toBeDefined();
  });
});

describe("validateNewsArticle", () => {
  const base = { category: "c", kicker: "k", title: "t", lead: "l", bodySlug: "", mediaAssetId: null };

  it("accepts a valid article; bodySlug is optional", () => {
    expect(validateNewsArticle(base)).toEqual({});
    expect(validateNewsArticle({ ...base, bodySlug: "spring-sale-2026" })).toEqual({});
  });

  it("bodySlug format matches the backend pattern", () => {
    for (const bad of ["Has Space", "UPPER", "under_score", "double--hyphen", "-lead", "trail-", "سلام"]) {
      expect(validateNewsArticle({ ...base, bodySlug: bad }).bodySlug).toBeDefined();
    }
    expect(BODY_SLUG_PATTERN.test("a-b-c")).toBe(true);
  });

  it("bodySlug max length 100 (101 rejected)", () => {
    expect(validateNewsArticle({ ...base, bodySlug: "a".repeat(100) })).toEqual({});
    expect(validateNewsArticle({ ...base, bodySlug: "a".repeat(101) }).bodySlug).toBeDefined();
  });

  it("required texts and their max lengths (100/200/300/1000)", () => {
    const blank = validateNewsArticle({ ...base, category: "", kicker: "", title: "", lead: "" });
    expect(Object.keys(blank).sort()).toEqual(["category", "kicker", "lead", "title"]);
    expect(validateNewsArticle({ ...base, category: "c".repeat(101) }).category).toBeDefined();
    expect(validateNewsArticle({ ...base, title: "t".repeat(301) }).title).toBeDefined();
    expect(validateNewsArticle({ ...base, lead: "l".repeat(1001) }).lead).toBeDefined();
    expect(validateNewsArticle({ ...base, lead: "l".repeat(1000), title: "t".repeat(300) })).toEqual({});
  });
});

describe("uuid / sortOrder / reorder guards", () => {
  it("isUuid", () => {
    expect(isUuid(U1)).toBe(true);
    expect(isUuid("banner-1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(validateCategoryId(U1)).toBeNull();
    expect(validateMediaAssetId(null)).toBeNull();
    expect(validateMediaAssetId(undefined)).toBeNull();
    expect(validateMediaAssetId("x")).not.toBeNull();
  });

  it("sortOrder must be an integer within 0..100000", () => {
    expect(validateSortOrder(0)).toBeNull();
    expect(validateSortOrder(100000)).toBeNull();
    expect(validateSortOrder(-1)).not.toBeNull();
    expect(validateSortOrder(100001)).not.toBeNull();
    expect(validateSortOrder(1.5)).not.toBeNull();
  });

  it("validateReorderEntries accepts the shapes the UI and the Stage 5.22 QA send (full list, single item, swap)", () => {
    expect(validateReorderEntries([{ id: U1, sortOrder: 0 }])).toBeNull();
    expect(
      validateReorderEntries([
        { id: U1, sortOrder: 1 },
        { id: U2, sortOrder: 0 },
      ]),
    ).toBeNull();
  });

  it("rejects empty, malformed id, duplicate ids, duplicate positions, out-of-range positions", () => {
    expect(validateReorderEntries([])).not.toBeNull();
    expect(validateReorderEntries([{ id: "not-a-uuid", sortOrder: 0 }])).not.toBeNull();
    expect(
      validateReorderEntries([
        { id: U1, sortOrder: 0 },
        { id: U1, sortOrder: 1 },
      ]),
    ).toContain("شناسه تکراری");
    expect(
      validateReorderEntries([
        { id: U1, sortOrder: 3 },
        { id: U2, sortOrder: 3 },
      ]),
    ).toContain("جایگاه تکراری");
    expect(validateReorderEntries([{ id: U1, sortOrder: -1 }])).not.toBeNull();
    expect(validateReorderEntries([{ id: U1, sortOrder: 100001 }])).not.toBeNull();
  });

  it("summarizeErrors returns the first message plus a count", () => {
    expect(summarizeErrors({})).toBeNull();
    expect(summarizeErrors({ a: "x" })).toBe("x");
    expect(summarizeErrors({ a: "x", b: "y", c: undefined })).toBe("x (و 1 مورد دیگر)");
  });
});
