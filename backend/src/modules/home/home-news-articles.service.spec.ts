import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { HomeNewsArticlesService } from './home-news-articles.service';

describe('HomeNewsArticlesService', () => {
  let service: HomeNewsArticlesService;
  let prisma: {
    homeNewsArticle: {
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

  function makeArticle(overrides: Record<string, unknown> = {}) {
    return {
      id: 'article-1',
      category: 'معرفی بیاوین',
      mediaAssetId: 'media-1',
      mediaAsset: { id: 'media-1', key: 'media/news-01.webp' },
      kicker: 'راهنمای عضویت',
      title: 'بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟',
      lead: '...',
      bodySlug: null,
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
      homeNewsArticle: {
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
      resolvePublicUrl: jest.fn(
        (key: string) => `/media/${key.split('/').pop()}`,
      ),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeNewsArticlesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MediaStorageService, useValue: mediaStorage },
        { provide: AdminAuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(HomeNewsArticlesService);
  });

  it('listPublic: active-only, sorted, image resolved from the MediaAsset relation', async () => {
    prisma.homeNewsArticle.findMany.mockResolvedValue([makeArticle()]);

    const result = await service.listPublic();

    expect(prisma.homeNewsArticle.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { mediaAsset: true },
    });
    expect(result).toEqual([
      {
        id: 'article-1',
        category: 'معرفی بیاوین',
        image: '/media/news-01.webp',
        kicker: 'راهنمای عضویت',
        title: 'بیاوین چگونه خریدهای بزرگ را ساده‌تر می‌کند؟',
        lead: '...',
        sortOrder: 0,
      },
    ]);
  });

  it('create: records a CREATE audit entry', async () => {
    prisma.homeNewsArticle.create.mockResolvedValue(makeArticle());

    await service.create(
      {
        category: 'معرفی بیاوین',
        kicker: 'راهنمای عضویت',
        title: 'عنوان',
        lead: 'متن',
      },
      'admin-1',
      meta,
    );

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        resourceType: 'HomeNewsArticle',
      }),
    );
  });

  it('remove: hard-deletes and records a DELETE audit entry', async () => {
    prisma.homeNewsArticle.findUnique.mockResolvedValue(makeArticle());

    await service.remove('article-1', 'admin-1', meta);

    expect(prisma.homeNewsArticle.delete).toHaveBeenCalledWith({
      where: { id: 'article-1' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        resourceType: 'HomeNewsArticle',
      }),
    );
  });
});
