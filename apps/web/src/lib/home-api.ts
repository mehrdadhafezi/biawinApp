import { apiClient } from "./api-client";

/** Matches the raw MembershipPlan shape returned by GET /subscriptions (public catalog). */
export interface MembershipPlanDto {
  id: string;
  kind: "earn" | "core" | "reward";
  tier: "start" | "plus" | "family" | "prime" | "gift" | "travel" | "lifestyle" | "organizational" | null;
  title: string;
  kicker: string;
  shortDescription: string;
  description: string;
  level: string;
  creditLabel: string;
  durationLabel: string;
  priceLabel: string;
  accentColor: string;
  deepColor: string;
  activationActionLabel: string;
  benefits: { title: string; description: string }[];
  terms: string[];
  sortOrder: number;
  active: boolean;
}

/** Matches the raw Membership shape returned by GET /membership (current user's activations). */
export interface MembershipDto {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "pending" | "special" | "expired";
  activatedAt: string | null;
  expiresAt: string | null;
}

export interface WalletDto {
  id: string;
  userId: string;
  kind: "main" | "reward";
  balance: number;
}

export interface CreditLineDto {
  id: string;
  userId: string;
  limitAmount: number;
  usedAmount: number;
  status: "active" | "suspended" | "closed";
  expiresAt: string | null;
}

/** Matches the raw Category shape returned by GET /categories (public catalog). */
export interface CategoryDto {
  id: string;
  name: string;
  description: string;
  imageKey: string | null;
  keywords: unknown;
  sortOrder: number;
  active: boolean;
}

export interface InstallmentDto {
  id: string;
  orderId: string;
  userId: string;
  totalMonths: number;
  monthlyAmount: number;
  paidCount: number;
  status: "active" | "completed" | "defaulted" | "cancelled";
  nextDueDate: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

// --- Home CMS (Stage 5.19 backend, Stage 5.21 Customer integration) --------
// Matches the real `GET /home/**` public response shapes exactly (verified
// live against the running backend, not assumed from the planning contract —
// see backend/src/modules/home/home-*.service.ts's own `toPublicResponse()`
// methods). Deliberately separate interfaces from `NewsArticle`/
// `ServiceCategory` in `@biawin/types` (those are the older mock-shaped
// customer types) — these are the raw API DTOs, transformed into this app's
// existing Home view models by `components/home/homeCmsAdapter.ts`, never
// consumed directly by presentation components.

export type HeroCardColor = "blue" | "sky" | "white";

export interface HomeHeroCardDto {
  id: string;
  cardKey: "earn" | "biawin" | "reward";
  label: string;
  title: string;
  subtitle: string;
  displayNumber: string;
  ownerLabel: string;
  colorPreset: HeroCardColor;
  sortOrder: number;
}

export type HomeBannerTheme = "auto" | "home" | "fashion" | "gold" | "travel";

export interface HomeServiceBannerDto {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  kicker: string;
  theme: HomeBannerTheme;
  wide: boolean;
  sortOrder: number;
}

export type HomeMosaicSlot = "half" | "wide";
export type HomeMosaicTheme = "beauty" | "insurance" | "home" | "digital";

export interface HomeServiceMosaicTileDto {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  slotType: HomeMosaicSlot;
  kicker: string;
  title: string | null;
  lead: string | null;
  theme: HomeMosaicTheme;
  sortOrder: number;
}

export interface HomeNewsArticleDto {
  id: string;
  category: string;
  image: string | null;
  kicker: string;
  title: string;
  lead: string;
  sortOrder: number;
}

export const homeApi = {
  listSubscriptionPlans: () => apiClient.get<Paginated<MembershipPlanDto>>("/subscriptions?limit=20", { public: true }),
  listMyMemberships: () => apiClient.get<Paginated<MembershipDto>>("/membership?limit=20"),
  listWallets: () => apiClient.get<WalletDto[]>("/wallet"),
  listCreditLines: () => apiClient.get<Paginated<CreditLineDto>>("/credit?limit=20"),
  listInstallments: () => apiClient.get<Paginated<InstallmentDto>>("/installments?limit=20"),
  listCategories: () => apiClient.get<Paginated<CategoryDto>>("/categories?limit=20", { public: true }),

  // Never call `/admin/home/**` from the Customer App (Stage 5.21 §8) —
  // these are exclusively the public, unauthenticated `/home/**` routes.
  listHomeHeroCards: () => apiClient.get<HomeHeroCardDto[]>("/home/hero-cards", { public: true }),
  listHomeServiceBanners: () => apiClient.get<HomeServiceBannerDto[]>("/home/service-banners", { public: true }),
  listHomeServiceMosaicTiles: () => apiClient.get<HomeServiceMosaicTileDto[]>("/home/service-mosaic-tiles", { public: true }),
  listHomeNewsArticles: () => apiClient.get<HomeNewsArticleDto[]>("/home/news-articles", { public: true }),
};
