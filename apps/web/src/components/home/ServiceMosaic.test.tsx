import { renderToStaticMarkup } from "react-dom/server";
import { ServiceMosaic } from "./ServiceMosaic";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("ServiceMosaic rendering", () => {
  it("renders both half tiles and both wide slides from the fallback content on first paint", () => {
    const html = renderToStaticMarkup(<ServiceMosaic />);

    expect(html).toContain("زیبایی");
    expect(html).toContain("بیمه");
    expect(html).toContain("مبلمان و دکوراسیون");
    expect(html).toContain("کالای دیجیتال");
  });

  it("renders exactly 2 wide-slide dots (one per fallback wide slide)", () => {
    const html = renderToStaticMarkup(<ServiceMosaic />);
    const dotsSection = html.split('aria-label="اسلایدهای خدمات"')[1] ?? "";
    const dotCount = (dotsSection.match(/<button/g) ?? []).length;
    expect(dotCount).toBe(2);
  });
});
