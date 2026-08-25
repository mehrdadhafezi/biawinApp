import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from './media-storage.service';
import { isAllowedMediaMimeType } from './utils/media-validation.constants';
import { sniffImageMimeType } from './utils/file-signature.util';
import { extractImageDimensions } from './utils/image-metadata.util';

/**
 * Deliberately not `Express.Multer.File` — that type comes from
 * `@types/multer`, which (like every other package new to this stage) the
 * npm registry didn't have reachable. `FileInterceptor`'s own exported
 * types (`multer-options.interface.d.ts`) don't reference it either — this
 * interface names exactly the fields this service actually reads, which is
 * all `@UploadedFile()` needs to type-check against at the controller.
 */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface MediaAssetResponse {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * The central, content-type-agnostic media catalog (docs/media-library-
 * foundation-report.md, docs/admin-architecture-decision-record.md §6).
 * Controllers never touch `MediaStorageService`/`StorageService`/S3
 * directly — every mutation goes through here, which is also the one place
 * that writes `AdminAuditLog` entries for media actions.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
    private readonly config: ConfigService,
  ) {}

  async upload(
    file: UploadedFileLike | undefined,
    input: { altText?: string },
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<MediaAssetResponse> {
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException('فایلی برای آپلود ارسال نشده است.');
    }

    const maxSizeBytes = this.config.get<number>(
      'MEDIA_MAX_FILE_SIZE_BYTES',
      5_242_880,
    );
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `حجم فایل بیشتر از حد مجاز است (حداکثر ${Math.floor(maxSizeBytes / 1024 / 1024)} مگابایت).`,
      );
    }

    if (!isAllowedMediaMimeType(file.mimetype)) {
      throw new BadRequestException(
        'فرمت فایل مجاز نیست. فرمت‌های مجاز: JPEG، PNG، WebP، GIF.',
      );
    }

    // The real security check — never trust the client-declared
    // Content-Type alone (see file-signature.util.ts).
    const sniffedMimeType = sniffImageMimeType(file.buffer);
    if (!sniffedMimeType || sniffedMimeType !== file.mimetype) {
      throw new BadRequestException(
        'محتوای فایل با نوع اعلام‌شده آن مطابقت ندارد یا فایل یک تصویر معتبر نیست.',
      );
    }

    const dimensions = extractImageDimensions(file.buffer, sniffedMimeType);
    const key = this.mediaStorage.buildKey(sniffedMimeType);
    await this.mediaStorage.store(key, file.buffer, sniffedMimeType);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        fileName: file.originalname,
        key,
        mimeType: sniffedMimeType,
        sizeBytes: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        altText: input.altText ?? null,
        uploadedBy: adminUserId,
      },
    });

    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'MediaAsset',
      resourceId: asset.id,
      afterJson: {
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.toResponse(asset);
  }

  async list(skip: number, take: number) {
    const where = { active: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOne(id: string): Promise<MediaAssetResponse> {
    const asset = await this.findActiveOrThrow(id);
    return this.toResponse(asset);
  }

  /**
   * Soft delete only (`active: false` + `deletedAt`) — this stage's delete
   * safety mechanism. Nothing references `MediaAsset.id` yet (Home/News
   * media isn't wired up this stage), so there's no live-content-breakage
   * risk to check for today; the row and the underlying storage object
   * both survive, so a mistaken delete is recoverable by a direct DB fix
   * without needing the original file back. A hard delete (removing the
   * storage object) is intentionally not built here — add it once a real
   * "empty trash" flow exists, backed by an actual usage check once some
   * content type references this table.
   */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const asset = await this.findActiveOrThrow(id);

    await this.prisma.mediaAsset.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });

    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'MediaAsset',
      resourceId: id,
      beforeJson: {
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        key: asset.key,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id };
  }

  private async findActiveOrThrow(id: string): Promise<MediaAsset> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, active: true },
    });
    if (!asset) throw new NotFoundException('فایل رسانه یافت نشد.');
    return asset;
  }

  private toResponse(asset: MediaAsset): MediaAssetResponse {
    return {
      id: asset.id,
      fileName: asset.fileName,
      url: this.mediaStorage.resolvePublicUrl(asset.key),
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
      uploadedBy: asset.uploadedBy,
      createdAt: asset.createdAt,
    };
  }
}
