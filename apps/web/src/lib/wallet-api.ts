import { apiClient } from "./api-client";
import type { WalletDto } from "./home-api";

export type { WalletDto };

/** Matches the raw WalletTransaction shape returned by GET /wallet/:kind/transactions. */
export interface WalletTransactionDto {
  id: string;
  walletId: string;
  type: "topup" | "spend" | "refund" | "gateway_settlement";
  amount: number;
  balanceAfter: number;
  relatedOrderId: string | null;
  relatedRewardClaimId: string | null;
  description: string;
  createdAt: string;
}

/**
 * `GET /wallet/:kind/transactions` returns a plain array (not the
 * `{items,total,skip,take}` envelope most other list endpoints use — see
 * backend/src/modules/wallet/wallet.service.ts's `listTransactions`,
 * verified live against the running API before writing this). Correcting
 * docs/wallet-ui-contract.md §5, which had assumed the paginated shape.
 */
export const walletApi = {
  listWallets: () => apiClient.get<WalletDto[]>("/wallet"),
  listWalletTransactions: (kind: "main" | "reward") =>
    apiClient.get<WalletTransactionDto[]>(`/wallet/${kind}/transactions?limit=20`),
};
