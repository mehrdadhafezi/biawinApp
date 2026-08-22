import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateOrderDto } from './dto/create-order.dto';

/**
 * Foundation-level: creates the Order row in `pending` status. Wiring this up
 * to actually debit a wallet/credit line or start an installment schedule is
 * Feature-stage work (those mutations belong to WalletService/CreditService/
 * InstallmentsService, called from here once that logic is designed).
 */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        orderNumber: `BW-${randomBytes(4).toString('hex').toUpperCase()}`,
        userId,
        serviceId: dto.serviceId,
        method: dto.method,
        amount: dto.amount,
        status: 'pending',
      },
    });
  }

  async list(userId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
