import { FinancialCard, color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { MembershipSummary } from "./useMembershipSummary";

/**
 * Account Summary — the 3 core membership cards (earn/core/reward, `tier:
 * null` in the catalog) joined against the user's own activations, so each
 * card shows real active/inactive status. Tapping a card would open Card
 * Detail, which doesn't exist yet — disabled rather than silently inert
 * (Stage 4.2 QA finding).
 */
export function HeroCardCarousel({ plans, memberships, error }: MembershipSummary) {
  const corePlans = plans?.filter((plan) => plan.tier === null) ?? null;

  return (
    <section style={{ paddingTop: spacing.lg }}>
      <h2 style={{ margin: `0 ${spacing.xl}px ${spacing.md}px`, ...typography.h3, color: color.deep }}>
        کارت‌های عضویت
      </h2>

      {error && (
        <p style={{ margin: `0 ${spacing.xl}px`, ...typography.caption, color: "#c0392b" }}>{error}</p>
      )}

      <div
        style={{
          display: "flex",
          gap: spacing.md,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          padding: `0 ${spacing.xl}px ${spacing.xs}px`,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {corePlans === null && !error
          ? [0, 1, 2].map((i) => (
              <SkeletonBlock
                key={i}
                style={{ flex: "0 0 86%", maxWidth: 340, aspectRatio: "1.62 / 1", scrollSnapAlign: "start" }}
                radiusPx={26}
              />
            ))
          : corePlans?.map((plan) => {
              const isActive = memberships.some((m) => m.planId === plan.id && m.status === "active");
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled
                  aria-label={`${plan.title} — به‌زودی`}
                  style={{
                    all: "unset",
                    flex: "0 0 86%",
                    maxWidth: 340,
                    scrollSnapAlign: "start",
                    cursor: "not-allowed",
                    opacity: isActive ? 1 : 0.75,
                  }}
                >
                  <FinancialCard
                    label={plan.kicker}
                    title={plan.title}
                    numberMasked={plan.priceLabel}
                    ownerLabel={isActive ? "فعال" : "غیرفعال"}
                    accentFrom={plan.accentColor}
                    accentTo={plan.deepColor}
                    style={{ width: "100%" }}
                  />
                </button>
              );
            })}
      </div>
    </section>
  );
}
