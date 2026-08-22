/**
 * Business logic (orders, reward redemption gateway top-ups, ...) depends
 * only on this interface — never on Zibal/Zarinpal/whichever gateway
 * directly. Swapping/adding a provider only touches
 * `payment-provider.factory.ts` (docs/07-security.md, "Payment Provider
 * Architecture"). Not wired into any business flow yet — Feature-stage.
 */
export interface CreatePaymentInput {
  /** Rial, integer — see docs/02-database.md amount convention. */
  amount: number;
  callbackUrl: string;
  description?: string;
  /** Our own Order/RewardClaim id, passed through for the gateway's own reference field where supported. */
  orderId?: string;
}

export interface CreatePaymentResult {
  /** URL to redirect the user's browser to, to complete payment. */
  gatewayUrl: string;
  /** Provider-specific reference, needed later to verify this same payment. */
  trackId: string;
}

export interface VerifyPaymentInput {
  trackId: string;
  amount: number;
}

export interface VerifyPaymentResult {
  success: boolean;
  refNumber?: string;
  rawStatus?: string;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
