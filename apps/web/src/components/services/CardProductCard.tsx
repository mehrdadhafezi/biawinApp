import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";
import { CARD_TYPE_ICON, CARD_TYPE_LABEL, formatCardProductPrice, formatCardProductValue } from "./cardProductPresentation";

export interface CardProductCardProps {
  cardProduct: CardProductDto;
  onSelect: (cardProduct: CardProductDto) => void;
}

/**
 * SERVICES-R5.18 — one purchasable tile in `CardProductGrid`, the
 * `CardProduct` analog of `ServiceCard`. No `imageKey`→`imageUrl`
 * resolution exists for this field (same gap `ServiceCard` already has
 * for `Service.imageKey`), so this shows a `cardType`-based icon fallback
 * instead of fabricating an image URL. The whole tile is the click target
 * (matches `ServiceCard`); the small trailing arrow is this component's
 * own CTA affordance into the Card Product Detail page — the real
 * "خرید کارت" purchase CTA only exists on that page, per this stage's
 * domain rule that a Service is never purchased, only a CardProduct is.
 *
 * SERVICES-R5.25 — renders BOTH facts, clearly labeled ("پرداخت"/"ارزش
 * اعتبار"), matching this stage's own prototype example ("پرداخت: ۳۰
 * میلیون / ارزش اعتبار: تا سقف ۳۰ میلیون"). Before this fix, only the
 * card's value was ever shown anywhere in the customer UI — a real
 * customer had no way to see what they would actually pay. See
 * `cardProductPresentation.ts`'s own doc comments for the price-vs-value
 * conflation this closes.
 */
export function CardProductCard({ cardProduct, onSelect }: CardProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cardProduct)}
      style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
    >
      <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs, height: "100%" }}>
        <span style={{ fontSize: 28 }} aria-hidden="true">
          {CARD_TYPE_ICON[cardProduct.cardType]}
        </span>
        <strong style={{ ...typography.body, fontWeight: 700, color: color.ink }}>{cardProduct.title}</strong>
        {(cardProduct.description || cardProduct.subtitle) && (
          <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
            {cardProduct.description || cardProduct.subtitle}
          </span>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: spacing.xs }}>
            <span style={{ ...typography.micro, color: color.muted }}>پرداخت</span>
            <span style={{ ...typography.caption, fontWeight: 700, color: color.deep }}>{formatCardProductPrice(cardProduct)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: spacing.xs }}>
            <span style={{ ...typography.micro, color: color.muted }}>ارزش اعتبار</span>
            <span style={{ ...typography.caption, fontWeight: 700, color: color.primary }}>{formatCardProductValue(cardProduct)}</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Badge tone="info">{cardProduct.badge || CARD_TYPE_LABEL[cardProduct.cardType]}</Badge>
        </div>
        <span aria-hidden="true" style={{ ...typography.caption, color: color.primary, fontWeight: 700 }}>
          مشاهده جزئیات ←
        </span>
      </Card>
    </button>
  );
}
