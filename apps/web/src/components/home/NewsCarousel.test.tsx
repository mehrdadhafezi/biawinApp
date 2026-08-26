import { renderToStaticMarkup } from "react-dom/server";
import { NewsCarousel } from "./NewsCarousel";

describe("NewsCarousel rendering", () => {
  it("renders all 8 fallback articles with real titles on first paint", () => {
    const html = renderToStaticMarkup(<NewsCarousel />);

    expect(html).toContain("بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟");
    expect(html).toContain("کدام کارت اشتراک بیاوین برای شما مناسب‌تر است؟");
    expect(html).toContain("۸"); // Persian-digit article count
  });

  it("renders the read-more control as disabled (no article page exists yet)", () => {
    const html = renderToStaticMarkup(<NewsCarousel />);
    expect(html).toContain("disabled");
    expect(html).toContain("مشاهده مقاله");
  });
});
