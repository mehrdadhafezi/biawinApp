import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { CategoriesService } from './categories.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let auditLog: { record: jest.Mock };

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('public list()/findOneOrThrow() — unchanged behavior', () => {
    it('does not filter by active (pre-existing behavior, untouched)', async () => {
      await service.list(0, 20);
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- jest.fn()'s .mock.calls is typed any[][]
      const call = prisma.category.findMany.mock.calls[0][0] as {
        where?: unknown;
      };
      expect(call.where).toBeUndefined();
    });

    it('findOneOrThrow throws NotFoundException for a missing category', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('admin create()', () => {
    it('creates a category with the admin as createdBy/updatedBy', async () => {
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: 'خودرو',
        active: true,
      });

      await service.create(
        { name: 'خودرو', description: 'توضیحات' },
        'admin-1',
        meta,
      );

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'خودرو',
            createdBy: 'admin-1',
            updatedBy: 'admin-1',
            active: true,
          }),
        }),
      );
    });

    it('records a CREATE audit entry with actor, resource, and after-state', async () => {
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: 'خودرو',
        active: true,
      });

      await service.create(
        { name: 'خودرو', description: 'توضیحات' },
        'admin-1',
        meta,
      );

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'Category',
          resourceId: 'cat-1',
          afterJson: { name: 'خودرو', active: true },
        }),
      );
    });
  });

  describe('admin update()', () => {
    it('throws NotFoundException for a nonexistent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { active: false }, 'admin-1', meta),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('activate/deactivate goes through the same update() path, audited before/after', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        name: 'خودرو',
        active: true,
      });
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        name: 'خودرو',
        active: false,
      });

      await service.update('cat-1', { active: false }, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resourceType: 'Category',
          resourceId: 'cat-1',
          beforeJson: { name: 'خودرو', active: true },
          afterJson: { name: 'خودرو', active: false },
        }),
      );
    });
  });

  describe('admin reorder()', () => {
    it('updates sortOrder for every entry in one transaction and records a REORDER audit entry', async () => {
      const items = [
        { id: 'cat-1', sortOrder: 1 },
        { id: 'cat-2', sortOrder: 0 },
      ];

      await service.reorder({ items }, 'admin-1', meta);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REORDER',
          resourceType: 'Category',
          afterJson: { items },
        }),
      );
    });
  });
});
