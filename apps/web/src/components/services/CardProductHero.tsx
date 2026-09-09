import { Badge, color, spacing, typography } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";
import { CARD_TYPE_ICON, CARD_TYPE_LABEL, formatCardProductPrice } from "./cardProductPresentation";

export interface CardProductHeroProps {
  cardProduct: CardProductDto;
}

/**
 * Title block for Card Product Detail — the `CardProduct` analog of
 * `ServiceHero`. No `imageKey`→`imageUrl` resolution exists for this
 * field (same gap `ServiceHero` already documents for `Service.imageKey`
 * — see `CardProductCard`'s own comment), so this shows the same
 * `cardType`-based icon fallback as the list tile, not a fabricated image.
 */
export function CardProductHero({ cardProduct }: CardProductHeroProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <span style={{ fontSize: 48 }} aria-hidden="true">
        {CARD_TYPE_ICON[cardProduct.cardType]}
      </span>
      <h1 style={{ margin: 0, ...typography.h1, color: color.deep }}>{cardProduct.title}</h1>
      {(cardProduct.description || cardProduct.subtitle) && (
        <p style={{ margin: 0, ...typography.body, color: color.muted }}>
          {cardProduct.description || cardProduct.subtitle}
        </p>
      )}
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone="neutral">{cardProduct.badge || CARD_TYPE_LABEL[cardProduct.cardType]}</Badge>
        <strong style={{ ...typography.h3, color: color.primary }}>{formatCardProductPrice(cardProduct)}</strong>
      </div>
    </div>
  );
}
