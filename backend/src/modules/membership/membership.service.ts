import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Entry point for a subscription/redemption code entered at signup
   * (`auth` calls this — the code is intentionally never persisted on `User`,
   * see docs/03-api.md). Real validation against a code catalog and the
   * resulting `Membership`/`Wallet` activation is Feature-stage work; for now
   * this only records that a code was received, so the integration boundary
   * is correct from day one.
   */
  registerSubscriptionCode(userId: string, code: string): Promise<void> {
    this.logger.log(
      `Received subscription code for user ${userId} (pending real redemption logic — Feature-stage): "${code}"`,
    );
    return Promise.resolve();
  }

  async list(skip: number, take: number, userId: string) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.membership.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOneOrThrow(id: string, userId: string) {
    const item = await this.prisma.membership.findFirst({
      where: { id, userId },
    });
    if (!item) throw new NotFoundException('Membership not found');
    return item;
  }
}
