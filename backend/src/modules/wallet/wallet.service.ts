import { BadRequestException, Injectable } from '@nestjs/common';
import type { Wallet, WalletKind, WalletTxType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Owning service for the `wallets`/`wallet_transactions` tables. Other modules
 * (orders, rewards, credit, ...) must call `credit()`/`debit()` here rather
 * than writing to Wallet/WalletTransaction directly (Module Boundary Rule,
 * docs/01-architecture.md §2.1) — this is also the only place that needs to
 * reason about the atomic balance-update transaction.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeWalletsForUser(userId: string): Promise<void> {
    await this.prisma.wallet.createMany({
      data: [
        { userId, kind: 'main' },
        { userId, kind: 'reward' },
      ],
      skipDuplicates: true,
    });
  }

  async listForUser(userId: string): Promise<Wallet[]> {
    return this.prisma.wallet.findMany({ where: { userId } });
  }

  async getOrThrow(userId: string, kind: WalletKind): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_kind: { userId, kind } },
    });
    if (!wallet)
      throw new BadRequestException(`Wallet "${kind}" not found for user`);
    return wallet;
  }

  /** Atomically increases a wallet's balance and appends the audit transaction row. */
  async credit(
    userId: string,
    kind: WalletKind,
    amount: number,
    type: Extract<WalletTxType, 'topup' | 'refund'>,
    description: string,
    relatedOrderId?: string,
    relatedRewardClaimId?: string,
  ): Promise<Wallet> {
    if (amount <= 0) throw new BadRequestException('amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId_kind: { userId, kind } },
        data: { balance: { increment: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceAfter: wallet.balance,
          description,
          relatedOrderId,
          relatedRewardClaimId,
        },
      });
      return wallet;
    });
  }

  /** Atomically decreases a wallet's balance; throws if it would go negative. */
  async debit(
    userId: string,
    kind: WalletKind,
    amount: number,
    type: Extract<WalletTxType, 'spend' | 'gateway_settlement'>,
    description: string,
    relatedOrderId?: string,
    relatedRewardClaimId?: string,
  ): Promise<Wallet> {
    if (amount <= 0) throw new BadRequestException('amount must be positive');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.wallet.findUniqueOrThrow({
        where: { userId_kind: { userId, kind } },
      });
      if (current.balance < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }
      const wallet = await tx.wallet.update({
        where: { userId_kind: { userId, kind } },
        data: { balance: { decrement: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceAfter: wallet.balance,
          description,
          relatedOrderId,
          relatedRewardClaimId,
        },
      });
      return wallet;
    });
  }

  async listTransactions(
    userId: string,
    kind: WalletKind,
    skip: number,
    take: number,
  ) {
    const wallet = await this.getOrThrow(userId, kind);
    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
