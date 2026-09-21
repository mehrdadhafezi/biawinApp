import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { HomeHeroCardsService } from './home-hero-cards.service';
import { HomeNewsArticlesService } from './home-news-articles.service';
import { HomeServiceBannersService } from './home-service-banners.service';
import { HomeServiceMosaicTilesService } from './home-service-mosaic-tiles.service';
import { HOME_ORDER_BY } from './home-write.util';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.objectContaining(...)` is typed `any` in @types/jest; plain assertion helper. */

/**
 * Stage 5.16-B service-level contract (docs/STAGE-5.16-HOME-BACKEND-HARDENING-
 * PLAN.md §3, §5, §6, §9): error mapping, reference checks, reorder
 * strictness (partial semantics kept), soft-deleted media, audit snapshots.
 * Prisma is mocked — nothing here touches a database.
 */

const meta = { ip: '127.0.0.1', userAgent: 'jest' };
const now = new Date();

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(`mock ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });
}

function delegate() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makePrisma() {
  const prisma = {
    homeHeroCard: delegate(),
    homeServiceBanner: delegate(),
    homeServiceMosaicTile: delegate(),
    homeNewsArticle: delegate(),
    category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
    mediaAsset: { findFirst: jest.fn().mockResolvedValue({ id: 'media-1' }) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return prisma;
}

const mediaStorage = {
  resolvePublicUrl: jest.fn(
    (key: string) => `/api/v1/media/${key.split('/').pop()}`,
  ),
};

const heroRow = {
  id: 'hero-1',
  cardKey: 'earn',
  label: 'L',
  title: 'T',
  subtitle: 'S',
  displayNumber: '1234',
  ownerLabel: 'O',
  colorPreset: 'blue',
  sortOrder: 0,
  active: true,
  createdBy: 'a',
  updatedBy: 'a',
  createdAt: now,
  updatedAt: now,
};
const bannerRow = {
  id: 'ban-1',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'اتومبیل', active: false },
  mediaAssetId: 'media-1',
  mediaAsset: { id: 'media-1', key: 'media/a.webp', active: true },
  kicker: 'K',
  theme: 'auto',
  wide: false,
  sortOrder: 0,
  active: true,
  createdBy: 'a',
  updatedBy: 'a',
  createdAt: now,
  updatedAt: now,
};
const tileRow = {
  id: 'tile-1',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'بیمه' },
  mediaAssetId: 'media-1',
  mediaAsset: { id: 'media-1', key: 'media/b.webp', active: true },
  slotType: 'wide',
  kicker: 'K',
  title: null,
  lead: null,
  theme: 'home',
  sortOrder: 0,
  active: true,
  createdBy: 'a',
  updatedBy: 'a',
  createdAt: now,
  updatedAt: now,
};
const newsRow = {
  id: 'news-1',
  category: 'خبر',
  mediaAssetId: 'media-1',
  mediaAsset: { id: 'media-1', key: 'media/c.webp', active: true },
  kicker: 'K',
  title: 'T',
  lead: 'L',
  bodySlug: null,
  sortOrder: 0,
  active: true,
  createdBy: 'a',
  updatedBy: 'a',
  createdAt: now,
  updatedAt: now,
};

