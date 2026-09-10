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
    };

export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", event.name, event);
  }
}
