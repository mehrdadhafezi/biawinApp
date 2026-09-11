import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { ServicesService } from './services.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: {
    service: Record<string, jest.Mock>;
    category: Record<string, jest.Mock>;
    merchant: Record<string, jest.Mock>;
    mediaAsset: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let auditLog: { record: jest.Mock };

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };
  const baseDto = {
    categoryId: 'cat-1',
    title: 'خودرو',
    groupLabel: 'گروه',
    subtitle: 'زیرعنوان',
    badge: 'نشان',
  };

  beforeEach(async () => {
    prisma = {
      service: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MediaStorageService,
          useValue: {
            resolvePublicUrl: jest.fn(
              (key: string) => `https://media.test/${key}`,
            ),
          },
        },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  describe('public list()/findOneOrThrow() — unchanged behavior', () => {
    it('findOneOrThrow throws NotFoundException for a missing service', async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('media resolution (SERVICES-R5.22)', () => {
    it('resolves image to a public URL when a mediaAsset is attached', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        mediaAssetId: 'media-1',
        mediaAsset: { id: 'media-1', key: 'services/service-1.jpg' },
        galleryMediaAssetIds: [],
      });

      const result = await service.findOneOrThrow('service-1');

      expect(result.image).toBe('https://media.test/services/service-1.jpg');
      expect(result.gallery).toEqual([]);
    });

    it('resolves image to null when no mediaAsset is attached', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        mediaAssetId: null,
        mediaAsset: null,
        galleryMediaAssetIds: [],
      });

      const result = await service.findOneOrThrow('service-1');

      expect(result.image).toBeNull();
    });

    it('resolves galleryMediaAssetIds to an ordered list of public URLs', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        mediaAssetId: null,
        mediaAsset: null,
        galleryMediaAssetIds: ['media-a', 'media-b'],
      });
      prisma.mediaAsset.findMany.mockResolvedValue([
        { id: 'media-a', key: 'services/gallery-a.jpg' },
        { id: 'media-b', key: 'services/gallery-b.jpg' },
      ]);

      const result = await service.findOneOrThrow('service-1');

      expect(result.gallery).toEqual([
        'https://media.test/services/gallery-a.jpg',
        'https://media.test/services/gallery-b.jpg',
      ]);
    });

    it('silently drops a gallery id whose MediaAsset no longer exists, rather than a broken URL', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        mediaAssetId: null,
        mediaAsset: null,
        galleryMediaAssetIds: ['media-a', 'media-deleted'],
      });
      prisma.mediaAsset.findMany.mockResolvedValue([
        { id: 'media-a', key: 'services/gallery-a.jpg' },
      ]);

      const result = await service.findOneOrThrow('service-1');

      expect(result.gallery).toEqual([
        'https://media.test/services/gallery-a.jpg',
      ]);
    });
  });

  describe('faq CRUD (SERVICES-R5.22 — closes the previously-hardcoded-empty gap)', () => {
    it('create() persists a real faq array instead of hardcoding []', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      const faq = [
        { question: 'چگونه خرید کنم؟', answer: 'از دکمه خرید استفاده کنید.' },
      ];
      prisma.service.create.mockResolvedValue({ id: 'service-1', faq });

      await service.create({ ...baseDto, faq }, 'admin-1', meta);

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ faq }) }),
      );
    });

    it('update() writes faq when the client supplies it', async () => {
      prisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        title: baseDto.title,
        priceFrom: null,
        active: true,
      });
      const faq = [{ question: 'q', answer: 'a' }];
      prisma.service.update.mockResolvedValue({ id: 'service-1', faq });

      await service.update('service-1', { faq }, 'admin-1', meta);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ faq }) }),
      );
    });

    it('update() never clears faq when the client omits it from the payload', async () => {
      prisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        title: baseDto.title,
        priceFrom: null,
        active: true,
      });
      prisma.service.update.mockResolvedValue({
        id: 'service-1',
        active: false,
      });

      await service.update('service-1', { active: false }, 'admin-1', meta);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- jest.fn()'s .mock.calls is typed any[][]
      const call = prisma.service.update.mock.calls[0][0] as { data: object };
      expect(call.data).not.toHaveProperty('faq');
    });
  });

  describe('admin create() — category/merchant relation validation', () => {
    it('rejects a nonexistent categoryId', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.create(baseDto, 'admin-1', meta),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent merchantId when one is supplied', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.merchant.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          { ...baseDto, merchantId: 'merchant-x' },
          'admin-1',
          meta,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('creates a Service for a real category, defaulting active to true', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.service.create.mockResolvedValue({
        id: 'service-1',
        categoryId: 'cat-1',
        title: baseDto.title,
        active: true,
      });

      await service.create(baseDto, 'admin-1', meta);

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 'cat-1',
            active: true,
            createdBy: 'admin-1',
            updatedBy: 'admin-1',
          }),
        }),
      );
    });

    it('records a CREATE audit entry', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.service.create.mockResolvedValue({
        id: 'service-1',
        categoryId: 'cat-1',
        title: baseDto.title,
        active: true,
      });

      await service.create(baseDto, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'Service',
          resourceId: 'service-1',
        }),
      );
    });
  });

  describe('admin update()', () => {
    it('throws NotFoundException for a nonexistent service', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { active: false }, 'admin-1', meta),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects reassigning to a nonexistent category', async () => {
      prisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        title: baseDto.title,
        priceFrom: null,
        active: true,
      });
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update(
          'service-1',
          { categoryId: 'nonexistent' },
          'admin-1',
          meta,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('updates and records a before/after audit entry (activate/deactivate included)', async () => {
      prisma.service.findUnique.mockResolvedValue({
        id: 'service-1',
        title: baseDto.title,
        priceFrom: null,
        active: true,
      });
      prisma.service.update.mockResolvedValue({
        id: 'service-1',
        title: baseDto.title,
        priceFrom: null,
        active: false,
      });

      await service.update('service-1', { active: false }, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resourceType: 'Service',
          resourceId: 'service-1',
          beforeJson: expect.objectContaining({ active: true }),
          afterJson: expect.objectContaining({ active: false }),
        }),
      );
    });
  });
});
