import { renderToStaticMarkup } from "react-dom/server";
import { MerchantHero } from "./MerchantHero";
import type { MerchantDto } from "../../lib/services-api";

function merchant(overrides: Partial<MerchantDto>): MerchantDto {
  return {
    id: "m1",
    name: "فروشگاه نمونه",
    description: "توضیحات واقعی فروشنده",
    logoKey: null,
    active: true,
    ...overrides,
  };
}

describe("MerchantHero (SERVICES-R4)", () => {
  it("renders the real merchant name and description", () => {
    const html = renderToStaticMarkup(<MerchantHero merchant={merchant({})} />);
    expect(html).toContain("فروشگاه نمونه");
    expect(html).toContain("توضیحات واقعی فروشنده");
  });

  it("omits the description block entirely when the real merchant has none, rather than showing blank/placeholder text", () => {
    const html = renderToStaticMarkup(<MerchantHero merchant={merchant({ description: null })} />);
    expect(html).not.toContain("<p");
  });

  it("never renders any invented field the real Merchant model doesn't have (rating, branch, address, discount, phone)", () => {
    const html = renderToStaticMarkup(<MerchantHero merchant={merchant({})} />);
    expect(html).not.toContain("امتیاز");
    expect(html).not.toContain("شعبه");
    expect(html).not.toContain("آدرس");
    expect(html).not.toContain("تخفیف");
  });
});
