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
import {
  HOME_ORDER_BY,
  assertCategoryExists,
  assertMediaAssetUsable,
  loadReorderBeforeState,
  rethrowHomeWriteError,
} from './home-write.util';

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

/** Audit snapshot (Stage 5.16-B): every editable column; `kicker`/`active` keep their historical keys. */
function snapshot(tile: HomeServiceMosaicTile) {
  return {
    categoryId: tile.categoryId,
    mediaAssetId: tile.mediaAssetId,
    slotType: tile.slotType,
    kicker: tile.kicker,
    title: tile.title,
    lead: tile.lead,
    theme: tile.theme,
    sortOrder: tile.sortOrder,
    active: tile.active,
  };
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
 *
 * Stage 5.16-B: `title`/`lead` stay optional for every `slotType` (BD-5);
 * public visibility depends only on the tile's own `active` (BD-1); a
 * soft-deleted MediaAsset yields `image: null` (BD-2).
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
      orderBy: HOME_ORDER_BY,
      include: { category: true, mediaAsset: true },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeServiceMosaicTile.findMany({
        skip,
        take,
        orderBy: HOME_ORDER_BY,
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
    await assertCategoryExists(this.prisma, dto.categoryId);
    await assertMediaAssetUsable(this.prisma, dto.mediaAssetId);
    let tile: TileWithRelations;
    try {
      tile = await this.prisma.homeServiceMosaicTile.create({
        data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
        include: { category: true, mediaAsset: true },
      });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: tile.id,
      afterJson: snapshot(tile),
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
    await assertCategoryExists(this.prisma, dto.categoryId);
    await assertMediaAssetUsable(this.prisma, dto.mediaAssetId);
    let tile: TileWithRelations;
    try {
      tile = await this.prisma.homeServiceMosaicTile.update({
        where: { id },
        data: { ...dto, updatedBy: adminUserId },
        include: { category: true, mediaAsset: true },
      });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: id,
      beforeJson: snapshot(before),
      afterJson: snapshot(tile),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(tile);
  }

  /** Hard delete — same reasoning as `HomeHeroCardsService.remove()`. Never touches the referenced MediaAsset. */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    try {
      await this.prisma.homeServiceMosaicTile.delete({ where: { id } });
    } catch (err) {
      rethrowHomeWriteError(err);
    }
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeServiceMosaicTile',
      resourceId: id,
      beforeJson: snapshot(before),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id };
  }

  /** PARTIAL reorder (BD-3): only the listed rows change. Unknown ids → 422 before any write. `half` and `wide` share one `sortOrder` space (unchanged). */
  async reorder(
    dto: ReorderHomeItemsDto,
    adminUserId: string,
    meta: SessionMeta,
  ) {
    const beforeItems = await loadReorderBeforeState(dto.items, (ids) =>
      this.prisma.homeServiceMosaicTile.findMany({
        where: { id: { in: ids } },
        select: { id: true, sortOrder: true },
      }),
    );
    try {
      await this.prisma.$transaction(
        dto.items.map((entry) =>
          this.prisma.homeServiceMosaicTile.update({
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
      resourceType: 'HomeServiceMosaicTile',
      beforeJson: { items: beforeItems },
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
