import type { ID, Rial, Timestamps } from "./common";

export interface ServiceCategory extends Timestamps {
  id: ID;
  name: string;
  description: string;
  imageUrl: string;
  /** Search keywords, e.g. "خودرو ماشین اقساط خرید". */
  keywords: string[];
  sortOrder: number;
}

/**
 * The 4 purchase methods offered on a product's detail page
 * (خرید اعتباری / خرید قسطی / پرداخت کامل / رایگان و جایزه).
 */
export type PurchaseMethod = "credit" | "installment" | "cash" | "free";

export interface InstallmentPlan {
  minMonths: number;
  maxMonths: number;
}

/** A catalog product/offer within a service category. */
export interface Product extends Timestamps {
  id: ID;
  categoryId: ID;
  title: string;
  /** Subcategory / group label, e.g. "شاسی‌بلند", "زیورآلات". */
  group: string;
  subtitle: string;
  /** Free-form badge shown on the card, e.g. "اقساطی", "محبوب", "ویژه". */
  badge: string;
  icon: string | null;
  imageUrl: string | null;
  /** Starting price, when the product has a fixed/known starting price. */
  priceFrom: Rial | null;
  /** Display fallback when price isn't a fixed number, e.g. "قیمت روز طلا". */
  priceLabel: string | null;
  availableMethods: PurchaseMethod[];
  installmentPlan: InstallmentPlan | null;
  /** Purchasing power multiplier shown on the hero, e.g. "تا ۳ برابر". */
  creditMultiplierLabel: string | null;
  benefits: string[];
  galleryImageUrls: string[];
  faq: { question: string; answer: string }[];
  tags: string[];
}
