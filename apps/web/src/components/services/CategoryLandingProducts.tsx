"use client";

import { useEffect } from "react";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CardProductDto } from "../../lib/services-api";
import { trackEvent } from "../../lib/analytics";
import { CardProductTile } from "./CardProductTile";
import { toPersianDigits } from "./serviceCategoryVisual";

export interface CategoryLandingProductsProps {
  categoryName: string;
  /** Every real CardProduct of this category, or `null` while loading. */
  cardProducts: CardProductDto[] | null;
  /** The subset matching the current search/filter. */
  visible: CardProductDto[];
  error: string | null;
  hasSearchOrFilter: boolean;
  onSelect: (cardProduct: CardProductDto) => void;
}

/**
 * The prototype's `.category-products-section`: heading ("کارت‌های {دسته}"),
 * count pill, the card grid, and the empty state — plus its loading and
 * error states. The empty copy distinguishes "this category has no cards"
 * from "your search/filter matched nothing" (the prototype's own empty text,
 * "موردی با این عبارت پیدا نشد…", is only the latter).
 *
 * Fires `CardProductViewed` once per card when a real, populated set first
 * renders (the same mount-time signal `CardProductGrid` used before this
 * page replaced it).
 */
export function CategoryLandingProducts({ categoryName, cardProducts, visible, error, hasSearchOrFilter, onSelect }: CategoryLandingProductsProps) {
  useEffect(() => {
    if (!cardProducts || cardProducts.length === 0) return;
    cardProducts.forEach((cardProduct, position) => {
      trackEvent({ name: "CardProductViewed", serviceId: cardProduct.serviceId, cardProductId: cardProduct.id, position });
    });
  }, [cardProducts]);

  return (
    <section className="cl-section">
      <div className="cl-section-head">
        <div>
          <h2>کارت‌های {categoryName}</h2>
          <p>شرایط اعتبار، قیمت و مزایای هر کارت را مقایسه کنید.</p>
        </div>
        <span className="cl-count">{toPersianDigits(visible.length)} کارت</span>
      </div>

      {error ? (
        <p className="cl-empty" style={{ color: "#c0392b" }}>
          {error}
        </p>
      ) : cardProducts === null ? (
        <div className="cl-grid">
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} height={220} radiusPx={24} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="cl-empty">
          {hasSearchOrFilter ? "موردی با این عبارت پیدا نشد. عبارت دیگری جستجو کنید." : "در حال حاضر کارتی برای این دسته‌بندی ثبت نشده است."}
        </p>
      ) : (
        <div className="cl-grid">
          {visible.map((cardProduct) => (
            <CardProductTile key={cardProduct.id} cardProduct={cardProduct} categoryName={categoryName} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The prototype's `.category-info-strip`. Its icon and heading are the
 * prototype's; the sentence is corrected to describe what the detail page
 * actually shows (value, benefits, validity, purchase) — the prototype's
 * version promises a "discount percentage" and "repayment period" that no
 * real CardProduct field backs.
 */
export function CategoryLandingInfoStrip() {
  return (
    <div className="cl-strip">
      <i aria-hidden="true">✓</i>
      <div>
        <strong>کارت متناسب با نیازتان را انتخاب کنید</strong>
        <span>پس از انتخاب کارت، ارزش اعتبار، مزایا، مدت اعتبار و مراحل خرید همان کارت نمایش داده می‌شود.</span>
      </div>
    </div>
  );
}
