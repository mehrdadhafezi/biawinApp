import { Injectable, NotFoundException } from '@nestjs/common';
import type { HomeNewsArticle, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateHomeNewsArticleDto } from './dto/create-home-news-article.dto';
import type { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import type { UpdateHomeNewsArticleDto } from './dto/update-home-news-article.dto';
import { resolveMediaUrl } from './home-media.util';

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
      orderBy: { sortOrder: 'asc' },
      include: { mediaAsset: true },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeNewsArticle.findMany({
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
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
    const article = await this.prisma.homeNewsArticle.create({
      data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
      include: { mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeNewsArticle',
      resourceId: article.id,
      afterJson: { title: article.title, category: article.category },
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
    const article = await this.prisma.homeNewsArticle.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
      include: { mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeNewsArticle',
      resourceId: id,
      beforeJson: { title: before.title, active: before.active },
      afterJson: { title: article.title, active: article.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(article);
  }

  /** Hard delete — same reasoning as `HomeHeroCardsService.remove()`. */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    await this.prisma.homeNewsArticle.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeNewsArticle',
      resourceId: id,
      beforeJson: { title: before.title },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id };
  }

  async reorder(
    dto: ReorderHomeItemsDto,
    adminUserId: string,
    meta: SessionMeta,
  ) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.homeNewsArticle.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'HomeNewsArticle',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listPublic();
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
