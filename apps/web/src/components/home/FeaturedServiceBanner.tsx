import { Card, color, spacing, typography } from "@biawin/ui";
import { ComingSoonCaption } from "../common/ComingSoonCaption";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoriesSummary } from "./useCategories";

const FEATURED_COUNT = 6;

/**
 * Featured service categories grid (prototype's "بنر خدمات منتخب" —
 * docs/01-prototype-analysis.md §2). No "featured" flag exists on the
 * `Category` model, and backend changes are out of scope for this stage, so
 * this takes the first 6 by `sortOrder` — the same ordering rule already
 * used everywhere else categories are listed. No `imageUrl` is resolved for
 * categories server-side either (unlike Orbit items), so these render as
 * text cards, not image cards, until that gap is addressed. Tapping one
 * would open Service Category, which doesn't exist yet — disabled.
 */
export function FeaturedServiceBanner({ categories, error }: CategoriesSummary) {
  if (error) return null;
  const featured = categories?.slice(0, FEATURED_COUNT) ?? null;

  return (
    <section style={{ padding: `${spacing.lg}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>خدمات منتخب</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
        {featured === null
          ? [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={84} />)
          : featured.map((category) => (
              <Card key={category.id} style={{ opacity: 0.85 }}>
                <button
                  type="button"
                  disabled
                  aria-label={`${category.name} — به‌زودی`}
                  style={{
                    all: "unset",
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.xs,
                    width: "100%",
                    cursor: "not-allowed",
                  }}
                >
                  <strong style={{ ...typography.body, fontWeight: 700, color: color.ink }}>
                    {category.name}
                  </strong>
                  <ComingSoonCaption />
                </button>
              </Card>
            ))}
      </div>
    </section>
  );
}
