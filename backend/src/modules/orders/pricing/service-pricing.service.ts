import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { PurchaseMethod, Service } from '@prisma/client';

/**
 * Resolves the amount actually charged for an order — the ONLY place an
 * Order's `amount` may come from (never the client, see CreateOrderDto).
 *
 * SERVICES-R5.1 verified live staging data before writing this: 0/108 real
 * services have a usable `priceFrom`, and 0/108 support `free`. So today
 * this always throws for `credit`/`installment`/`cash`. That is intentional
 * — a safely blocked checkout is preferred over inventing, hardcoding, or
 * deriving a fake price from the prototype (see the R5.1 report). Once a
 * real pricing source is decided, only this method needs to change.
 */
@Injectable()
export class ServicePricingService {
  resolveAuthoritativePrice(service: Service, method: PurchaseMethod): number {
    if (method === 'free') {
      return 0;
    }

    if (typeof service.priceFrom === 'number' && service.priceFrom > 0) {
      return service.priceFrom;
    }

    throw new UnprocessableEntityException(
      'Purchase unavailable: no authoritative price is configured for this service',
    );
  }
}
