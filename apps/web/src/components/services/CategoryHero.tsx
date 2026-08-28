import { color, radius, spacing, typography } from "@biawin/ui";
import type { CategoryDto } from "../../lib/services-api";
import { getCategoryAccent } from "./serviceCategoryVisual";

/**
 * Category View's header — pixel-matched to `.category-hero` (real
 * `Category.name`/`.description`, not the prototype's synthetic
 * `serviceCopy` fallback text). Applies the per-category accent theme
 * mined from `openServiceCategory()`'s `style.setProperty()` calls (4
 * distinct themes + a default) — `service-detail` never varies this in
 * the prototype (a real prototype inconsistency, not reproduced further
 * downstream than this one screen, per
 * docs/services-prototype-analysis.md §6).
 *
 * No back button here — `GlobalHeader`/`AppShell` provide the shared,
 * fixed shell chrome (no per-page header slot exists, unlike the
 * prototype's own per-view `<header>`), and Next.js's router already
 * gives correct browser-back behavior without one (verified,
 * docs/services-v1-implementation-report.md "Responsive validation").
 * Adding a duplicate in-page back control was judged unnecessary
 * chrome, not a fidelity gap — the prototype's back button exists
 * because *it* has no browser history to rely on (a single-file hash
 * app), a constraint that doesn't apply here.
 */
export function CategoryHero({ category }: { category: CategoryDto }) {
  const theme = getCategoryAccent(category.name);
  return (
    <div
      style={{
        borderRadius: radius.xl,
        overflow: "hidden",
        background: theme.soft,
        border: `1px solid ${theme.accent}33`,
        padding: spacing.lg,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
      }}
    >
      <span style={{ ...typography.caption, color: theme.deep }}>کارت‌های خدمات بیاوین</span>
      <h1 style={{ margin: 0, ...typography.h2, color: theme.deep }}>{category.name}</h1>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{category.description}</p>
    </div>
  );
}
