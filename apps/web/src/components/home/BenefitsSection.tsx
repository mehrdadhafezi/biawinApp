import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { MembershipSummary } from "./useMembershipSummary";

/**
 * Shows the active core membership's benefit list (docs/home-ui-contract.md
 * §4 — `MembershipCardDefinition.benefits`, already returned by
 * GET /subscriptions, no new data needed). If no core membership is active
 * yet, shows an activation prompt instead of an empty section — matches
 * §2's "no active membership" empty-state rule.
 */
export function BenefitsSection({ plans, memberships, error }: MembershipSummary) {
  if (error) return null;

  const corePlans = plans?.filter((plan) => plan.tier === null) ?? null;
  const activePlan = corePlans?.find((plan) =>
    memberships.some((m) => m.planId === plan.id && m.status === "active"),
  );

  return (
    <section style={{ padding: `${spacing.xl}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>مزایای عضویت</h2>

      {corePlans === null && <SkeletonBlock height={96} radiusPx={24} />}

      {corePlans !== null && !activePlan && (
        <Card>
          <p style={{ margin: 0, ...typography.body, color: color.muted }}>
            هنوز کارت عضویتی فعال نکرده‌ای. یکی از کارت‌های بالا را فعال کن تا مزایای آن اینجا نمایش داده شود.
          </p>
        </Card>
      )}

      {activePlan && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong style={{ ...typography.h3, color: color.deep }}>{activePlan.title}</strong>
            <Badge tone="success">فعال</Badge>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {activePlan.benefits.map((benefit) => (
              <li key={benefit.title} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ ...typography.body, fontWeight: 700, color: color.ink }}>{benefit.title}</span>
                <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
                  {benefit.description}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
