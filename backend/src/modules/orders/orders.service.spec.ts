import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrdersService } from './orders.service';
import { ServicePricingService } from './pricing/service-pricing.service';
import { CardProductPricingService } from './pricing/card-product-pricing.service';
import type { CreateOrderDto } from './dto/create-order.dto';

const ACTIVE_SERVICE_NO_MERCHANT = {
  id: 'service-1',
  categoryId: 'category-1',
  merchantId: null,
  active: true,
  availableMethods: ['cash', 'credit', 'installment', 'free'],
  priceFrom: null,
};

const ACTIVE_SERVICE_WITH_MERCHANT = {
  id: 'service-2',
  categoryId: 'category-1',
  merchantId: 'merchant-1',
  active: true,
  availableMethods: ['cash'],
  priceFrom: 150000,
};

const ACTIVE_CATEGORY = { id: 'category-1', active: true };

const ACTIVE_CARD_PRODUCT = {
  id: 'card-1',
  serviceId: 'service-1',
  status: 'ACTIVE',
  journeyType: 'PURCHASE',
  priceAmount: 500000,
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: Record<string, jest.Mock>;
    service: Record<string, jest.Mock>;
    merchant: Record<string, jest.Mock>;
    category: Record<string, jest.Mock>;
    cardProduct: Record<string, jest.Mock>;
    wallet: Record<string, jest.Mock>;
    installment: Record<string, jest.Mock>;
    payment: Record<string, jest.Mock>;
    customerCardInstance: Record<string, jest.Mock>;
    usageTransaction: Record<string, jest.Mock>;
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
      category: { findUnique: jest.fn().mockResolvedValue(ACTIVE_CATEGORY) },
      cardProduct: { findUnique: jest.fn() },
      wallet: { debit: jest.fn(), credit: jest.fn() },
      installment: { create: jest.fn() },
      payment: { create: jest.fn() },
      customerCardInstance: { create: jest.fn() },
      usageTransaction: { create: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        ServicePricingService,
        CardProductPricingService,
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

  const cardDto: CreateOrderDto = {
    cardProductId: 'card-1',
    idempotencyKey: 'card-key-1',
  };

  describe('domain validation (Service path — SERVICES-R5.1, unchanged)', () => {
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
        cardProductId: null,
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
            cardProductId: null,
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('never debits a wallet in R5.1/R5.19', async () => {
      await service.create('user-1', baseDto);
      expect(prisma.wallet.debit).not.toHaveBeenCalled();
      expect(prisma.wallet.credit).not.toHaveBeenCalled();
    });

    it('never creates an installment schedule in R5.1/R5.19', async () => {
      await service.create('user-1', baseDto);
      expect(prisma.installment.create).not.toHaveBeenCalled();
    });

    it('has no payment-gateway or wallet dependency injected at all', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Reflect.getMetadata is typed `any`
      const paramTypes: unknown[] =
        Reflect.getMetadata('design:paramtypes', OrdersService) ?? [];
      const paramNames = paramTypes.map((t) => (t as { name: string }).name);
      expect(paramNames).toEqual([
        'PrismaService',
        'ServicePricingService',
        'CardProductPricingService',
      ]);
    });
  });

  describe('idempotency (Service path)', () => {
    const existingOrder = {
      id: 'order-1',
      userId: 'user-1',
      serviceId: 'service-1',
      cardProductId: null,
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

  // ---------------------------------------------------------------------
  // SERVICES-R5.19 — CardProduct purchase path
  // ---------------------------------------------------------------------

  describe('request-shape validation (SERVICES-R5.19)', () => {
    it('rejects a request providing both serviceId and cardProductId', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          serviceId: 'service-1',
          cardProductId: 'card-1',
          idempotencyKey: 'key-x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a request providing neither serviceId nor cardProductId', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          idempotencyKey: 'key-x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied merchantId alongside cardProductId', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          cardProductId: 'card-1',
          merchantId: 'merchant-1',
          idempotencyKey: 'key-x',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.cardProduct.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('CardProduct purchase eligibility (SERVICES-R5.19)', () => {
    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(null);
    });

    it('rejects a nonexistent card product', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive (DRAFT) card product', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        ...ACTIVE_CARD_PRODUCT,
        status: 'DRAFT',
      });
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects an EXPIRED card product', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        ...ACTIVE_CARD_PRODUCT,
        status: 'EXPIRED',
      });
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects a non-PURCHASE journeyType', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        ...ACTIVE_CARD_PRODUCT,
        journeyType: 'QUOTE_REQUEST',
      });
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects when the card product has no positive priceAmount', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue({
        ...ACTIVE_CARD_PRODUCT,
        priceAmount: null,
      });
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects when the parent Service is inactive', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue({
        ...ACTIVE_SERVICE_NO_MERCHANT,
        active: false,
      });
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects when the parent Category is inactive', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.category.findUnique.mockResolvedValue({
        ...ACTIVE_CATEGORY,
        active: false,
      });
      await expect(service.create('user-1', cardDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('never lets the client control the amount — always CardProduct.priceAmount', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockResolvedValue({
        id: 'order-2',
        userId: 'user-1',
        serviceId: 'service-1',
        cardProductId: 'card-1',
        merchantId: null,
        method: null,
        amount: 500000,
        status: 'pending',
        idempotencyKey: 'card-key-1',
      });

      await service.create('user-1', {
        ...cardDto,
        amount: 999999999,
      } as CreateOrderDto);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 500000,
            serviceId: 'service-1',
            cardProductId: 'card-1',
            method: null,
            status: 'pending',
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('creates a pending Order derived from the CardProduct, with no method set', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockResolvedValue({
        id: 'order-2',
        userId: 'user-1',
        serviceId: 'service-1',
        cardProductId: 'card-1',
        merchantId: null,
        method: null,
        amount: 500000,
        status: 'pending',
        idempotencyKey: 'card-key-1',
      });

      const result = await service.create('user-1', cardDto);
      expect(result.status).toBe('pending');
      expect(prisma.wallet.debit).not.toHaveBeenCalled();
      expect(prisma.wallet.credit).not.toHaveBeenCalled();
      expect(prisma.installment.create).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.customerCardInstance.create).not.toHaveBeenCalled();
      expect(prisma.usageTransaction.create).not.toHaveBeenCalled();
    });

    it('derives Order.merchantId from the CardProduct’s parent Service, never from the client', async () => {
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_WITH_MERCHANT);
      prisma.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        active: true,
      });
      prisma.order.create.mockResolvedValue({
        id: 'order-2',
        userId: 'user-1',
        serviceId: 'service-2',
        cardProductId: 'card-1',
        merchantId: 'merchant-1',
        method: null,
        amount: 500000,
        status: 'pending',
        idempotencyKey: 'card-key-1',
      });

      await service.create('user-1', cardDto);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ merchantId: 'merchant-1' }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  describe('idempotency (CardProduct path — SERVICES-R5.19)', () => {
    const existingCardOrder = {
      id: 'order-2',
      userId: 'user-1',
      serviceId: 'service-1',
      cardProductId: 'card-1',
      merchantId: null,
      method: null,
      amount: 500000,
      status: 'pending',
      idempotencyKey: 'card-key-1',
    };

    it('returns the original order on an exact retry (same user + key + cardProductId)', async () => {
      prisma.order.findUnique.mockResolvedValue(existingCardOrder);

      const result = await service.create('user-1', cardDto);

      expect(result).toEqual(existingCardOrder);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.cardProduct.findUnique).not.toHaveBeenCalled();
    });

    it('rejects reuse of the same key against a different CardProduct', async () => {
      prisma.order.findUnique.mockResolvedValue(existingCardOrder);

      await expect(
        service.create('user-1', {
          cardProductId: 'card-2',
          idempotencyKey: 'card-key-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('does not treat a serviceId-shaped retry as matching a CardProduct-original just because the derived serviceId happens to match', async () => {
      prisma.order.findUnique.mockResolvedValue(existingCardOrder);

      // existingCardOrder.serviceId is 'service-1' (derived from the
      // CardProduct at creation time) — a retry that sends serviceId
      // instead of cardProductId must NOT be treated as a safe replay just
      // because that serviceId happens to match.
      await expect(
        service.create('user-1', {
          serviceId: 'service-1',
          method: 'cash',
          idempotencyKey: 'card-key-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('handles a concurrent-insert race for the CardProduct path by re-fetching and treating it as a safe retry', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingCardOrder);
      prisma.cardProduct.findUnique.mockResolvedValue(ACTIVE_CARD_PRODUCT);
      prisma.service.findUnique.mockResolvedValue(ACTIVE_SERVICE_NO_MERCHANT);
      prisma.order.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.create('user-1', cardDto);

      expect(result).toEqual(existingCardOrder);
      expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Order.amount immutability after CardProduct price changes (SERVICES-R5.19)', () => {
    it('an idempotent replay never re-resolves price — it returns the amount frozen at creation, even if CardProduct.priceAmount has since changed', async () => {
      const originalOrder = {
        id: 'order-2',
        userId: 'user-1',
        serviceId: 'service-1',
        cardProductId: 'card-1',
        merchantId: null,
        method: null,
        amount: 500000, // frozen at creation time
        status: 'pending',
        idempotencyKey: 'card-key-1',
      };
      prisma.order.findUnique.mockResolvedValue(originalOrder);
      // Simulates an Admin having since raised the CardProduct's price —
      // this must never be consulted on a replay.
      prisma.cardProduct.findUnique.mockResolvedValue({
        ...ACTIVE_CARD_PRODUCT,
        priceAmount: 9000000,
      });

      const result = await service.create('user-1', cardDto);

      expect(result.amount).toBe(500000);
      expect(prisma.cardProduct.findUnique).not.toHaveBeenCalled();
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });
});
