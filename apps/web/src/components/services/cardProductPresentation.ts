import type { CardProductDto, CardType } from "../../lib/services-api";
import { formatToman } from "../../lib/format";

/**
 * SERVICES-R5.18 — no icon field exists on `CardProduct` (unlike
 * `Service.icon`), so this is a presentation-only fallback by `cardType`,
 * same spirit as `ServiceCard`/`ServiceHero`'s existing icon-emoji
 * fallback for `Service` (no imageKey→imageUrl resolution exists for this
 * field either — see `CardProductHero`'s own doc comment).
 */
export const CARD_TYPE_ICON: Record<CardType, string> = {
  CREDIT_CARD: "💳",
  DISCOUNT_CARD: "🏷️",
  SUBSCRIPTION: "🔁",
  VOUCHER: "🎟️",
  INSTALLMENT_CARD: "📆",
};

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  CREDIT_CARD: "کارت اعتباری",
  DISCOUNT_CARD: "کارت تخفیفی",
  SUBSCRIPTION: "اشتراک",
  VOUCHER: "ووچر",
  INSTALLMENT_CARD: "کارت اقساطی",
};

/**
 * Never hardcoded text — always derived from the real `priceAmount`/
 * `priceLabel`/`cardType` fields (SERVICES-R5.17: `priceAmount` is
 * Rial, Admin-set; `priceLabel` is an Admin-set display override).
 *
 * - `priceLabel` set → used verbatim (that's its entire purpose, same as
 *   `Service.priceLabel` in `Pricing.tsx`).
 * - `priceLabel` unset, `priceAmount` set, `cardType === 'CREDIT_CARD'` →
 *   "تا سقف <toman> اعتبار" (a credit card's amount is a ceiling, not a
 *   fixed charge — matches `CreditLine.limitAmount`'s own real meaning,
 *   docs/services-r5-2-pricing-and-eligibility-domain.md §10).
 * - `priceLabel` unset, `priceAmount` set, any other `cardType` → the
 *   plain toman amount (a fixed value/voucher/subscription price).
 * - Neither set → "قیمت اعلام نشده", matching `Pricing.tsx`'s exact
 *   existing fallback for `Service`.
 */
export function formatCardProductPrice(
  card: Pick<CardProductDto, "priceAmount" | "priceLabel" | "cardType">,
): string {
  if (card.priceLabel) return card.priceLabel;
  if (card.priceAmount == null) return "قیمت اعلام نشده";
  const amount = formatToman(card.priceAmount);
  return card.cardType === "CREDIT_CARD" ? `تا سقف ${amount} اعتبار` : amount;
}
