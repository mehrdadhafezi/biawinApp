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
 * SERVICES-R5.19 — renders the CardProduct's own displayed commercial
 * value/credit ceiling. Never hardcoded text — always derived from the
 * real `valueAmount`/`valueDisplayType`/`priceLabel` fields.
 *
 * CRITICAL: this must NEVER read `priceAmount`. `priceAmount` is the
 * amount the customer pays Biawin, a completely separate fact from what a
 * card is worth (see `CardProductDto`'s own doc comment and
 * docs/services-r5-19-purchase-order-audit.md §10 for the R5.18 bug this
 * replaces — that version read `priceAmount` here and presented it as if
 * it were the card's credit ceiling).
 *
 * - `priceLabel` set → used verbatim (an Admin-set display override, same
 *   purpose as `Service.priceLabel` in `Pricing.tsx` — note this overrides
 *   the VALUE display, not a payable-price display; no payable-price UI
 *   exists anywhere in this stage).
 * - `priceLabel` unset, `valueAmount` set, `valueDisplayType === 'UP_TO'`
 *   → "تا سقف <toman> اعتبار" (a ceiling, not a guaranteed amount).
 * - `priceLabel` unset, `valueAmount` set, `valueDisplayType === 'FIXED'`
 *   (or unset) → the plain toman amount (a fixed value/voucher/
 *   subscription value).
 * - Neither set → "قیمت اعلام نشده", matching `Pricing.tsx`'s exact
 *   existing fallback for `Service`.
 */
export function formatCardProductValue(
  card: Pick<CardProductDto, "valueAmount" | "valueDisplayType" | "priceLabel">,
): string {
  if (card.priceLabel) return card.priceLabel;
  if (card.valueAmount == null) return "قیمت اعلام نشده";
  const amount = formatToman(card.valueAmount);
  return card.valueDisplayType === "UP_TO" ? `تا سقف ${amount} اعتبار` : amount;
}
