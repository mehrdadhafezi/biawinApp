/**
 * SERVICES-R5.17 — admin-only shapes for the Category/Service/CardProduct
 * catalog (backend/src/modules/{categories,services,cards}/*). Local to
 * this feature, same convention as features/home/types.ts.
 */

export type PurchaseMethod = "credit" | "installment" | "cash" | "free";
export type CardType =
  | "CREDIT_CARD"
  | "DISCOUNT_CARD"
  | "SUBSCRIPTION"
  | "VOUCHER"
  | "INSTALLMENT_CARD";
export type JourneyType =
  | "PURCHASE"
  | "CREDIT_REQUEST"
  | "LEAD"
  | "EXTERNAL_REDIRECT"
  | "QUOTE_REQUEST"
  | "FREE_SERVICE";
export type CardProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "EXPIRED";
export type CardValueDisplayType = "FIXED" | "UP_TO";

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface ReorderEntry {
  id: string;
  sortOrder: number;
}

export interface CategoryAdmin {
  id: string;
  name: string;
  description: string;
  imageKey: string | null;
  keywords: string[];
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  description: string;
  imageKey?: string | null;
  keywords?: string[];
  sortOrder?: number;
  active?: boolean;
}

export interface ServiceAdmin {
  id: string;
  categoryId: string;
  category?: { id: string; name: string };
  merchantId: string | null;
  title: string;
  groupLabel: string;
  subtitle: string;
  badge: string;
  icon: string | null;
  imageKey: string | null;
  priceFrom: number | null;
  priceLabel: string | null;
  availableMethods: PurchaseMethod[];
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceInput {
  categoryId: string;
  merchantId?: string | null;
  title: string;
  groupLabel: string;
  subtitle: string;
  badge: string;
  icon?: string | null;
  imageKey?: string | null;
  priceFrom?: number | null;
  priceLabel?: string | null;
  availableMethods?: PurchaseMethod[];
  active?: boolean;
}

export interface CardProductAdmin {
  id: string;
  serviceId: string;
  service?: { id: string; title: string };
  title: string;
  subtitle: string | null;
  description: string | null;
  imageKey: string | null;
  badge: string | null;
  cardType: CardType;
  journeyType: JourneyType;
  priceAmount: number | null;
  priceLabel: string | null;
  /** SERVICES-R5.19 — the card's displayed commercial value, NOT the payable price (see priceAmount). */
  valueAmount: number | null;
  valueDisplayType: CardValueDisplayType | null;
  benefits: string[];
  validityDays: number | null;
  status: CardProductStatus;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardProductInput {
  serviceId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageKey?: string | null;
  badge?: string | null;
  cardType: CardType;
  journeyType: JourneyType;
  priceAmount?: number | null;
  priceLabel?: string | null;
  valueAmount?: number | null;
  valueDisplayType?: CardValueDisplayType | null;
  benefits?: string[];
  validityDays?: number | null;
  status?: CardProductStatus;
  sortOrder?: number;
}
