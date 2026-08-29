import { renderToStaticMarkup } from "react-dom/server";
import { ServiceGrid } from "./ServiceGrid";
import type { ServiceDto } from "../../lib/services-api";

function service(overrides: Partial<ServiceDto>): ServiceDto {
  return {
    id: "s1",
    categoryId: "c1",
    merchantId: null,
    title: "تور کیش",
    groupLabel: "داخلی",
    subtitle: "۳ شب و ۴ روز",
    badge: "اقساطی",
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

const PROTOTYPE_EMPTY_COPY = "موردی با این عبارت پیدا نشد. عبارت دیگری جستجو کنید.";

describe("ServiceGrid", () => {
  it("renders a skeleton grid while loading (services === null)", () => {
    const html = renderToStaticMarkup(<ServiceGrid services={null} error={null} onSelect={() => {}} />);
    expect(html).not.toContain("تور کیش");
  });

  it("renders the error state and never the empty state when both could apply", () => {
    const html = renderToStaticMarkup(<ServiceGrid services={[]} error="خطا در دریافت اطلاعات." onSelect={() => {}} />);
    expect(html).toContain("خطا در دریافت اطلاعات.");
    expect(html).not.toContain("یافت نشد");
  });

  it("renders real services when present", () => {
    const html = renderToStaticMarkup(<ServiceGrid services={[service({})]} error={null} onSelect={() => {}} />);
    expect(html).toContain("تور کیش");
  });

  it("SERVICES-R2: falls back to a generic empty message when no emptyContext is given", () => {
    const html = renderToStaticMarkup(<ServiceGrid services={[]} error={null} onSelect={() => {}} />);
    expect(html).toContain("خدمتی در این دسته یافت نشد.");
  });

  it("SERVICES-R2 scenario A: distinguishes a genuinely service-less category (no prototype precedent, implementation-decision copy)", () => {
    const html = renderToStaticMarkup(
      <ServiceGrid
        services={[]}
        error={null}
        onSelect={() => {}}
        emptyContext={{ hasAnyInCategory: false, hasSearchQuery: false, hasMethodFilter: false }}
      />,
    );
    expect(html).toContain("در حال حاضر خدمتی در این دسته ثبت نشده است.");
    expect(html).not.toContain(PROTOTYPE_EMPTY_COPY);
  });

  it("SERVICES-R2 scenarios B/C/D: a method-filter-only empty result uses the exact prototype #categoryEmpty copy", () => {
    const html = renderToStaticMarkup(
      <ServiceGrid
        services={[]}
        error={null}
        onSelect={() => {}}
        emptyContext={{ hasAnyInCategory: true, hasSearchQuery: false, hasMethodFilter: true }}
      />,
    );
    expect(html).toContain(PROTOTYPE_EMPTY_COPY);
  });

  it("SERVICES-R2 scenarios B/C/D: a search-only empty result uses the exact prototype #categoryEmpty copy", () => {
    const html = renderToStaticMarkup(
      <ServiceGrid
        services={[]}
        error={null}
        onSelect={() => {}}
        emptyContext={{ hasAnyInCategory: true, hasSearchQuery: true, hasMethodFilter: false }}
      />,
    );
    expect(html).toContain(PROTOTYPE_EMPTY_COPY);
  });

  it("SERVICES-R2 scenarios B/C/D: a search+filter intersection empty result also uses the exact prototype #categoryEmpty copy", () => {
    const html = renderToStaticMarkup(
      <ServiceGrid
        services={[]}
        error={null}
        onSelect={() => {}}
        emptyContext={{ hasAnyInCategory: true, hasSearchQuery: true, hasMethodFilter: true }}
      />,
    );
    expect(html).toContain(PROTOTYPE_EMPTY_COPY);
  });

  it("SERVICES-R2: scenario A takes priority even if search/filter flags are also set (an empty category can't have a real filtered match either)", () => {
    const html = renderToStaticMarkup(
      <ServiceGrid
        services={[]}
        error={null}
        onSelect={() => {}}
        emptyContext={{ hasAnyInCategory: false, hasSearchQuery: true, hasMethodFilter: true }}
      />,
    );
    expect(html).toContain("در حال حاضر خدمتی در این دسته ثبت نشده است.");
    expect(html).not.toContain(PROTOTYPE_EMPTY_COPY);
  });
});
