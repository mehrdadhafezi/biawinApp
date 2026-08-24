import { spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { ServiceDto } from "../../lib/services-api";
import { ServicesEmptyState, ServicesErrorState } from "./ServicesStates";
import { ServiceCard } from "./ServiceCard";

export interface ServiceGridProps {
  services: ServiceDto[] | null;
  error: string | null;
  onSelect: (service: ServiceDto) => void;
}

/** Loading (null)/error/empty/populated states for the filtered service list — mirrors InstallmentList precedent. */
export function ServiceGrid({ services, error, onSelect }: ServiceGridProps) {
  if (error) {
    return <ServicesErrorState message={error} />;
  }

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: spacing.md };

  if (services === null) {
    return (
      <div style={gridStyle}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={140} />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return <ServicesEmptyState message="خدمتی در این دسته یافت نشد." />;
  }

  return (
    <div style={gridStyle}>
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onSelect={onSelect} />
      ))}
    </div>
  );
}
