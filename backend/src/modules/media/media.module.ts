import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

@Module({
  imports: [AdminAuditLogModule],
  controllers: [MediaController],
  providers: [MediaService, MediaStorageService],
  // MediaStorageService exported too (Stage 5.19) — Home CMS's services
  // resolve `mediaAsset` relations to public URLs the same way
  // MediaService does, so they inject the same abstraction rather than
  // getting their own separate instance or (worse) reaching for
  // StorageService directly.
  exports: [MediaService, MediaStorageService],
})
export class MediaModule {}
