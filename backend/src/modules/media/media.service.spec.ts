import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

    it('throws NotFoundException for a missing or already-deleted asset', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue(null);
      await expect(
        service.remove('missing-id', 'admin-1', meta),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    });
  });
});