describe('Home hardening — Hero Cards', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { record: jest.Mock };
  let service: HomeHeroCardsService;
  beforeEach(() => {
    prisma = makePrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new HomeHeroCardsService(prisma as never, audit as never);
  });

  const createDto = {
    cardKey: 'earn' as const,
    label: 'L',
    title: 'T',
    subtitle: 'S',
    displayNumber: '1',
    ownerLabel: 'O',
  };

  it('create with a cardKey that already exists → 409, nothing written, no audit', async () => {
    prisma.homeHeroCard.findUnique.mockResolvedValue({ id: 'other' });
    await expect(service.create(createDto, 'admin-1', meta)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.homeHeroCard.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('create racing another writer (P2002 on cardKey) → 409, not 500', async () => {
    prisma.homeHeroCard.create.mockRejectedValue(
      prismaError('P2002', { target: ['cardKey'] }),
    );
    await expect(service.create(createDto, 'admin-1', meta)).rejects.toThrow(
      ConflictException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('update to another row’s cardKey → 409; keeping its own cardKey is fine', async () => {
    prisma.homeHeroCard.findUnique
      .mockResolvedValueOnce(heroRow) // findOrThrow
      .mockResolvedValueOnce({ id: 'other' }); // cardKey pre-check
    await expect(
      service.update('hero-1', { cardKey: 'biawin' }, 'admin-1', meta),
    ).rejects.toThrow(ConflictException);
    expect(prisma.homeHeroCard.update).not.toHaveBeenCalled();

    prisma.homeHeroCard.findUnique.mockReset().mockResolvedValue(heroRow);
    prisma.homeHeroCard.update.mockResolvedValue(heroRow);
    await service.update(
      'hero-1',
      { cardKey: 'earn', title: 'T' },
      'admin-1',
      meta,
    );
    expect(prisma.homeHeroCard.update).toHaveBeenCalledTimes(1);
  });

  it('update/delete of a row deleted mid-request (P2025) → 404', async () => {
    prisma.homeHeroCard.findUnique.mockResolvedValue(heroRow);
    prisma.homeHeroCard.update.mockRejectedValue(prismaError('P2025'));
    prisma.homeHeroCard.delete.mockRejectedValue(prismaError('P2025'));
    await expect(
      service.update('hero-1', { title: 'x' }, 'admin-1', meta),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove('hero-1', 'admin-1', meta)).rejects.toThrow(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('an unexpected Prisma failure is NOT swallowed (stays a 500 upstream)', async () => {
    const boom = prismaError('P1001');
    prisma.homeHeroCard.create.mockRejectedValue(boom);
    await expect(service.create(createDto, 'admin-1', meta)).rejects.toBe(boom);
  });

  it('update audit records full before/after snapshots (superset of the old title/active keys)', async () => {
    prisma.homeHeroCard.findUnique.mockResolvedValue(heroRow);
    prisma.homeHeroCard.update.mockResolvedValue({
      ...heroRow,
      title: 'New',
      colorPreset: 'sky',
    });
    await service.update(
      'hero-1',
      { title: 'New', colorPreset: 'sky' },
      'admin-1',
      meta,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        beforeJson: expect.objectContaining({
          title: 'T',
          active: true,
          colorPreset: 'blue',
          cardKey: 'earn',
          sortOrder: 0,
        }),
        afterJson: expect.objectContaining({
          title: 'New',
          active: true,
          colorPreset: 'sky',
        }),
      }),
    );
  });

  it('a failed audit write does not fail the mutation (best-effort, non-transactional — unchanged)', async () => {
    // Real AdminAuditLogService whose DB write fails: record() swallows + logs.
    const failing = new AdminAuditLogService({
      adminAuditLog: {
        create: jest.fn().mockRejectedValue(new Error('audit db down')),
      },
    } as never);
    jest.spyOn(failing['logger'], 'error').mockImplementation(() => undefined);
    const svc = new HomeHeroCardsService(prisma as never, failing);
    prisma.homeHeroCard.create.mockResolvedValue(heroRow);

    await expect(svc.create(createDto, 'admin-1', meta)).resolves.toEqual(
      expect.objectContaining({ id: 'hero-1' }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled(); // mutation is not wrapped in a transaction with the audit write
  });

  it('lists are ordered deterministically (sortOrder, createdAt, id)', async () => {
    await service.listPublic();
    await service.listAdmin(0, 20);
    expect(prisma.homeHeroCard.findMany).toHaveBeenNthCalledWith(1, {
      where: { active: true },
      orderBy: HOME_ORDER_BY,
    });
    expect(prisma.homeHeroCard.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ orderBy: HOME_ORDER_BY }),
    );
    expect(HOME_ORDER_BY).toEqual([
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  describe('reorder (partial semantics kept)', () => {
    it('a valid single-item payload is accepted (Stage 5.22 QA shape) and audits before + after', async () => {
      prisma.homeHeroCard.findMany
        .mockResolvedValueOnce([{ id: 'hero-1', sortOrder: 2 }])
        .mockResolvedValue([]);
      await service.reorder(
        { items: [{ id: 'hero-1', sortOrder: 2 }] },
        'admin-1',
        meta,
      );
      expect(prisma.homeHeroCard.update).toHaveBeenCalledWith({
        where: { id: 'hero-1' },
        data: { sortOrder: 2, updatedBy: 'admin-1' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REORDER',
          beforeJson: { items: [{ id: 'hero-1', sortOrder: 2 }] },
          afterJson: { items: [{ id: 'hero-1', sortOrder: 2 }] },
        }),
      );
    });

    it('an unknown id → 422 and NOTHING is written (no update, no transaction, no audit)', async () => {
      prisma.homeHeroCard.findMany.mockResolvedValueOnce([
        { id: 'hero-1', sortOrder: 0 },
      ]);
      await expect(
        service.reorder(
          {
            items: [
              { id: 'hero-1', sortOrder: 1 },
              { id: 'ghost', sortOrder: 2 },
            ],
          },
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.homeHeroCard.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('unlisted rows are never touched (only the listed ids are looked up / updated)', async () => {
      prisma.homeHeroCard.findMany
        .mockResolvedValueOnce([{ id: 'hero-1', sortOrder: 0 }])
        .mockResolvedValue([]);
      await service.reorder(
        { items: [{ id: 'hero-1', sortOrder: 5 }] },
        'admin-1',
        meta,
      );
      expect(prisma.homeHeroCard.findMany).toHaveBeenNthCalledWith(1, {
        where: { id: { in: ['hero-1'] } },
        select: { id: true, sortOrder: true },
      });
      expect(prisma.homeHeroCard.update).toHaveBeenCalledTimes(1);
    });

    it('a row deleted between the pre-check and the write (P2025) → 404, no audit', async () => {
      prisma.homeHeroCard.findMany.mockResolvedValueOnce([
        { id: 'hero-1', sortOrder: 0 },
      ]);
      prisma.homeHeroCard.update.mockRejectedValue(prismaError('P2025'));
      await expect(
        service.reorder(
          { items: [{ id: 'hero-1', sortOrder: 1 }] },
          'admin-1',
          meta,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});

describe('Home hardening — Service Banners & Mosaic Tiles (category / media references)', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { record: jest.Mock };
  let banners: HomeServiceBannersService;
  let tiles: HomeServiceMosaicTilesService;
  beforeEach(() => {
    prisma = makePrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    banners = new HomeServiceBannersService(
      prisma as never,
      mediaStorage as never,
      audit as never,
    );
    tiles = new HomeServiceMosaicTilesService(
      prisma as never,
      mediaStorage as never,
      audit as never,
    );
  });

  it('unknown category → 422 on banner and tile create/update, nothing written', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.homeServiceBanner.findUnique.mockResolvedValue(bannerRow);
    prisma.homeServiceMosaicTile.findUnique.mockResolvedValue(tileRow);

    await expect(
      banners.create({ categoryId: 'ghost', kicker: 'k' }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      banners.update('ban-1', { categoryId: 'ghost' }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      tiles.create(
        { categoryId: 'ghost', slotType: 'half', kicker: 'k' },
        'a',
        meta,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      tiles.update('tile-1', { categoryId: 'ghost' }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(prisma.homeServiceBanner.create).not.toHaveBeenCalled();
    expect(prisma.homeServiceBanner.update).not.toHaveBeenCalled();
    expect(prisma.homeServiceMosaicTile.create).not.toHaveBeenCalled();
    expect(prisma.homeServiceMosaicTile.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('unknown or soft-deleted media → 422 (lookup requires active: true); nothing written', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    prisma.homeServiceBanner.findUnique.mockResolvedValue(bannerRow);
    await expect(
      banners.create(
        { categoryId: 'cat-1', mediaAssetId: 'ghost', kicker: 'k' },
        'a',
        meta,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      banners.update('ban-1', { mediaAssetId: 'ghost' }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'ghost', active: true },
      select: { id: true },
    });
    expect(prisma.homeServiceBanner.create).not.toHaveBeenCalled();
    expect(prisma.homeServiceBanner.update).not.toHaveBeenCalled();
  });

  it('mediaAssetId: null is accepted on create and update (clears; no media lookup)', async () => {
    prisma.homeServiceBanner.create.mockResolvedValue({
      ...bannerRow,
      mediaAssetId: null,
      mediaAsset: null,
    });
    prisma.homeServiceBanner.findUnique.mockResolvedValue(bannerRow);
    prisma.homeServiceBanner.update.mockResolvedValue({
      ...bannerRow,
      mediaAssetId: null,
      mediaAsset: null,
    });
    await banners.create(
      { categoryId: 'cat-1', mediaAssetId: null, kicker: 'k' },
      'a',
      meta,
    );
    await banners.update('ban-1', { mediaAssetId: null }, 'a', meta);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });

  it('a mosaic tile without title/lead is accepted for both slot types (BD-5)', async () => {
    prisma.homeServiceMosaicTile.create.mockResolvedValue(tileRow);
    await tiles.create(
      { categoryId: 'cat-1', slotType: 'wide', kicker: 'k' },
      'a',
      meta,
    );
    await tiles.create(
      {
        categoryId: 'cat-1',
        slotType: 'half',
        kicker: 'k',
        title: null,
        lead: null,
      },
      'a',
      meta,
    );
    expect(prisma.homeServiceMosaicTile.create).toHaveBeenCalledTimes(2);
  });

  it('a FK violation that slips past the pre-check (P2003, race) → 422, not 500', async () => {
    prisma.homeServiceBanner.create.mockRejectedValue(prismaError('P2003'));
    await expect(
      banners.create({ categoryId: 'cat-1', kicker: 'k' }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('BD-1: public lists filter ONLY on the Home row’s own `active` — an inactive category’s banner is still returned', async () => {
    prisma.homeServiceBanner.findMany.mockResolvedValue([bannerRow]); // category.active === false
    prisma.homeServiceMosaicTile.findMany.mockResolvedValue([tileRow]);
    const result = await banners.listPublic();
    await tiles.listPublic();

    expect(prisma.homeServiceBanner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(prisma.homeServiceMosaicTile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].image).toBe('/api/v1/media/a.webp');
  });

  it('BD-2: a soft-deleted media asset → image: null; the row is kept and mediaAssetId untouched (banner, tile, news)', async () => {
    const dead = { key: 'media/gone.webp', active: false };
    prisma.homeServiceBanner.findMany.mockResolvedValue([
      { ...bannerRow, mediaAsset: { id: 'media-1', ...dead } },
    ]);
    prisma.homeServiceMosaicTile.findMany.mockResolvedValue([
      { ...tileRow, mediaAsset: { id: 'media-1', ...dead } },
    ]);
    prisma.homeNewsArticle.findMany.mockResolvedValue([
      { ...newsRow, mediaAsset: { id: 'media-1', ...dead } },
    ]);
    const news = new HomeNewsArticlesService(
      prisma as never,
      mediaStorage as never,
      audit as never,
    );

    const [banner] = await banners.listPublic();
    const [tile] = await tiles.listPublic();
    const [article] = await news.listPublic();
    expect(banner.image).toBeNull();
    expect(tile.image).toBeNull();
    expect(article.image).toBeNull();
    expect([banner.id, tile.id, article.id]).toEqual([
      'ban-1',
      'tile-1',
      'news-1',
    ]); // rows kept

    // admin view: still shows the stored reference, image null
    prisma.homeServiceBanner.findUnique.mockResolvedValue({
      ...bannerRow,
      mediaAsset: { id: 'media-1', ...dead },
    });
    const admin = await banners.findOneAdmin('ban-1');
    expect(admin.mediaAssetId).toBe('media-1');
    expect(admin.image).toBeNull();
    // and nothing was written anywhere
    expect(prisma.homeServiceBanner.update).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });

  it('an active media asset still resolves to its URL (no regression)', async () => {
    prisma.homeServiceBanner.findMany.mockResolvedValue([bannerRow]);
    const [banner] = await banners.listPublic();
    expect(banner.image).toBe('/api/v1/media/a.webp');
  });

  it('banner update audit snapshots include media, category, theme, wide, sortOrder (before + after)', async () => {
    prisma.homeServiceBanner.findUnique.mockResolvedValue(bannerRow);
    prisma.homeServiceBanner.update.mockResolvedValue({
      ...bannerRow,
      mediaAssetId: null,
      mediaAsset: null,
      theme: 'gold',
    });
    await banners.update(
      'ban-1',
      { mediaAssetId: null, theme: 'gold' },
      'admin-1',
      meta,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeJson: expect.objectContaining({
          mediaAssetId: 'media-1',
          theme: 'auto',
          kicker: 'K',
          active: true,
          categoryId: 'cat-1',
          wide: false,
          sortOrder: 0,
        }),
        afterJson: expect.objectContaining({
          mediaAssetId: null,
          theme: 'gold',
        }),
      }),
    );
  });

  describe('reorder (partial semantics kept)', () => {
    it('unknown id → 422, nothing written (banners and tiles)', async () => {
      prisma.homeServiceBanner.findMany.mockResolvedValueOnce([]);
      prisma.homeServiceMosaicTile.findMany.mockResolvedValueOnce([]);
      await expect(
        banners.reorder({ items: [{ id: 'ghost', sortOrder: 0 }] }, 'a', meta),
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        tiles.reorder({ items: [{ id: 'ghost', sortOrder: 0 }] }, 'a', meta),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.homeServiceBanner.update).not.toHaveBeenCalled();
      expect(prisma.homeServiceMosaicTile.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('a two-row swap (Stage 5.22 QA shape) succeeds and audits previous positions', async () => {
      prisma.homeServiceMosaicTile.findMany
        .mockResolvedValueOnce([
          { id: 'x', sortOrder: 0 },
          { id: 'y', sortOrder: 1 },
        ])
        .mockResolvedValue([]);
      await tiles.reorder(
        {
          items: [
            { id: 'x', sortOrder: 1 },
            { id: 'y', sortOrder: 0 },
          ],
        },
        'admin-1',
        meta,
      );
      expect(prisma.homeServiceMosaicTile.update).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeJson: {
            items: [
              { id: 'x', sortOrder: 0 },
              { id: 'y', sortOrder: 1 },
            ],
          },
          afterJson: {
            items: [
              { id: 'x', sortOrder: 1 },
              { id: 'y', sortOrder: 0 },
            ],
          },
        }),
      );
    });
  });
});

describe('Home hardening — News Articles', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { record: jest.Mock };
  let service: HomeNewsArticlesService;
  beforeEach(() => {
    prisma = makePrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new HomeNewsArticlesService(
      prisma as never,
      mediaStorage as never,
      audit as never,
    );
  });

  const createDto = {
    category: 'خبر',
    kicker: 'k',
    title: 't',
    lead: 'l',
    bodySlug: 'spring-sale',
  };

  it('create with an existing bodySlug → 409, nothing written', async () => {
    prisma.homeNewsArticle.findUnique.mockResolvedValue({ id: 'other' });
    await expect(service.create(createDto, 'a', meta)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.homeNewsArticle.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('create racing another writer (P2002 on bodySlug) → 409', async () => {
    prisma.homeNewsArticle.create.mockRejectedValue(
      prismaError('P2002', { target: ['bodySlug'] }),
    );
    await expect(service.create(createDto, 'a', meta)).rejects.toThrow(
      ConflictException,
    );
  });

  it('update: re-saving an article with its OWN bodySlug is not a conflict; another article’s slug is', async () => {
    prisma.homeNewsArticle.findUnique
      .mockResolvedValueOnce(newsRow) // findOrThrow
      .mockResolvedValueOnce({ id: 'news-1' }); // slug pre-check: itself
    prisma.homeNewsArticle.update.mockResolvedValue({
      ...newsRow,
      bodySlug: 'spring-sale',
    });
    await service.update('news-1', { bodySlug: 'spring-sale' }, 'a', meta);
    expect(prisma.homeNewsArticle.update).toHaveBeenCalledTimes(1);

    prisma.homeNewsArticle.findUnique
      .mockReset()
      .mockResolvedValueOnce(newsRow)
      .mockResolvedValueOnce({ id: 'someone-else' });
    await expect(
      service.update('news-1', { bodySlug: 'taken' }, 'a', meta),
    ).rejects.toThrow(ConflictException);
  });

  it('bodySlug: null / absent never triggers a uniqueness lookup', async () => {
    prisma.homeNewsArticle.create.mockResolvedValue(newsRow);
    await service.create({ ...createDto, bodySlug: null }, 'a', meta);
    await service.create(
      { category: 'خبر', kicker: 'k', title: 't', lead: 'l' },
      'a',
      meta,
    );
    expect(prisma.homeNewsArticle.findUnique).not.toHaveBeenCalled();
  });

  it('unknown / soft-deleted media → 422', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(
      service.create(
        { ...createDto, bodySlug: undefined, mediaAssetId: 'ghost' },
        'a',
        meta,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.homeNewsArticle.create).not.toHaveBeenCalled();
  });

  it('delete audit records the full before snapshot; reorder unknown id → 422', async () => {
    prisma.homeNewsArticle.findUnique.mockResolvedValue(newsRow);
    await service.remove('news-1', 'admin-1', meta);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        beforeJson: expect.objectContaining({
          title: 'T',
          category: 'خبر',
          mediaAssetId: 'media-1',
          bodySlug: null,
        }),
      }),
    );
    prisma.homeNewsArticle.findMany.mockResolvedValueOnce([]);
    await expect(
      service.reorder({ items: [{ id: 'ghost', sortOrder: 0 }] }, 'a', meta),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
