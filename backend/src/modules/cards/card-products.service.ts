import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CardProduct, MediaAsset } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateCardProductDto } from './dto/create-card-product.dto';
import type { UpdateCardProductDto } from './dto/update-card-product.dto';

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

type CardProductWithMedia = CardProduct & { mediaAsset: MediaAsset | null };

/**
 * SERVICES-R5.16 foundation, SERVICES-R5.17 adds Admin management.
 * `list()`/`findOneOrThrow()` are public — only `status: ACTIVE` card
 * products are ever visible there (DRAFT/INACTIVE/EXPIRED are Admin-only),
 * per this stage's explicit "inactive products must not be visible to
 * customer APIs" rule. `status` replaced R5.16's boolean `active` field
 * outright (see the migration/schema comment) — `card_products` had zero
 * real rows, so this was a safe, non-breaking rename-with-richer-values.
 *
 * SERVICES-R5.22 — every read now resolves a real `image` URL from
 * `mediaAssetId` (same mechanism as `CategoriesService`/`ServicesService`)
 * additively — every field this module already returned is unchanged.
 */
@Injectable()
export class CardProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async list(skip: number, take: number, serviceId?: string) {
    const where = {
      status: 'ACTIVE' as const,
      ...(serviceId ? { serviceId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cardProduct.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { mediaAsset: true },
      }),
      this.prisma.cardProduct.count({ where }),
    ]);
    return {
      items: items.map((item) => this.withImage(item)),
      total,
      skip,
      take,
    };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.cardProduct.findFirst({
      where: { id, status: 'ACTIVE' },
      include: { mediaAsset: true },
    });
    if (!item) throw new NotFoundException('Card product not found');
    return this.withImage(item);
  }

  async listAdmin(skip: number, take: number, serviceId?: string) {
    const where = serviceId ? { serviceId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cardProduct.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { service: true, mediaAsset: true },
      }),
      this.prisma.cardProduct.count({ where }),
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
    dto: CreateCardProductDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<CardProduct> {
    await this.assertServiceExists(dto.serviceId);

    const cardProduct = await this.prisma.cardProduct.create({
      data: {
        serviceId: dto.serviceId,
        title: dto.title,
        subtitle: dto.subtitle,
        description: dto.description,
        imageKey: dto.imageKey,
        mediaAssetId: dto.mediaAssetId,
        badge: dto.badge,
        cardType: dto.cardType,
        journeyType: dto.journeyType,
        priceAmount: dto.priceAmount,
        priceLabel: dto.priceLabel,
        valueAmount: dto.valueAmount,
        valueDisplayType: dto.valueDisplayType,
        benefits: dto.benefits ?? [],
        validityDays: dto.validityDays,
        status: dto.status ?? 'DRAFT',
        sortOrder: dto.sortOrder ?? 0,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'CardProduct',
      resourceId: cardProduct.id,
      afterJson: {
        title: cardProduct.title,
        serviceId: cardProduct.serviceId,
        status: cardProduct.status,
        priceAmount: cardProduct.priceAmount,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return cardProduct;
  }

  async update(
    id: string,
    dto: UpdateCardProductDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<CardProduct> {
    const before = await this.findOrThrow(id);
    if (dto.serviceId) await this.assertServiceExists(dto.serviceId);

    const cardProduct = await this.prisma.cardProduct.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'CardProduct',
      resourceId: id,
      beforeJson: {
        title: before.title,
        status: before.status,
        priceAmount: before.priceAmount,
      },
      afterJson: {
        title: cardProduct.title,
        status: cardProduct.status,
        priceAmount: cardProduct.priceAmount,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return cardProduct;
  }

  private async assertServiceExists(serviceId: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new UnprocessableEntityException('خدمت انتخاب‌شده معتبر نیست.');
    }
  }

  private async findOrThrow(id: string): Promise<CardProductWithMedia> {
    const cardProduct = await this.prisma.cardProduct.findUnique({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!cardProduct) throw new NotFoundException('محصول کارتی یافت نشد.');
    return cardProduct;
  }

  private withImage(cardProduct: CardProductWithMedia) {
    const { mediaAsset, ...rest } = cardProduct;
    return {
      ...rest,
      image: mediaAsset
        ? this.mediaStorage.resolvePublicUrl(mediaAsset.key)
        : null,
    };
  }
}
