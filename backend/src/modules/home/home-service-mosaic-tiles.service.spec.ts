import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { HomeServiceMosaicTilesService } from './home-service-mosaic-tiles.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest. */

describe('HomeServiceMosaicTilesService', () => {
  let service: HomeServiceMosaicTilesService;
  let prisma: {
    homeServiceMosaicTile: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mediaStorage: { resolvePublicUrl: jest.Mock };
  let auditLog: { record: jest.Mock };
  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  function makeTile(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tile-1',
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'زیبایی' },
      mediaAssetId: null,
      mediaAsset: null,
      slotType: 'half',
      kicker: 'زیبایی و مراقبت',
      title: null,
      lead: null,
      theme: 'beauty',
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
      homeServiceMosaicTile: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    mediaStorage = {
      resolvePublicUrl: jest.fn((key: string) => `/media/${key}`),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeServiceMosaicTilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaStorageService, useValue: mediaStorage },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(HomeServiceMosaicTilesService);
  });

  it('listPublic: returns both half and wide slot types in one list, active-only, sorted', async () => {
    prisma.homeServiceMosaicTile.findMany.mockResolvedValue([
      makeTile({ id: 'tile-1', slotType: 'half', sortOrder: 0 }),
      makeTile({
        id: 'tile-2',
        slotType: 'wide',
        title: 'مبلمان و دکوراسیون',
        lead: 'خرید منعطف',
        sortOrder: 1,
      }),
    ]);

    const result = await service.listPublic();

    expect(prisma.homeServiceMosaicTile.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { category: true, mediaAsset: true },
    });
    expect(result.map((t) => t.slotType)).toEqual(['half', 'wide']);
    expect(result[1].title).toBe('مبلمان و دکوراسیون');
  });

  it('resolves categoryName from the real Category relation, not a hardcoded string', async () => {
    prisma.homeServiceMosaicTile.findMany.mockResolvedValue([makeTile()]);
    const [tile] = await service.listPublic();
    expect(tile.categoryName).toBe('زیبایی');
  });

  it('create: records a CREATE audit entry with the ownership stamp', async () => {
    prisma.homeServiceMosaicTile.create.mockResolvedValue(makeTile());

    await service.create(
      { categoryId: 'cat-1', slotType: 'half', kicker: 'زیبایی و مراقبت' },
      'admin-1',
      meta,
    );

    expect(prisma.homeServiceMosaicTile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
      }),
      include: { category: true, mediaAsset: true },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'HomeServiceMosaicTile',
      }),
    );
  });

  it('reorder: updates sortOrder for every entry and records a REORDER audit entry', async () => {
    prisma.homeServiceMosaicTile.findMany.mockResolvedValue([]);

    await service.reorder(
      { items: [{ id: 'tile-1', sortOrder: 3 }] },
      'admin-1',
      meta,
    );

    expect(prisma.homeServiceMosaicTile.update).toHaveBeenCalledWith({
      where: { id: 'tile-1' },
      data: { sortOrder: 3, updatedBy: 'admin-1' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REORDER',
        resourceType: 'HomeServiceMosaicTile',
      }),
    );
  });
});
