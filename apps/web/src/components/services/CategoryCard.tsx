import { Card, color, spacing, typography } from "@biawin/ui";
import type { CategoryCardDto } from "../../lib/services-api";
import { formatToman } from "../../lib/format";

export interface CategoryCardProps {
  categoryCard: CategoryCardDto;
  onSelect: (categoryCard: CategoryCardDto) => void;
}

/**
 * R5.26.2 prototype card contract — the approved prototype's discovery
 * card is deliberately just the real photo plus a price, nothing else
 * (no title, subtitle, bullet list, badge, icon, or CTA text rendered
 * inside the visual card). This supersedes SERVICES-R5.21/R5.23's richer
 * "marketing tile" treatment. `categoryCard.title` is kept ONLY as the
 * button's `aria-label` — real accessibility/navigation need, not visual
 * content — so a screen-reader user still hears what the card is, per
 * this stage's own "do not remove navigation/interaction behavior merely
 * because the visual content is simplified" rule.
 *
 * `image` is already a resolved, real URL (`MediaStorageService`,
 * server-side) — never fabricates a placeholder when null (same "no
 * invented image" discipline as everywhere else). `priceAmount` is
 * READ-ONLY, resolved server-side from the target Service's own single
 * ACTIVE `CardProduct.priceAmount` (see `CategoryCardDto`'s own doc
 * comment) — never hardcoded here, never a second price source. `null`
 * (no purchasable product yet, or ambiguous) renders the same
 * "قیمت اعلام نشده" empty-state copy `formatCardProductPrice` already
 * established for `CardProduct` itself, rather than inventing new wording
 * or hiding the price row inconsistently.
 *
 * CategoryCard is still a discovery/marketing card, NOT a purchasable
 * product in storage — it carries no CardProduct reference, no purchase
 * CTA. Its only action remains navigation to the target Service's own
 * Detail page, where the real CardProduct purchase flow lives.
 */
export function CategoryCard({ categoryCard, onSelect }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(categoryCard)}
      aria-label={categoryCard.title}
      style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
    >
      <Card padded={false} style={{ display: "flex", flexDirection: "column", gap: spacing.xs, height: "100%", overflow: "hidden" }}>
        {categoryCard.image ? (
          <img
            src={categoryCard.image}
            alt=""
            style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: "100%",
              aspectRatio: "3 / 4",
              background: color.ice,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            🔎
          </div>
        )}
        <span style={{ ...typography.body, fontWeight: 700, color: color.deep, padding: spacing.sm }}>
          {categoryCard.priceAmount != null ? formatToman(categoryCard.priceAmount) : "قیمت اعلام نشده"}
        </span>
      </Card>
    </button>
  );
}
