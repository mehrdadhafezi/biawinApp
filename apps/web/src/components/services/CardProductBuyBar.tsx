"use client";

import { useState } from "react";
import type { CardProductDto } from "../../lib/services-api";
import { formatCardProductPrice, isCardProductPurchasable } from "./cardProductPresentation";
import { PurchaseSheet } from "./PurchaseSheet";

export interface CardProductBuyBarProps {
  cardProduct: CardProductDto;
}

/**
 * The prototype's `.detail-buybar` / `.detail-buy-btn`, wired to the REAL
 * purchase flow, with the same contract this page has had since R5.26:
 *
 * - Purchasable (`isCardProductPurchasable`: `journeyType === 'PURCHASE'` and
 *   a positive `priceAmount` — the rule the server independently re-enforces):
 *   a real, enabled button that opens `PurchaseSheet` (-> real
 *   `POST /orders` -> `/purchase/[orderId]`). Untouched.
 * - Anything else: a real `disabled` button (`aria-label` "خرید کارت —
 *   به‌زودی") with the visible "به‌زودی" caption — never a tappable-looking
 *   button that does nothing.
 *
 * The bar shows the real payable price (`formatCardProductPrice`: what the
 * customer pays Biawin — never the card's value), which is exactly what the
 * prototype's bar shows for the selected plan. The visible label stays
 * "خرید کارت" (the prototype says "خرید این کارت") so the accessible name the
 * live purchase QA and the Purchase flow key on is unchanged.
 */
export function CardProductBuyBar({ cardProduct }: CardProductBuyBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const purchasable = isCardProductPurchasable(cardProduct);

  return (
    <div className="cpd-buybar">
      <div className="cpd-buy-summary">
        <small>{purchasable ? "پرداخت به بیاوین" : "به‌زودی"}</small>
        <strong>{formatCardProductPrice(cardProduct)}</strong>
      </div>
      {purchasable ? (
        <>
          <button type="button" className="cpd-buy-btn" onClick={() => setSheetOpen(true)}>
            خرید کارت
          </button>
          <PurchaseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} cardProduct={cardProduct} />
        </>
      ) : (
        <button type="button" className="cpd-buy-btn" disabled aria-label="خرید کارت — به‌زودی">
          خرید کارت
        </button>
      )}
    </div>
  );
}
