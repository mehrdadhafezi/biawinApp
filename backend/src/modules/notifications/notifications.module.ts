import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsProcessor } from './processors/sms.processor';
import { FarazSmsProvider } from './sms/faraz-sms.provider';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { smsProviderFactory } from './sms/sms-provider.factory';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SmsProcessor,
    FarazSmsProvider,
    MockSmsProvider,
    smsProviderFactory,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
