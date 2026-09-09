import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Service } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * SERVICES-R5.17 — Service becomes Admin-managed for the first time.
 * `list()`/`findOneOrThrow()` (public, unchanged since R1) are untouched;
 * the new `listAdmin()`/`create()`/`update()` methods follow the same Home
 * CMS CRUD+RBAC+audit-log pattern as CategoriesService.
 */
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count(),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.service.findFirst({
      where: { id },
    });
    if (!item) throw new NotFoundException('Services not found');
    return item;
  }

  async listAdmin(skip: number, take: number, categoryId?: string) {
    const where = categoryId ? { categoryId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      this.prisma.service.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async findOneAdmin(id: string): Promise<Service> {
    return this.findOrThrow(id);
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
        priceFrom: dto.priceFrom,
        priceLabel: dto.priceLabel,
        availableMethods: dto.availableMethods ?? [],
        installmentMinMonths: dto.installmentMinMonths,
        installmentMaxMonths: dto.installmentMaxMonths,
        creditMultiplierLabel: dto.creditMultiplierLabel,
        benefits: dto.benefits ?? [],
        galleryKeys: dto.galleryKeys ?? [],
        faq: [],
        tags: dto.tags ?? [],
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

    const service = await this.prisma.service.update({
      where: { id },
      data: { ...dto, updatedBy: adminUserId },
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

  private async findOrThrow(id: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException('خدمت یافت نشد.');
    return service;
  }
}
