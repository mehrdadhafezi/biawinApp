import { Injectable, NotFoundException } from '@nestjs/common';
import type { Payment, PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Owning service for the `payments` table. Orders/rewards call `record()` to
 * settle themselves rather than writing Payment rows directly (Module
 * Boundary Rule). Read endpoints here are scoped to the requesting user via
 * the owning order/rewardClaim.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    orderId?: string;
    rewardClaimId?: string;
    provider: PaymentProvider;
    amount: number;
    status: PaymentStatus;
    gatewayRef?: string;
  }): Promise<Payment> {
    return this.prisma.payment.create({ data: input });
  }

  async list(userId: string, skip: number, take: number) {
    const where = { OR: [{ order: { userId } }, { rewardClaim: { userId } }] };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, OR: [{ order: { userId } }, { rewardClaim: { userId } }] },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
