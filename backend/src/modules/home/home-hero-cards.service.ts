import { Injectable, NotFoundException } from '@nestjs/common';
import type { HomeHeroCard } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import type { CreateHomeHeroCardDto } from './dto/create-home-hero-card.dto';
import type { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import type { UpdateHomeHeroCardDto } from './dto/update-home-hero-card.dto';

export interface HomeHeroCardPublicResponse {
  id: string;
  cardKey: string;
  label: string;
  title: string;
  subtitle: string;
  displayNumber: string;
  ownerLabel: string;
  colorPreset: string;
  sortOrder: number;
}

export interface HomeHeroCardAdminResponse extends HomeHeroCardPublicResponse {
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
 * `کارت‌های بیاوین` — the simplest of the 4 Home CMS resources (no
 * Category/MediaAsset relation, just the 3 fixed marketing cards). Kept as
 * its own small service rather than folded into a generic one, per
 * `docs/admin-architecture-decision-record.md` §9 ("no generic CRUD
 * endpoint" — explicit, typed, per-resource code, same as every other
 * module in this codebase).
 */
@Injectable()
export class HomeHeroCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async listPublic(): Promise<HomeHeroCardPublicResponse[]> {
    const items = await this.prisma.homeHeroCard.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((item) => this.toPublicResponse(item));
  }

  async listAdmin(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.homeHeroCard.findMany({
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.homeHeroCard.count(),
    ]);
    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string): Promise<HomeHeroCardAdminResponse> {
    return this.toAdminResponse(await this.findOrThrow(id));
  }

  async create(
    dto: CreateHomeHeroCardDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeHeroCardAdminResponse> {
    const card = await this.prisma.homeHeroCard.create({
      data: { ...dto, createdBy: adminUserId, updatedBy: adminUserId },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'HomeHeroCard',
      resourceId: card.id,
      afterJson: { cardKey: card.cardKey, title: card.title },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(card);
  }

  async update(
    id: string,
    dto: UpdateHomeHeroCardDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<HomeHeroCardAdminResponse> {
    const before = await this.findOrThrow(id);
    const card = await this.prisma.homeHeroCard.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'HomeHeroCard',
      resourceId: id,
      beforeJson: { title: before.title, active: before.active },
      afterJson: { title: card.title, active: card.active },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(card);
  }

  /**
   * Hard delete — unlike `MediaAsset`'s soft delete, nothing references a
   * `HomeHeroCard` by id from elsewhere (it's leaf content, same as
   * `OrbitItem`), so the "don't silently break a dependent" reasoning that
   * justifies `MediaAsset`'s soft delete doesn't apply here. Mirrors
   * `OrbitItemsService.remove()` exactly.
   */
  async remove(
    id: string,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<{ id: string }> {
    const before = await this.findOrThrow(id);
    await this.prisma.homeHeroCard.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId,
      action: 'DELETE',
      resourceType: 'HomeHeroCard',
      resourceId: id,
      beforeJson: { cardKey: before.cardKey, title: before.title },
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
        this.prisma.homeHeroCard.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'HomeHeroCard',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listPublic();
  }

  private async findOrThrow(id: string): Promise<HomeHeroCard> {
    const card = await this.prisma.homeHeroCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('کارت یافت نشد.');
    return card;
  }

  private toPublicResponse(card: HomeHeroCard): HomeHeroCardPublicResponse {
    return {
      id: card.id,
      cardKey: card.cardKey,
      label: card.label,
      title: card.title,
      subtitle: card.subtitle,
      displayNumber: card.displayNumber,
      ownerLabel: card.ownerLabel,
      colorPreset: card.colorPreset,
      sortOrder: card.sortOrder,
    };
  }

  private toAdminResponse(card: HomeHeroCard): HomeHeroCardAdminResponse {
    return {
      ...this.toPublicResponse(card),
      active: card.active,
      createdBy: card.createdBy,
      updatedBy: card.updatedBy,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }
}
