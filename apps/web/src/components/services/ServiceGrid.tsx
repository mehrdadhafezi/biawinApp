import { color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { ServiceDto } from "../../lib/services-api";
import { ServicesEmptyState, ServicesErrorState } from "./ServicesStates";
import { ServiceCard } from "./ServiceCard";

export interface ServiceGridEmptyContext {
  /** Whether the current Category has at least one real, active Service before any search/filter is applied. */
  hasAnyInCategory: boolean;
  hasSearchQuery: boolean;
  hasMethodFilter: boolean;
}

export interface ServiceGridProps {
  services: ServiceDto[] | null;
  error: string | null;
  onSelect: (service: ServiceDto) => void;
  /**
   * SERVICES-R2 (§10 of the R2 task): which empty scenario applies when
   * `services` is an empty array — a genuinely service-less Category (A)
   * reads very differently from "your search/filter matched nothing"
   * (B/C/D). Optional only so existing call sites/tests that don't care
   * about the distinction still compile; the real page always passes it.
   */
  emptyContext?: ServiceGridEmptyContext;
}

/**
 * SERVICES-R2 finding, mined directly from the prototype's own
 * `renderCategoryProducts()`/`#categoryEmpty`: it toggles ONE empty
 * element based purely on `visible.length === 0`, with NO distinction
 * between "your search matched nothing," "your filter matched nothing,"
 * or "both" — the exact same copy covers all three. That single copy is
 * PROTOTYPE-DERIVED, verbatim: "موردی با این عبارت پیدا نشد. عبارت
 * دیگری جستجو کنید." Reused here for scenarios B/C/D exactly as-is,
 * rather than inventing 3 separate messages the prototype itself never
 * distinguishes.
 *
 * Scenario A (a Category with zero real, active Services at all) has NO
 * prototype precedent — `buildServiceOffers()` always synthesizes ≥2
 * cards per category, so this state is structurally unreachable in the
 * prototype. IMPLEMENTATION DECISION copy, not prototype-derived.
 */
function emptyMessage(ctx: ServiceGridEmptyContext): { text: string; prototypeDerived: boolean } {
  if (!ctx.hasAnyInCategory) {
    return { text: "در حال حاضر خدمتی در این دسته ثبت نشده است.", prototypeDerived: false }; // A
  }
  if (ctx.hasSearchQuery || ctx.hasMethodFilter) {
    return { text: "موردی با این عبارت پیدا نشد. عبارت دیگری جستجو کنید.", prototypeDerived: true }; // B/C/D — unified, PROTOTYPE-DERIVED
  }
  return { text: "خدمتی در این دسته یافت نشد.", prototypeDerived: false }; // fallback — should not be reachable given the branches above
}

/**
 * PROTOTYPE-DERIVED — `.category-empty`'s real CSS: a dashed border,
 * distinct from every other Services surface's solid-border `Card`.
 * Used only for the B/C/D (search/filter-empty) case, matching the
 * prototype's own single empty element; scenario A keeps the existing
 * `ServicesEmptyState` (solid card) — that state has no prototype
 * precedent to match a dashed treatment against.
 */
function CategoryFilterEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "34px 15px",
        textAlign: "center",
        border: "1px dashed #cadff2",
        borderRadius: 22,
        background: "#f8fbfe",
      }}
    >
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{message}</p>
    </div>
  );
}

/** Loading (null)/error/empty/populated states for the filtered service list — mirrors InstallmentList precedent. */
export function ServiceGrid({ services, error, onSelect, emptyContext }: ServiceGridProps) {
  if (error) {
    return <ServicesErrorState message={error} />;
  }

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: spacing.md };

  if (services === null) {
    return (
      <div style={gridStyle}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={140} />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    const { text, prototypeDerived } = emptyContext ? emptyMessage(emptyContext) : { text: "خدمتی در این دسته یافت نشد.", prototypeDerived: false };
    return prototypeDerived ? <CategoryFilterEmptyState message={text} /> : <ServicesEmptyState message={text} />;
  }

  return (
    <div style={gridStyle}>
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onSelect={onSelect} />
      ))}
    </div>
  );
}
