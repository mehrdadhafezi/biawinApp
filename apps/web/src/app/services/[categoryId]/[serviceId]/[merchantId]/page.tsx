"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing, typography } from "@biawin/ui";
import { AppShell } from "../../../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../../../components/common/SkeletonBlock";
import { MerchantHero } from "../../../../../components/services/MerchantHero";
import { MerchantServicesList } from "../../../../../components/services/MerchantServicesList";
import { ServicesErrorState } from "../../../../../components/services/ServicesStates";
import { useServiceCatalog } from "../../../../../components/services/useServiceCatalog";
import { belongsToCategory, serviceReferencesMerchant } from "../../../../../components/services/serviceValidation";
import { servicesApi, merchantsApi, type ServiceDto, type MerchantDto } from "../../../../../lib/services-api";
import { ApiError } from "../../../../../lib/api-client";

/**
 * Merchant Detail (SERVICES-R4) — `/services/[categoryId]/[serviceId]/[merchantId]`.
 *
 * IMPORTANT CONTEXT (see docs/services-r4-merchant-detail-report.md for
 * the full audit): the approved prototype has NO Merchant Detail screen
 * at all — confirmed exhaustively this stage (zero matches for
 * "merchant"/"فروشنده"/"شعبه"/"branch" anywhere in the 26MB prototype
 * file), the third independent confirmation of this exact fact across
 * SERVICES-R1, R3, and now R4. There is therefore no prototype UI/UX to
 * be faithful to — this route exists to make the real, already-modeled
 * `Service.merchantId` -> `Merchant` relationship reachable and safe,
 * using only the 4 real `Merchant` fields (`name`/`description`/
 * `logoKey`/`active`) that exist in the schema. No rating, branch,
 * address, phone, gallery, or discount UI was built — none of those
 * fields exist in the real domain, and none are invented here.
 *
 * Also important: 0 of the 108 real seeded services currently have a
 * non-null `merchantId`, and 0 real `Merchant` rows exist on staging
 * (verified live this stage) — this route is real, correct, and fully
 * validated, but is not organically reachable from any real service
 * today. The entry point on Service Detail only ever appears when a real
 * service's `merchantId` is non-null, so this is never a dead link in
 * practice — it simply doesn't render for any of today's real services.
 *
 * Relationship validation mirrors SERVICES-R3's `belongsToCategory`
 * exactly, extended one hop further: a real, existing Service must
 * belong to the URL's Category (`belongsToCategory`), AND that Service
 * must actually reference the URL's Merchant
 * (`serviceReferencesMerchant`) — a real, active Merchant fetched by ID
 * alone proves nothing about whether THIS Service sells through them.
 * Any mismatch renders the same "not found" state as SERVICES-R3.
 */
export default function MerchantDetailPage() {
  const router = useRouter();
  const params = useParams<{ categoryId: string; serviceId: string; merchantId: string }>();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [merchant, setMerchant] = useState<MerchantDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { services: catalogServices } = useServiceCatalog();

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .getService(params.serviceId)
      .then(async (data) => {
        if (cancelled) return;
        if (!belongsToCategory(data, params.categoryId) || !serviceReferencesMerchant(data, params.merchantId)) {
          setNotFound(true);
          return;
        }
        try {
          const merchantData = await merchantsApi.getMerchant(params.merchantId);
          if (cancelled) return;
          setService(data);
          setMerchant(merchantData);
        } catch (err: unknown) {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true);
          } else {
            setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات فروشنده.");
          }
        }
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
  }, [params.serviceId, params.categoryId, params.merchantId]);

  const otherServices = useMemo(() => {
    if (!catalogServices || !service) return null;
    return catalogServices.filter((s) => s.merchantId === params.merchantId && s.id !== service.id);
  }, [catalogServices, service, params.merchantId]);

  function handleSelectService(target: ServiceDto) {
    router.push(`/services/${target.categoryId}/${target.id}`);
  }

  const ready = service !== null && merchant !== null && catalogServices !== null;

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {error && <ServicesErrorState message={error} />}

        {!error && notFound && <ServicesErrorState message="این فروشنده یافت نشد." />}

        {!error && !notFound && !ready && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={120} />
            <SkeletonBlock height={140} />
          </div>
        )}

        {!error && !notFound && ready && (
          <>
            <MerchantHero merchant={merchant} />
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <h2 style={{ margin: 0, ...typography.h3 }}>سایر خدمات این فروشنده</h2>
              <MerchantServicesList services={otherServices ?? []} onSelect={handleSelectService} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
