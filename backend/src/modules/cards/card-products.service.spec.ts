import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CardProductsService } from './card-products.service';

describe('CardProductsService', () => {
  let service: CardProductsService;
  let prisma: {
    cardProduct: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      cardProduct: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CardProductsService);
  });

  it('only lists active card products', async () => {
    await service.list(0, 20);
    expect(prisma.cardProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it('filters by serviceId when supplied, without dropping the active filter', async () => {
    await service.list(0, 20, 'service-1');
    expect(prisma.cardProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, serviceId: 'service-1' },
      }),
    );
  });

  it('throws NotFoundException for a nonexistent or inactive card product', async () => {
    prisma.cardProduct.findFirst.mockResolvedValue(null);
    await expect(service.findOneOrThrow('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.cardProduct.findFirst).toHaveBeenCalledWith({
      where: { id: 'missing', active: true },
    });
  });
});
