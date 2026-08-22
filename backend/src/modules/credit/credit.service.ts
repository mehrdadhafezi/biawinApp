import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(skip: number, take: number, userId: string) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.creditLine.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditLine.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string) {
    const item = await this.prisma.creditLine.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Credit not found');
    return item;
  }
}
