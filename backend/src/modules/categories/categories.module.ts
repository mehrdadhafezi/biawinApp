import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { MediaModule } from '../media/media.module';
import { CategoriesAdminController } from './categories-admin.controller';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AdminAuditLogModule, MediaModule],
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
