import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";
import { PURCHASE_METHOD_LABEL, PURCHASE_METHOD_TONE } from "./serviceMethod";

export interface ServiceCardProps {
  service: ServiceDto;
  onSelect: (service: ServiceDto) => void;
}

/**
 * One product tile in `ServiceGrid`. No `imageKey` → `imageUrl`
 * resolution exists server-side yet for `Service` (docs/services-ui-contract.md
 * §6 Gap #3, same as Category/Merchant), so this renders the `icon`
 * emoji field as a text-only fallback — the same choice
 * `FeaturedServiceBanner` already made for categories on Home.
 */
export function ServiceCard({ service, onSelect }: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
    >
      <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs, height: "100%" }}>
        <span style={{ fontSize: 28 }} aria-hidden="true">
          {service.icon ?? "🛍️"}
        </span>
        <strong style={{ ...typography.body, fontWeight: 700, color: color.ink }}>{service.title}</strong>
        <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>{service.subtitle}</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <span style={{ ...typography.caption, color: color.deep }}>{service.priceLabel ?? "—"}</span>
          {service.availableMethods[0] && (
            <Badge tone={PURCHASE_METHOD_TONE[service.availableMethods[0]]}>
              {PURCHASE_METHOD_LABEL[service.availableMethods[0]]}
            </Badge>
          )}
        </div>
      </Card>
    </button>
  );
}
