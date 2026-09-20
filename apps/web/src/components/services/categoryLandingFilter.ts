import type { CardProductDto, CardType } from "../../lib/services-api";
import { CARD_TYPE_LABEL, CARD_TYPE_SHORT_LABEL } from "./cardProductPresentation";

export type CardTypeFilter = "all" | CardType;

/** Stable chip order — the prototype's own (اقساطی، اعتباری، تخفیفی) then the remaining real types. */
const TYPE_ORDER: CardType[] = ["INSTALLMENT_CARD", "CREDIT_CARD", "DISCOUNT_CARD", "VOUCHER", "SUBSCRIPTION"];

/**
 * The filter chips are built from the card types that ACTUALLY exist among
 * this category's real CardProducts — never the prototype's static
 * `['همه','اقساطی','اعتباری','تخفیفی','ترکیبی']` list, whose "ترکیبی" has no
 * real counterpart and would be a permanently-empty filter.
 */
export function availableCardTypes(cards: CardProductDto[]): CardType[] {
  const present = new Set(cards.map((c) => c.cardType));
  return TYPE_ORDER.filter((t) => present.has(t));
}

/** Same normalization the prototype's `renderCategoryProducts()` applies: Arabic ي/ك -> Persian ی/ک, trimmed, lower-cased. */
export function normalizeSearchText(value: string): string {
  return value.replace(/ي/g, "ی").replace(/ك/g, "ک").trim().toLowerCase();
}

/**
 * Category-scoped search + type filter — page-local, over the cards the
 * server already scoped to this category (`GET /cards?categoryId=`); it
 * never widens the set, only narrows it. The searchable text mirrors the
 * prototype's haystack (title, type, description, tags) using the real
 * fields: title, type labels, subtitle, description, benefits.
 */
export function filterCardProducts(cards: CardProductDto[], type: CardTypeFilter, query: string): CardProductDto[] {
  const q = normalizeSearchText(query);
  return cards.filter((card) => {
    if (type !== "all" && card.cardType !== type) return false;
    if (!q) return true;
    const haystack = normalizeSearchText(
      [
        card.title,
        CARD_TYPE_LABEL[card.cardType],
        CARD_TYPE_SHORT_LABEL[card.cardType],
        card.subtitle ?? "",
        card.description ?? "",
        ...card.benefits,
      ].join(" "),
    );
    return haystack.includes(q);
  });
}
