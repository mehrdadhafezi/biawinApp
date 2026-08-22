import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsProvider } from './sms-provider.interface';

/**
 * FarazSMS (ippanel.com) REST client.
 *
 * ⚠️ Architecture-stage: the request shape below (endpoint path, field names)
 * follows FarazSMS's commonly-documented "send" pattern (username/password/
 * message/recipient/sender against their REST API), but has **not** been
 * verified against a live FarazSMS account in this environment (no real
 * credentials were available — see docs/07-security.md "SMS Provider
 * Architecture"). Before enabling this in staging/production:
 *   1. Confirm the exact endpoint + payload shape against the current
 *      FarazSMS API docs / your account's API key type (REST vs SOAP).
 *   2. Confirm the response shape this class assumes (`res.ok` + a
 *      recoverable error body) matches what FarazSMS actually returns.
 *   3. Set FARAZ_API_URL if your account uses a different base URL.
 */
@Injectable()
export class FarazSmsProvider implements SmsProvider {
  private readonly logger = new Logger(FarazSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(phone: string, message: string): Promise<void> {
    const baseUrl = this.config.get<string>(
      'FARAZ_API_URL',
      'https://edge.ippanel.com/v1/api/send',
    );
    const username = this.config.getOrThrow<string>('FARAZ_USERNAME');
    const password = this.config.getOrThrow<string>('FARAZ_PASSWORD');
    const sender = this.config.getOrThrow<string>('FARAZ_SENDER');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        sender,
        recipient: phone,
        message,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`FarazSMS send failed (${res.status}): ${body}`);
      throw new Error(`FarazSMS send failed with status ${res.status}`);
    }
  }
}
