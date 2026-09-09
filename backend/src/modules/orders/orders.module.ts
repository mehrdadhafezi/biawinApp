import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ServicePricingService } from './pricing/service-pricing.service';
import { CardProductPricingService } from './pricing/card-product-pricing.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, ServicePricingService, CardProductPricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
