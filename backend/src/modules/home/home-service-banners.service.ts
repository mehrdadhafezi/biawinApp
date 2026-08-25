import { Injectable, NotFoundException } from '@nestjs/common';
import type { Category, HomeServiceBanner, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateHomeServiceBannerDto } from './dto/create-home-service-banner.dto';
import type { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import type { UpdateHomeServiceBannerDto } from './dto/update-home-service-banner.dto';
import { resolveMediaUrl } from './home-media.util';

type BannerWithRelations = HomeServiceBanner & {
  category: Category;
  mediaAsset: MediaAsset | null;
};

export interface HomeServiceBannerPublicResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  kicker: string;
  theme: string;
  wide: boolean;
  sortOrder: number;
}

export interface HomeServiceBannerAdminResponse extends HomeServiceBannerPublicResponse {
  mediaAssetId: string | null;
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
 * `خدمات منتخب بیاوین` — `categoryId` is a real FK (never the
 * `categoryName === category.name` string match `docs/home-admin-
 * contract.md` originally flagged as the exact bug class that caused
 * Stage 5.14.1's membership-image incident). `categoryName` is still
 * included in the public response — resolved server-side from the join,
 * not re-typed by hand — so it satisfies "preserve the current Customer
 * Home API contract if possible" (`ServiceBannerTile.categoryName` in
 * `apps/web/src/components/home/home.mock.ts`) without reintroducing the
 * fragile pattern that produced it.
 */
@Injectable()
export class HomeServiceBannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async listPublic(): Promise<HomeServiceBannerPublicResponse[]> {
    const items = await this.prisma.homeServiceBanner.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { category: true, mediaAsset: true },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeServiceBanner.findMany({
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
        include: { category: true, mediaAsset: true },
      }),
      this.prisma.homeServiceBanner.count(),
    ]);
    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string): Promise<HomeServiceBannerAdminResponse> {
    return this.toAdminResponse(await this.findOrThrow(id));
  }

  async create(
    dto: CreateHomeServiceBannerDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeServiceBannerAdminResponse> {
    const banner = await this.prisma.homeServiceBanner.create({
      data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
      include: { category: true, mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeServiceBanner',
      resourceId: banner.id,
      afterJson: { categoryId: banner.categoryId, kicker: banner.kicker },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(banner);
  }

  async update(
    id: string,
    dto: UpdateHomeServiceBannerDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeServiceBannerAdminResponse> {
    const before = await this.findOrThrow(id);
    const banner = await this.prisma.homeServiceBanner.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
      include: { category: true, mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeServiceBanner',
      resourceId: id,
      beforeJson: { kicker: before.kicker, active: before.active },
      afterJson: { kicker: banner.kicker, active: banner.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(banner);
  }

  /** Hard delete — same reasoning as `HomeHeroCardsService.remove()`. */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    await this.prisma.homeServiceBanner.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeServiceBanner',
      resourceId: id,
      beforeJson: { categoryId: before.categoryId, kicker: before.kicker },
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
        this.prisma.homeServiceBanner.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'HomeServiceBanner',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listPublic();
  }

  private async findOrThrow(id: string): Promise<BannerWithRelations> {
    const banner = await this.prisma.homeServiceBanner.findUnique({
      where: { id },
      include: { category: true, mediaAsset: true },
    });
    if (!banner) throw new NotFoundException('بنر یافت نشد.');
    return banner;
  }

  private toPublicResponse(
    banner: BannerWithRelations,
  ): HomeServiceBannerPublicResponse {
    return {
      id: banner.id,
      categoryId: banner.categoryId,
      categoryName: banner.category.name,
      image: resolveMediaUrl(this.mediaStorage, banner.mediaAsset),
      kicker: banner.kicker,
      theme: banner.theme,
      wide: banner.wide,
      sortOrder: banner.sortOrder,
    };
  }

  private toAdminResponse(
    banner: BannerWithRelations,
  ): HomeServiceBannerAdminResponse {
    return {
      ...this.toPublicResponse(banner),
      mediaAssetId: banner.mediaAssetId,
      active: banner.active,
      createdBy: banner.createdBy,
      updatedBy: banner.updatedBy,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }
}
