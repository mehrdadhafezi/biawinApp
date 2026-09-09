import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { ServicesService } from './services.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: {
    service: Record<string, jest.Mock>;
    category: Record<string, jest.Mock>;
    merchant: Record<string, jest.Mock>;
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
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
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
