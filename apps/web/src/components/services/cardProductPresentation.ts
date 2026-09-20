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
 * Short type names for the Category Landing's filter chips and card-visual
 * type pill — the prototype's own vocabulary (اقساطی / اعتباری / تخفیفی …),
 * one word each, mapped from the REAL `CardType` enum (never invented types).
 */
export const CARD_TYPE_SHORT_LABEL: Record<CardType, string> = {
  CREDIT_CARD: "اعتباری",
  DISCOUNT_CARD: "تخفیفی",
  SUBSCRIPTION: "اشتراک",
  VOUCHER: "ووچر",
  INSTALLMENT_CARD: "اقساطی",
};

/**
 * The prototype's four card-visual colorways (`.service-finance-card--
 * installment|credit|discount|mixed`: blue / near-black / orange / purple).
 * The real `CardType` enum has five values, so `VOUCHER` and `SUBSCRIPTION`
 * share the prototype's fourth ("mixed") colorway — a colour choice only,
 * carrying no meaning of its own.
 */
export type CardVisualKind = "installment" | "credit" | "discount" | "mixed";
export const CARD_VISUAL_KIND: Record<CardType, CardVisualKind> = {
  INSTALLMENT_CARD: "installment",
  CREDIT_CARD: "credit",
  DISCOUNT_CARD: "discount",
  VOUCHER: "mixed",
  SUBSCRIPTION: "mixed",
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

/**
 * Card Detail visual-fidelity pass — compact forms of the SAME real fields
 * for the prototype's small `.detail-hero-stat` tiles, which are sized for
 * a few words, not `formatCardProductValue`'s full sentence. Still derived
 * only from `valueAmount`/`valueDisplayType`, never `priceAmount`.
 *
 * `null` when `valueAmount` is unset — the caller omits the tile rather
 * than showing an invented placeholder.
 */
export function formatCardProductValueCompact(
  card: Pick<CardProductDto, "valueAmount">,
): string | null {
  return card.valueAmount == null ? null : formatToman(card.valueAmount);
}

/** The tile's caption — a ceiling ("UP_TO") and an exact worth ("FIXED") are different facts. */
export function cardProductValueCaption(
  card: Pick<CardProductDto, "valueDisplayType">,
): string {
  return card.valueDisplayType === "UP_TO" ? "سقف اعتبار" : "ارزش کارت";
}

/** `null` when the card has no validity period — never a fabricated default. */
export function formatCardProductValidity(
  card: Pick<CardProductDto, "validityDays">,
): string | null {
  return card.validityDays == null ? null : `${card.validityDays} روز`;
}

/**
 * SERVICES-R5.26 — the exact eligibility rule the purchase CTA
 * uses to decide between the real Purchase Flow CTA and the disabled one,
 * extracted as a pure function so it can be unit-tested directly (the CTA
 * component itself renders `PurchaseSheet`, which calls `useRouter()` —
 * untestable under this workspace's `testEnvironment: "node"` Jest config,
 * same reason `AuthModal.tsx` — the closest prior-art `useRouter()`
 * consumer — has no unit test either; live browser verification is the
 * real proof for that half, this function is the real proof for the
 * decision logic).
 *
 * Deliberately mirrors `CardProductPricingService.resolveAuthoritativePrice()`
 * (`backend/src/modules/orders/pricing/card-product-pricing.service.ts`)
 * exactly: a positive `priceAmount` and `journeyType === 'PURCHASE'`, never
 * `priceLabel` (display-only) and never `valueAmount`/`status` (the public
 * API only ever returns `status: 'ACTIVE'` rows to begin with — see
 * `CardProductsService.list()`/`findOneOrThrow()` — so this component never
 * needs to re-check status itself). This is a UX decision only (which CTA
 * to render); the server independently re-validates everything regardless
 * and is the only real security boundary.
 */
export function isCardProductPurchasable(
  card: Pick<CardProductDto, "journeyType" | "priceAmount">,
): boolean {
  return card.journeyType === "PURCHASE" && card.priceAmount != null && card.priceAmount > 0;
}
