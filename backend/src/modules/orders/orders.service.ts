import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type Order } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import { ServicePricingService } from './pricing/service-pricing.service';

/**
 * SERVICES-R5.1 transaction domain foundation.
 *
 * `create()` is the single server-side purchase command. It never accepts a
 * trusted final amount, always re-derives the merchant relationship from the
 * real Service row, always resolves price via ServicePricingService, and
 * enforces idempotency at both the application and database level.
 *
 * Deliberately NOT done here (see docs/services-r5-1-transaction-domain-foundation.md):
 * no wallet debit, no payment-gateway call, no installment schedule creation.
 * Orders are only ever created in `pending` status.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ServicePricingService,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<Order> {
    const existing = await this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey },
      },
    });
    if (existing) {
      this.assertReplayMatchesRequest(existing, dto);
      return existing;
    }

    const { amount, resolvedMerchantId } = await this.validateAndPrice(dto);

    try {
      return await this.prisma.order.create({
        data: {
          orderNumber: `BW-${randomBytes(4).toString('hex').toUpperCase()}`,
          userId,
          serviceId: dto.serviceId,
          merchantId: resolvedMerchantId,
          method: dto.method,
          amount,
          status: 'pending',
          idempotencyKey: dto.idempotencyKey,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raceExisting = await this.prisma.order.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (raceExisting) {
          this.assertReplayMatchesRequest(raceExisting, dto);
          return raceExisting;
        }
      }
      throw err;
    }
  }

  /**
   * Validates every server-independently-checkable domain relationship and
   * resolves the authoritative price. Category/method data supplied by the
   * frontend is never used as financial authority — only the live Service
   * and Merchant rows are.
   */
  private async validateAndPrice(
    dto: CreateOrderDto,
  ): Promise<{ amount: number; resolvedMerchantId: string | null }> {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    if (!service.active) {
      throw new UnprocessableEntityException('Service is not active');
    }

    const availableMethods = Array.isArray(service.availableMethods)
      ? (service.availableMethods as unknown[])
      : [];
    if (!availableMethods.includes(dto.method)) {
      throw new UnprocessableEntityException(
        'Purchase method is not available for this service',
      );
    }

    let resolvedMerchantId: string | null = null;
    if (service.merchantId) {
      if (dto.merchantId && dto.merchantId !== service.merchantId) {
        throw new UnprocessableEntityException(
          'Merchant does not match this service',
        );
      }
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: service.merchantId },
      });
      if (!merchant || !merchant.active) {
        throw new UnprocessableEntityException(
          'Merchant is not available for this service',
        );
      }
      resolvedMerchantId = merchant.id;
    } else if (dto.merchantId) {
      throw new UnprocessableEntityException(
        'Merchant does not match this service',
      );
    }

    const amount = this.pricing.resolveAuthoritativePrice(service, dto.method);

    return { amount, resolvedMerchantId };
  }

  /**
   * A retried request with the same idempotency key must be provably the
   * same purchase intent, not just any request that happens to reuse the
   * key. `merchantId` is only compared when the client supplied one on the
   * retry — it is a client-side hint, never the source of truth (see
   * validateAndPrice).
   */
  private assertReplayMatchesRequest(
    existing: Order,
    dto: CreateOrderDto,
  ): void {
    const sameCore =
      existing.serviceId === dto.serviceId && existing.method === dto.method;
    const merchantConsistent =
      dto.merchantId === undefined || dto.merchantId === existing.merchantId;
    if (!sameCore || !merchantConsistent) {
      throw new ConflictException(
        'Idempotency key was already used for a different purchase request',
      );
    }
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
