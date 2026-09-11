/**
 * SERVICES-R5.21 — analytics FOUNDATION only. No analytics vendor
 * (GA4/Segment/Mixpanel/a custom events backend) exists anywhere in this
 * codebase today — building a real integration would mean fabricating a
 * connection with no real credentials or destination behind it, which
 * this whole engagement has consistently avoided doing for any domain.
 *
 * What this actually provides: a typed, testable event contract and the
 * real call sites wired to it (`CategoryCardGrid`'s mount-time "viewed"
 * signal, `CategoryCard`'s click handler) — the part that's expensive to
 * retrofit later. Swapping `trackEvent`'s body for a real sink (a backend
 * endpoint, a vendor SDK) is a one-function change with zero call-site
 * changes once a vendor decision is made.
 *
 * `CategoryCardViewed` fires once per card when the Discovery Card Grid
 * first renders it — an honest "this card was rendered to the DOM"
 * signal, not true viewport-intersection ("was actually scrolled into
 * view") tracking. Real impression tracking (IntersectionObserver) is a
 * legitimate future enhancement, not built here — this file says so
 * rather than quietly pretending mount-time firing is impression-accurate.
 *
 * SERVICES-R5.22 extends the union (not the mechanism) for the rest of
 * the Category → Service → CardProduct discovery funnel: `CategoryViewed`
 * (Category Landing mount), `ServiceViewed` (Service Detail mount),
 * `CardProductViewed` (`CardProductGrid` mount per card, mirroring
 * `CategoryCardGrid`'s exact pattern above).
 *
 * `PurchaseCTAClicked` is declared here for a future real purchase button,
 * but has **no call site today** — the only purchase-adjacent controls in
 * this app (`DisabledPurchaseCTA`/`DisabledCardPurchaseCTA`) are real,
 * native `disabled` buttons, and a disabled HTML button never fires
 * `onClick` (the browser suppresses the event outright, it doesn't even
 * bubble to a wrapping element). Firing this event from anywhere else —
 * the caption text, a wrapping div, the card selection tap that merely
 * navigates to Detail — would misrepresent what the user actually
 * clicked. Wiring it honestly requires a real, enabled purchase button,
 * which doesn't exist yet (purchase execution is still out of scope, see
 * `DisabledPurchaseCTA`'s own doc comment); this type exists so the first
 * stage that adds one doesn't also have to design its analytics shape.
 */
export type AnalyticsEvent =
  | {
      name: "CategoryCardViewed";
      categoryId: string;
      categoryCardId: string;
      targetServiceId: string;
      position: number;
    }
  | {
      name: "CategoryCardClicked";
      categoryId: string;
      categoryCardId: string;
      targetServiceId: string;
      position: number;
    }
  | {
      name: "CategoryViewed";
      categoryId: string;
    }
  | {
      name: "ServiceViewed";
      categoryId: string;
      serviceId: string;
    }
  | {
      name: "CardProductViewed";
      serviceId: string;
      cardProductId: string;
      position: number;
    }
  | {
      name: "PurchaseCTAClicked";
      context: "service" | "cardProduct";
      id: string;
    };

export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", event.name, event);
  }
}
