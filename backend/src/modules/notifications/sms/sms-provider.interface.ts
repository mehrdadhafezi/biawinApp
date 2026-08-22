/**
 * Business logic (OTP, order updates, ...) depends only on this interface —
 * never on a specific gateway. Swapping providers, or running two side by
 * side, only touches `sms-provider.factory.ts` (docs/07-security.md,
 * "SMS Provider Architecture").
 */
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
