import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(skip: number, take: number, userId: string) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.installment.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.installment.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string) {
    const item = await this.prisma.installment.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Installments not found');
    return item;
  }
}
