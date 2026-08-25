import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

@Module({
  imports: [AdminAuditLogModule],
  controllers: [MediaController],
  providers: [MediaService, MediaStorageService],
  exports: [MediaService],
})
export class MediaModule {}
