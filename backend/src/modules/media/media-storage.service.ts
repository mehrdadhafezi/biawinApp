import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

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
   * viewer loads).
   *
   * Stage 5.21: now an ABSOLUTE URL (`PUBLIC_API_ORIGIN` + the standard
   * versioned route) rather than an origin-relative `/media/{filename}`
   * path. The relative form resolved against whichever *frontend* origin
   * rendered the `<img>` — not this backend — and 404'd; that mismatch was
   * never caught because nothing had rendered a resolved media URL in a
   * real browser before Customer Home needed to (`docs/media-library-
   * foundation-report.md` §3 and `docs/admin-architecture-decision-record.md`
   * §6 both flagged the serving route itself as not-yet-built, but neither
   * anticipated the cross-origin issue since it only surfaces once a
   * *different app* than the API consumes the URL). `MediaFilesController`
   * (`media-files.controller.ts`) is the serving route this now points at.
   */
  resolvePublicUrl(key: string): string {
    const filename = key.split('/').pop();
    const origin = this.config.get<string>(
      'PUBLIC_API_ORIGIN',
      'http://localhost:4000',
    );
    return `${origin}/api/v1/${MEDIA_NAMESPACE}/${filename}`;
  }
}
