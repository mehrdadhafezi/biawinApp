import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { MediaModule } from '../media/media.module';
import { CategoryCardsAdminController } from './category-cards-admin.controller';
import { CategoryCardsController } from './category-cards.controller';
import { CategoryCardsService } from './category-cards.service';

@Module({
  imports: [AdminAuditLogModule, MediaModule],
  controllers: [CategoryCardsController, CategoryCardsAdminController],
  providers: [CategoryCardsService],
})
export class CategoryCardsModule {}
