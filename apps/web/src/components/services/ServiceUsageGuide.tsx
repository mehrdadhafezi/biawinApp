import { Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";
import { toPersianDigits } from "./serviceCategoryVisual";

export interface ServiceUsageGuideProps {
  service: ServiceDto;
}

/**
 * SERVICES-R5.22 — `service.usageGuide` is a plain ordered string array
 * (Admin supplies the steps, this component supplies the numbering —
 * same division of responsibility `service.benefits`'s checklist already
 * uses). Renders nothing when empty.
 */
export function ServiceUsageGuide({ service }: ServiceUsageGuideProps) {
  if (service.usageGuide.length === 0) return null;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <strong style={{ ...typography.h3, color: color.deep }}>راهنمای استفاده</strong>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: spacing.xs }}>
        {service.usageGuide.map((step, i) => (
          <li key={i} style={{ ...typography.body, color: color.ink }}>
            {toPersianDigits(i + 1)}. {step}
          </li>
        ))}
      </ol>
    </Card>
  );
}
