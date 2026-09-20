import type { CardProductDto } from "../../lib/services-api";
import { CARD_TYPE_LABEL, formatCardProductValue } from "./cardProductPresentation";

export interface CardProductDetailSummaryProps {
  cardProduct: CardProductDto;
  categoryName: string;
}

/**
 * The prototype's cardOnly "مشخصات همین کارت" block —
 * `.detail-selected-card-summary` (selected-card name + summary, and the
 * `.detail-selected-card-value` value box), `.detail-card-facts` (three
 * fact tiles) — with real fields only.
 *
 * - Value box: `formatCardProductValue` (the real `valueAmount` /
 *   `valueDisplayType`), labelled "ارزش اعتبار کارت" (not the prototype's
 *   generic "سقف / مزیت") because value and price are two different facts
 *   in this domain and the payable price lives in the buy bar below.
 * - Facts (prototype: type / main condition / area of use): the real card
 *   type; the real validity period (else the real `badge`, else the tile is
 *   omitted); the real Category name.
 * - `.detail-card-tags`: not rendered — `CardProduct` has no tags field
 *   (unlike `Service`), and no tags are invented.
 */
export function CardProductDetailSummary({ cardProduct, categoryName }: CardProductDetailSummaryProps) {
  const description = cardProduct.description || cardProduct.subtitle;
  const mainCondition =
    cardProduct.validityDays != null ? `اعتبار ${cardProduct.validityDays} روز` : cardProduct.badge;

  const facts = [
    { label: "نوع کارت", value: CARD_TYPE_LABEL[cardProduct.cardType] },
    ...(mainCondition ? [{ label: "شرایط اصلی", value: mainCondition }] : []),
    ...(categoryName ? [{ label: "حوزه استفاده", value: categoryName }] : []),
  ];

  return (
    <section className="cpd-section">
      <div className="cpd-section-head">
        <div>
          <h2>مشخصات همین کارت</h2>
          <p>تمام اطلاعات این صفحه فقط مربوط به کارت انتخاب‌شده است.</p>
        </div>
        <span className="cpd-section-tag">{CARD_TYPE_LABEL[cardProduct.cardType]}</span>
      </div>

      <div className="cpd-summary">
        <div className="cpd-summary-main">
          <span>کارت انتخاب‌شده</span>
          <strong>{cardProduct.title}</strong>
          {description && <p>{description}</p>}
        </div>
        <div className="cpd-summary-value">
          <small>ارزش اعتبار کارت</small>
          <b>{formatCardProductValue(cardProduct)}</b>
        </div>
      </div>

      <div className="cpd-facts" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
        {facts.map((fact) => (
          <div key={fact.label} className="cpd-fact">
            <span>{fact.label}</span>
            <b>{fact.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
