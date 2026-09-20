import { renderToStaticMarkup } from "react-dom/server";
import { CategoryLandingHero } from "./CategoryLandingHero";
import { CategoryLandingTools } from "./CategoryLandingTools";
import { CategoryLandingProducts, CategoryLandingInfoStrip } from "./CategoryLandingProducts";
import { CardProductTile } from "./CardProductTile";
import { availableCardTypes, filterCardProducts, normalizeSearchText } from "./categoryLandingFilter";
import type { CardProductDto, CategoryDto } from "../../lib/services-api";

const category: CategoryDto = {
  id: "cat-1",
  name: "پوشاک",
  description: "خرید از برندهای منتخب",
  imageKey: null,
  image: null,
  slug: "poushak",
  keywords: [],
  sortOrder: 0,
  active: true,
};

function card(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "svc-1",
    title: "کارت اقساطی پوشاک",
    subtitle: null,
    description: "اعتبار خرید پوشاک با پرداخت منعطف",
    imageKey: null,
    image: null,
    badge: null,
    cardType: "INSTALLMENT_CARD",
    journeyType: "PURCHASE",
    priceAmount: 30_000_000,
    priceLabel: null,
    valueAmount: 100_000_000,
    valueDisplayType: "FIXED",
    benefits: ["پرداخت منعطف"],
    validityDays: 365,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

const noop = () => {};

describe("Category Landing — hero (prototype .category-hero)", () => {
  it("renders the real category name, description, label and the real card count", () => {
    const html = renderToStaticMarkup(<CategoryLandingHero category={category} cardCount={3} cardTypes={["INSTALLMENT_CARD", "CREDIT_CARD"]} />);
    expect(html).toContain("<h1>پوشاک</h1>");
    expect(html).toContain("خرید از برندهای منتخب");
    expect(html).toContain("کارت‌های خدمات بیاوین");
    expect(html).toContain("۳ کارت قابل انتخاب");
  });

  it("lists only the card types that actually exist in the category", () => {
    const html = renderToStaticMarkup(<CategoryLandingHero category={category} cardCount={2} cardTypes={["CREDIT_CARD"]} />);
    expect(html).toContain("اعتباری");
    expect(html).not.toContain("تخفیفی");
  });

  it("omits the count chip while the cards are still loading — never a false zero", () => {
    const html = renderToStaticMarkup(<CategoryLandingHero category={category} cardCount={null} cardTypes={[]} />);
    expect(html).not.toContain("کارت قابل انتخاب");
  });

  it("renders the category's own image when set, and none otherwise", () => {
    expect(renderToStaticMarkup(<CategoryLandingHero category={{ ...category, image: "https://cdn.test/c.jpg" }} cardCount={0} cardTypes={[]} />)).toContain("https://cdn.test/c.jpg");
    expect(renderToStaticMarkup(<CategoryLandingHero category={category} cardCount={0} cardTypes={[]} />)).not.toContain("<img");
  });
});

describe("Category Landing — tools (prototype .category-tools)", () => {
  it("renders a category-specific search placeholder and a filter row of only the real types after 'همه'", () => {
    const html = renderToStaticMarkup(
      <CategoryLandingTools categoryName="پوشاک" search="" onSearchChange={noop} cardTypes={["INSTALLMENT_CARD", "CREDIT_CARD"]} filter="all" onFilterChange={noop} />,
    );
    expect(html).toContain("جستجو در کارت‌های پوشاک...");
    expect(html).toContain("همه");
    expect(html).toContain("اقساطی");
    expect(html).toContain("اعتباری");
    expect(html).not.toContain("ترکیبی");
    expect(html).toContain("cl-filter active");
  });

  it("shows no filter row for a category with no cards", () => {
    const html = renderToStaticMarkup(
      <CategoryLandingTools categoryName="پوشاک" search="" onSearchChange={noop} cardTypes={[]} filter="all" onFilterChange={noop} />,
    );
    expect(html).not.toContain("cl-filter-row");
  });
});

describe("Category Landing — CardProduct tile (prototype .service-finance-card)", () => {
  it("is one control named by the card's title, and shows only real values", () => {
    const html = renderToStaticMarkup(<CardProductTile cardProduct={card()} categoryName="پوشاک" onSelect={noop} />);
    expect(html).toContain('aria-label="کارت اقساطی پوشاک"');
    expect(html).toContain("<h3>کارت اقساطی پوشاک</h3>");
    expect(html).toContain("10,000,000 تومان"); // value, from valueAmount
    expect(html).toContain("3,000,000 تومان"); // the payable price, from priceAmount — separate fact
    expect(html).toContain("اعتبار 365 روز");
    expect(html).toContain("cl-fc--installment");
    expect(html).toContain("مشاهده شرایط کارت");
  });

  it("never prints the prototype's fake card decoration, and offers no purchase CTA on the tile", () => {
    const html = renderToStaticMarkup(<CardProductTile cardProduct={card()} categoryName="پوشاک" onSelect={noop} />);
    expect(html).not.toContain("VALID");
    expect(html).not.toContain("2088");
    expect(html).not.toContain("MEMBERSHIP");
    expect(html).not.toContain("خرید کارت");
  });

  it("uses the CardProduct's OWN image when set, and a colorway gradient (no image) otherwise", () => {
    expect(renderToStaticMarkup(<CardProductTile cardProduct={card({ image: "https://cdn.test/card.jpg" })} categoryName="پوشاک" onSelect={noop} />)).toContain("https://cdn.test/card.jpg");
    expect(renderToStaticMarkup(<CardProductTile cardProduct={card({ image: null })} categoryName="پوشاک" onSelect={noop} />)).not.toContain("url(");
  });

  it("maps each real card type to a colorway", () => {
    const kinds = (t: CardProductDto["cardType"]) => renderToStaticMarkup(<CardProductTile cardProduct={card({ cardType: t })} categoryName="پوشاک" onSelect={noop} />);
    expect(kinds("CREDIT_CARD")).toContain("cl-fc--credit");
    expect(kinds("DISCOUNT_CARD")).toContain("cl-fc--discount");
    expect(kinds("VOUCHER")).toContain("cl-fc--mixed");
  });

  it("omits the value and validity blocks when those fields are unset, instead of inventing them", () => {
    const html = renderToStaticMarkup(<CardProductTile cardProduct={card({ valueAmount: null, valueDisplayType: null, validityDays: null })} categoryName="پوشاک" onSelect={noop} />);
    expect(html).toContain("ارزش کارت مشخص نشده");
    expect(html).not.toContain("cl-fc-bottom");
  });
});

describe("Category Landing — products section (prototype .category-products-section)", () => {
  const base = { categoryName: "پوشاک", hasSearchOrFilter: false, onSelect: noop };

  it("renders the real cards with a Persian count pill", () => {
    const cards = [card({ id: "a", title: "کارت الف" }), card({ id: "b", title: "کارت ب" })];
    const html = renderToStaticMarkup(<CategoryLandingProducts {...base} cardProducts={cards} visible={cards} error={null} />);
    expect(html).toContain("کارت‌های پوشاک");
    expect(html).toContain("کارت الف");
    expect(html).toContain("کارت ب");
    expect(html).toContain("۲ کارت");
  });

  it("renders the honest empty state when the category genuinely has no cards", () => {
    const html = renderToStaticMarkup(<CategoryLandingProducts {...base} cardProducts={[]} visible={[]} error={null} />);
    expect(html).toContain("در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است.");
  });

  it("renders the prototype's no-match text when a search/filter matched nothing — distinct from an empty category", () => {
    const html = renderToStaticMarkup(<CategoryLandingProducts {...base} hasSearchOrFilter cardProducts={[card()]} visible={[]} error={null} />);
    expect(html).toContain("موردی با این عبارت پیدا نشد.");
    expect(html).not.toContain("در حال حاضر کارتی");
  });

  it("renders the error and loading states", () => {
    expect(renderToStaticMarkup(<CategoryLandingProducts {...base} cardProducts={null} visible={[]} error="خطا" />)).toContain("خطا");
    expect(renderToStaticMarkup(<CategoryLandingProducts {...base} cardProducts={null} visible={[]} error={null} />)).toContain("biawin-skeleton");
  });

  it("the info strip describes what the detail page really shows, not a discount percentage no field backs", () => {
    const html = renderToStaticMarkup(<CategoryLandingInfoStrip />);
    expect(html).toContain("کارت متناسب با نیازتان را انتخاب کنید");
    expect(html).not.toContain("درصد تخفیف");
  });
});

describe("Category Landing — filtering (page-local, over the server-scoped list)", () => {
  const cards = [
    card({ id: "a", title: "کارت اقساطی پوشاک", cardType: "INSTALLMENT_CARD" }),
    card({ id: "b", title: "کارت اعتباری پوشاک", cardType: "CREDIT_CARD", description: null, benefits: ["اعتبار فوری"] }),
  ];

  it("offers only the types that exist, in the prototype's order", () => {
    expect(availableCardTypes(cards)).toEqual(["INSTALLMENT_CARD", "CREDIT_CARD"]);
    expect(availableCardTypes([])).toEqual([]);
  });

  it("filters by type and never widens the set", () => {
    expect(filterCardProducts(cards, "CREDIT_CARD", "").map((c) => c.id)).toEqual(["b"]);
    expect(filterCardProducts(cards, "all", "").map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterCardProducts(cards, "DISCOUNT_CARD", "")).toEqual([]);
  });

  it("searches title, type, description and benefits, with the prototype's Arabic/Persian normalization", () => {
    expect(filterCardProducts(cards, "all", "اقساطی").map((c) => c.id)).toEqual(["a"]);
    expect(filterCardProducts(cards, "all", "فوری").map((c) => c.id)).toEqual(["b"]);
    expect(filterCardProducts(cards, "all", "كارت اعتباري").map((c) => c.id)).toEqual(["b"]);
    expect(filterCardProducts(cards, "all", "zzz")).toEqual([]);
  });

  it("normalizes Arabic ي/ك to Persian ی/ک", () => {
    expect(normalizeSearchText(" كارت يك ")).toBe("کارت یک");
  });
});
