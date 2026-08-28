"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../../components/common/SkeletonBlock";
import { ServiceHero } from "../../../../components/services/ServiceHero";
import { ServiceInfo } from "../../../../components/services/ServiceInfo";
import { Pricing } from "../../../../components/services/Pricing";
import { DisabledPurchaseCTA } from "../../../../components/services/DisabledPurchaseCTA";
import { ServicesErrorState } from "../../../../components/services/ServicesStates";
import { servicesApi, type ServiceDto } from "../../../../lib/services-api";
import { ApiError } from "../../../../lib/api-client";

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
 */
export default function ServiceDetailPage() {
  const params = useParams<{ categoryId: string; serviceId: string }>();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .getService(params.serviceId)
      .then((data) => {
        if (!cancelled) setService(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات خدمت.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.serviceId]);

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {error && <ServicesErrorState message={error} />}

        {!error && service === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={100} />
            <SkeletonBlock height={60} />
          </div>
        )}

        {!error && service !== null && (
          <>
            <ServiceHero service={service} />
            <Pricing service={service} />
            <ServiceInfo service={service} />
            <DisabledPurchaseCTA />
          </>
        )}
      </div>
    </AppShell>
  );
}
