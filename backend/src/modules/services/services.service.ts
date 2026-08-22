import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
