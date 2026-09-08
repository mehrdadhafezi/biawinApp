import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CustomerCardsService } from './customer-cards.service';

describe('CustomerCardsService', () => {
  let service: CustomerCardsService;
  let prisma: {
    customerCardInstance: Record<string, jest.Mock>;
    usageTransaction: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      customerCardInstance: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
      usageTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerCardsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CustomerCardsService);
  });

  it('scopes list() to the requesting user', async () => {
    await service.list('user-1', 0, 20);
    expect(prisma.customerCardInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('does not leak another user’s card via findOneOrThrow', async () => {
    prisma.customerCardInstance.findFirst.mockResolvedValue(null);
    await expect(
      service.findOneOrThrow('card-owned-by-someone-else', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerCardInstance.findFirst).toHaveBeenCalledWith({
      where: { id: 'card-owned-by-someone-else', userId: 'user-1' },
    });
  });

  it('rejects listing usage for a card not owned by the requesting user', async () => {
    prisma.customerCardInstance.findFirst.mockResolvedValue(null);
    await expect(
      service.listUsage('card-1', 'user-1', 0, 20),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.usageTransaction.findMany).not.toHaveBeenCalled();
  });

  it('lists usage scoped to an owned card', async () => {
    prisma.customerCardInstance.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
    });
    await service.listUsage('card-1', 'user-1', 0, 20);
    expect(prisma.usageTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerCardInstanceId: 'card-1' },
      }),
    );
  });
});
