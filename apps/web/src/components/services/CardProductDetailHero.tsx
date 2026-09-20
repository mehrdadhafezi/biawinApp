import type { CardProductDto } from "../../lib/services-api";
import {
  CARD_TYPE_LABEL,
  cardProductValueCaption,
  formatCardProductValidity,
  formatCardProductValueCompact,
} from "./cardProductPresentation";

export interface CardProductDetailHeroProps {
  cardProduct: CardProductDto;
  categoryName: string;
}

/**
 * The prototype's `.detail-hero` — full-bleed rounded hero, gradient scrim,
 * badge pills, big title, description, three translucent stat tiles.
 *
 * Real data only:
 * - Image: the CardProduct's OWN resolved `image`. With none (every
 *   canonical CardProduct today — `mediaAssetId` is null by explicit seed
 *   design) the hero shows the prototype's own `#0b4d88` background under
 *   the scrim; never a Category/CategoryCard image, never a placeholder.
 * - Badges: the real Category name and the real card-type label. (The
 *   prototype's second badge, "خرید امن", is a static marketing claim with
 *   no backend behind it — not reproduced.)
 * - Title is the page's `h1` (the prototype's `h2`); the prototype's own
 *   `h1` is the small header caption, kept as a non-heading so the document
 *   has one meaningful top-level heading.
 * - Stats (prototype: type / cap-or-benefit / main condition): card type,
 *   the real value (`valueAmount`, captioned by `valueDisplayType`), and the
 *   real validity period. A stat whose field is unset is omitted, not faked.
 */
export function CardProductDetailHero({ cardProduct, categoryName }: CardProductDetailHeroProps) {
  const description = cardProduct.description || cardProduct.subtitle;
  const value = formatCardProductValueCompact(cardProduct);
  const validity = formatCardProductValidity(cardProduct);

  const stats = [
    { value: CARD_TYPE_LABEL[cardProduct.cardType], caption: "نوع کارت" },
    ...(value ? [{ value, caption: cardProductValueCaption(cardProduct) }] : []),
    ...(validity ? [{ value: validity, caption: "مدت اعتبار" }] : []),
  ];

  return (
    <section className="cpd-hero">
      {cardProduct.image && <img className="cpd-hero-img" src={cardProduct.image} alt="" />}
      <div className="cpd-hero-copy">
        <div className="cpd-hero-badges">
          {categoryName && <span className="cpd-hero-badge">{categoryName}</span>}
          <span className="cpd-hero-badge">{cardProduct.badge || CARD_TYPE_LABEL[cardProduct.cardType]}</span>
        </div>
        <h1>{cardProduct.title}</h1>
        {description && <p>{description}</p>}
        <div className="cpd-hero-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map((stat) => (
            <div key={stat.caption} className="cpd-hero-stat">
              <b>{stat.value}</b>
              <span>{stat.caption}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
