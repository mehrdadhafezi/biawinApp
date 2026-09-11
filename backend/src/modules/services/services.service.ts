import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { MediaAsset, Prisma, Service } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

type ServiceWithMedia = Service & { mediaAsset: MediaAsset | null };

/**
 * SERVICES-R5.17 — Service becomes Admin-managed for the first time.
 * `list()`/`findOneOrThrow()` (public, unchanged since R1) are untouched;
 * the new `listAdmin()`/`create()`/`update()` methods follow the same Home
 * CMS CRUD+RBAC+audit-log pattern as CategoriesService.
 *
 * SERVICES-R5.22 — every read now resolves a real `image` URL (from
 * `mediaAssetId`) and a real `gallery` URL array (from
 * `galleryMediaAssetIds`, a plain JSON id array — resolved with one extra
 * `MediaAsset.findMany` per read rather than a Prisma `include`, since a
 * JSON array of ids isn't a real Prisma relation). Every field this
 * module already returned is still returned unchanged — `image`/`gallery`
 * are purely additive. `create()`/`update()` also stop dropping `faq`
 * silently (previously hardcoded to `[]` in `create()`, entirely absent
 * from `UpdateServiceDto` — a confirmed gap despite `Service.faq` already
 * existing on the schema and already being rendered by `ServiceInfo.tsx`
 * since R1) and gain `description`/`usageGuide`/`terms`/
 * `galleryMediaAssetIds`/`mediaAssetId`.
 */
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { mediaAsset: true },
      }),
      this.prisma.service.count(),
    ]);
    return {
      items: await Promise.all(items.map((item) => this.withMedia(item))),
      total,
      skip,
      take,
    };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.service.findFirst({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!item) throw new NotFoundException('Services not found');
    return this.withMedia(item);
  }

  async listAdmin(skip: number, take: number, categoryId?: string) {
    const where = categoryId ? { categoryId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, mediaAsset: true },
      }),
      this.prisma.service.count({ where }),
    ]);
    return {
      items: await Promise.all(items.map((item) => this.withMedia(item))),
      total,
      skip,
      take,
    };
  }

  async findOneAdmin(id: string) {
    return this.withMedia(await this.findOrThrow(id));
  }

  async create(
    dto: CreateServiceDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<Service> {
    await this.assertCategoryExists(dto.categoryId);
    if (dto.merchantId) await this.assertMerchantExists(dto.merchantId);

    const service = await this.prisma.service.create({
      data: {
        categoryId: dto.categoryId,
        merchantId: dto.merchantId,
        title: dto.title,
        groupLabel: dto.groupLabel,
        subtitle: dto.subtitle,
        badge: dto.badge,
        icon: dto.icon,
        imageKey: dto.imageKey,
        mediaAssetId: dto.mediaAssetId,
        galleryMediaAssetIds: dto.galleryMediaAssetIds ?? [],
        description: dto.description,
        priceFrom: dto.priceFrom,
        priceLabel: dto.priceLabel,
        availableMethods: dto.availableMethods ?? [],
        installmentMinMonths: dto.installmentMinMonths,
        installmentMaxMonths: dto.installmentMaxMonths,
        creditMultiplierLabel: dto.creditMultiplierLabel,
        benefits: dto.benefits ?? [],
        galleryKeys: dto.galleryKeys ?? [],
        faq: (dto.faq ?? []) as unknown as Prisma.InputJsonValue,
        tags: dto.tags ?? [],
        usageGuide: dto.usageGuide ?? [],
        terms: dto.terms ?? [],
        active: dto.active ?? true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'CREATE',
      resourceType: 'Service',
      resourceId: service.id,
      afterJson: {
        title: service.title,
        categoryId: service.categoryId,
        active: service.active,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    adminUserId: string,
    meta: SessionMeta,
  ): Promise<Service> {
    const before = await this.findOrThrow(id);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    if (dto.merchantId) await this.assertMerchantExists(dto.merchantId);

    const { faq, ...rest } = dto;
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...rest,
        ...(faq !== undefined
          ? { faq: faq as unknown as Prisma.InputJsonValue }
          : {}),
        updatedBy: adminUserId,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: 'UPDATE',
      resourceType: 'Service',
      resourceId: id,
      beforeJson: {
        title: before.title,
        priceFrom: before.priceFrom,
        active: before.active,
      },
      afterJson: {
        title: service.title,
        priceFrom: service.priceFrom,
        active: service.active,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return service;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new UnprocessableEntityException(
        'دسته‌بندی انتخاب‌شده معتبر نیست.',
      );
    }
  }

  private async assertMerchantExists(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new UnprocessableEntityException('فروشنده انتخاب‌شده معتبر نیست.');
    }
  }

  private async findOrThrow(id: string): Promise<ServiceWithMedia> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { mediaAsset: true },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد.');
    return service;
  }

  /**
   * Resolves both the single main image and the gallery. `galleryMediaAssetIds`
   * is a plain JSON string array (not a real Prisma relation — see this
   * service's own doc comment), so the gallery is resolved with one extra
   * query per read rather than a Prisma `include`. A ROW that no longer
   * exists (e.g. its MediaAsset was later removed) is silently dropped
   * from the resolved gallery — never a broken image URL — same "no
   * fabricated image" discipline as everywhere else in this codebase.
   */
  private async withMedia(service: ServiceWithMedia) {
    const { mediaAsset, ...rest } = service;
    const galleryIds = Array.isArray(service.galleryMediaAssetIds)
      ? (service.galleryMediaAssetIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];

    let gallery: string[] = [];
    if (galleryIds.length > 0) {
      const assets = await this.prisma.mediaAsset.findMany({
        where: { id: { in: galleryIds } },
      });
      const byId = new Map(assets.map((a) => [a.id, a]));
      gallery = galleryIds
        .map((id) => byId.get(id))
        .filter((a): a is MediaAsset => !!a)
        .map((a) => this.mediaStorage.resolvePublicUrl(a.key));
    }

    return {
      ...rest,
      image: mediaAsset
        ? this.mediaStorage.resolvePublicUrl(mediaAsset.key)
        : null,
      gallery,
    };
  }
}
