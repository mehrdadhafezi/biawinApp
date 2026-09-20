import type { CardProductDto } from "../../lib/services-api";
import {
  CARD_TYPE_SHORT_LABEL,
  CARD_VISUAL_KIND,
  cardProductValueCaption,
  formatCardProductPrice,
  formatCardProductValidity,
  formatCardProductValueCompact,
} from "./cardProductPresentation";

export interface CardProductTileProps {
  cardProduct: CardProductDto;
  categoryName: string;
  onSelect: (cardProduct: CardProductDto) => void;
}

/**
 * One real CardProduct on the Category Landing — the prototype's
 * `.service-finance-card`: a card graphic (brand, type pill, chip, value,
 * category, validity) with title, summary and an "open" row beneath it.
 * Clicking it opens THAT CardProduct's detail page directly — the tile IS
 * the final purchasable object, not a doorway to another selection layer.
 *
 * Every visible value is real: type from `cardType` (colorway from
 * `CARD_VISUAL_KIND`), the value from `valueAmount`/`valueDisplayType`, the
 * validity from `validityDays`, the payable price from `priceAmount`
 * (labelled separately — price and value are different facts). The
 * prototype's fixed decoration with no backend behind it (`VALID 08/29`,
 * `•••• 2088`, "MEMBERSHIP CLUB") is not reproduced. The graphic uses the
 * CardProduct's OWN image when one is set (with a scrim for legibility) and
 * otherwise the colorway gradient — never a Category/CategoryCard image.
 *
 * Structure: a semantic `article` (real `h3`/`p`), with one transparent,
 * full-tile `button` (accessible name = the card's title) carrying the click
 * and keyboard behavior — so the tile is one control, not nested ones.
 */
export function CardProductTile({ cardProduct, categoryName, onSelect }: CardProductTileProps) {
  const kind = CARD_VISUAL_KIND[cardProduct.cardType];
  const value = formatCardProductValueCompact(cardProduct);
  const validity = formatCardProductValidity(cardProduct);
  const summary = cardProduct.description || cardProduct.subtitle || cardProduct.benefits[0] || null;
  const photoStyle = cardProduct.image
    ? { backgroundImage: `linear-gradient(180deg, rgba(5,22,41,.25), rgba(5,22,41,.62)), url("${cardProduct.image}")` }
    : undefined;

  return (
    <article className={`cl-fc cl-fc--${kind}`}>
      <button type="button" className="cl-fc-hit" aria-label={cardProduct.title} onClick={() => onSelect(cardProduct)} />
      <div className={`cl-fc-visual${cardProduct.image ? " cl-fc-visual--photo" : ""}`} style={photoStyle}>
        <div className="cl-fc-top">
          <span className="cl-fc-brand">BIAWIN</span>
          <span className="cl-fc-type">{CARD_TYPE_SHORT_LABEL[cardProduct.cardType]}</span>
        </div>
        <span className="cl-fc-chip" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <div className="cl-fc-main">
          {value && <small>{cardProductValueCaption(cardProduct)}</small>}
          <strong>{value ?? "ارزش کارت مشخص نشده"}</strong>
          <span>{categoryName}</span>
        </div>
        {validity && (
          <div className="cl-fc-bottom">
            <span>اعتبار {validity}</span>
          </div>
        )}
      </div>
      <div className="cl-fc-copy">
        <h3>{cardProduct.title}</h3>
        {summary && <p>{summary}</p>}
        <div className="cl-fc-price">
          <small>پرداخت به بیاوین</small>
          <b>{formatCardProductPrice(cardProduct)}</b>
        </div>
        <div className="cl-fc-open" aria-hidden="true">
          <b>مشاهده شرایط کارت</b>
          <i>‹</i>
        </div>
      </div>
    </article>
  );
}
