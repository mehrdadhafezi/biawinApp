import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { paymentProviderFactory } from './providers/payment-provider.factory';
import { ZarinpalProvider } from './providers/zarinpal.provider';
import { ZibalProvider } from './providers/zibal.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ZibalProvider,
    ZarinpalProvider,
    paymentProviderFactory,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
