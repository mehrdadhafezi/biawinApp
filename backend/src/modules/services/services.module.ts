import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { ServicesAdminController } from './services-admin.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [AdminAuditLogModule],
  controllers: [ServicesController, ServicesAdminController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
