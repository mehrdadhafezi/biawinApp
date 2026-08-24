"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../components/shell/AppShell";
import { CategorySelector } from "../../components/services/CategorySelector";
import { ServiceGrid } from "../../components/services/ServiceGrid";
import { useServiceCatalog } from "../../components/services/useServiceCatalog";
import type { ServiceDto } from "../../lib/services-api";

/**
 * Services Module v1 (docs/services-ui-contract.md) — browse-only:
 * category filter + service grid, replacing Stage 5.2's placeholder.
 * Purchase/Checkout/Confirmation are explicitly out of scope (no button
 * or UI for them exists here) — tapping a card goes to a read-only
 * Service Detail page, per the approved contract's Tier 1/2 split.
 */
export default function ServicesPage() {
  const router = useRouter();
  const { categories, services, error } = useServiceCatalog();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    if (services === null) return null;
    if (activeCategoryId === null) return services;
    return services.filter((s) => s.categoryId === activeCategoryId);
  }, [services, activeCategoryId]);

  function handleSelectCategory(categoryId: string | null) {
    if (categoryId === null) {
      setActiveCategoryId(null);
      return;
    }
    router.push(`/services/${categoryId}`);
  }

  function handleSelectService(service: ServiceDto) {
    router.push(`/services/${service.categoryId}/${service.id}`);
  }

  return (
    <AppShell activeNavKey="services" pageLabel="خدمات">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <CategorySelector categories={categories} activeCategoryId={activeCategoryId} onSelect={handleSelectCategory} />
        <ServiceGrid services={filteredServices} error={error} onSelect={handleSelectService} />
      </div>
    </AppShell>
  );
}
