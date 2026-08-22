import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from './payment-provider.interface';

/**
 * Zarinpal (zarinpal.com) IPG client — request/verify shape follows
 * Zarinpal's documented REST v4 API. ⚠️ Not exercised against a live
 * merchant account in this environment; confirm field names/response codes
 * against current Zarinpal docs before enabling in staging/production
 * (docs/07-security.md).
 */
@Injectable()
export class ZarinpalProvider implements PaymentProvider {
  private readonly logger = new Logger(ZarinpalProvider.name);
  private readonly baseUrl = 'https://api.zarinpal.com/pg/v4/payment';
  private readonly startPayUrl = 'https://www.zarinpal.com/pg/StartPay';

  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const merchant_id = this.config.getOrThrow<string>('ZARINPAL_MERCHANT_ID');

    const res = await fetch(`${this.baseUrl}/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id,
        amount: input.amount,
        callback_url: input.callbackUrl,
        description: input.description ?? 'Biawin payment',
      }),
    });
    const body = (await res.json()) as {
      data?: { authority?: string; code?: number };
      errors?: unknown;
    };

    if (!res.ok || !body.data?.authority) {
      this.logger.error(
        `Zarinpal createPayment failed: ${JSON.stringify(body)}`,
      );
      throw new Error('Zarinpal createPayment failed');
    }

    return {
      trackId: body.data.authority,
      gatewayUrl: `${this.startPayUrl}/${body.data.authority}`,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const merchant_id = this.config.getOrThrow<string>('ZARINPAL_MERCHANT_ID');

    const res = await fetch(`${this.baseUrl}/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id,
        amount: input.amount,
        authority: input.trackId,
      }),
    });
    const body = (await res.json()) as {
      data?: { ref_id?: number; code?: number };
    };

    const success =
      res.ok && (body.data?.code === 100 || body.data?.code === 101);
    return {
      success,
      refNumber: body.data?.ref_id ? String(body.data.ref_id) : undefined,
      rawStatus: String(body.data?.code),
    };
  }
}
