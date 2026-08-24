import { color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoriesSummary } from "./useCategories";

/**
 * Auto-scrolling vertical list of category names (prototype's "تیکر
 * خدمات" — docs/01-prototype-analysis.md §2). Purely decorative in the
 * prototype — a passive display, not tappable — so unlike every other new
 * section here it needs no disabled/coming-soon treatment.
 */
export function ServiceTicker({ categories, error }: CategoriesSummary) {
  if (error) return null;

  return (
    <section style={{ padding: `${spacing.lg}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>خدمات محبوب</h2>

      {categories === null && <SkeletonBlock height={120} />}

      {categories && (
        <div
          aria-hidden="true"
          style={{
            height: 120,
            overflow: "hidden",
            borderRadius: 18,
            background: color.ice,
            border: `1px solid ${color.line}`,
            maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
          }}
        >
          <div className="biawin-home-ticker-track">
            {[...categories, ...categories].map((category, i) => (
              <div
                key={`${category.id}-${i}`}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  ...typography.body,
                  color: color.ink,
                  borderBottom: `1px solid ${color.line}`,
                }}
              >
                {category.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes biawinHomeTicker{ from{transform:translateY(0)} to{transform:translateY(-50%)} }
        .biawin-home-ticker-track{ animation: biawinHomeTicker 18s linear infinite; }
        @media (prefers-reduced-motion:reduce){
          .biawin-home-ticker-track{ animation: none; }
        }
      `}</style>
    </section>
  );
}
