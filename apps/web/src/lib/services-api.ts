import { apiClient } from "./api-client";
import type { CategoryDto } from "./home-api";

export type { CategoryDto };

export type PurchaseMethod = "credit" | "installment" | "cash" | "free";

/** Matches the raw Service shape returned by GET /services and GET /services/:id (public catalog). */
export interface ServiceDto {
  id: string;
  categoryId: string;
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
  installmentMinMonths: number | null;
  installmentMaxMonths: number | null;
  creditMultiplierLabel: string | null;
  benefits: string[];
  galleryKeys: string[];
  faq: { question: string; answer: string }[];
  tags: string[];
  active: boolean;
}

/**
 * SERVICES-R4 — matches the raw Merchant shape returned by
 * `GET /merchants/:id` (public). Deliberately minimal: this is the
 * REAL, complete `Merchant` model (`backend/prisma/schema.prisma`) —
 * `id`/`name`/`description`/`logoKey`/`active` only. No branch, address,
 * phone, rating, or discount fields exist anywhere in the real schema;
 * see docs/services-r4-merchant-detail-report.md for why none of those
 * prototype-adjacent concepts were invented here.
 */
export interface MerchantDto {
  id: string;
  name: string;
  description: string | null;
  logoKey: string | null;
  active: boolean;
}

export type CardType = "CREDIT_CARD" | "DISCOUNT_CARD" | "SUBSCRIPTION" | "VOUCHER" | "INSTALLMENT_CARD";
export type JourneyType = "PURCHASE" | "CREDIT_REQUEST" | "LEAD" | "EXTERNAL_REDIRECT" | "QUOTE_REQUEST" | "FREE_SERVICE";
export type CardValueDisplayType = "FIXED" | "UP_TO";

/**
 * SERVICES-R5.18 — matches the raw CardProduct shape returned by the
 * public `GET /cards`/`GET /cards/:id` (backend/src/modules/cards/
 * card-products.controller.ts, SERVICES-R5.16/R5.17) — always
 * `status: 'ACTIVE'` there, enforced server-side (see
 * `CardProductsService.list()`/`findOneOrThrow()`), never client-filtered
 * here. No `usageGuide`/`terms` field exists on the real `CardProduct`
 * model — only `benefits` — so this stage's UI never renders a "usage
 * guide"/"terms" section (nothing to show, not an oversight; see
 * docs/services-r5-18-customer-card-catalog-ui.md).
 *
 * SERVICES-R5.19 CRITICAL: `priceAmount`/`priceLabel` are what the
 * customer PAYS BIAWIN — never rendered to the customer as the card's
 * value (an R5.18 bug this stage fixes; see
 * docs/services-r5-19-purchase-order-audit.md §10). `valueAmount`/
 * `valueDisplayType` are the card's own displayed commercial value/credit
 * ceiling — the ONLY fields `formatCardProductValue()` may read.
 */
export interface CardProductDto {
  id: string;
  serviceId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageKey: string | null;
  badge: string | null;
  cardType: CardType;
  journeyType: JourneyType;
  priceAmount: number | null;
  priceLabel: string | null;
  valueAmount: number | null;
  valueDisplayType: CardValueDisplayType | null;
  benefits: string[];
  validityDays: number | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "EXPIRED";
  sortOrder: number;
}

interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

const MAX_PAGE_SIZE = 100;

/**
 * `GET /services` has no `categoryId`/`method`/`q` filter today
 * (verified this session, matches docs/services-ui-contract.md §6's
 * "PARTIALLY AVAILABLE" finding) — Category View filters the full list
 * client-side instead, the same workaround `useCategories` already uses
 * for the missing `active` filter. `limit` is capped at 100 server-side
 * (verified live — 108 seeded services needs 2 pages), so this loops
 * pages until every item is collected rather than assuming one page is
 * enough.
 */
async function listAllServices(): Promise<ServiceDto[]> {
  const all: ServiceDto[] = [];
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const result = await apiClient.get<Paginated<ServiceDto>>(
      `/services?limit=${MAX_PAGE_SIZE}&page=${page}`,
      { public: true },
    );
    all.push(...result.items);
    if (all.length >= result.total) break;
    page += 1;
  }
  return all;
}

export const servicesApi = {
  listCategories: () => apiClient.get<Paginated<CategoryDto>>("/categories?limit=100", { public: true }),
  listAllServices,
  getService: (id: string) => apiClient.get<ServiceDto>(`/services/${id}`, { public: true }),
  /**
   * SERVICES-R5.21 — the Category Landing route's (`/categories/[slug]`)
   * data source. A dedicated backend path (`GET /categories/slug/:slug`,
   * never `:id`), so this 404s for any Category with no slug ever set by
   * Admin — no fabricated slug exists for any real Category yet.
   */
  getCategoryBySlug: (slug: string) => apiClient.get<CategoryDto>(`/categories/slug/${slug}`, { public: true }),
};

/** SERVICES-R4 — real, public `GET /merchants/:id`, same "public catalog read" shape as `servicesApi`. */
export const merchantsApi = {
  getMerchant: (id: string) => apiClient.get<MerchantDto>(`/merchants/${id}`, { public: true }),
};

/**
 * SERVICES-R5.18 — real, public `GET /cards`/`GET /cards/:id`. Unlike
 * `GET /services` (no server-side `active` filter, see `listAllServices`'s
 * own comment), `GET /cards` already filters to `status: 'ACTIVE'`
 * server-side (SERVICES-R5.16/R5.17), so a single page is fetched here —
 * no client-side active-filtering workaround is needed or added.
 */
export const cardProductsApi = {
  listByService: (serviceId: string) =>
    apiClient.get<Paginated<CardProductDto>>(`/cards?serviceId=${serviceId}&limit=100`, { public: true }),
  getCardProduct: (id: string) => apiClient.get<CardProductDto>(`/cards/${id}`, { public: true }),
};

/**
 * SERVICES-R5.21 — CategoryCard is a discovery/marketing card for the
 * Category Landing route, NOT a purchasable product — it has no price and
 * no relationship to CardProduct at all. It only ever points at a Service
 * (`targetServiceId`); clicking one navigates to that Service's own
 * Detail page, where the real CardProduct purchase flow (R5.16–R5.19)
 * lives. `image` is already a resolved, real URL (or null) — never a raw
 * Storage key needing client-side resolution.
 */
export interface CategoryCardDto {
  id: string;
  categoryId: string;
  targetServiceId: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image: string | null;
  highlights: string[];
  sortOrder: number;
}

/**
 * SERVICES-R5.21 — real, public `GET /category-cards?categoryId=X`,
 * already filtered to `active: true` server-side (mirrors
 * `cardProductsApi`'s own "no client-side re-filter needed" discipline).
 */
export const categoryCardsApi = {
  listByCategory: (categoryId: string) =>
    apiClient.get<Paginated<CategoryCardDto>>(`/category-cards?categoryId=${categoryId}&limit=100`, { public: true }),
};
