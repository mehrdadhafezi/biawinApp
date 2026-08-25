import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { HomeHeroCardsService } from './home-hero-cards.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('HomeHeroCardsService', () => {
  let service: HomeHeroCardsService;
  let prisma: {
    homeHeroCard: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditLog: { record: jest.Mock };
  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  function makeCard(overrides: Record<string, unknown> = {}) {
    return {
      id: 'card-1',
      cardKey: 'biawin',
      label: 'کارت اصلی',
      title: 'کارت بیاوین',
      subtitle: 'عضویت اصلی',
      displayNumber: '6219 8610 4432 1095',
      ownerLabel: 'BIAWIN CLUB',
      colorPreset: 'sky',
      sortOrder: 1,
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
      homeHeroCard: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeHeroCardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(HomeHeroCardsService);
  });

  it('listPublic: queries only active cards ordered by sortOrder, shaped for the customer contract', async () => {
    prisma.homeHeroCard.findMany.mockResolvedValue([makeCard()]);

    const result = await service.listPublic();

    expect(prisma.homeHeroCard.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    expect(result).toEqual([
      {
        id: 'card-1',
        cardKey: 'biawin',
        label: 'کارت اصلی',
        title: 'کارت بیاوین',
        subtitle: 'عضویت اصلی',
        displayNumber: '6219 8610 4432 1095',
        ownerLabel: 'BIAWIN CLUB',
        colorPreset: 'sky',
        sortOrder: 1,
      },
    ]);
  });

  it('create: stamps ownership and records a CREATE audit entry', async () => {
    prisma.homeHeroCard.create.mockResolvedValue(makeCard());

    await service.create(
      {
        cardKey: 'biawin',
        label: 'کارت اصلی',
        title: 'کارت بیاوین',
        subtitle: 'عضویت اصلی',
        displayNumber: '...',
        ownerLabel: 'BIAWIN CLUB',
      },
      'admin-1',
      meta,
    );

    expect(prisma.homeHeroCard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
      }),
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'HomeHeroCard',
      }),
    );
  });

  it('remove: hard-deletes and records a DELETE audit entry', async () => {
    prisma.homeHeroCard.findUnique.mockResolvedValue(makeCard());

    await service.remove('card-1', 'admin-1', meta);

    expect(prisma.homeHeroCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-1' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        resourceType: 'HomeHeroCard',
      }),
    );
  });

  it('findOneAdmin: throws NotFoundException for a missing card', async () => {
    prisma.homeHeroCard.findUnique.mockResolvedValue(null);
    await expect(service.findOneAdmin('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
