"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing, typography } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { CategoryHero } from "../../../components/services/CategoryHero";
import { ServiceSearchInput } from "../../../components/services/ServiceSearchInput";
import { MethodFilterChips, matchesMethodFilter, type MethodFilter } from "../../../components/services/MethodFilterChips";
import { ServiceGrid } from "../../../components/services/ServiceGrid";
import { useServiceCatalog } from "../../../components/services/useServiceCatalog";
import { getCategoryAccent } from "../../../components/services/serviceCategoryVisual";
import type { ServiceDto } from "../../../lib/services-api";

/**
 * Category View (docs/services-r1-fidelity-report.md) — pixel-matched to
 * `data-view="service-category"`: hero header (real `Category.name`/
 * `.description`, per-category accent theme), search, payment-method
 * filter chips, product grid. Replaces Stage 9.1's category-*switching*
 * chip row — the prototype's own Category View has no such control (its
 * filter row is payment-method, not category), so that affordance wasn't
 * actually a fidelity feature to preserve; `/services` is one tap away
 * via the shell's bottom nav regardless.
 *
 * `GET /services` still has no `categoryId`/`q`/`method` filter param
 * server-side (unchanged since docs/services-ui-contract.md §6) —
 * filtering (category, search text, and now method) all happen
 * client-side against the same full fetch `useServiceCatalog` already
 * does, the same Tier-1 workaround the approved contract documented.
 */
export default function ServiceCategoryPage() {
  const router = useRouter();
  const params = useParams<{ categoryId: string }>();
  const { categories, services, error } = useServiceCatalog();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<MethodFilter>("all");

  const category = useMemo(
    () => categories?.find((c) => c.id === params.categoryId) ?? null,
    [categories, params.categoryId],
  );

  const filteredServices = useMemo(() => {
    if (services === null) return null;
    const q = search.trim();
    return services.filter(
      (s) =>
        s.categoryId === params.categoryId &&
        matchesMethodFilter(s.availableMethods, method) &&
        (q === "" || s.title.includes(q) || s.subtitle.includes(q)),
    );
  }, [services, params.categoryId, method, search]);

  function handleSelectService(service: ServiceDto) {
    router.push(`/services/${service.categoryId}/${service.id}`);
  }

  const accent = category ? getCategoryAccent(category.name).accent : undefined;

  return (
    <AppShell activeNavKey="services">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        {category ? (
          <CategoryHero category={category} />
        ) : categories !== null ? (
          <p style={{ margin: 0, ...typography.body, color: "#c0392b" }}>این دسته‌بندی یافت نشد.</p>
        ) : null}
        <ServiceSearchInput value={search} onChange={setSearch} placeholder="جستجو در کارت‌های این خدمت..." />
        <MethodFilterChips value={method} onChange={setMethod} accent={accent} />
        <ServiceGrid services={filteredServices} error={error} onSelect={handleSelectService} />
      </div>
    </AppShell>
  );
}
