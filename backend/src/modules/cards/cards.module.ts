import { Module } from '@nestjs/common';
import { CardProductsController } from './card-products.controller';
import { CardProductsService } from './card-products.service';
import { CustomerCardsController } from './customer-cards.controller';
import { CustomerCardsService } from './customer-cards.service';

@Module({
  controllers: [CardProductsController, CustomerCardsController],
  providers: [CardProductsService, CustomerCardsService],
})
export class CardsModule {}
