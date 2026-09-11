import { Badge, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";

export interface ServiceHeroProps {
  service: ServiceDto;
}

/**
 * Title block for Service Detail. SERVICES-R5.22 — renders the real,
 * backend-resolved `service.image` when set (Admin's Media Picker), never
 * a fabricated one; falls back to the `icon` emoji exactly as before for
 * every Service that has no image set. Gallery (`service.gallery`) is
 * intentionally not rendered here — a lightbox/carousel primitive doesn't
 * exist yet in `packages/ui`, and no real Service has more than one
 * gallery image today, so building one now would be speculative UI with
 * nothing real to show; the gallery images remain available on the DTO
 * for a future stage.
 */
export function ServiceHero({ service }: ServiceHeroProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      {service.image ? (
        <img
          src={service.image}
          alt=""
          style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 20 }}
        />
      ) : (
        <span style={{ fontSize: 48 }} aria-hidden="true">
          {service.icon ?? "🛍️"}
        </span>
      )}
      <h1 style={{ margin: 0, ...typography.h1, color: color.deep }}>{service.title}</h1>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{service.subtitle}</p>
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
        <Badge tone="neutral">{service.groupLabel}</Badge>
        <Badge tone="neutral">{service.badge}</Badge>
      </div>
    </div>
  );
}
