import { StoryCard, color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { MembershipSummary } from "./useMembershipSummary";

/**
 * The 8 subscription-tier cards as a story strip (prototype's
 * "کارت‌های اشتراک" — docs/01-prototype-analysis.md §2, and the missing
 * `MembershipStoryStrip` component flagged in Stage 4.2's QA review).
 * Reuses the same `plans` fetch as `HeroCardCarousel` — filters to
 * `tier !== null` instead of the 3 core cards. Tapping a tier would open
 * Card Detail, which doesn't exist yet — disabled, same as the hero cards.
 */
export function MembershipStories({ plans, error }: MembershipSummary) {
  if (error) return null;
  const tierPlans = plans?.filter((plan) => plan.tier !== null) ?? null;

  return (
    <section style={{ paddingTop: spacing.lg }}>
      <h2 style={{ margin: `0 ${spacing.xl}px ${spacing.md}px`, ...typography.h3, color: color.deep }}>
        کارت‌های اشتراک
      </h2>
      <div
        style={{
          display: "flex",
          gap: spacing.md,
          overflowX: "auto",
          padding: `0 ${spacing.xl}px ${spacing.xs}px`,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tierPlans === null
          ? [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={58} width={58} radiusPx={999} />)
          : tierPlans.map((plan) => (
              <StoryCard
                key={plan.id}
                title={plan.title}
                ringFrom={plan.accentColor}
                ringTo={plan.deepColor}
                disabled
                aria-label={`${plan.title} — به‌زودی`}
                style={{ flex: "0 0 auto", cursor: "not-allowed", opacity: 0.85 }}
              >
                🎫
              </StoryCard>
            ))}
      </div>
    </section>
  );
}
