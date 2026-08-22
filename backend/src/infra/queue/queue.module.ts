import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE } from './queue.constants';
import { PushNotificationProcessor } from './processors/push-notification.processor';
import { EmailProcessor } from './processors/email.processor';
import { FinancialEventsProcessor } from './processors/financial-events.processor';

/**
 * Global queue infrastructure. Individual modules (auth, notifications, ...)
 * inject `@InjectQueue(QUEUE.SMS)` etc. to enqueue jobs — they never talk to
 * Redis directly. The SMS processor lives in `modules/notifications` (its
 * domain owner, and where `SmsProvider` is wired — docs/07-security.md); the
 * processors below are still Foundation stubs (console.log) pending their
 * own Feature-stage provider wiring.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE.SMS },
      { name: QUEUE.PUSH_NOTIFICATION },
      { name: QUEUE.EMAIL },
      { name: QUEUE.FINANCIAL_EVENTS },
    ),
  ],
  providers: [
    PushNotificationProcessor,
    EmailProcessor,
    FinancialEventsProcessor,
  ],
  exports: [BullModule],
})
export class QueueModule {}
