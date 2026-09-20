import { renderToStaticMarkup } from "react-dom/server";
import { CardProductDetailHero } from "./CardProductDetailHero";
import { CardProductDetailSummary } from "./CardProductDetailSummary";
import { CardProductBenefits, CardProductProcess, CardProductFaq, CARD_PURCHASE_PROCESS, cardFaqItems } from "./CardProductDetailSections";
import { CardProductBuyBar } from "./CardProductBuyBar";
import { cardProductValueCaption, formatCardProductValidity, formatCardProductValueCompact } from "./cardProductPresentation";
import type { CardProductDto } from "../../lib/services-api";

function cardProduct(overrides: Partial<CardProductDto> = {}): CardProductDto {
  return {
    id: "card-1",
    serviceId: "service-1",
    title: "کارت اعتباری بیمه شخص ثالث",
    subtitle: "پوشش کامل خودرو",
    description: "توضیحات کامل این کارت اعتباری برای بیمه شخص ثالث.",
    imageKey: null,
    image: null,
    badge: "پرفروش",
    cardType: "CREDIT_CARD",
    journeyType: "PURCHASE",
    priceAmount: 30000000,
    priceLabel: null,
    valueAmount: 300000000,
    valueDisplayType: "UP_TO",
    benefits: ["تخفیف ویژه اعضا", "فعال‌سازی آنی"],
    validityDays: 365,
    status: "ACTIVE",
    sortOrder: 0,
    ...overrides,
  };
}

describe("Card Product Detail — hero (prototype .detail-hero)", () => {
  it("renders the real title as the page's h1, the real description, category and card-type badges", () => {
    const html = renderToStaticMarkup(<CardProductDetailHero cardProduct={cardProduct({ badge: null })} categoryName="بیمه" />);
    expect(html).toContain("<h1>کارت اعتباری بیمه شخص ثالث</h1>");
    expect(html).toContain("توضیحات کامل این کارت اعتباری برای بیمه شخص ثالث.");
    expect(html).toContain("بیمه");
    expect(html).toContain("کارت اعتباری");
  });

  it("renders the real, backend-resolved image when set (SERVICES-R5.22)", () => {
    const html = renderToStaticMarkup(
      <CardProductDetailHero cardProduct={cardProduct({ image: "https://cdn.test/card-products/card-1.jpg" })} categoryName="بیمه" />,
    );
    expect(html).toContain("<img");
    expect(html).toContain("https://cdn.test/card-products/card-1.jpg");
  });

  it("renders NO image element when none is set — never a fabricated or borrowed one", () => {
    const html = renderToStaticMarkup(<CardProductDetailHero cardProduct={cardProduct({ image: null })} categoryName="بیمه" />);
    expect(html).not.toContain("<img");
  });

  it("stat tiles come only from real fields: type, value (captioned by display type), validity", () => {
    const html = renderToStaticMarkup(<CardProductDetailHero cardProduct={cardProduct()} categoryName="بیمه" />);
    expect(html).toContain("نوع کارت");
    expect(html).toContain("30,000,000 تومان");
    expect(html).toContain("سقف اعتبار");
    expect(html).toContain("365 روز");
    expect(html).toContain("مدت اعتبار");
  });

  it("omits the value and validity tiles when those fields are unset, instead of inventing them", () => {
    const html = renderToStaticMarkup(
      <CardProductDetailHero cardProduct={cardProduct({ valueAmount: null, valueDisplayType: null, validityDays: null })} categoryName="بیمه" />,
    );
    expect(html).toContain("نوع کارت");
    expect(html).not.toContain("سقف اعتبار");
    expect(html).not.toContain("مدت اعتبار");
  });

  it("never prints the prototype's static 'خرید امن' claim — no backend behind it", () => {
    expect(renderToStaticMarkup(<CardProductDetailHero cardProduct={cardProduct()} categoryName="بیمه" />)).not.toContain("خرید امن");
  });
});

describe("Card Product Detail — summary/facts (prototype .detail-selected-card-summary / .detail-card-facts)", () => {
  it("renders the real card name, description, value, type, category and validity — no tags block (CardProduct has no tags field)", () => {
    const html = renderToStaticMarkup(<CardProductDetailSummary cardProduct={cardProduct()} categoryName="بیمه" />);
    expect(html).toContain("مشخصات همین کارت");
    expect(html).toContain("کارت انتخاب‌شده");
    expect(html).toContain("کارت اعتباری بیمه شخص ثالث");
    expect(html).toContain("تا سقف 30,000,000 تومان اعتبار");
    expect(html).toContain("ارزش اعتبار کارت");
    expect(html).toContain("حوزه استفاده");
    expect(html).toContain("اعتبار 365 روز");
    expect(html).not.toContain("cpd-tags");
  });

  it("shows the value and the price as two independent facts — the summary never reads priceAmount (SERVICES-R5.19/R5.25)", () => {
    const html = renderToStaticMarkup(
      <CardProductDetailSummary cardProduct={cardProduct({ priceAmount: 11000000, valueAmount: 999000000 })} categoryName="بیمه" />,
    );
    expect(html).toContain("99,900,000 تومان");
    expect(html).not.toContain("1,100,000 تومان");
  });

  it("falls back to the real badge for the main-condition fact, and omits it when neither validity nor badge exists", () => {
    expect(renderToStaticMarkup(<CardProductDetailSummary cardProduct={cardProduct({ validityDays: null, badge: "پرفروش" })} categoryName="بیمه" />)).toContain("پرفروش");
    const bare = renderToStaticMarkup(<CardProductDetailSummary cardProduct={cardProduct({ validityDays: null, badge: null })} categoryName="بیمه" />);
    expect(bare).not.toContain("شرایط اصلی");
  });
});

