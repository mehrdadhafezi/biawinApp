import { apiClient } from "./api-client";
import type { InstallmentDto } from "./home-api";

export type { InstallmentDto };

interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Both endpoints verified live before writing this (per this stage's
 * instruction) — `GET /installments` returns the standard
 * `{items,total,skip,take}` envelope, `GET /installments/:id` returns
 * the single object directly. No surprises this time (contrast with
 * Wallet's transactions endpoint, which turned out to be a plain array —
 * see docs/wallet-v1-implementation-report.md).
 */
export const installmentApi = {
  listInstallments: () => apiClient.get<Paginated<InstallmentDto>>("/installments?limit=20"),
  getInstallment: (id: string) => apiClient.get<InstallmentDto>(`/installments/${id}`),
};
