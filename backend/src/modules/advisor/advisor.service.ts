import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AdvisorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.advisorPersona.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.advisorPersona.count(),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string) {
    const item = await this.prisma.advisorPersona.findFirst({
      where: { id },
    });
    if (!item) throw new NotFoundException('Advisor not found');
    return item;
  }
}
