import { renderToStaticMarkup } from "react-dom/server";
import { ServiceBannerGrid } from "./ServiceBannerGrid";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("ServiceBannerGrid rendering", () => {
  it("renders all 5 fallback banners with real category names/kickers on first paint", () => {
    const html = renderToStaticMarkup(<ServiceBannerGrid />);

    expect(html).toContain("اتومبیل");
    expect(html).toContain("لوازم خانگی");
    expect(html).toContain("پوشاک");
    expect(html).toContain("طلا و جواهر");
    expect(html).toContain("گردشگری");
    expect(html).toContain("اعتبار و اقساط منعطف");
  });

  it("renders the wide (گردشگری) tile with the wide modifier class", () => {
    const html = renderToStaticMarkup(<ServiceBannerGrid />);
    expect(html).toContain("biawin-service-banner--wide");
  });

  it("renders in the defined fallback order", () => {
    const html = renderToStaticMarkup(<ServiceBannerGrid />);
    const autoIndex = html.indexOf("اتومبیل");
    const travelIndex = html.indexOf("گردشگری");
    expect(autoIndex).toBeGreaterThan(-1);
    expect(autoIndex).toBeLessThan(travelIndex);
  });
});
