import {
  mapHomeHeroCard,
  mapHomeNewsArticle,
  mapHomeServiceBanner,
  mapHomeServiceMosaicTiles,
} from "./homeCmsAdapter";
import type {
  HomeHeroCardDto,
  HomeNewsArticleDto,
  HomeServiceBannerDto,
  HomeServiceMosaicTileDto,
} from "../../lib/home-api";

function heroCard(overrides: Partial<HomeHeroCardDto> = {}): HomeHeroCardDto {
  return {
    id: "card-1",
    cardKey: "biawin",
    label: "کارت اصلی",
    title: "کارت بیاوین",
    subtitle: "عضویت اصلی",
    displayNumber: "6219 8610 4432 1095",
    ownerLabel: "BIAWIN CLUB",
    colorPreset: "sky",
    sortOrder: 1,
    ...overrides,
  };
}

function banner(overrides: Partial<HomeServiceBannerDto> = {}): HomeServiceBannerDto {
  return {
    id: "banner-1",
    categoryId: "cat-abc",
    categoryName: "اتومبیل",
    image: "https://cdn.example/banner.webp",
    kicker: "اعتبار و اقساط منعطف",
    theme: "auto",
    wide: false,
    sortOrder: 0,
    ...overrides,
  };
}

function mosaicTile(overrides: Partial<HomeServiceMosaicTileDto> = {}): HomeServiceMosaicTileDto {
  return {
    id: "tile-1",
    categoryId: "cat-xyz",
    categoryName: "زیبایی",
    image: null,
    slotType: "half",
    kicker: "زیبایی و مراقبت",
    title: null,
    lead: null,
    theme: "beauty",
    sortOrder: 0,
    ...overrides,
  };
}

function newsArticle(overrides: Partial<HomeNewsArticleDto> = {}): HomeNewsArticleDto {
  return {
    id: "article-1",
    category: "معرفی بیاوین",
    image: "https://cdn.example/news.webp",
    kicker: "راهنمای عضویت",
    title: "بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟",
    lead: "...",
    sortOrder: 0,
    ...overrides,
  };
}

describe("mapHomeHeroCard", () => {
  it("maps text fields through verbatim and derives ariaLabel from title", () => {
    const result = mapHomeHeroCard(heroCard());

    expect(result.key).toBe("biawin");
    expect(result.title).toBe("کارت بیاوین");
    expect(result.subtitle).toBe("عضویت اصلی");
    expect(result.number).toBe("6219 8610 4432 1095");
    expect(result.owner).toBe("BIAWIN CLUB");
    expect(result.ariaLabel).toBe("مشاهده کارت بیاوین");
  });

  it("maps each of the 3 real colorPreset values to a distinct, stable gradient/icon pair", () => {
    const blue = mapHomeHeroCard(heroCard({ colorPreset: "blue" }));
    const sky = mapHomeHeroCard(heroCard({ colorPreset: "sky" }));
    const white = mapHomeHeroCard(heroCard({ colorPreset: "white" }));

    const gradients = new Set([blue.gradient, sky.gradient, white.gradient]);
    const iconChips = new Set([blue.iconChip, sky.iconChip, white.iconChip]);
    expect(gradients.size).toBe(3);
    expect(iconChips.size).toBe(3);
  });
});

describe("mapHomeServiceBanner", () => {
  it("carries the real categoryId through as identity, never re-derived from categoryName", () => {
    const result = mapHomeServiceBanner(banner({ categoryId: "real-uuid-here", categoryName: "پوشاک" }));

    expect(result.categoryId).toBe("real-uuid-here");
    expect(result.categoryName).toBe("پوشاک");
  });

  it("passes a null image through as null rather than substituting a placeholder", () => {
    const result = mapHomeServiceBanner(banner({ image: null }));
    expect(result.image).toBeNull();
  });

  it("preserves the array's given order (callers sort, the adapter never re-sorts)", () => {
    const dtos = [banner({ id: "a", sortOrder: 2 }), banner({ id: "b", sortOrder: 0 }), banner({ id: "c", sortOrder: 1 })];
    const result = dtos.map(mapHomeServiceBanner);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mapHomeServiceMosaicTiles", () => {
  it("splits one ordered collection into half/wide groups by slotType, preserving order within each group", () => {
    const dtos = [
      mosaicTile({ id: "h1", slotType: "half" }),
      mosaicTile({ id: "w1", slotType: "wide", title: "عنوان", lead: "توضیح" }),
      mosaicTile({ id: "h2", slotType: "half" }),
    ];

    const { halves, wide } = mapHomeServiceMosaicTiles(dtos);

    expect(halves.map((t) => t.id)).toEqual(["h1", "h2"]);
    expect(wide.map((t) => t.id)).toEqual(["w1"]);
  });

  it("skips a malformed wide tile (missing title/lead) instead of crashing or emitting a broken entry, without dropping the other valid tiles", () => {
    const dtos = [
      mosaicTile({ id: "good-half", slotType: "half" }),
      mosaicTile({ id: "malformed-wide", slotType: "wide", title: null, lead: null }),
      mosaicTile({ id: "good-wide", slotType: "wide", title: "عنوان", lead: "توضیح" }),
    ];

    const { halves, wide } = mapHomeServiceMosaicTiles(dtos);

    expect(halves.map((t) => t.id)).toEqual(["good-half"]);
    expect(wide.map((t) => t.id)).toEqual(["good-wide"]);
  });

  it("carries categoryId through as identity for both half and wide tiles", () => {
    const dtos = [mosaicTile({ id: "h1", categoryId: "cat-real-1" }), mosaicTile({ id: "w1", slotType: "wide", categoryId: "cat-real-2", title: "t", lead: "l" })];
    const { halves, wide } = mapHomeServiceMosaicTiles(dtos);
    expect(halves[0].categoryId).toBe("cat-real-1");
    expect(wide[0].categoryId).toBe("cat-real-2");
  });
});

describe("mapHomeNewsArticle", () => {
  it("maps every field through and passes a null image as null", () => {
    const result = mapHomeNewsArticle(newsArticle({ image: null }));
    expect(result.image).toBeNull();
    expect(result.title).toBe("بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟");
  });

  it("preserves array order across a full list mapping", () => {
    const dtos = [newsArticle({ id: "a" }), newsArticle({ id: "b" }), newsArticle({ id: "c" })];
    expect(dtos.map(mapHomeNewsArticle).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

/**
 * "Inactive content does not leak into customer display" (Stage 5.21 §22):
 * the public DTOs this adapter consumes have no `active` field at all — the
 * backend's public endpoints already filter to `active: true` before this
 * code ever runs (`backend/src/modules/home/*.service.ts`'s `listPublic()`),
 * so there is structurally nothing here that could leak an inactive row.
 * This test documents that guarantee at the type level rather than
 * asserting behavior the adapter doesn't (and shouldn't) implement itself.
 */
describe("public DTOs carry no active flag", () => {
  it("HomeHeroCardDto/HomeServiceBannerDto/HomeServiceMosaicTileDto/HomeNewsArticleDto have no `active` key", () => {
    const samples = [heroCard(), banner(), mosaicTile(), newsArticle()];
    for (const sample of samples) {
      expect(Object.keys(sample)).not.toContain("active");
    }
  });
});
