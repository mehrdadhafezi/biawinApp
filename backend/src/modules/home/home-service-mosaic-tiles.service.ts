import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Category,
  HomeServiceMosaicTile,
  MediaAsset,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateHomeServiceMosaicTileDto } from './dto/create-home-service-mosaic-tile.dto';
import type { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import type { UpdateHomeServiceMosaicTileDto } from './dto/update-home-service-mosaic-tile.dto';
import { resolveMediaUrl } from './home-media.util';

type TileWithRelations = HomeServiceMosaicTile & {
  category: Category;
  mediaAsset: MediaAsset | null;
};

export interface HomeServiceMosaicTilePublicResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  slotType: string;
  kicker: string;
  title: string | null;
  lead: string | null;
  theme: string;
  sortOrder: number;
}

export interface HomeServiceMosaicTileAdminResponse extends HomeServiceMosaicTilePublicResponse {
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
 * `.sketch-continuation` mosaic — one table for both `half` tiles and
 * `wide` slides (`slotType` discriminates), replacing `docs/home-admin-
 * contract.md` §4.4's originally-speculated two separate arrays. The
 * public response includes both groups; the (unmodified this stage)
 * customer `ServiceMosaic.tsx` component already splits its own two
 * hardcoded arrays into `half`/`wide` groups today, so a future frontend
 * cutover does the equivalent split client-side by filtering on `slotType`
 * instead — the API doesn't need two endpoints to preserve that shape.
 */
@Injectable()
export class HomeServiceMosaicTilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async listPublic(): Promise<HomeServiceMosaicTilePublicResponse[]> {
    const items = await this.prisma.homeServiceMosaicTile.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { category: true, mediaAsset: true },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeServiceMosaicTile.findMany({
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
        include: { category: true, mediaAsset: true },
      }),
      this.prisma.homeServiceMosaicTile.count(),
    ]);
    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string): Promise<HomeServiceMosaicTileAdminResponse> {
    return this.toAdminResponse(await this.findOrThrow(id));
  }

  async create(
    dto: CreateHomeServiceMosaicTileDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeServiceMosaicTileAdminResponse> {
    const tile = await this.prisma.homeServiceMosaicTile.create({
      data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
      include: { category: true, mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: tile.id,
      afterJson: { categoryId: tile.categoryId, slotType: tile.slotType },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(tile);
  }

  async update(
    id: string,
    dto: UpdateHomeServiceMosaicTileDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeServiceMosaicTileAdminResponse> {
    const before = await this.findOrThrow(id);
    const tile = await this.prisma.homeServiceMosaicTile.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
      include: { category: true, mediaAsset: true },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: id,
      beforeJson: { kicker: before.kicker, active: before.active },
      afterJson: { kicker: tile.kicker, active: tile.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(tile);
  }

  /** Hard delete — same reasoning as `HomeHeroCardsService.remove()`. */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    await this.prisma.homeServiceMosaicTile.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: id,
      beforeJson: { categoryId: before.categoryId, slotType: before.slotType },
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
        this.prisma.homeServiceMosaicTile.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'HomeServiceMosaicTile',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listPublic();
  }

  private async findOrThrow(id: string): Promise<TileWithRelations> {
    const tile = await this.prisma.homeServiceMosaicTile.findUnique({
      where: { id },
      include: { category: true, mediaAsset: true },
    });
    if (!tile) throw new NotFoundException('کاشی یافت نشد.');
    return tile;
  }

  private toPublicResponse(
    tile: TileWithRelations,
  ): HomeServiceMosaicTilePublicResponse {
    return {
      id: tile.id,
      categoryId: tile.categoryId,
      categoryName: tile.category.name,
      image: resolveMediaUrl(this.mediaStorage, tile.mediaAsset),
      slotType: tile.slotType,
      kicker: tile.kicker,
      title: tile.title,
      lead: tile.lead,
      theme: tile.theme,
      sortOrder: tile.sortOrder,
    };
  }

  private toAdminResponse(
    tile: TileWithRelations,
  ): HomeServiceMosaicTileAdminResponse {
    return {
      ...this.toPublicResponse(tile),
      mediaAssetId: tile.mediaAssetId,
      active: tile.active,
      createdBy: tile.createdBy,
      updatedBy: tile.updatedBy,
      createdAt: tile.createdAt,
      updatedAt: tile.updatedAt,
    };
  }
}
