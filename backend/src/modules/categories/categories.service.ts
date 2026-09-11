import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

type CategoryWithMedia = Category & { mediaAsset: MediaAsset | null };

/**
 * SERVICES-R5.17 — Category becomes Admin-managed for the first time
 * (previously seed-only, per docs/services-r5-16-audit.md §5). `list()`/
 * `findOneOrThrow()` (public, unchanged since R1) stay exactly as they
 * were — no filtering added here, matching this module's pre-existing
 * behavior; the new `listAdmin()`/`create()`/`update()`/`reorder()` methods
 * are purely additive, following the exact Home CMS CRUD+RBAC+audit-log
 * pattern (HomeHeroCardsService).
 *
 * SERVICES-R5.22 — every read now resolves a real `image` URL from
 * `mediaAssetId` (via `MediaStorageService`, same mechanism as
 * `CategoryCardsService`) additively: every field this module already
 * returned is still returned unchanged, `image` is purely new. The raw
 * joined `mediaAsset` row (which would leak the Storage key) is stripped
 * before the response leaves this service — only the resolved URL ever
 * does.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { mediaAsset: true },
      }),
      this.prisma.category.count(),
    ]);
    return {
      items: items.map((item) => this.withImage(item)),
      total,
      skip,
      take,
    };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.category.findFirst({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!item) throw new NotFoundException('Categories not found');
    return this.withImage(item);
  }

  /**
   * SERVICES-R5.21 — resolves a Category for the Category Landing route
   * (`/categories/[slug]`). A Category with `slug: null` (no fabricated
   * backfill — see the schema's own doc comment) correctly 404s here, same
   * not-found discipline as `findOneOrThrow`.
   */
  async findBySlugOrThrow(slug: string) {
    const item = await this.prisma.category.findFirst({
      where: { slug },
      include: { mediaAsset: true },
    });
    if (!item) throw new NotFoundException('دسته‌بندی یافت نشد.');
    return this.withImage(item);
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { mediaAsset: true },
      }),
      this.prisma.category.count(),
    ]);
    return {
      items: items.map((item) => this.withImage(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string) {
    return this.withImage(await this.findOrThrow(id));
  }

  async create(
    dto: CreateCategoryDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<Category> {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        imageKey: dto.imageKey,
        mediaAssetId: dto.mediaAssetId,
        slug: dto.slug,
        keywords: dto.keywords ?? [],
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'Category',
      resourceId: category.id,
      afterJson: { name: category.name, active: category.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return category;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<Category> {
    const before = await this.findOrThrow(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'Category',
      resourceId: id,
      beforeJson: { name: before.name, active: before.active },
      afterJson: { name: category.name, active: category.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return category;
  }

  async reorder(
    dto: ReorderCategoriesDto,
    adminUserId: string,
    meta: SessionMeta,
  ) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.category.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'Category',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listAdmin(0, 100);
  }

  private async findOrThrow(id: string): Promise<CategoryWithMedia> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!category) throw new NotFoundException('دسته‌بندی یافت نشد.');
    return category;
  }

  private withImage(category: CategoryWithMedia) {
    const { mediaAsset, ...rest } = category;
    return {
      ...rest,
      image: mediaAsset
        ? this.mediaStorage.resolvePublicUrl(mediaAsset.key)
        : null,
    };
  }
}
