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
};

/** SERVICES-R4 — real, public `GET /merchants/:id`, same "public catalog read" shape as `servicesApi`. */
export const merchantsApi = {
  getMerchant: (id: string) => apiClient.get<MerchantDto>(`/merchants/${id}`, { public: true }),
};
