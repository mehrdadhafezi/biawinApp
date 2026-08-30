"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../../components/common/SkeletonBlock";
import { ServiceHero } from "../../../../components/services/ServiceHero";
import { ServiceDetailCardSummary } from "../../../../components/services/ServiceDetailCardSummary";
import { ServiceInfo } from "../../../../components/services/ServiceInfo";
import { Pricing } from "../../../../components/services/Pricing";
import { MerchantLinkCTA } from "../../../../components/services/MerchantLinkCTA";
import { DisabledPurchaseCTA } from "../../../../components/services/DisabledPurchaseCTA";
import { ServicesErrorState } from "../../../../components/services/ServicesStates";
import { useServiceCatalog } from "../../../../components/services/useServiceCatalog";
import { servicesApi, type ServiceDto } from "../../../../lib/services-api";
import { ApiError } from "../../../../lib/api-client";
import { belongsToCategory } from "../../../../components/services/serviceValidation";

/**
 * Service Detail (docs/services-ui-contract.md §1/§4) — read-only:
 * GET /services/:id only. No Purchase Flow/Checkout/Confirmation/Credit
 * Purchase/Installment Creation — `DisabledPurchaseCTA` is the only
 * purchase-related UI on this page, and it does nothing when tapped.
 *
 * cardOnly contract (SERVICES-R1, docs/services-prototype-analysis.md
 * §4/§9): the prototype's `service-detail` view has two render modes —
 * a full 4-payment-method chooser (Home-originated navigation only) and a
 * "card-only" mode (every path through the Services tab — Services List →
 * Category View → here) that hides that chooser entirely. This route is
 * ONLY ever reached via `/services/**`, so it is unconditionally
 * equivalent to the prototype's card-only mode today — there is no second,
 * Home-originated caller of this exact route yet, so no runtime mode flag
 * is introduced here. If a future stage adds a Home-originated entry into
 * this same screen needing the full chooser, that should be an explicit,
 * typed signal (e.g. a distinct prop/query param passed down from
 * wherever that navigation originates), never inferred from browser
 * history/referrer/`document.referrer` — this route must keep resolving
 * identically for a bookmarked/shared/directly-typed URL either way.
 * SERVICES-R3 re-confirmed this by grepping every `router.push` into a
 * `/services/**` route across the whole app: the only real caller of this
 * exact two-segment route is Category View's own product-card click
 * (`app/services/[categoryId]/page.tsx`) — Home's `ServiceBannerGrid`/
 * `ServiceMosaic` both navigate only to `/services/${categoryId}`
 * (Category View), never to a specific service. There is, today, no real
 * Home-origin entry point into this route to preserve or regression-test
 * — restated here as a verified fact, not assumed.
 *
 * SERVICES-R3 fix: this page used to fetch `GET /services/:id` and render
 * whatever came back with no check against the URL's own `categoryId` —
 * `GET /services/:id` has no category-scoping of its own, so
 * `/services/{anyCategoryId}/{realServiceId}` would silently render a
 * real service under the wrong category. Now validated client-side
 * (`data.categoryId !== params.categoryId` is treated identically to a
 * real 404) — a Service must never appear to belong to a Category it
 * isn't actually in.
 *
 * SERVICES-R3.1 fix: `service` (this page's own `GET /services/:id` call)
 * and `categories` (`useServiceCatalog()`'s own, separate, heavier
 * paginated fetch) are two INDEPENDENT async operations with no ordering
 * guarantee — a real staging run proved `service` can resolve first,
 * which used to be enough on its own to render the full composition,
 * including `ServiceDetailCardSummary`'s real-category-name fact, while
 * `categoryName` was still `""` (categories not loaded yet). Not a QA
 * selector bug — a real content-correctness gap: the page could
 * genuinely show a blank category fact to a real user for that same
 * window. Fixed by treating the page as still loading until BOTH
 * `service` and `categories` are ready, not just `service` — no partial
 * render, no blank fact, no UUID-as-fallback, only ever the real name
 * once it's actually known.
 */
export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ categoryId: string; serviceId: string }>();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // SERVICES-R3: the real Category name (`ServiceDetailCardSummary`'s
  // "دسته‌بندی" fact, mapped from the prototype's `#detailCardFactCategory`)
  // — reuses the same catalog hook Category View already fetches through,
  // not a second bespoke endpoint call.
  const { categories } = useServiceCatalog();
  const categoryName = categories?.find((c) => c.id === params.categoryId)?.name ?? "";

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .getService(params.serviceId)
      .then((data) => {
        if (cancelled) return;
        // A real service that exists but doesn't belong to this URL's
        // Category is treated exactly like "not found" — never rendered
        // as if it were correctly categorized.
        if (!belongsToCategory(data, params.categoryId)) {
          setNotFound(true);
          return;
        }
        setService(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات خدمت.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.serviceId, params.categoryId]);

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      {/*
       * SERVICES-R3: the prototype's real `.page-service-detail` background
       * is a subtle vertical gradient (`linear-gradient(180deg,#f7fbff 0%,
       * #ffffff 36%)`), not flat white — mined this stage. `PageContainer`
       * itself has no horizontal/top padding to work around (confirmed by
       * reading it: only `paddingBottom` for bottom-nav clearance), so this
       * applies cleanly to this page's own wrapper with no offset hack —
       * `AppShell`/`PageContainer` stay unmodified, every other route keeps
       * its current flat background.
       */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg, background: "linear-gradient(180deg,#f7fbff 0%,#ffffff 36%)" }}>
        {error && <ServicesErrorState message={error} />}

        {!error && notFound && <ServicesErrorState message="این خدمت یافت نشد." />}

        {!error && !notFound && !(service !== null && categories !== null) && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={100} />
            <SkeletonBlock height={60} />
          </div>
        )}

        {!error && !notFound && service !== null && categories !== null && (
          <>
            <ServiceHero service={service} />
            <ServiceDetailCardSummary service={service} categoryName={categoryName} />
            <Pricing service={service} />
            <ServiceInfo service={service} />
            {/*
             * SERVICES-R4: a REAL, functioning link — only rendered when
             * this real service's `merchantId` is actually non-null.
             * Every one of the 108 real services today has `merchantId:
             * null` (verified live), so this correctly never appears in
             * practice — not a dead control, an honest reflection of the
             * real relationship.
             */}
            {service.merchantId && (
              <MerchantLinkCTA onClick={() => router.push(`/services/${service.categoryId}/${service.id}/${service.merchantId}`)} />
            )}
            <DisabledPurchaseCTA />
          </>
        )}
      </div>
    </AppShell>
  );
}
