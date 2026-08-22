import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from './sms-provider.interface';

/** Used whenever no real provider is configured (default in dev/CI) — logs instead of sending. */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  send(phone: string, message: string): Promise<void> {
    this.logger.log(`[mock-sms] would send to ${phone}: "${message}"`);
    return Promise.resolve();
  }
}
