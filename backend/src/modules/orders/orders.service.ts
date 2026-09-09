import {
  BadRequestException,
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
import { CardProductPricingService } from './pricing/card-product-pricing.service';

interface ResolvedPurchase {
  serviceId: string;
  cardProductId: string | null;
  method: Order['method'];
  amount: number;
  resolvedMerchantId: string | null;
}

/**
 * SERVICES-R5.1 transaction domain foundation, extended by SERVICES-R5.19 to
 * also purchase a `CardProduct` (see docs/services-r5-19-card-product-
 * purchase-order-foundation.md). `create()` is still the single server-side
 * purchase command for BOTH shapes. It never accepts a trusted final
 * amount, always re-derives every relationship from real rows, always
 * resolves price server-side, and enforces idempotency at both the
 * application and database level.
 *
 * Deliberately NOT done here, for either shape (see the R5.19 report): no
 * wallet debit, no payment-gateway call, no installment schedule creation,
 * no CustomerCardInstance issuance. Orders are only ever created in
 * `pending` status.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ServicePricingService,
    private readonly cardProductPricing: CardProductPricingService,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<Order> {
    if (dto.serviceId && dto.cardProductId) {
      throw new BadRequestException(
        'Provide either serviceId or cardProductId, not both',
      );
    }
    if (!dto.serviceId && !dto.cardProductId) {
      throw new BadRequestException(
        'Either serviceId or cardProductId is required',
      );
    }
    if (dto.cardProductId && dto.merchantId) {
      throw new BadRequestException(
        'merchantId is not accepted for a CardProduct purchase — it is always derived server-side',
      );
    }

    const existing = await this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey },
      },
    });
    if (existing) {
      this.assertReplayMatchesRequest(existing, dto);
      return existing;
    }

    const resolved = dto.cardProductId
      ? await this.validateAndPriceCardProduct(dto.cardProductId)
      : await this.validateAndPriceService(dto);

    try {
      return await this.prisma.order.create({
        data: {
          orderNumber: `BW-${randomBytes(4).toString('hex').toUpperCase()}`,
          userId,
          serviceId: resolved.serviceId,
          cardProductId: resolved.cardProductId,
          merchantId: resolved.resolvedMerchantId,
          method: resolved.method,
          amount: resolved.amount,
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
   * SERVICES-R5.1 legacy path — validates every server-independently-
   * checkable domain relationship and resolves the authoritative price for
   * a Service purchase. Category/method data supplied by the frontend is
   * never used as financial authority — only the live Service and Merchant
   * rows are. Unchanged from R5.1/R5.18.
   */
  private async validateAndPriceService(
    dto: CreateOrderDto,
  ): Promise<ResolvedPurchase> {
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

    const resolvedMerchantId = await this.resolveMerchant(
      service.merchantId,
      dto.merchantId,
    );
    const amount = this.pricing.resolveAuthoritativePrice(service, dto.method!);

    return {
      serviceId: service.id,
      cardProductId: null,
      method: dto.method!,
      amount,
      resolvedMerchantId,
    };
  }

  /**
   * SERVICES-R5.19 — validates every purchase-eligibility rule for a
   * CardProduct and resolves the authoritative payable price. Mirrors
   * `validateAndPriceService`'s discipline (re-fetch real rows, never trust
   * a client relationship hint) for the new purchasable entity. See
   * docs/services-r5-19-card-product-purchase-order-foundation.md §7.
   */
  private async validateAndPriceCardProduct(
    cardProductId: string,
  ): Promise<ResolvedPurchase> {
    const cardProduct = await this.prisma.cardProduct.findUnique({
      where: { id: cardProductId },
    });
    if (!cardProduct) {
      throw new NotFoundException('Card product not found');
    }
    if (cardProduct.status !== 'ACTIVE') {
      throw new UnprocessableEntityException('Card product is not active');
    }
    if (cardProduct.journeyType !== 'PURCHASE') {
      throw new UnprocessableEntityException(
        'This card product is not available for direct purchase',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: cardProduct.serviceId },
    });
    if (!service) {
      // Defensive only — Service.onDelete: Restrict on CardProduct.service
      // makes this practically unreachable, never assumed elsewhere.
      throw new NotFoundException('Service not found');
    }
    if (!service.active) {
      throw new UnprocessableEntityException('Service is not active');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: service.categoryId },
    });
    if (!category || !category.active) {
      throw new UnprocessableEntityException('Category is not active');
    }

    const resolvedMerchantId = await this.resolveMerchant(
      service.merchantId,
      undefined,
    );
    const amount =
      this.cardProductPricing.resolveAuthoritativePrice(cardProduct);

    return {
      serviceId: service.id,
      cardProductId: cardProduct.id,
      method: null,
      amount,
      resolvedMerchantId,
    };
  }

  /**
   * Shared by both purchase shapes — a Service's Merchant relationship is
   * re-derived from the live Service row either way (SERVICES-R5.1's
   * "never client-trusted" invariant, reused verbatim for the CardProduct
   * path). `clientMerchantId` is only ever passed for the legacy shape —
   * the CardProduct shape rejects a client-supplied merchantId before this
   * is ever called (see `create()`).
   */
  private async resolveMerchant(
    serviceMerchantId: string | null,
    clientMerchantId: string | undefined,
  ): Promise<string | null> {
    if (!serviceMerchantId) {
      if (clientMerchantId) {
        throw new UnprocessableEntityException(
          'Merchant does not match this service',
        );
      }
      return null;
    }
    if (clientMerchantId && clientMerchantId !== serviceMerchantId) {
      throw new UnprocessableEntityException(
        'Merchant does not match this service',
      );
    }
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: serviceMerchantId },
    });
    if (!merchant || !merchant.active) {
      throw new UnprocessableEntityException(
        'Merchant is not available for this service',
      );
    }
    return merchant.id;
  }

  /**
   * A retried request with the same idempotency key must be provably the
   * same purchase intent, not just any request that happens to reuse the
   * key. Branches on what the ORIGINAL Order actually recorded
   * (`existing.cardProductId`), not on what shape the retry happens to send
   * — a retry that omits `cardProductId` must never be treated as matching
   * a CardProduct-purchase original just because it happens to name the
   * same (server-derived) `serviceId` (SERVICES-R5.19 fix; see the R5.19
   * report §10 for why comparing on the retry's own shape would have been
   * unsound). `merchantId` is only compared for the legacy shape, and only
   * when the client supplied one on the retry — it is a client-side hint,
   * never the source of truth (see validateAndPriceService).
   */
  private assertReplayMatchesRequest(
    existing: Order,
    dto: CreateOrderDto,
  ): void {
    if (existing.cardProductId) {
      if (existing.cardProductId !== dto.cardProductId) {
        throw new ConflictException(
          'Idempotency key was already used for a different purchase request',
        );
      }
      return;
    }

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
