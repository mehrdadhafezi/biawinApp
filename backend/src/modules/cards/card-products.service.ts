import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Read-only, public. SERVICES-R5.16 foundation — no admin write surface yet
 * (see the R5.16 contract doc's "Admin Requirements" section for why).
 */
@Injectable()
export class CardProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(skip: number, take: number, serviceId?: string) {
    const where = { active: true, ...(serviceId ? { serviceId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cardProduct.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.cardProduct.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.cardProduct.findFirst({
      where: { id, active: true },
    });
    if (!item) throw new NotFoundException('Card product not found');
    return item;
  }
}
