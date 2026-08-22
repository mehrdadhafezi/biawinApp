import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { ZarinpalProvider } from './zarinpal.provider';
import { ZibalProvider } from './zibal.provider';

/** Selects the gateway from `PAYMENT_PROVIDER` (`zibal` | `zarinpal`), default `zibal`. */
export const paymentProviderFactory: Provider = {
  provide: PAYMENT_PROVIDER,
  inject: [ConfigService, ZibalProvider, ZarinpalProvider],
  useFactory: (
    config: ConfigService,
    zibal: ZibalProvider,
    zarinpal: ZarinpalProvider,
  ) => {
    const provider = config.get<string>('PAYMENT_PROVIDER', 'zibal');
    return provider === 'zarinpal' ? zarinpal : zibal;
  },
};
