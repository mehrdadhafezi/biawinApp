import { UnprocessableEntityException } from '@nestjs/common';
import type { CardProduct } from '@prisma/client';
import { CardProductPricingService } from './card-product-pricing.service';

function makeCardProduct(overrides: Partial<CardProduct> = {}): CardProduct {
  return {
    id: 'card-1',
    serviceId: 'service-1',
    title: 't',
    subtitle: null,
    description: null,
    imageKey: null,
    mediaAssetId: null,
    badge: null,
    cardType: 'CREDIT_CARD',
    journeyType: 'PURCHASE',
    priceAmount: null,
    priceLabel: null,
    valueAmount: null,
    valueDisplayType: null,
    benefits: [],
    validityDays: null,
    providerConfig: null,
    status: 'ACTIVE',
    sortOrder: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * SERVICES-R5.19 — mirrors `service-pricing.service.spec.ts` exactly, for
 * the sibling resolver. `priceAmount` is the ONLY field this resolver may
 * ever read — it must never read `valueAmount` (the card's displayed
 * commercial value, a completely separate fact — see this service's own
 * doc comment and docs/services-r5-19-purchase-order-audit.md §10).
 */
describe('CardProductPricingService', () => {
  const pricing = new CardProductPricingService();

  it('resolves a positive priceAmount', () => {
    expect(
      pricing.resolveAuthoritativePrice(
        makeCardProduct({ priceAmount: 500000 }),
      ),
    ).toBe(500000);
  });

  it('blocks the purchase when priceAmount is null', () => {
    expect(() =>
      pricing.resolveAuthoritativePrice(makeCardProduct({ priceAmount: null })),
    ).toThrow(UnprocessableEntityException);
  });

  it('blocks the purchase when priceAmount is zero or negative', () => {
    expect(() =>
      pricing.resolveAuthoritativePrice(makeCardProduct({ priceAmount: 0 })),
    ).toThrow(UnprocessableEntityException);
  });

  it('never treats valueAmount as a substitute for priceAmount', () => {
    expect(() =>
      pricing.resolveAuthoritativePrice(
        makeCardProduct({
          priceAmount: null,
          valueAmount: 30000000,
          valueDisplayType: 'UP_TO',
        }),
      ),
    ).toThrow(UnprocessableEntityException);
  });
});
