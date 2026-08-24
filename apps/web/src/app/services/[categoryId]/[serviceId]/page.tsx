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
