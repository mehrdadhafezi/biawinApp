import { Injectable } from '@nestjs/common';
import { StorageService } from '../../infra/storage/storage.service';
import type { AllowedMediaMimeType } from './utils/media-validation.constants';
import { MIME_TYPE_EXTENSION } from './utils/media-validation.constants';

const MEDIA_NAMESPACE = 'media';

/**
 * Media's own storage abstraction, layered on top of the generic
 * `StorageService` (the actual S3/MinIO adapter) rather than any
 * controller/service in this module talking to `StorageService` — or, far
 * worse, the AWS SDK — directly. `MediaService` only ever calls this class;
 * this class is the one place that knows the `"media/"` key namespace and
 * the public-URL convention, so both can change (a CDN, a signed-URL
 * scheme, a namespace rename) without touching `MediaService`'s business
 * logic at all.
 */
@Injectable()
export class MediaStorageService {
  constructor(private readonly storage: StorageService) {}

  buildKey(mimeType: AllowedMediaMimeType): string {
    return this.storage.buildKey(
      MEDIA_NAMESPACE,
      MIME_TYPE_EXTENSION[mimeType],
    );
  }

  async store(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.storage.putObject(key, body, contentType);
  }

  async remove(key: string): Promise<void> {
    await this.storage.deleteObject(key);
  }

  /**
   * Static-bridge public URL — the exact pattern
   * `OrbitItemsService.resolveImageUrl()` already established and
   * `docs/admin-architecture-decision-record.md` §6 confirms as the
   * project-wide standard: a filename-keyed path, not a presigned MinIO
   * URL (MinIO is loopback-only in every environment this runs in; a
   * presigned URL would also expire and break caching on a page every
   * viewer loads). Serving `/media/{filename}` from the object store is
   * deployment-level wiring — the same not-yet-built step Orbit's own
   * `/orbit/{filename}` bridge is still waiting on, since nothing has
   * uploaded a real Orbit asset through that API either. Recorded here,
   * not silently assumed: `docs/media-library-foundation-report.md` §3.
   */
  resolvePublicUrl(key: string): string {
    const filename = key.split('/').pop();
    return `/${MEDIA_NAMESPACE}/${filename}`;
  }
}
