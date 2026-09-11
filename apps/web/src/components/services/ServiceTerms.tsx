import { Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";

export interface ServiceTermsProps {
  service: ServiceDto;
}

/**
 * SERVICES-R5.22 — `service.terms`, a plain string array (same shape as
 * `MembershipPlan.terms` elsewhere in this schema). Renders nothing when
 * empty — no CardProduct-level equivalent exists or is added; terms live
 * on Service only (see this stage's contract §4.1).
 */
export function ServiceTerms({ service }: ServiceTermsProps) {
  if (service.terms.length === 0) return null;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <strong style={{ ...typography.h3, color: color.deep }}>شرایط و ضوابط</strong>
      <ul style={{ margin: 0, paddingInlineStart: spacing.lg, ...typography.body, color: color.ink }}>
        {service.terms.map((term, i) => (
          <li key={i}>{term}</li>
        ))}
      </ul>
    </Card>
  );
}
