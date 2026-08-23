import { Module } from '@nestjs/common';
import { OrbitItemsAdminController } from './orbit-items-admin.controller';
import { OrbitItemsController } from './orbit-items.controller';
import { OrbitItemsService } from './orbit-items.service';

@Module({
  controllers: [OrbitItemsController, OrbitItemsAdminController],
  providers: [OrbitItemsService],
  exports: [OrbitItemsService],
})
export class OrbitItemsModule {}
