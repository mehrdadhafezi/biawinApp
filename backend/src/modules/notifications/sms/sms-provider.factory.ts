import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FarazSmsProvider } from './faraz-sms.provider';
import { MockSmsProvider } from './mock-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

const logger = new Logger('SmsProviderFactory');

/**
 * Selects the SMS implementation from `SMS_PROVIDER` — falls back to the mock
 * whenever `faraz` is requested but credentials are missing, so `pnpm dev` /
 * CI never crash on absent SMS credentials (docs/07-security.md).
 */
export const smsProviderFactory: Provider = {
  provide: SMS_PROVIDER,
  inject: [ConfigService, FarazSmsProvider, MockSmsProvider],
  useFactory: (
    config: ConfigService,
    faraz: FarazSmsProvider,
    mock: MockSmsProvider,
  ) => {
    const provider = config.get<string>('SMS_PROVIDER', 'mock');
    if (provider === 'faraz') {
      const hasCredentials = Boolean(
        config.get<string>('FARAZ_USERNAME') &&
        config.get<string>('FARAZ_PASSWORD'),
      );
      if (hasCredentials) return faraz;
      logger.warn(
        'SMS_PROVIDER=faraz but FARAZ_USERNAME/FARAZ_PASSWORD are not set — falling back to MockSmsProvider.',
      );
    }
    return mock;
  },
};
