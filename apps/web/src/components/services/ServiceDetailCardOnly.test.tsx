import { renderToStaticMarkup } from "react-dom/server";
import { ServiceHero } from "./ServiceHero";
import { Pricing } from "./Pricing";
import { ServiceInfo } from "./ServiceInfo";
import { DisabledPurchaseCTA } from "./DisabledPurchaseCTA";
import type { ServiceDto } from "../../lib/services-api";

/**
 * SERVICES-R1 cardOnly contract check (docs/services-prototype-analysis.md
 * §4/§9, docs/services-r1-fidelity-report.md): confirms the exact
 * composition `app/services/[categoryId]/[serviceId]/page.tsx` renders
 * once a service loads — every real entry point into this route is
 * card-only-equivalent, so this asserts none of the prototype's 4
 * full-mode payment-method plan labels ("خرید اعتباری"/"خرید قسطی"/
 * "پرداخت کامل"/"رایگان و جایزه" as selectable *plan cards*, distinct
 * from the disabled CTA's own "خرید این خدمت" button text) ever render
 * from this composition, and that the real disabled-CTA affordance does.
 */
const service: ServiceDto = {
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
  availableMethods: ["credit", "installment"],
  installmentMinMonths: 3,
  installmentMaxMonths: 24,
  creditMultiplierLabel: "تا ۳ برابر",
  benefits: ["مزیت یک"],
  galleryKeys: [],
  faq: [],
  tags: ["برچسب"],
  active: true,
};

describe("Service Detail composition — cardOnly contract", () => {
  it("never renders the prototype's full-mode 4-payment-method plan chooser", () => {
    const html = renderToStaticMarkup(
      <>
        <ServiceHero service={service} />
        <Pricing service={service} />
        <ServiceInfo service={service} />
        <DisabledPurchaseCTA />
      </>,
    );
    // The prototype's full-mode .detail-plan cards are selectable, distinct
    // "خرید اعتباری"/"خرید قسطی"/"پرداخت کامل"/"رایگان و جایزه" CTAs —
    // none of that plan-selection copy exists in this composition.
    expect(html).not.toContain("خرید اعتباری");
    expect(html).not.toContain("خرید قسطی");
    expect(html).not.toContain("رایگان و جایزه");
  });

  it("renders the real disabled purchase affordance instead, doing nothing when tapped", () => {
    const html = renderToStaticMarkup(<DisabledPurchaseCTA />);
    expect(html).toContain("disabled");
    expect(html).toContain("خرید این خدمت");
    expect(html).toContain("به‌زودی");
  });
});
