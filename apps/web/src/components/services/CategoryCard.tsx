import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import type { CategoryCardDto } from "../../lib/services-api";

export interface CategoryCardProps {
  categoryCard: CategoryCardDto;
  onSelect: (categoryCard: CategoryCardDto) => void;
}

/**
 * SERVICES-R5.21 — Discovery Card: one discovery/marketing tile on a
 * Category Landing page (`/categories/[slug]`). Unlike every other card
 * in this Services module (`ServiceCard`/`CardProductCard`, both stuck
 * with an icon-only fallback because no `imageUrl` resolver exists for
 * their `imageKey`), CategoryCard's `image` is ALREADY a real, resolved
 * URL — the backend resolves `mediaAssetId` via `MediaStorageService`
 * server-side (see `docs/services-r5-21-category-landing-discovery-card-
 * contract.md` §3/§5). Still never fabricates a placeholder when `image`
 * is null — the same "no invented image" discipline as everywhere else.
 *
 * CategoryCard is a discovery/marketing card, NOT a purchasable product —
 * it carries no price, no CardProduct reference, no purchase CTA. Its
 * only action is navigation to the target Service's own Detail page,
 * where the real CardProduct purchase flow lives.
 */
export function CategoryCard({ categoryCard, onSelect }: CategoryCardProps) {
  const highlights = categoryCard.highlights.slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => onSelect(categoryCard)}
      style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
    >
      <Card padded={false} style={{ display: "flex", flexDirection: "column", gap: spacing.xs, height: "100%", overflow: "hidden" }}>
        {categoryCard.image ? (
          <img
            src={categoryCard.image}
            alt=""
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: "100%",
              height: 140,
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
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, padding: spacing.sm }}>
          {categoryCard.badge && <Badge tone="info">{categoryCard.badge}</Badge>}
          <strong style={{ ...typography.body, fontWeight: 700, color: color.ink }}>{categoryCard.title}</strong>
          {categoryCard.subtitle && (
            <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>{categoryCard.subtitle}</span>
          )}
          {highlights.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {highlights.map((h) => (
                <li key={h} style={{ display: "flex", alignItems: "center", gap: 6, ...typography.caption, color: color.deep }}>
                  <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: color.primary, flexShrink: 0 }} />
                  {h}
                </li>
              ))}
            </ul>
          )}
          <span aria-hidden="true" style={{ ...typography.caption, color: color.primary, fontWeight: 700, marginTop: spacing.xs }}>
            مشاهده خدمت ←
          </span>
        </div>
      </Card>
    </button>
  );
}
