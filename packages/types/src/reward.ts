import type { ID, Rial, Timestamps } from "./common";

export interface RewardProduct extends Timestamps {
  id: ID;
  title: string;
  imageUrl: string;
  /** Cost to redeem, in Rial. */
  cost: Rial;
  description: string;
  active: boolean;
}

export type RewardRedemptionStatus = "pending_payment" | "confirmed" | "cancelled";

/**
 * Redeeming a reward can be split between the reward wallet and a payment gateway
 * for the difference, mirroring the prototype's combined-payment modal.
 */
export interface RewardRedemption extends Timestamps {
  id: ID;
  userId: ID;
  rewardProductId: ID;
  cost: Rial;
  paidFromWallet: Rial;
  paidFromGateway: Rial;
  status: RewardRedemptionStatus;
  gatewayReferenceId: string | null;
}
