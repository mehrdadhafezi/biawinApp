import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { HomeServiceBannersService } from './home-service-banners.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest; every use below is a plain Jest assertion helper (same rationale as modules/admin-auth/admin-auth.service.spec.ts). */

describe('HomeServiceBannersService', () => {
  let service: HomeServiceBannersService;
  let prisma: {
    homeServiceBanner: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mediaStorage: { resolvePublicUrl: jest.Mock };
  let auditLog: { record: jest.Mock };

  const category = { id: 'cat-1', name: 'اتومبیل' };
  const mediaAsset = { id: 'media-1', key: 'media/photo.webp' };

  function makeBanner(overrides: Record<string, unknown> = {}) {
    return {
      id: 'banner-1',
      categoryId: 'cat-1',
      category,
      mediaAssetId: 'media-1',
      mediaAsset,
      kicker: 'اعتبار و اقساط منعطف',
      theme: 'auto',
      wide: false,
      sortOrder: 0,
      active: true,
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeEach(async () => {
    prisma = {
      homeServiceBanner: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
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
        HomeServiceBannersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaStorageService, useValue: mediaStorage },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(HomeServiceBannersService);
  });

  describe('listPublic — "Customer Home returns CMS data" + "Ordering works" + "Inactive items hidden" + "Media relations work"', () => {
    it('returns banners shaped for the customer contract, resolved from the database, not a hardcoded array', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValue([makeBanner()]);

      const result = await service.listPublic();

      expect(result).toEqual([
        {
          id: 'banner-1',
          categoryId: 'cat-1',
          categoryName: 'اتومبیل', // resolved server-side from the real Category join — not a hardcoded categoryName re-typed by hand
          image: '/media/photo.webp',
          kicker: 'اعتبار و اقساط منعطف',
          theme: 'auto',
          wide: false,
          sortOrder: 0,
        },
      ]);
    });

    it('queries only active rows, ordered by sortOrder ascending', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValue([]);

      await service.listPublic();

      expect(prisma.homeServiceBanner.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        include: { category: true, mediaAsset: true },
      });
    });

    it('resolves a real image URL from the joined MediaAsset relation', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValue([makeBanner()]);

      const [banner] = await service.listPublic();

      expect(mediaStorage.resolvePublicUrl).toHaveBeenCalledWith(
        'media/photo.webp',
      );
      expect(banner.image).toBe('/media/photo.webp');
    });

    it('returns null image (not a broken link) when no MediaAsset is linked yet', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValue([
        makeBanner({ mediaAssetId: null, mediaAsset: null }),
      ]);

      const [banner] = await service.listPublic();

      expect(banner.image).toBeNull();
      expect(mediaStorage.resolvePublicUrl).not.toHaveBeenCalled();
    });
  });

  describe('listAdmin / findOneAdmin', () => {
    it('includes admin-only fields the public response omits (active, mediaAssetId, ownership, timestamps)', async () => {
      prisma.homeServiceBanner.findFirst.mockResolvedValue(undefined);
      prisma.homeServiceBanner.findUnique.mockResolvedValue(
        makeBanner({ active: false }),
      );

      const result = await service.findOneAdmin('banner-1');

      expect(result).toEqual(
        expect.objectContaining({
          active: false,
          mediaAssetId: 'media-1',
          createdBy: 'admin-1',
          updatedBy: 'admin-1',
        }),
      );
    });

    it('throws NotFoundException for a missing banner', async () => {
      prisma.homeServiceBanner.findUnique.mockResolvedValue(null);
      await expect(service.findOneAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create — "Admin CRUD works" + "Audit records created"', () => {
    it('creates a banner, stamps createdBy/updatedBy, and records a CREATE audit entry', async () => {
      const created = makeBanner();
      prisma.homeServiceBanner.create.mockResolvedValue(created);

      const dto = { categoryId: 'cat-1', kicker: 'اعتبار و اقساط منعطف' };
      const result = await service.create(dto, 'admin-1', meta);

      expect(prisma.homeServiceBanner.create).toHaveBeenCalledWith({
        data: { ...dto, createdBy: 'admin-1', updatedBy: 'admin-1' },
        include: { category: true, mediaAsset: true },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'HomeServiceBanner',
          resourceId: 'banner-1',
        }),
      );
      expect(result.categoryName).toBe('اتومبیل');
    });
  });

  describe('update — "Admin CRUD works" + "Audit records created"', () => {
    it('updates the banner and records an UPDATE audit entry with before/after state', async () => {
      prisma.homeServiceBanner.findUnique.mockResolvedValue(
        makeBanner({ kicker: 'قدیمی' }),
      );
      prisma.homeServiceBanner.update.mockResolvedValue(
        makeBanner({ kicker: 'جدید' }),
      );

      await service.update('banner-1', { kicker: 'جدید' }, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resourceType: 'HomeServiceBanner',
          beforeJson: expect.objectContaining({ kicker: 'قدیمی' }),
          afterJson: expect.objectContaining({ kicker: 'جدید' }),
        }),
      );
    });

    it('throws NotFoundException when updating a missing banner, without writing an audit entry', async () => {
      prisma.homeServiceBanner.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', {}, 'admin-1', meta),
      ).rejects.toThrow(NotFoundException);
      expect(auditLog.record).not.toHaveBeenCalled();
    });
  });

  describe('remove — "Admin CRUD works" + "Audit records created"', () => {
    it('hard-deletes the row and records a DELETE audit entry', async () => {
      prisma.homeServiceBanner.findUnique.mockResolvedValue(makeBanner());

      const result = await service.remove('banner-1', 'admin-1', meta);

      expect(prisma.homeServiceBanner.delete).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          resourceType: 'HomeServiceBanner',
          resourceId: 'banner-1',
        }),
      );
      expect(result).toEqual({ id: 'banner-1' });
    });
  });

  describe('reorder — "Ordering works" + "Audit records created"', () => {
    it('updates sortOrder for every entry in one transaction and records a REORDER audit entry', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValue([]);

      await service.reorder(
        {
          items: [
            { id: 'banner-1', sortOrder: 5 },
            { id: 'banner-2', sortOrder: 6 },
          ],
        },
        'admin-1',
        meta,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.homeServiceBanner.update).toHaveBeenCalledWith({
        where: { id: 'banner-1' },
        data: { sortOrder: 5, updatedBy: 'admin-1' },
      });
      expect(prisma.homeServiceBanner.update).toHaveBeenCalledWith({
        where: { id: 'banner-2' },
        data: { sortOrder: 6, updatedBy: 'admin-1' },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REORDER',
          resourceType: 'HomeServiceBanner',
        }),
      );
    });
  });
});
