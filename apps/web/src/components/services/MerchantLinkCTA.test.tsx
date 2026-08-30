import { renderToStaticMarkup } from "react-dom/server";
import { MerchantLinkCTA } from "./MerchantLinkCTA";

describe("MerchantLinkCTA (SERVICES-R4)", () => {
  it("renders as a real, enabled, actionable button — not a decorative/disabled control", () => {
    const html = renderToStaticMarkup(<MerchantLinkCTA onClick={() => {}} />);
    expect(html).toContain("<button");
    expect(html).not.toContain("disabled");
    expect(html).toContain("مشاهده اطلاعات فروشنده");
  });
});
