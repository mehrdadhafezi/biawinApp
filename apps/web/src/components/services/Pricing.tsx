import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";
import { PURCHASE_METHOD_LABEL, PURCHASE_METHOD_TONE } from "./serviceMethod";

export interface PricingProps {
  service: ServiceDto;
}

/** Price + available purchase methods, display-only — selecting a method is out of scope for this stage (see DisabledPurchaseCTA). */
export function Pricing({ service }: PricingProps) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <strong style={{ ...typography.h1, color: color.deep }}>{service.priceLabel ?? "قیمت اعلام نشده"}</strong>

      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
        {service.availableMethods.map((method) => (
          <Badge key={method} tone={PURCHASE_METHOD_TONE[method]}>
            {PURCHASE_METHOD_LABEL[method]}
          </Badge>
        ))}
      </div>

      {service.availableMethods.includes("installment") &&
        (service.installmentMinMonths || service.installmentMaxMonths) && (
          <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
            اقساط {service.installmentMinMonths ?? "؟"} تا {service.installmentMaxMonths ?? "؟"} ماهه
          </span>
        )}

      {service.creditMultiplierLabel && (
        <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
          {service.creditMultiplierLabel}
        </span>
      )}
    </Card>
  );
}
