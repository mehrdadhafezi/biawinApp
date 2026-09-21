import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';
import { samplePng, sampleJpeg } from './utils/__fixtures__/sample-images';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)`/`expect.any(...)` are typed `any` in @types/jest; every use below is a plain Jest assertion helper, not a real unsafe value (same rationale as modules/admin-auth/admin-auth.service.spec.ts, Stage 5.16). */

describe('MediaService', () => {
  let service: MediaService;
  let prisma: {
    mediaAsset: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    homeServiceBanner: { count: jest.Mock };
    homeServiceMosaicTile: { count: jest.Mock };
    homeNewsArticle: { count: jest.Mock };
    category: { count: jest.Mock };
    categoryCard: { count: jest.Mock };
    service: { count: jest.Mock };
    cardProduct: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let mediaStorage: {
    buildKey: jest.Mock;
    store: jest.Mock;
    remove: jest.Mock;
    resolvePublicUrl: jest.Mock;
  };
  let auditLog: { record: jest.Mock };

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeEach(async () => {
    prisma = {
      mediaAsset: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      homeServiceBanner: { count: jest.fn().mockResolvedValue(0) },
      homeServiceMosaicTile: { count: jest.fn().mockResolvedValue(0) },
      homeNewsArticle: { count: jest.fn().mockResolvedValue(0) },
      category: { count: jest.fn().mockResolvedValue(0) },
      categoryCard: { count: jest.fn().mockResolvedValue(0) },
      service: { count: jest.fn().mockResolvedValue(0) },
      cardProduct: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    mediaStorage = {
      buildKey: jest.fn().mockReturnValue('media/generated-key.png'),
      store: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      resolvePublicUrl: jest.fn(
        (key: string) => `/media/${key.split('/').pop()}`,
      ),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaStorageService, useValue: mediaStorage },
        { provide: AdminAuditLogService, useValue: auditLog },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback: unknown) => fallback },
        },
      ],
    }).compile();

    service = module.get(MediaService);
  });

  describe('upload', () => {
    it('succeeds for a valid PNG: stores the file, persists the row, and returns a shaped response', async () => {
      const buffer = samplePng(100, 50);
      prisma.mediaAsset.create.mockResolvedValue({
        id: 'asset-1',
        fileName: 'photo.png',
        key: 'media/generated-key.png',
        mimeType: 'image/png',
        sizeBytes: buffer.length,
        width: 100,
        height: 50,
        altText: null,
        uploadedBy: 'admin-1',
        createdAt: new Date(),
      });

      const result = await service.upload(
        {
          originalname: 'photo.png',
          mimetype: 'image/png',
          size: buffer.length,
          buffer,
        },
        {},
        'admin-1',
        meta,
      );

      expect(mediaStorage.store).toHaveBeenCalledWith(
        'media/generated-key.png',
        buffer,
        'image/png',
      );
      expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fileName: 'photo.png',
          key: 'media/generated-key.png',
          mimeType: 'image/png',
          sizeBytes: buffer.length,
          width: 100,
          height: 50,
          uploadedBy: 'admin-1',
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'asset-1',
          fileName: 'photo.png',
          url: '/media/generated-key.png',
        }),
      );
    });

    it('rejects a missing file', async () => {
      await expect(
        service.upload(undefined, {}, 'admin-1', meta),
      ).rejects.toThrow(BadRequestException);
      expect(mediaStorage.store).not.toHaveBeenCalled();
    });

    it('rejects a disallowed declared MIME type (e.g. application/pdf)', async () => {
      const buffer = Buffer.from('%PDF-1.4 fake');
      await expect(
        service.upload(
          {
            originalname: 'doc.pdf',
            mimetype: 'application/pdf',
            size: buffer.length,
            buffer,
          },
          {},
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mediaStorage.store).not.toHaveBeenCalled();
    });

    it('rejects a file whose declared MIME type does not match its real content (spoofed upload)', async () => {
      // Declares image/png but the actual bytes are plain text — the magic-byte check must catch this even though the MIME allow-list check alone would pass.
      const buffer = Buffer.from('this is not a real png, just relabeled text');
      await expect(
        service.upload(
          {
            originalname: 'fake.png',
            mimetype: 'image/png',
            size: buffer.length,
            buffer,
          },
          {},
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mediaStorage.store).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    });

    it('rejects a file larger than MEDIA_MAX_FILE_SIZE_BYTES', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MediaService,
          { provide: PrismaService, useValue: prisma },
          { provide: MediaStorageService, useValue: mediaStorage },
          { provide: AdminAuditLogService, useValue: auditLog },
          { provide: ConfigService, useValue: { get: () => 10 } }, // 10-byte limit for this test
        ],
      }).compile();
      const tinyLimitService = module.get(MediaService);

      const buffer = samplePng();
      await expect(
        tinyLimitService.upload(
          {
            originalname: 'photo.png',
            mimetype: 'image/png',
            size: buffer.length,
            buffer,
          },
          {},
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mediaStorage.store).not.toHaveBeenCalled();
    });

    it('extracts and persists real width/height metadata from the uploaded file', async () => {
      const buffer = sampleJpeg(640, 480);
      prisma.mediaAsset.create.mockResolvedValue({
        id: 'asset-2',
        fileName: 'wide.jpg',
        key: 'media/generated-key.png',
        mimeType: 'image/jpeg',
        sizeBytes: buffer.length,
        width: 640,
        height: 480,
        altText: null,
        uploadedBy: 'admin-1',
        createdAt: new Date(),
      });

      const result = await service.upload(
        {
          originalname: 'wide.jpg',
          mimetype: 'image/jpeg',
          size: buffer.length,
          buffer,
        },
        {},
        'admin-1',
        meta,
      );

      expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ width: 640, height: 480 }),
      });
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
    });

    it('records a CREATE audit log entry on successful upload', async () => {
      const buffer = samplePng();
      prisma.mediaAsset.create.mockResolvedValue({
        id: 'asset-3',
        fileName: 'photo.png',
        key: 'media/generated-key.png',
        mimeType: 'image/png',
        sizeBytes: buffer.length,
        width: 100,
        height: 50,
        altText: null,
        uploadedBy: 'admin-1',
        createdAt: new Date(),
      });

      await service.upload(
        {
          originalname: 'photo.png',
          mimetype: 'image/png',
          size: buffer.length,
          buffer,
        },
        {},
        'admin-1',
        meta,
      );

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'MediaAsset',
          resourceId: 'asset-3',
        }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes the asset and records a DELETE audit entry', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        fileName: 'photo.png',
        key: 'media/generated-key.png',
        mimeType: 'image/png',
      });

      await service.remove('asset-1', 'admin-1', meta);

      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { active: false, deletedAt: expect.any(Date) },
      });
      expect(mediaStorage.remove).not.toHaveBeenCalled(); // soft delete only — see remove()'s own doc comment
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'DELETE',
          resourceType: 'MediaAsset',
          resourceId: 'asset-1',
        }),
      );
    });

    describe('reference guard (Stage 5.16-B, BD-4)', () => {
      const asset = {
        id: 'asset-1',
        fileName: 'photo.png',
        key: 'media/generated-key.png',
        mimeType: 'image/png',
      };

      const referrers: [string, () => jest.Mock][] = [
        ['a Home banner', () => prisma.homeServiceBanner.count],
        ['a Home mosaic tile', () => prisma.homeServiceMosaicTile.count],
        ['a Home news article', () => prisma.homeNewsArticle.count],
        ['a Category', () => prisma.category.count],
        ['a CategoryCard', () => prisma.categoryCard.count],
        ['a Service (main image or gallery)', () => prisma.service.count],
        ['a CardProduct', () => prisma.cardProduct.count],
      ];

      it.each(referrers)(
        'returns 409 and writes nothing when the asset is referenced by %s',
        async (_label, countMock) => {
          prisma.mediaAsset.findFirst.mockResolvedValue(asset);
          countMock().mockResolvedValue(1);

          await expect(
            service.remove('asset-1', 'admin-1', meta),
          ).rejects.toThrow(ConflictException);

          expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
          expect(mediaStorage.remove).not.toHaveBeenCalled();
          expect(auditLog.record).not.toHaveBeenCalled();
        },
      );

      it('checks the Service gallery JSON id list (no FK) for the asset id', async () => {
        prisma.mediaAsset.findFirst.mockResolvedValue(asset);
        await service.remove('asset-1', 'admin-1', meta);

        expect(prisma.service.count).toHaveBeenCalledWith({
          where: { galleryMediaAssetIds: { array_contains: 'asset-1' } },
        });
        expect(prisma.service.count).toHaveBeenCalledWith({
          where: { mediaAssetId: 'asset-1' },
        });
      });

      it('the 409 body names which locations reference the asset and never detaches anything', async () => {
        prisma.mediaAsset.findFirst.mockResolvedValue(asset);
        prisma.cardProduct.count.mockResolvedValue(2);
        prisma.homeServiceBanner.count.mockResolvedValue(1);

        const error = await service
          .remove('asset-1', 'admin-1', meta)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toEqual(
          expect.objectContaining({
            details: { references: { homeServiceBanners: 1, cardProducts: 2 } },
          }),
        );
        // Only the read-only counts ran; no referencing table was written.
        for (const model of [
          prisma.homeServiceBanner,
          prisma.category,
          prisma.categoryCard,
          prisma.service,
          prisma.cardProduct,
        ]) {
          expect(Object.keys(model)).toEqual(['count']);
        }
        expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
      });

      it('an unreferenced asset is still soft-deleted exactly as before', async () => {
        prisma.mediaAsset.findFirst.mockResolvedValue(asset);

        await service.remove('asset-1', 'admin-1', meta);

        expect(prisma.mediaAsset.update).toHaveBeenCalledTimes(1);
        expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
          where: { id: 'asset-1' },
          data: { active: false, deletedAt: expect.any(Date) },
        });
      });
    });

    it('throws NotFoundException for a missing or already-deleted asset', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue(null);
      await expect(
        service.remove('missing-id', 'admin-1', meta),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    });
  });
});
