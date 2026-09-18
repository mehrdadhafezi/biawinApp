import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CategoryCard, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateCategoryCardDto } from './dto/create-category-card.dto';
import type { UpdateCategoryCardDto } from './dto/update-category-card.dto';
import type { ReorderCategoryCardsDto } from './dto/reorder-category-cards.dto';

type CardWithRelations = CategoryCard & {
  mediaAsset: MediaAsset | null;
  targetService: {
    id: string;
    title: string;
    cardProducts: { priceAmount: number | null }[];
  } | null;
  category: { id: string; name: string } | null;
};

const ADMIN_INCLUDE = {
  mediaAsset: true,
  targetService: {
    select: {
      id: true,
      title: true,
      // R5.26.2 price contract — only the customer-visible (`status:
      // ACTIVE`) CardProducts count when resolving this card's price;
      // a DRAFT/INACTIVE/EXPIRED sibling a customer will never see must
      // never make an unambiguous Service look ambiguous. See
      // `resolvePriceAmount()`'s own doc comment for the 0/1/many rule.
      cardProducts: {
        where: { status: 'ACTIVE' },
        select: { priceAmount: true },
      },
    },
  },
  category: { select: { id: true, name: true } },
} as const;

export interface CategoryCardPublicResponse {
  id: string;
  categoryId: string;
  targetServiceId: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image: string | null;
  highlights: unknown;
  sortOrder: number;
  /**
   * R5.26.2 price contract — READ-ONLY, resolved server-side from the
   * target Service's own CardProduct.priceAmount; never a second,
   * persisted price on CategoryCard itself (the schema's own module
   * comment: "CategoryCard... carries no price... must NEVER reference
   * CardProduct directly" — this resolves through the relation at read
   * time, it does not violate that boundary by storing a duplicate).
   * `null` when the target Service has zero ACTIVE CardProducts (never
   * fabricated) or when it has more than one (ambiguous — see
   * `resolvePriceAmount()`).
   */
  priceAmount: number | null;
}

export interface CategoryCardAdminResponse extends CategoryCardPublicResponse {
  mediaAssetId: string | null;
  active: boolean;
  targetService: { id: string; title: string } | null;
  category: { id: string; name: string } | null;
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
 * SERVICES-R5.21 — CategoryCard is a discovery/marketing card, NOT a
 * purchasable product, and NEVER references CardProduct (see the schema's
 * own module-header comment). Mirrors HomeServiceBannersService's exact
 * shape (mediaAssetId resolution via `MediaStorageService`, CRUD + audit
 * log + reorder), the closest existing precedent for "a Category-scoped
 * promo card with an image and short copy."
 *
 * `list()`/public reads only ever return `active: true` rows — no
 * client-side re-filtering is needed downstream (same discipline as
 * `CardProductsService.list()`).
 */
@Injectable()
export class CategoryCardsService {
  private readonly logger = new Logger(CategoryCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async list(skip: number, take: number, categoryId?: string) {
    const where = {
      active: true as const,
      ...(categoryId ? { categoryId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.categoryCard.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: ADMIN_INCLUDE,
      }),
      this.prisma.categoryCard.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toPublicResponse(item)),
      total,
      skip,
      take,
    };
  }

