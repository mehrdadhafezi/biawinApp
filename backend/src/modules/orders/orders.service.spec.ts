import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrdersService } from './orders.service';
import { ServicePricingService } from './pricing/service-pricing.service';
import type { CreateOrderDto } from './dto/create-order.dto';

const ACTIVE_SERVICE_NO_MERCHANT = {
  id: 'service-1',
  merchantId: null,
  active: true,
  availableMethods: ['cash', 'credit', 'installment', 'free'],
  priceFrom: null,
};

const ACTIVE_SERVICE_WITH_MERCHANT = {
  id: 'service-2',
  merchantId: 'merchant-1',
  active: true,
  availableMethods: ['cash'],
  priceFrom: 150000,
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: Record<string, jest.Mock>;
    service: Record<string, jest.Mock>;
    merchant: Record<string, jest.Mock>;
    wallet: Record<string, jest.Mock>;
    installment: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
      service: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
      wallet: { debit: jest.fn(), credit: jest.fn() },
      installment: { create: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        ServicePricingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  const baseDto: CreateOrderDto = {
    serviceId: 'service-1',
    method: 'free',
    idempotencyKey: 'key-1',
  };

  describe('domain validation', () => {
    it('rejects a nonexistent service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue({
        ...ACTIVE_SERVICE_NO_MERCHANT,
        active: false,
      });

      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a purchase method not supported by the service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue({
        ...ACTIVE_SERVICE_NO_MERCHANT,
        availableMethods: ['cash'],
      });

      await expect(
        service.create('user-1', { ...baseDto, method: 'credit' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied merchantId that does not match the service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_WITH_MERCHANT);

      await expect(
        service.create('user-1', {
          ...baseDto,
          serviceId: 'service-2',
          method: 'cash',
          merchantId: 'some-other-merchant',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a merchantId supplied for a service that has no merchant', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);

      await expect(
        service.create('user-1', { ...baseDto, merchantId: 'merchant-x' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent merchant behind an otherwise-valid service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_WITH_MERCHANT);
      prisma.merchant.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          ...baseDto,
          serviceId: 'service-2',
          method: 'cash',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive merchant behind an otherwise-valid service', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_WITH_MERCHANT);
      prisma.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        active: false,
      });

      await expect(
        service.create('user-1', {
          ...baseDto,
          serviceId: 'service-2',
          method: 'cash',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('blocks the purchase when no authoritative price is configured', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue({
        ...ACTIVE_SERVICE_NO_MERCHANT,
        availableMethods: ['cash'],
        priceFrom: null,
      });

      await expect(
        service.create('user-1', { ...baseDto, method: 'cash' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('ignores a client-supplied amount and never persists a partial order on failure', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(null);

      const dtoWithTamperedAmount = { ...baseDto, amount: 1 } as CreateOrderDto;
      await expect(
        service.create('user-1', dtoWithTamperedAmount),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('successful purchase creation (free method, always priced at 0)', () => {
    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        serviceId: 'service-1',
        merchantId: null,
        method: 'free',
        amount: 0,
        status: 'pending',
        idempotencyKey: 'key-1',
      });
    });

    it('creates the order with a server-resolved amount, ignoring any client amount', async () => {
      await service.create('user-1', baseDto);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest's expect.objectContaining is typed `any` */
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 0,
            status: 'pending',
            merchantId: null,
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('never debits a wallet in R5.1', async () => {
      await service.create('user-1', baseDto);
      expect(prisma.wallet.debit).not.toHaveBeenCalled();
      expect(prisma.wallet.credit).not.toHaveBeenCalled();
    });

    it('never creates an installment schedule in R5.1', async () => {
      await service.create('user-1', baseDto);
      expect(prisma.installment.create).not.toHaveBeenCalled();
    });

    it('has no payment-gateway or wallet dependency injected at all', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Reflect.getMetadata is typed `any`
      const paramTypes: unknown[] =
        Reflect.getMetadata('design:paramtypes', OrdersService) ?? [];
      const paramNames = paramTypes.map((t) => (t as { name: string }).name);
      expect(paramNames).toEqual(['PrismaService', 'ServicePricingService']);
    });
  });

  describe('idempotency', () => {
    const existingOrder = {
      id: 'order-1',
      userId: 'user-1',
      serviceId: 'service-1',
      merchantId: null,
      method: 'free',
      amount: 0,
      status: 'pending',
      idempotencyKey: 'key-1',
    };

    it('returns the existing order on an exact retry instead of creating a duplicate', async () => {
      prisma.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.create('user-1', baseDto);

      expect(result).toEqual(existingOrder);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.service.findUnique).not.toHaveBeenCalled();
    });

    it('rejects reuse of the same key with different purchase parameters', async () => {
      prisma.order.findUnique.mockResolvedValue(existingOrder);

      await expect(
        service.create('user-1', {
          ...baseDto,
          serviceId: 'service-2',
          method: 'cash',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('handles a concurrent-insert race by re-fetching and treating it as a safe retry', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingOrder);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.create('user-1', baseDto);

      expect(result).toEqual(existingOrder);
      expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);
    });

    it('propagates a race that turns out to be a genuine conflict', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...existingOrder,
          serviceId: 'service-2',
          method: 'cash',
        });
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('ownership scoping', () => {
    it('scopes list() to the requesting user', async () => {
      await service.list('user-1', 0, 20);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('does not leak another user’s order via findOneOrThrow', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneOrThrow('order-owned-by-someone-else', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-owned-by-someone-else', userId: 'user-1' },
      });
    });
  });
});
