import { color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";
import { ServiceCard } from "./ServiceCard";

/**
 * SERVICES-R4 — "other real services from this Merchant." The one piece
 * of genuinely useful, real, buildable content on Merchant Detail today:
 * `Service.merchantId` is a real relationship, so listing a merchant's
 * other real services (excluding the one the user arrived from) is
 * domain-derived, not invented. Given 0 of the 108 real seeded services
 * currently have a non-null `merchantId` (verified live this stage),
 * this list renders empty for every real merchant reachable today — an
 * honest reflection of the current real data, not a bug.
 */
export function MerchantServicesList({ services, onSelect }: { services: ServiceDto[]; onSelect: (service: ServiceDto) => void }) {
  if (services.length === 0) {
    return (
      <div style={{ padding: spacing.lg, textAlign: "center" }}>
        <p style={{ margin: 0, ...typography.body, color: color.muted }}>خدمت دیگری از این فروشنده ثبت نشده است.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: spacing.md }}>
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onSelect={onSelect} />
      ))}
    </div>
  );
}
