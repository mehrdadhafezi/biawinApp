import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HomeNewsArticle, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateHomeNewsArticleDto } from './dto/create-home-news-article.dto';
import type { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import type { UpdateHomeNewsArticleDto } from './dto/update-home-news-article.dto';
import { resolveMediaUrl } from './home-media.util';
import {
  DUPLICATE_BODY_SLUG_MESSAGE,
  HOME_ORDER_BY,
  assertMediaAssetUsable,
  loadReorderBeforeState,
  rethrowHomeWriteError,
} from './home-write.util';

type ArticleWithRelations = HomeNewsArticle & { mediaAsset: MediaAsset | null };

export interface HomeNewsArticlePublicResponse {
  id: string;
  category: string;
  image: string | null;
  kicker: string;
  title: string;
  lead: string;
  sortOrder: number;
}

export interface HomeNewsArticleAdminResponse extends HomeNewsArticlePublicResponse {
  mediaAssetId: string | null;
  bodySlug: string | null;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/** Audit snapshot (Stage 5.16-B): every editable column; `title`/`category`/`active` keep their historical keys. */
function snapshot(article: HomeNewsArticle) {
  return {
    category: article.category,
    mediaAssetId: article.mediaAssetId,
    kicker: article.kicker,
    title: article.title,
    lead: article.lead,
    bodySlug: article.bodySlug,
    sortOrder: article.sortOrder,
    active: article.active,
  };
}

/**
 * `مقالات و اخبار بیاوین` — gives `docs/prototype-to-production-mapping.md`'s
 * long-deferred `NewsArticle` P2 item (and `docs/home-admin-contract.md`
 * §4.5) its concrete backend. `category` stays a plain editorial label, not
 * an FK — news categories are editorial tags, not the Category catalog.
 */
@Injectable()
export class HomeNewsArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async listPublic(): Promise<HomeNewsArticlePublicResponse[]> {
    const items = await this.prisma.homeNewsArticle.findMany({
      where: { active: true },
      orderBy: HOME_ORDER_BY,
      include: { mediaAsset: true },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeNewsArticle.findMany({
        skip,
        take,
        orderBy: HOME_ORDER_BY,
        include: { mediaAsset: true },
      }),
      this.prisma.homeNewsArticle.count(),
    ]);
    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string): Promise<HomeNewsArticleAdminResponse> {
    return this.toAdminResponse(await this.findOrThrow(id));
  }

  async create(
    dto: CreateHomeNewsArticleDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeNewsArticleAdminResponse> {
    await this.assertBodySlugFree(dto.bodySlug);
    await assertMediaAssetUsable(this.prisma, dto.mediaAssetId);
    let article: ArticleWithRelations;
    try {
      article = await this.prisma.homeNewsArticle.create({
        data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
        include: { mediaAsset: true },
      });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeNewsArticle',
      resourceId: article.id,
      afterJson: snapshot(article),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(article);
  }

  async update(
    id: string,
    dto: UpdateHomeNewsArticleDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeNewsArticleAdminResponse> {
    const before = await this.findOrThrow(id);
    await this.assertBodySlugFree(dto.bodySlug, id);
    await assertMediaAssetUsable(this.prisma, dto.mediaAssetId);
    let article: ArticleWithRelations;
    try {
      article = await this.prisma.homeNewsArticle.update({
        where: { id },
        data: { ...dto, updatedBy: adminUserId },
        include: { mediaAsset: true },
      });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeNewsArticle',
      resourceId: id,
      beforeJson: snapshot(before),
      afterJson: snapshot(article),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(article);
  }

  /** Hard delete — same reasoning as `HomeHeroCardsService.remove()`. Never touches the referenced MediaAsset. */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    try {
      await this.prisma.homeNewsArticle.delete({ where: { id } });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeNewsArticle',
      resourceId: id,
      beforeJson: snapshot(before),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id };
  }

  /** PARTIAL reorder (BD-3): only the listed rows change. Unknown ids → 422 before any write. */
  async reorder(
    dto: ReorderHomeItemsDto,
    adminUserId: string,
    meta: SessionMeta,
  ) {
    const beforeItems = await loadReorderBeforeState(dto.items, (ids) =>
      this.prisma.homeNewsArticle.findMany({
        where: { id: { in: ids } },
        select: { id: true, sortOrder: true },
      }),
    );
    try {
      await this.prisma.$transaction(
        dto.items.map((entry) =>
          this.prisma.homeNewsArticle.update({
            where: { id: entry.id },
            data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
          }),
        ),
      );
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'HomeNewsArticle',
      beforeJson: { items: beforeItems },
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listPublic();
  }

  /** `bodySlug` is `@unique`: pre-check gives a clean 409; the `P2002` catch covers the concurrent-write race. `null`/absent never conflicts. */
  private async assertBodySlugFree(
    bodySlug: string | null | undefined,
    ownId?: string,
  ): Promise<void> {
    if (bodySlug === null || bodySlug === undefined) return;
    const existing = await this.prisma.homeNewsArticle.findUnique({
      where: { bodySlug },
      select: { id: true },
    });
    if (existing && existing.id !== ownId) {
      throw new ConflictException(DUPLICATE_BODY_SLUG_MESSAGE);
    }
  }

  private async findOrThrow(id: string): Promise<ArticleWithRelations> {
    const article = await this.prisma.homeNewsArticle.findUnique({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!article) throw new NotFoundException('مقاله یافت نشد.');
    return article;
  }

  private toPublicResponse(
    article: ArticleWithRelations,
  ): HomeNewsArticlePublicResponse {
    return {
      id: article.id,
      category: article.category,
      image: resolveMediaUrl(this.mediaStorage, article.mediaAsset),
      kicker: article.kicker,
      title: article.title,
      lead: article.lead,
      sortOrder: article.sortOrder,
    };
  }

  private toAdminResponse(
    article: ArticleWithRelations,
  ): HomeNewsArticleAdminResponse {
    return {
      ...this.toPublicResponse(article),
      mediaAssetId: article.mediaAssetId,
      bodySlug: article.bodySlug,
      active: article.active,
      createdBy: article.createdBy,
      updatedBy: article.updatedBy,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }
}
