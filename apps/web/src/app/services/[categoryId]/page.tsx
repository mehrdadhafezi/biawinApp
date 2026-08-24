"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { CategorySelector } from "../../../components/services/CategorySelector";
import { ServiceGrid } from "../../../components/services/ServiceGrid";
import { useServiceCatalog } from "../../../components/services/useServiceCatalog";
import type { ServiceDto } from "../../../lib/services-api";

/**
 * Category View (docs/services-ui-contract.md §1/§4) — same catalog and
 * components as `/services`, pre-filtered to one category via the route
 * param. `GET /services` has no `categoryId` filter server-side, so
 * filtering happens client-side against the same full fetch `useServiceCatalog`
 * already does — the Tier 1 workaround the approved contract documented.
 */
export default function ServiceCategoryPage() {
  const router = useRouter();
  const params = useParams<{ categoryId: string }>();
  const { categories, services, error } = useServiceCatalog();

  const filteredServices = useMemo(() => {
    if (services === null) return null;
    return services.filter((s) => s.categoryId === params.categoryId);
  }, [services, params.categoryId]);

  function handleSelectCategory(categoryId: string | null) {
    router.push(categoryId === null ? "/services" : `/services/${categoryId}`);
  }

  function handleSelectService(service: ServiceDto) {
    router.push(`/services/${service.categoryId}/${service.id}`);
  }

  return (
    <AppShell activeNavKey="services">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <CategorySelector categories={categories} activeCategoryId={params.categoryId} onSelect={handleSelectCategory} />
        <ServiceGrid services={filteredServices} error={error} onSelect={handleSelectService} />
      </div>
    </AppShell>
  );
}
