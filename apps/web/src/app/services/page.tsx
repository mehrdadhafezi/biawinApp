"use client";

import { useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../components/shell/AppShell";
import { CategoryGrid } from "../../components/services/CategoryGrid";
import { PromoBanner } from "../../components/services/PromoBanner";
import { useServiceCatalog } from "../../components/services/useServiceCatalog";
import type { CategoryDto } from "../../lib/services-api";

/**
 * Services Module R1 (docs/services-r1-fidelity-report.md) — pixel-matched
 * to `data-view="services"`: promo banner + category icon grid with a
 * "بیشتر" reveal, replacing Stage 9.1's horizontal category-chip browse
 * page (that layout belonged to a shared List/Category component pair;
 * the prototype's List and Category screens are genuinely different
 * layouts, so this stage splits them — see `CategoryGrid`'s own comment).
 *
 * No search box here — `GlobalHeader`'s shell-level search already
 * represents the prototype's `#serviceSearch` (same placeholder text),
 * deliberately left disabled; see the fidelity report's "Deferred"
 * section for why wiring it up is out of this stage's scope.
 *
 * Real `Category` rows only (SERVICES-R1 product decision #2) — no
 * prototype synthetic content is ported in.
 */
export default function ServicesPage() {
  const router = useRouter();
  const { categories, error } = useServiceCatalog();

  function handleSelectCategory(category: CategoryDto) {
    // Services Home -> Category Landing, the first of the journey's two
    // clicks (Category, then CardProduct). A Category with no slug has no
    // Landing route (Admin has not published one), so there is nowhere
    // meaningful to go — the old fallback, `/services/[categoryId]`, is now
    // only a redirect back to a Landing/Home and would just loop.
    if (category.slug) router.push(`/categories/${category.slug}`);
  }

  return (
    <AppShell activeNavKey="services">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <PromoBanner />
        {error ? (
          <p style={{ margin: 0, color: "#c0392b" }}>{error}</p>
        ) : (
          <CategoryGrid categories={categories} onSelect={handleSelectCategory} />
        )}
      </div>
    </AppShell>
  );
}
