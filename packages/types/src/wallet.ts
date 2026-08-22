import type { ID, Rial, Timestamps } from "./common";

/** Two separate balances exist in the prototype: the main wallet and the reward wallet. */
export type WalletKind = "main" | "reward";

export interface Wallet {
  userId: ID;
  kind: WalletKind;
  balance: Rial;
}

export type WalletTransactionType = "topup" | "spend" | "refund" | "gateway_settlement";

export interface WalletTransaction extends Timestamps {
  id: ID;
  userId: ID;
  walletKind: WalletKind;
  type: WalletTransactionType;
  amount: Rial;
  /** Balance after this transaction was applied, for auditability. */
  balanceAfter: Rial;
  relatedOrderId: ID | null;
  relatedRewardRedemptionId: ID | null;
  description: string;
}
