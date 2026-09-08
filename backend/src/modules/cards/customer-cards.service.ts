import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Read-only, ownership-scoped to the authenticated user. SERVICES-R5.16
 * foundation — nothing creates a real CustomerCardInstance yet (see the
 * R5.16 contract doc), so these endpoints will genuinely return empty
 * results against real data today, the same way `GET /orders` did before
 * any real Order could be created (R5.1).
 */
@Injectable()
export class CustomerCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerCardInstance.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerCardInstance.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string) {
    const item = await this.prisma.customerCardInstance.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Card not found');
    return item;
  }

  async listUsage(id: string, userId: string, skip: number, take: number) {
    // Ownership check first — never leak whether another user's card id
    // exists via the usage sub-resource.
    await this.findOneOrThrow(id, userId);
    const where = { customerCardInstanceId: id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.usageTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.usageTransaction.count({ where }),
    ]);
    return { items, total, skip, take };
  }
}
