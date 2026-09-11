import { Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";

export interface ServiceDescriptionProps {
  service: ServiceDto;
}

/**
 * SERVICES-R5.22 — the full-length "توضیحات کامل" content, separate from
 * `service.subtitle` (the existing short description already shown in
 * `ServiceHero`). Renders nothing when `description` is empty — same
 * "no content, no section" discipline `ServiceInfo` already follows.
 */
export function ServiceDescription({ service }: ServiceDescriptionProps) {
  if (!service.description) return null;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <strong style={{ ...typography.h3, color: color.deep }}>درباره این خدمت</strong>
      <p style={{ margin: 0, ...typography.body, color: color.ink, whiteSpace: "pre-line" }}>{service.description}</p>
    </Card>
  );
}
