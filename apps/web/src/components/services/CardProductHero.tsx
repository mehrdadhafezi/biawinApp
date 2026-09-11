import { Badge, color, spacing, typography } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";
import { CARD_TYPE_ICON, CARD_TYPE_LABEL, formatCardProductValue } from "./cardProductPresentation";

export interface CardProductHeroProps {
  cardProduct: CardProductDto;
}

/**
 * Title block for Card Product Detail — the `CardProduct` analog of
 * `ServiceHero`. SERVICES-R5.22 — renders the real, backend-resolved
 * `cardProduct.image` when set, falling back to the same `cardType`-based
 * icon as the list tile for every card that has no image set (never a
 * fabricated one).
 */
export function CardProductHero({ cardProduct }: CardProductHeroProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      {cardProduct.image ? (
        <img
          src={cardProduct.image}
          alt=""
          style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 20 }}
        />
      ) : (
        <span style={{ fontSize: 48 }} aria-hidden="true">
          {CARD_TYPE_ICON[cardProduct.cardType]}
        </span>
      )}
      <h1 style={{ margin: 0, ...typography.h1, color: color.deep }}>{cardProduct.title}</h1>
      {(cardProduct.description || cardProduct.subtitle) && (
        <p style={{ margin: 0, ...typography.body, color: color.muted }}>
          {cardProduct.description || cardProduct.subtitle}
        </p>
      )}
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone="neutral">{cardProduct.badge || CARD_TYPE_LABEL[cardProduct.cardType]}</Badge>
        <strong style={{ ...typography.h3, color: color.primary }}>{formatCardProductValue(cardProduct)}</strong>
      </div>
    </div>
  );
}
