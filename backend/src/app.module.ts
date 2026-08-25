import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { AdminAuditLogModule } from './modules/admin-audit-log/admin-audit-log.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdvisorModule } from './modules/advisor/advisor.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CreditModule } from './modules/credit/credit.module';
import { InstallmentsModule } from './modules/installments/installments.module';
import { MembershipModule } from './modules/membership/membership.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrbitItemsModule } from './modules/orbit-items/orbit-items.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { ServicesModule } from './modules/services/services.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(config.getOrThrow<string>('REDIS_URL')),
        ),
      }),
    }),

    // Infra
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,

    // Domain modules
    AuthModule,
    UsersModule,
    ProfilesModule,
    MembershipModule,
    SubscriptionsModule,
    WalletModule,
    TransactionsModule,
    CreditModule,
    InstallmentsModule,
    ServicesModule,
    CategoriesModule,
    MerchantsModule,
    OrbitItemsModule,
    OrdersModule,
    PaymentsModule,
    RewardsModule,
    NotificationsModule,
    AdvisorModule,

    // Admin (Stage 5.16, docs/admin-architecture-decision-record.md) —
    // independent of every module above: separate identity, separate JWT
    // secret/audience, separate guards. AdminAuditLogModule is imported
    // before AdminAuthModule so its exported AdminAuditLogService is
    // available to inject there.
    AdminAuditLogModule,
    AdminAuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
