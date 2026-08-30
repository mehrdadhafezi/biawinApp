import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ServicePricingService } from './pricing/service-pricing.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, ServicePricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
