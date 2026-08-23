import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateOrbitItemDto } from './dto/create-orbit-item.dto';
import { ReorderOrbitItemsDto } from './dto/reorder-orbit-items.dto';
import { UpdateOrbitItemDto } from './dto/update-orbit-item.dto';

@Injectable()
export class OrbitItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public catalog for the Landing Orbit — active items only, sorted for
   * render order. `imageUrl` is resolved from `imageKey` via a static-asset
   * bridge (`/orbit/{filename}`, served by the web app) rather than a
   * presigned MinIO URL: MinIO is intentionally not publicly reachable
   * (loopback-only, an earlier infra decision) and a presigned URL's
   * expiry would break image caching on a public landing page. `imageKey`
   * remains the durable Media Library identifier for whenever real
   * public object-storage serving is stood up.
   */
  async listPublic() {
    const items = await this.prisma.orbitItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.toPublicShape(item));
  }

  async create(dto: CreateOrbitItemDto) {
    const item = await this.prisma.orbitItem.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        categoryId: dto.categoryId,
        imageKey: dto.imageKey,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        positionConfig: dto.positionConfig as unknown as Prisma.InputJsonValue,
        animationConfig:
          dto.animationConfig as unknown as Prisma.InputJsonValue,
      },
    });
    return item;
  }

  async update(id: string, dto: UpdateOrbitItemDto) {
    await this.findOneOrThrow(id);
    return this.prisma.orbitItem.update({
      where: { id },
      data: {
        slug: dto.slug,
        title: dto.title,
        categoryId: dto.categoryId,
        imageKey: dto.imageKey,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        positionConfig: dto.positionConfig as unknown as Prisma.InputJsonValue,
        animationConfig:
          dto.animationConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.orbitItem.delete({ where: { id } });
    return { id };
  }

  async reorder(dto: ReorderOrbitItemsDto) {
    await this.prisma.$transaction(
      dto.items.map((entry) =>
        this.prisma.orbitItem.update({
          where: { id: entry.id },
          data: { sortOrder: entry.sortOrder },
        }),
      ),
    );
    return this.listPublic();
  }

  private async findOneOrThrow(id: string) {
    const item = await this.prisma.orbitItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Orbit item not found');
    return item;
  }

  private toPublicShape(item: {
    id: string;
    title: string;
    imageKey: string | null;
    sortOrder: number;
    isActive: boolean;
    positionConfig: Prisma.JsonValue;
    animationConfig: Prisma.JsonValue;
  }) {
    return {
      id: item.id,
      title: item.title,
      imageKey: item.imageKey,
      imageUrl: this.resolveImageUrl(item.imageKey),
      sortOrder: item.sortOrder,
      position: item.positionConfig,
      animation: item.animationConfig,
      active: item.isActive,
    };
  }

  private resolveImageUrl(imageKey: string | null): string | null {
    if (!imageKey) return null;
    const filename = imageKey.split('/').pop();
    return `/orbit/${filename}`;
  }
}
