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
 * `PurchaseCTAClicked` was declared in R5.22 with no call site (no real,
 * enabled purchase button existed yet — a disabled HTML button never fires
 * `onClick` at all, so firing this from anywhere else would have
 * misrepresented what the user clicked). SERVICES-R5.26 finally wires a
 * real one: `PurchaseSheet.tsx`'s confirm button, the only genuinely
 * clickable purchase-intent control in the app.
 *
 * SERVICES-R5.26 also adds `OrderCreated` — fires once, after `POST
 * /orders` actually succeeds (`PurchaseSheet.tsx`), carrying the real,
 * newly-created `Order.id`/`amount`/`status`. This is an honest "a
 * `pending` Order now exists" signal, not a payment event — this stage
 * explicitly does not implement Payment, so no `PaymentSucceeded`/
 * `PaymentFailed`/`VoucherIssued`/`CardRedeemed` event exists or is
 * claimed here; those belong to R5.27–R5.29, once something real happens
 * for them to describe.
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
    }
  | {
      name: "OrderCreated";
      orderId: string;
      cardProductId: string;
      serviceId: string;
      amount: number;
    };

export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", event.name, event);
  }
}
