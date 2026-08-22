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
 * Zibal (zibal.ir) IPG client — request/verify shape follows Zibal's
 * documented REST API. ⚠️ Not exercised against a live merchant account in
 * this environment; confirm field names/response codes against current Zibal
 * docs before enabling in staging/production (docs/07-security.md).
 */
@Injectable()
export class ZibalProvider implements PaymentProvider {
  private readonly logger = new Logger(ZibalProvider.name);
  private readonly baseUrl = 'https://gateway.zibal.ir';

  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const merchant = this.config.getOrThrow<string>('ZIBAL_MERCHANT_ID');

    const res = await fetch(`${this.baseUrl}/v1/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant,
        amount: input.amount,
        callbackUrl: input.callbackUrl,
        description: input.description,
        orderId: input.orderId,
      }),
    });
    const body = (await res.json()) as {
      result: number;
      trackId?: string;
      message?: string;
    };

    if (!res.ok || body.result !== 100 || !body.trackId) {
      this.logger.error(`Zibal createPayment failed: ${JSON.stringify(body)}`);
      throw new Error(
        `Zibal createPayment failed: ${body.message ?? 'unknown error'}`,
      );
    }

    return {
      trackId: body.trackId,
      gatewayUrl: `${this.baseUrl}/start/${body.trackId}`,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const merchant = this.config.getOrThrow<string>('ZIBAL_MERCHANT_ID');

    const res = await fetch(`${this.baseUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, trackId: input.trackId }),
    });
    const body = (await res.json()) as {
      result: number;
      refNumber?: string;
      amount?: number;
      status?: number;
    };

    return {
      success: res.ok && body.result === 100,
      refNumber: body.refNumber,
      rawStatus: String(body.status ?? body.result),
    };
  }
}
