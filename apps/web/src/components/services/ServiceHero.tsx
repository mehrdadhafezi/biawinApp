import { Badge, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";

export interface ServiceHeroProps {
  service: ServiceDto;
}

/**
 * Title block for Service Detail. No `imageUrl` resolution exists for
 * `Service.imageKey` yet (docs/services-ui-contract.md §6 Gap #3), so
 * this shows the `icon` emoji as a large fallback, same choice
 * `ServiceCard` and Home's `FeaturedServiceBanner` already made — no
 * image gallery is rendered for the same reason (this stage's component
 * tree doesn't include one either).
 */
export function ServiceHero({ service }: ServiceHeroProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <span style={{ fontSize: 48 }} aria-hidden="true">
        {service.icon ?? "🛍️"}
      </span>
      <h1 style={{ margin: 0, ...typography.h1, color: color.deep }}>{service.title}</h1>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{service.subtitle}</p>
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
        <Badge tone="neutral">{service.groupLabel}</Badge>
        <Badge tone="neutral">{service.badge}</Badge>
      </div>
    </div>
  );
}
