import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { CardProductsService } from './card-products.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('CardProductsService', () => {
  let service: CardProductsService;
  let prisma: {
    cardProduct: Record<string, jest.Mock>;
    service: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let auditLog: { record: jest.Mock };

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeEach(async () => {
    prisma = {
      cardProduct: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      service: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(CardProductsService);
  });

  describe('public list/findOne — inactive filtering', () => {
    it('only lists status=ACTIVE card products', async () => {
      await service.list(0, 20);
      expect(prisma.cardProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
    });

    it('filters by serviceId when supplied, without dropping the status filter', async () => {
      await service.list(0, 20, 'service-1');
      expect(prisma.cardProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', serviceId: 'service-1' },
        }),
      );
    });

    it('throws NotFoundException for a nonexistent or non-ACTIVE card product', async () => {
      prisma.cardProduct.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.cardProduct.findFirst).toHaveBeenCalledWith({
        where: { id: 'missing', status: 'ACTIVE' },
      });
    });

    it('DRAFT/INACTIVE/EXPIRED card products are never returned by the public findOneOrThrow query', async () => {
      // The query itself always constrains status:'ACTIVE' — a DRAFT row
      // simply never matches, which findFirst correctly reports as null.
      prisma.cardProduct.findFirst.mockResolvedValue(null);
      await expect(service.findOneOrThrow('draft-card')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('admin create — validation', () => {
    const dto = {
      serviceId: 'service-1',
      title: 'کارت اعتباری',
      cardType: 'CREDIT_CARD' as const,
      journeyType: 'PURCHASE' as const,
    };

    it('rejects a card product for a nonexistent Service', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 'admin-1', meta)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.cardProduct.create).not.toHaveBeenCalled();
    });

    it('creates a card product for a real Service, defaulting to DRAFT status', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 'service-1' });
      prisma.cardProduct.create.mockResolvedValue({
        id: 'card-1',
        serviceId: 'service-1',
        title: dto.title,
        status: 'DRAFT',
        priceAmount: null,
      });

      await service.create(dto, 'admin-1', meta);

      expect(prisma.cardProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceId: 'service-1',
            status: 'DRAFT',
            createdBy: 'admin-1',
            updatedBy: 'admin-1',
          }),
        }),
      );
    });

    it('records a CREATE audit entry with the actor and resource', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 'service-1' });
      prisma.cardProduct.create.mockResolvedValue({
        id: 'card-1',
        serviceId: 'service-1',
        title: dto.title,
        status: 'DRAFT',
        priceAmount: null,
      });

      await service.create(dto, 'admin-1', meta);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'CREATE',
          resourceType: 'CardProduct',
          resourceId: 'card-1',
        }),
      );
    });
  });

  describe('admin update — priceAmount and status', () => {
    it('rejects reassigning to a nonexistent Service', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        id: 'card-1',
        serviceId: 'service-1',
        title: 't',
        status: 'DRAFT',
        priceAmount: null,
      });
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(
        service.update('card-1', { serviceId: 'nonexistent' }, 'admin-1', meta),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.cardProduct.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when updating a nonexistent card product', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { priceAmount: 100000 }, 'admin-1', meta),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates priceAmount and records a before/after audit entry', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        id: 'card-1',
        serviceId: 'service-1',
        title: 'کارت اعتباری',
        status: 'DRAFT',
        priceAmount: null,
      });
      prisma.cardProduct.update.mockResolvedValue({
        id: 'card-1',
        serviceId: 'service-1',
        title: 'کارت اعتباری',
        status: 'ACTIVE',
        priceAmount: 500000,
      });

      await service.update(
        'card-1',
        { priceAmount: 500000, status: 'ACTIVE' },
        'admin-1',
        meta,
      );

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          resourceType: 'CardProduct',
          resourceId: 'card-1',
          beforeJson: expect.objectContaining({
            priceAmount: null,
            status: 'DRAFT',
          }),
          afterJson: expect.objectContaining({
            priceAmount: 500000,
            status: 'ACTIVE',
          }),
        }),
      );
    });
  });
});
