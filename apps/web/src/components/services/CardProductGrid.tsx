import { useEffect } from "react";
import { spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CardProductDto } from "../../lib/services-api";
import { trackEvent } from "../../lib/analytics";
import { ServicesEmptyState, ServicesErrorState } from "./ServicesStates";
import { CardProductCard } from "./CardProductCard";

export interface CardProductGridProps {
  cardProducts: CardProductDto[] | null;
  error: string | null;
  onSelect: (cardProduct: CardProductDto) => void;
}

/**
 * SERVICES-R5.18 — the `CardProduct` analog of `ServiceGrid`: same
 * loading (skeleton)/error/empty/populated states. No search/method-
 * filter empty-context distinction (unlike `ServiceGrid`) — this stage
 * doesn't add search/filtering for card products, only browsing.
 * `cardProducts` is already server-filtered to `status: 'ACTIVE'` by
 * `GET /cards` (see `cardProductsApi.listByService`'s own doc comment) —
 * this component trusts that contract rather than re-filtering.
 *
 * SERVICES-R5.22 — fires `CardProductViewed` once per card whenever a
 * real, populated set of cards first renders, mirroring
 * `CategoryCardGrid`'s `CategoryCardViewed` pattern exactly (same mount-
 * time "rendered to the DOM", not true viewport-intersection, caveat).
 */
export function CardProductGrid({ cardProducts, error, onSelect }: CardProductGridProps) {
  useEffect(() => {
    if (!cardProducts || cardProducts.length === 0) return;
    cardProducts.forEach((cardProduct, position) => {
      trackEvent({
        name: "CardProductViewed",
        serviceId: cardProduct.serviceId,
        cardProductId: cardProduct.id,
        position,
      });
    });
  }, [cardProducts]);

  if (error) {
    return <ServicesErrorState message={error} />;
  }

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: spacing.md };

  if (cardProducts === null) {
    return (
      <div style={gridStyle}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} height={140} />
        ))}
      </div>
    );
  }

  if (cardProducts.length === 0) {
    return <ServicesEmptyState message="در حال حاضر محصولی برای این خدمت ثبت نشده است." />;
  }

  return (
    <div style={gridStyle}>
      {cardProducts.map((cardProduct) => (
        <CardProductCard key={cardProduct.id} cardProduct={cardProduct} onSelect={onSelect} />
      ))}
    </div>
  );
}