  async listAdmin(skip: number, take: number, categoryId?: string) {
    const where = categoryId ? { categoryId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.categoryCard.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: ADMIN_INCLUDE,
      }),
      this.prisma.categoryCard.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toAdminResponse(item)),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string): Promise<CategoryCardAdminResponse> {
    return this.toAdminResponse(await this.findOrThrow(id));
  }

  async create(
    dto: CreateCategoryCardDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<CategoryCardAdminResponse> {
    await this.assertOwnership(dto.categoryId, dto.targetServiceId);

    const card = await this.prisma.categoryCard.create({
      data: {
        categoryId: dto.categoryId,
        targetServiceId: dto.targetServiceId,
        title: dto.title,
        subtitle: dto.subtitle,
        badge: dto.badge,
        mediaAssetId: dto.mediaAssetId,
        highlights: dto.highlights ?? [],
        sortOrder: dto.sortOrder ?? 0,
        active: dto.active ?? true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
      include: ADMIN_INCLUDE,
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'CategoryCard',
      resourceId: card.id,
      afterJson: {
        title: card.title,
        categoryId: card.categoryId,
        targetServiceId: card.targetServiceId,
        active: card.active,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(card);
  }

  async update(
    id: string,
    dto: UpdateCategoryCardDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<CategoryCardAdminResponse> {
    const before = await this.findOrThrow(id);

    // Re-validate ownership whenever either side of the relationship
    // could change — using whichever value the request supplies, falling
    // back to the existing row's own value, so a partial update (e.g.
    // only `title`) never skips the check against its real, current
    // relationship.
    const nextCategoryId = dto.categoryId ?? before.categoryId;
    const nextTargetServiceId = dto.targetServiceId ?? before.targetServiceId;
    if (dto.categoryId || dto.targetServiceId) {
      await this.assertOwnership(nextCategoryId, nextTargetServiceId);
    }

    const card = await this.prisma.categoryCard.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
      include: ADMIN_INCLUDE,
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'CategoryCard',
      resourceId: id,
      beforeJson: {
        title: before.title,
        categoryId: before.categoryId,
        targetServiceId: before.targetServiceId,
        active: before.active,
      },
      afterJson: {
        title: card.title,
        categoryId: card.categoryId,
        targetServiceId: card.targetServiceId,
        active: card.active,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.toAdminResponse(card);
  }

  async reorder(
    dto: ReorderCategoryCardsDto,
    adminUserId: string,
    meta: SessionMeta,
  ) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.categoryCard.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder, updatedBy: adminUserId },
        }),
      ),
    );
    await this.auditLog.record({
      adminUserId,
      action: 'REORDER',
      resourceType: 'CategoryCard',
      afterJson: { items: dto.items },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.listAdmin(0, 100);
  }

  /**
   * SERVICES-R5.21 — the task's explicit "validate category/service
   * ownership" requirement: re-fetches the real Category and Service rows
   * (never trusts a client-supplied relationship, same discipline as
   * `OrdersService`/`CardProductsService`) and asserts the target Service
   * actually belongs to the given Category. A CategoryCard pointing at a
   * Service from a DIFFERENT Category would silently misrepresent the
   * business relationship this whole domain is built on
   * (Category -> CategoryCard -> Service) — rejected outright, not just a
   * UI-layer suggestion.
   */
  private async assertOwnership(
    categoryId: string,
    targetServiceId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new UnprocessableEntityException(
        'دسته‌بندی انتخاب‌شده معتبر نیست.',
      );
    }
    const service = await this.prisma.service.findUnique({
      where: { id: targetServiceId },
    });
    if (!service) {
      throw new UnprocessableEntityException('خدمت انتخاب‌شده معتبر نیست.');
    }
    if (service.categoryId !== categoryId) {
      throw new UnprocessableEntityException(
        'خدمت انتخاب‌شده متعلق به این دسته‌بندی نیست.',
      );
    }
  }

  private async findOrThrow(id: string): Promise<CardWithRelations> {
    const card = await this.prisma.categoryCard.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!card) throw new NotFoundException('کارت دسته‌بندی یافت نشد.');
    return card;
  }

  private toPublicResponse(
    card: CardWithRelations,
  ): CategoryCardPublicResponse {
    return {
      id: card.id,
      categoryId: card.categoryId,
      targetServiceId: card.targetServiceId,
      title: card.title,
      subtitle: card.subtitle,
      badge: card.badge,
      image: card.mediaAsset
        ? this.mediaStorage.resolvePublicUrl(card.mediaAsset.key)
        : null,
      highlights: card.highlights,
      sortOrder: card.sortOrder,
      priceAmount: this.resolvePriceAmount(card),
    };
  }

  /**
   * R5.26.2 price contract (Admin → DB → API → Customer round trip,
   * confirmed decision): the target Service's own ACTIVE CardProduct is
   * the ONLY source of truth for the price this card displays — never a
   * second, persisted field on CategoryCard.
   *   - exactly one ACTIVE CardProduct -> its priceAmount (may itself be
   *     null if the Admin hasn't set one yet — never fabricated).
   *   - zero ACTIVE CardProducts -> null. Not an error; most CategoryCards
   *     have no purchasable product yet (see the Services Catalog Reset
   *     report §6/§9 — e.g. موتور سیکلت).
   *   - more than one ACTIVE CardProduct -> genuinely ambiguous; per the
   *     confirmed decision this must "STOP and report the ambiguity, do
   *     not choose one arbitrarily." A single ambiguous card cannot be
   *     allowed to fail the whole `/category-cards` list for every other
   *     card, so this logs a loud warning identifying the exact
   *     CategoryCard/Service and returns `null` for that card only —
   *     never silently picks the first/cheapest/newest one. No real
   *     Service has more than one ACTIVE CardProduct today (confirmed),
   *     so this branch is not currently reachable in practice.
   */
  private resolvePriceAmount(card: CardWithRelations): number | null {
    const cardProducts = card.targetService?.cardProducts ?? [];
    if (cardProducts.length === 0) return null;
    if (cardProducts.length === 1) return cardProducts[0].priceAmount;
    this.logger.warn(
      `CategoryCard ${card.id} ("${card.title}") target Service ${card.targetServiceId} has ${cardProducts.length} ACTIVE CardProducts — price is ambiguous, returning null rather than guessing. Resolve this in Admin before this card's price can display.`,
    );
    return null;
  }

  private toAdminResponse(card: CardWithRelations): CategoryCardAdminResponse {
    return {
      ...this.toPublicResponse(card),
      mediaAssetId: card.mediaAssetId,
      active: card.active,
      targetService: card.targetService,
      category: card.category,
      createdBy: card.createdBy,
      updatedBy: card.updatedBy,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }
}
