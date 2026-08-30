import { UnprocessableEntityException } from '@nestjs/common';
import type { Service } from '@prisma/client';
import { ServicePricingService } from './service-pricing.service';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 's1',
    categoryId: 'c1',
    merchantId: null,
    title: 't',
    groupLabel: 'g',
    subtitle: 's',
    badge: 'b',
    icon: null,
    imageKey: null,
    priceFrom: null,
    priceLabel: null,
    availableMethods: [],
    installmentMinMonths: null,
    installmentMaxMonths: null,
    creditMultiplierLabel: null,
    benefits: [],
    galleryKeys: [],
    faq: [],
    tags: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ServicePricingService', () => {
  const pricing = new ServicePricingService();

  it('resolves the free method to 0 regardless of priceFrom', () => {
    expect(
      pricing.resolveAuthoritativePrice(
        makeService({ priceFrom: null }),
        'free',
      ),
    ).toBe(0);
  });

  it('resolves a positive priceFrom for a priced method', () => {
    expect(
      pricing.resolveAuthoritativePrice(
        makeService({ priceFrom: 150000 }),
        'cash',
      ),
    ).toBe(150000);
  });

  it('blocks the purchase when priceFrom is null (the real state of every current service)', () => {
    expect(() =>
      pricing.resolveAuthoritativePrice(
        makeService({ priceFrom: null }),
        'cash',
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it('blocks the purchase when priceFrom is zero or negative', () => {
    expect(() =>
      pricing.resolveAuthoritativePrice(
        makeService({ priceFrom: 0 }),
        'credit',
      ),
    ).toThrow(UnprocessableEntityException);
  });
});
