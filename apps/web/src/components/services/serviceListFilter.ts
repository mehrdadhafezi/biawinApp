import type { ServiceDto } from "../../lib/services-api";
import { matchesMethodFilter, type MethodFilter } from "./MethodFilterChips";

/**
 * SERVICES-R2 — the deterministic composition Category View's search box
 * and method-filter chips use together (docs/services-r2-category-filter-fidelity-report.md
 * "Search + filter composition"). Extracted from `/services/[categoryId]/page.tsx`
 * so the intersection logic itself is directly unit-testable, independent
 * of routing/hooks.
 *
 * Composition order is a plain AND of three conditions — category scope,
 * method filter, search substring — so "which one is applied first" has
 * no observable effect: `matchesMethodFilter(..., "all")` always returns
 * `true`, so selecting "همه" is equivalent to omitting that condition
 * entirely and never disturbs an active search query, and an empty search
 * string (`q === ""`) short-circuits to `true` the same way, so clearing
 * search always restores exactly the current method-filtered subset.
 */
export function filterServicesForCategory(
  services: ServiceDto[],
  categoryId: string,
  method: MethodFilter,
  search: string,
): ServiceDto[] {
  const q = search.trim();
  return services.filter(
    (s) => s.categoryId === categoryId && matchesMethodFilter(s.availableMethods, method) && (q === "" || s.title.includes(q) || s.subtitle.includes(q)),
  );
}
