import { renderToStaticMarkup } from "react-dom/server";
import { ServiceDetailCardSummary } from "./ServiceDetailCardSummary";
import type { ServiceDto } from "../../lib/services-api";

function service(overrides: Partial<ServiceDto>): ServiceDto {
  return {
    id: "s1",
    categoryId: "c1",
    merchantId: null,
    title: "تور کیش",
    groupLabel: "داخلی",
    subtitle: "۳ شب و ۴ روز",
    badge: "اقساطی ویژه",
    icon: null,
    imageKey: null,
    priceFrom: 12900000,
    priceLabel: "از ۱۲٬۹۰۰٬۰۰۰ تومان",
    availableMethods: ["credit"],
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

describe("ServiceDetailCardSummary", () => {
  it("renders the real title, subtitle, and price — the prototype's #detailCardName/#detailCardSummary/#detailCardValue mapped to real fields", () => {
    const html = renderToStaticMarkup(<ServiceDetailCardSummary service={service({})} categoryName="گردشگری" />);
    expect(html).toContain("تور کیش");
    expect(html).toContain("۳ شب و ۴ روز");
    expect(html).toContain("از ۱۲٬۹۰۰٬۰۰۰ تومان");
  });

  it("renders the real category name passed in — the prototype's #detailCardFactCategory", () => {
    const html = renderToStaticMarkup(<ServiceDetailCardSummary service={service({})} categoryName="گردشگری" />);
    expect(html).toContain("گردشگری");
  });

  it("shows the first real PurchaseMethod as the type fact, never an invented type", () => {
    const html = renderToStaticMarkup(<ServiceDetailCardSummary service={service({ availableMethods: ["installment", "cash"] })} categoryName="اتومبیل" />);
    expect(html).toContain("اقساطی");
  });

  it("prefers creditMultiplierLabel for the main-condition fact when present", () => {
    const html = renderToStaticMarkup(
      <ServiceDetailCardSummary service={service({ creditMultiplierLabel: "تا ۳ برابر", availableMethods: ["credit"] })} categoryName="اتومبیل" />,
    );
    expect(html).toContain("تا ۳ برابر");
  });

  it("falls back to an installment month range when no creditMultiplierLabel exists", () => {
    // Plain digits, matching Pricing.tsx's own established identical pattern
    // (no Persian-digit conversion applied there either) — not a new gap.
    const html = renderToStaticMarkup(
      <ServiceDetailCardSummary
        service={service({ availableMethods: ["installment"], installmentMinMonths: 3, installmentMaxMonths: 24, creditMultiplierLabel: null })}
        categoryName="اتومبیل"
      />,
    );
    expect(html).toContain("اقساط 3 تا 24 ماهه");
  });

  it("falls back to the real badge field as a last resort, never an invented condition", () => {
    const html = renderToStaticMarkup(
      <ServiceDetailCardSummary
        service={service({ availableMethods: ["cash"], creditMultiplierLabel: null, badge: "پرداخت آنی" })}
        categoryName="اتومبیل"
      />,
    );
    expect(html).toContain("پرداخت آنی");
  });

  it("renders real tags when present, and nothing extra when absent", () => {
    const withTags = renderToStaticMarkup(<ServiceDetailCardSummary service={service({ tags: ["ویژه", "محبوب"] })} categoryName="گردشگری" />);
    expect(withTags).toContain("ویژه");
    expect(withTags).toContain("محبوب");

    const withoutTags = renderToStaticMarkup(<ServiceDetailCardSummary service={service({ tags: [], badge: "شرایط عادی" })} categoryName="گردشگری" />);
    expect(withoutTags).not.toContain("ویژه");
  });
});
