"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { CategoryHero } from "../../../components/services/CategoryHero";
import { ServiceSearchInput } from "../../../components/services/ServiceSearchInput";
import { MethodFilterChips, type MethodFilter } from "../../../components/services/MethodFilterChips";
import { ServiceGrid } from "../../../components/services/ServiceGrid";
import { ServicesErrorState } from "../../../components/services/ServicesStates";
import { SkeletonBlock } from "../../../components/common/SkeletonBlock";
import { useServiceCatalog } from "../../../components/services/useServiceCatalog";
import { getCategoryAccent } from "../../../components/services/serviceCategoryVisual";
import { filterServicesForCategory } from "../../../components/services/serviceListFilter";
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

  // SERVICES-R2: kept separate from `filteredServices` — this is the
  // category-scoped set BEFORE search/method filtering, needed to tell
  // "this Category genuinely has no Services" (ServiceGrid's
  // `hasAnyInCategory`) apart from "your search/filter matched nothing."
  const categoryServices = useMemo(
    () => services?.filter((s) => s.categoryId === params.categoryId) ?? null,
    [services, params.categoryId],
  );

  const filteredServices = useMemo(() => {
    if (services === null) return null;
    return filterServicesForCategory(services, params.categoryId, method, search);
  }, [services, params.categoryId, method, search]);

  function handleSelectService(service: ServiceDto) {
    router.push(`/services/${service.categoryId}/${service.id}`);
  }

  const accent = category ? getCategoryAccent(category.name) : undefined;
  // SERVICES-R2: prototype's `#categorySearch` placeholder is dynamic per
  // category (`جستجو در کارت‌های ${name}...`, openServiceCategory() in the
  // mined prototype source) — was a static string in R1.
  const searchPlaceholder = category ? `جستجو در کارت‌های ${category.name}...` : "جستجو در کارت‌های این خدمت...";

  return (
    <AppShell activeNavKey="services">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        {category ? (
          <CategoryHero category={category} serviceCount={categoryServices?.length ?? 0} />
        ) : categories !== null ? (
          <ServicesErrorState message="این دسته‌بندی یافت نشد." />
        ) : (
          // SERVICES-R2: avoids a layout jump once the real category loads
          // and CategoryHero mounts — matches CategoryHero's real rendered
          // height closely enough that nothing visibly reflows.
          <SkeletonBlock height={160} />
        )}
        <ServiceSearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} accent={accent?.accent} />
        <MethodFilterChips value={method} onChange={setMethod} accent={accent} />
        <ServiceGrid
          services={filteredServices}
          error={error}
          onSelect={handleSelectService}
          emptyContext={{
            hasAnyInCategory: (categoryServices?.length ?? 0) > 0,
            hasSearchQuery: search.trim() !== "",
            hasMethodFilter: method !== "all",
          }}
        />
      </div>
    </AppShell>
  );
}
