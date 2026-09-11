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
 * SERVICES-R5.19, corrected SERVICES-R5.25 — renders the CardProduct's own
 * displayed commercial value/credit ceiling. Never hardcoded text — always
 * derived from the real `valueAmount`/`valueDisplayType` fields.
 *
 * CRITICAL: this must NEVER read `priceAmount` OR `priceLabel`.
 * `priceAmount`/`priceLabel` describe the amount the customer PAYS Biawin
 * — a completely separate fact from what a card is WORTH (see
 * `CardProductDto`'s own doc comment, the schema's own doc comment on
 * `priceLabel` — "a display override for the PAYABLE price... not for the
 * card's commercial value" — and docs/services-r5-19-purchase-order-audit.md
 * §10 for the R5.18 bug this originally replaced).
 *
 * SERVICES-R5.25 fix: the R5.19 version of this function read
 * `card.priceLabel` as if it were a VALUE-display override — directly
 * contradicting the schema's own doc comment on that field (it overrides
 * `priceAmount`'s display, see `formatCardProductPrice` below) and, as a
 * side effect of that confusion, `priceAmount` itself was never rendered
 * anywhere in the customer UI at all — a real customer had no way to see
 * what they would actually pay for a card, only what it was worth. Fixed
 * by splitting price and value into two genuinely independent functions;
 * see `docs/services-r5-25-services-prototype-finalization-audit.md`.
 *
 * - `valueAmount` set, `valueDisplayType === 'UP_TO'` → "تا سقف <toman>
 *   اعتبار" (a ceiling, not a guaranteed amount).
 * - `valueAmount` set, `valueDisplayType === 'FIXED'` (or unset) → the
 *   plain toman amount (a fixed value/voucher/subscription value).
 * - Unset → "ارزش کارت مشخص نشده" — deliberately distinct wording from
 *   `formatCardProductPrice`'s "قیمت اعلام نشده" fallback, so an admin who
 *   set neither field never sees the same fallback text twice on one
 *   screen with no way to tell which fact is missing.
 */
export function formatCardProductValue(
  card: Pick<CardProductDto, "valueAmount" | "valueDisplayType">,
): string {
  if (card.valueAmount == null) return "ارزش کارت مشخص نشده";
  const amount = formatToman(card.valueAmount);
  return card.valueDisplayType === "UP_TO" ? `تا سقف ${amount} اعتبار` : amount;
}

/**
 * SERVICES-R5.25 — renders the amount the customer actually PAYS Biawin
 * for this card, the fact `formatCardProductValue` above must never read.
 * Mirrors `Pricing.tsx`'s exact existing fallback convention for
 * `Service.priceLabel` ("قیمت اعلام نشده") — same copy, same "real
 * admin-set field or nothing" discipline, now finally applied to
 * `CardProduct` too (previously `priceAmount`/`priceLabel` were stored but
 * never rendered anywhere in the customer UI).
 *
 * - `priceLabel` set → used verbatim (an Admin-set display override for
 *   `priceAmount`, matching the schema's own doc comment on that field).
 * - `priceLabel` unset, `priceAmount` set → the plain toman amount.
 * - Neither set → "قیمت اعلام نشده".
 */
export function formatCardProductPrice(
  card: Pick<CardProductDto, "priceAmount" | "priceLabel">,
): string {
  if (card.priceLabel) return card.priceLabel;
  if (card.priceAmount == null) return "قیمت اعلام نشده";
  return formatToman(card.priceAmount);
}