describe("Card Product Detail — benefits / process / FAQ", () => {
  it("renders each real benefit as a feature card", () => {
    const html = renderToStaticMarkup(<CardProductBenefits cardProduct={cardProduct()} />);
    expect(html).toContain("مزایای این کارت");
    expect(html).toContain("تخفیف ویژه اعضا");
    expect(html).toContain("فعال‌سازی آنی");
  });

  it("renders no benefits section at all when the card has no benefits", () => {
    expect(renderToStaticMarkup(<CardProductBenefits cardProduct={cardProduct({ benefits: [] })} />)).toBe("");
  });

  it("never renders a 'usage guide' or 'terms' section — no such field exists on the real CardProduct model", () => {
    const html = renderToStaticMarkup(
      <>
        <CardProductBenefits cardProduct={cardProduct()} />
        <CardProductProcess />
        <CardProductFaq cardProduct={cardProduct()} />
      </>,
    );
    expect(html).not.toContain("راهنمای استفاده");
    expect(html).not.toContain("شرایط و ضوابط");
  });

  it("the process is the same global static content for every card (it takes no card data)", () => {
    const html = renderToStaticMarkup(<CardProductProcess />);
    for (const step of CARD_PURCHASE_PROCESS) expect(html).toContain(step.title);
    expect(CARD_PURCHASE_PROCESS).toHaveLength(3);
  });

  it("the FAQ is global static content; only the first answer interpolates the real title and real value", () => {
    const a = cardFaqItems(cardProduct({ title: "کارت الف" }));
    const b = cardFaqItems(cardProduct({ title: "کارت ب" }));
    expect(a[0].answer).toContain("کارت الف");
    expect(a[0].answer).toContain("تا سقف 30,000,000 تومان اعتبار");
    expect(b[0].answer).toContain("کارت ب");
    expect(a.slice(1)).toEqual(b.slice(1));
  });

  it("the FAQ heading is the generic one — it does not claim card-specific FAQs exist", () => {
    const html = renderToStaticMarkup(<CardProductFaq cardProduct={cardProduct()} />);
    expect(html).toContain("سؤالات متداول");
    expect(html).not.toContain("سؤالات این کارت");
  });

  it("the FAQ opens with its first item expanded, like the prototype", () => {
    const html = renderToStaticMarkup(<CardProductFaq cardProduct={cardProduct()} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/cpd-faq-item open/g)).toHaveLength(1);
  });

  it("omits the value clause from the first FAQ answer when the card has no value", () => {
    expect(cardFaqItems(cardProduct({ valueAmount: null, valueDisplayType: null }))[0].answer).not.toContain("سقف یا مزیت");
  });
});

/**
 * SERVICES-R5.26 — only the NOT-purchasable branch of the buy bar is
 * unit-testable here: the purchasable branch renders `PurchaseSheet`, which
 * calls `useRouter()` and throws under `renderToStaticMarkup` in this
 * workspace's Node-only Jest environment. The eligibility decision itself is
 * covered in `cardProductPresentation.test.ts`; the purchasable branch is
 * proven live by the browser QA purchase click-through.
 */
describe("Card Product Detail — buy bar, not-purchasable branch", () => {
  it.each([
    ["a non-PURCHASE journey", { journeyType: "LEAD" as const }],
    ["a null priceAmount", { priceAmount: null }],
    ["a zero priceAmount", { priceAmount: 0 }],
  ])("renders a real disabled button (never a fake-looking one) for %s", (_label, overrides) => {
    const html = renderToStaticMarkup(<CardProductBuyBar cardProduct={cardProduct(overrides)} />);
    expect(html).toContain("disabled");
    expect(html).toContain("خرید کارت");
    expect(html).toContain("به‌زودی");
  });

  it("shows the payable price (priceAmount), never the card's value, in the bar", () => {
    const html = renderToStaticMarkup(<CardProductBuyBar cardProduct={cardProduct({ journeyType: "LEAD", priceAmount: 30000000, valueAmount: 300000000 })} />);
    expect(html).toContain("3,000,000 تومان");
    expect(html).not.toContain("30,000,000 تومان");
  });
});

describe("cardProductPresentation — detail helpers", () => {
  it("formats the compact value and its caption from the real display type", () => {
    expect(formatCardProductValueCompact({ valueAmount: 300000000 })).toBe("30,000,000 تومان");
    expect(formatCardProductValueCompact({ valueAmount: null })).toBeNull();
    expect(cardProductValueCaption({ valueDisplayType: "UP_TO" })).toBe("سقف اعتبار");
    expect(cardProductValueCaption({ valueDisplayType: "FIXED" })).toBe("ارزش کارت");
    expect(cardProductValueCaption({ valueDisplayType: null })).toBe("ارزش کارت");
  });

  it("formats validity only when set", () => {
    expect(formatCardProductValidity({ validityDays: 365 })).toBe("365 روز");
    expect(formatCardProductValidity({ validityDays: null })).toBeNull();
  });
});
