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

export const homeApi = {
  listSubscriptionPlans: () => apiClient.get<Paginated<MembershipPlanDto>>("/subscriptions?limit=20", { public: true }),
  listMyMemberships: () => apiClient.get<Paginated<MembershipDto>>("/membership?limit=20"),
  listWallets: () => apiClient.get<WalletDto[]>("/wallet"),
  listCreditLines: () => apiClient.get<Paginated<CreditLineDto>>("/credit?limit=20"),
  listInstallments: () => apiClient.get<Paginated<InstallmentDto>>("/installments?limit=20"),
  listCategories: () => apiClient.get<Paginated<CategoryDto>>("/categories?limit=20", { public: true }),
};
