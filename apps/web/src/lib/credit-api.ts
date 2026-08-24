import { apiClient } from "./api-client";
import type { CreditLineDto } from "./home-api";

export type { CreditLineDto };

interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

/**
 * `GET /credit` returns the standard paginated envelope (verified live
 * before writing this, per this stage's instruction — unlike Wallet's
 * `/wallet/:kind/transactions`, which turned out to be a plain array;
 * credit-ui-contract.md's assumption for this endpoint was correct).
 */
export const creditApi = {
  listCreditLines: () => apiClient.get<Paginated<CreditLineDto>>("/credit?limit=20"),
};
