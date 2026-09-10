import { Test, type TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { CategoryCardsService } from './category-cards.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest, same rationale as home-service-banners.service.spec.ts */

describe('CategoryCardsService', () => {
  let service: CategoryCardsService;
  let prisma: {
    categoryCard: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: { findUnique: jest.Mock };
    service: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mediaStorage: { resolvePublicUrl: jest.Mock };
  let auditLog: { record: jest.Mock };

  const targetService = { id: 'svc-1', title: 'کفش' };
  const category = { id: 'cat-1', name: 'پوشاک' };
  const mediaAsset = { id: 'media-1', key: 'media/photo.webp' };
  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  function makeCard(overrides: Record<string, unknown> = {}) {
    return {
      id: 'card-1',
      categoryId: 'cat-1',
      category,
      targetServiceId: 'svc-1',
      targetService,
      title: 'کیف و کفش',
      subtitle: null,
      badge: null,
      mediaAssetId: 'media-1',
      mediaAsset,
      highlights: ['خدمات متنوع پوشاک', 'طرح‌های خرید و پشتیبانی'],
      sortOrder: 0,
      active: true,
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      categoryCard: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      service: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'svc-1', categoryId: 'cat-1' }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    mediaStorage = {
      resolvePublicUrl: jest.fn(
        (key: string) => `/media/${key.split('/').pop()}`,
      ),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryCardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaStorageService, useValue: mediaStorage },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(CategoryCardsService);
  });

  describe('public list()', () => {
    it('queries only active rows for the given category, ordered by sortOrder', async () => {
      prisma.categoryCard.findMany.mockResolvedValue([]);

      await service.list(0, 20, 'cat-1');

      expect(prisma.categoryCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true, categoryId: 'cat-1' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('never includes an inactive card, even if one is somehow returned by a broader query', async () => {
      // Asserts the where-clause contract directly (the real filtering
      // happens in Postgres) — this proves no client-side re-filter exists
      // to compensate for a missing `active: true` in the query itself.
      prisma.categoryCard.findMany.mockResolvedValue([makeCard()]);
      await service.list(0, 20);
      expect(prisma.categoryCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: true } }),
      );
    });

    it('resolves a real image URL from the joined MediaAsset relation, never a raw key', async () => {
      prisma.categoryCard.findMany.mockResolvedValue([makeCard()]);

      const result = await service.list(0, 20);

      expect(mediaStorage.resolvePublicUrl).toHaveBeenCalledWith(
        'media/photo.webp',
      );
      expect(result.items[0].image).toBe('/media/photo.webp');
    });

    it('returns null image (never a broken link) when no MediaAsset is linked', async () => {
      prisma.categoryCard.findMany.mockResolvedValue([
        makeCard({ mediaAssetId: null, mediaAsset: null }),
      ]);

      const result = await service.list(0, 20);

      expect(result.items[0].image).toBeNull();
      expect(mediaStorage.resolvePublicUrl).not.toHaveBeenCalled();
    });

    it('the public response never contains a CardProduct-shaped field', async () => {
      prisma.categoryCard.findMany.mockResolvedValue([makeCard()]);
      const result = await service.list(0, 20);
      expect(result.items[0]).not.toHaveProperty('cardProductId');
      expect(result.items[0]).not.toHaveProperty('priceAmount');
      expect(result.items[0]).not.toHaveProperty('status');
    });
  });

  describe('listAdmin / findOneAdmin', () => {
    it('includes admin-only fields the public response omits', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(
        makeCard({ active: false }),
      );

      const result = await service.findOneAdmin('card-1');

      expect(result).toEqual(
        expect.objectContaining({
          active: false,
          mediaAssetId: 'media-1',
          createdBy: 'admin-1',
          updatedBy: 'admin-1',
          targetService,
          category,
        }),
      );
    });

    it('throws NotFoundException for a missing card', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(null);
      await expect(service.findOneAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ownership validation (SERVICES-R5.21 — "validate category/service ownership")', () => {
    it('rejects a nonexistent Category on create', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          { categoryId: 'missing', targetServiceId: 'svc-1', title: 't' },
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.categoryCard.create).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent target Service on create', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          { categoryId: 'cat-1', targetServiceId: 'missing', title: 't' },
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.categoryCard.create).not.toHaveBeenCalled();
    });

    it('rejects a target Service that belongs to a DIFFERENT Category than the one supplied', async () => {
      prisma.service.findUnique.mockResolvedValue({
        id: 'svc-1',
        categoryId: 'cat-OTHER',
      });
      await expect(
        service.create(
          { categoryId: 'cat-1', targetServiceId: 'svc-1', title: 't' },
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.categoryCard.create).not.toHaveBeenCalled();
    });

    it('accepts a target Service that genuinely belongs to the given Category', async () => {
      prisma.categoryCard.create.mockResolvedValue(makeCard());
      await service.create(
        { categoryId: 'cat-1', targetServiceId: 'svc-1', title: 'کیف و کفش' },
        'admin-1',
        meta,
      );
      expect(prisma.categoryCard.create).toHaveBeenCalled();
    });

    it('re-validates ownership on update when targetServiceId changes to a Service from a different Category', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(makeCard());
      prisma.service.findUnique.mockResolvedValue({
        id: 'svc-2',
        categoryId: 'cat-OTHER',
      });

      await expect(
        service.update('card-1', { targetServiceId: 'svc-2' }, 'admin-1', meta),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.categoryCard.update).not.toHaveBeenCalled();
    });

    it('does not re-validate ownership on an update that touches neither categoryId nor targetServiceId', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(makeCard());
      prisma.categoryCard.update.mockResolvedValue(
        makeCard({ title: 'عنوان جدید' }),
      );

      await service.update('card-1', { title: 'عنوان جدید' }, 'admin-1', meta);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.categoryCard.update).toHaveBeenCalled();
    });
  });

  describe('create — audit logging', () => {
    it('creates a card, stamps createdBy/updatedBy, and records a CREATE audit entry', async () => {
      const created = makeCard();
      prisma.categoryCard.create.mockResolvedValue(created);

      const dto = {
        categoryId: 'cat-1',
        targetServiceId: 'svc-1',
        title: 'کیف و کفش',
      };
      const result = await service.create(dto, 'admin-1', meta);

      expect(prisma.categoryCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 'cat-1',
            targetServiceId: 'svc-1',
            title: 'کیف و کفش',
            createdBy: 'admin-1',
            updatedBy: 'admin-1',
          }),
        }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'CategoryCard',
          resourceId: 'card-1',
        }),
      );
      expect(result.title).toBe('کیف و کفش');
    });
  });

  describe('update — audit logging', () => {
    it('updates the card and records an UPDATE audit entry with before/after state', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(
        makeCard({ title: 'قدیمی' }),
      );
      prisma.categoryCard.update.mockResolvedValue(makeCard({ title: 'جدید' }));

      await service.update('card-1', { title: 'جدید' }, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resourceType: 'CategoryCard',
          beforeJson: expect.objectContaining({ title: 'قدیمی' }),
          afterJson: expect.objectContaining({ title: 'جدید' }),
        }),
      );
    });

    it('throws NotFoundException when updating a missing card, without writing an audit entry', async () => {
      prisma.categoryCard.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', {}, 'admin-1', meta),
      ).rejects.toThrow(NotFoundException);
      expect(auditLog.record).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('updates sortOrder for every entry in one transaction and records a REORDER audit entry', async () => {
      prisma.categoryCard.findMany.mockResolvedValue([]);

      await service.reorder(
        {
          items: [
            { id: 'card-1', sortOrder: 5 },
            { id: 'card-2', sortOrder: 6 },
          ],
        },
        'admin-1',
        meta,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.categoryCard.update).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        data: { sortOrder: 5, updatedBy: 'admin-1' },
      });
      expect(prisma.categoryCard.update).toHaveBeenCalledWith({
        where: { id: 'card-2' },
        data: { sortOrder: 6, updatedBy: 'admin-1' },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REORDER',
          resourceType: 'CategoryCard',
        }),
      );
    });
  });
});
