import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { CardProductsAdminController } from './card-products-admin.controller';
import { CardProductsController } from './card-products.controller';
import { CardProductsService } from './card-products.service';
import { CustomerCardsController } from './customer-cards.controller';
import { CustomerCardsService } from './customer-cards.service';

@Module({
  imports: [AdminAuditLogModule],
  controllers: [
    CardProductsController,
    CardProductsAdminController,
    CustomerCardsController,
  ],
  providers: [CardProductsService, CustomerCardsService],
})
export class CardsModule {}
