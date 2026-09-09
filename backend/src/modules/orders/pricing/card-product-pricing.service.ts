import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { CardProduct } from '@prisma/client';

/**
 * SERVICES-R5.19 — resolves the amount actually charged for a CardProduct
 * purchase. The ONLY place a CardProduct-purchase Order's `amount` may come
 * from (never the client, see CreateOrderDto).
 *
 * Deliberately a separate class from `ServicePricingService`, not a rename
 * of it: the Service-purchase path (R5.1) still needs Service-shaped
 * pricing (method-aware, `Service.priceFrom`-sourced) exactly as it always
 * has, and continues to use `ServicePricingService` unchanged. CardProduct
 * is a different purchasable entity with a different authoritative source
 * (`CardProduct.priceAmount`, Admin-set, per SERVICES-R5.2.1's resolved
 * Model A decision) and no `method` concept at all — giving it its own
 * resolver avoids either overloading `ServicePricingService` with a second,
 * unrelated entity shape or misappropriating its Service-only name. See
 * docs/services-r5-19-card-product-purchase-order-foundation.md §5.
 *
 * CRITICAL: `priceAmount` is the amount the customer pays Biawin — NEVER
 * the card's displayed commercial value (`CardProduct.valueAmount`). This
 * resolver only ever reads `priceAmount`; it must never read `valueAmount`.
 */
@Injectable()
export class CardProductPricingService {
  resolveAuthoritativePrice(cardProduct: CardProduct): number {
    if (
      typeof cardProduct.priceAmount === 'number' &&
      cardProduct.priceAmount > 0
    ) {
      return cardProduct.priceAmount;
    }

    throw new UnprocessableEntityException(
      'Purchase unavailable: no authoritative price is configured for this card product',
    );
  }
}
