import { renderToStaticMarkup } from "react-dom/server";
import { BiawinCardsCarousel } from "./BiawinCardsCarousel";

/**
 * "Home navigation route renders" / list-rendering-style coverage for a
 * self-fetching Home section: `renderToStaticMarkup` never runs effects
 * (SSR doesn't), so this exercises exactly the pre-fetch state
 * `useHomeHeroCards()` initializes with — the static fallback content
 * (`HERO_CARDS_FALLBACK`). That's the intended behavior, not a test
 * limitation: Stage 5.21 §10 requires the first paint to already have
 * real content, never a spinner/empty flash, which this proves directly.
 */
describe("BiawinCardsCarousel rendering", () => {
  it("renders all 3 fallback cards with their real titles/subtitles on first paint, before any CMS fetch resolves", () => {
    const html = renderToStaticMarkup(<BiawinCardsCarousel />);

    expect(html).toContain("کارت کسب درآمد");
    expect(html).toContain("کارت بیاوین");
    expect(html).toContain("کارت جایزه");
    expect(html).toContain("BIAWIN EARN");
    expect(html).toContain("BIAWIN CLUB");
    expect(html).toContain("BIAWIN REWARD");
  });

  it("renders the 3 cards in their defined order (earn, biawin, reward)", () => {
    const html = renderToStaticMarkup(<BiawinCardsCarousel />);
    const earnIndex = html.indexOf("کارت کسب درآمد");
    const biawinIndex = html.indexOf(">کارت بیاوین<");
    const rewardIndex = html.indexOf("کارت جایزه");

    expect(earnIndex).toBeGreaterThan(-1);
    expect(earnIndex).toBeLessThan(biawinIndex);
    expect(biawinIndex).toBeLessThan(rewardIndex);
  });
});
