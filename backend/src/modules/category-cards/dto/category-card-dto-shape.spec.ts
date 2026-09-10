import { getMetadataStorage } from 'class-validator';
import { CreateCategoryCardDto } from './create-category-card.dto';
import { UpdateCategoryCardDto } from './update-category-card.dto';

/**
 * SERVICES-R5.21 — dedicated proof that a Content Editor cannot touch
 * Service pricing or CardProduct data through the CategoryCard admin
 * surface, structurally, not just by convention: no field shaped like
 * `priceAmount`/`valueAmount`/`priceLabel`/`status`/`cardType`/
 * `journeyType`/`cardProductId` exists anywhere on either DTO class. The
 * deployed global `ValidationPipe({ whitelist: true,
 * forbidNonWhitelisted: true })` (backend/src/main.ts) rejects any field
 * not declared on the DTO with 400 — so this is the real, complete list
 * of what a client (including the Admin frontend) can ever set.
 */
function declaredPropertyNames(
  target: new (...args: never[]) => unknown,
): string[] {
  return getMetadataStorage()
    .getTargetValidationMetadatas(target, '', false, false)
    .map((m) => m.propertyName)
    .filter((name, index, all) => all.indexOf(name) === index);
}

const FORBIDDEN_FIELDS = [
  'priceAmount',
  'valueAmount',
  'valueDisplayType',
  'priceLabel',
  'status',
  'cardType',
  'journeyType',
  'cardProductId',
  'validityDays',
  'providerConfig',
];

describe('CategoryCard DTOs never expose a CardProduct/pricing/purchase-logic field', () => {
  it.each([
    ['CreateCategoryCardDto', CreateCategoryCardDto],
    ['UpdateCategoryCardDto', UpdateCategoryCardDto],
  ])('%s declares none of the forbidden fields', (_name, DtoClass) => {
    const properties = declaredPropertyNames(DtoClass);
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(properties).not.toContain(forbidden);
    }
  });

  it('CreateCategoryCardDto declares exactly the discovery/marketing fields the task specifies', () => {
    const properties = declaredPropertyNames(CreateCategoryCardDto).sort();
    expect(properties).toEqual(
      [
        'categoryId',
        'targetServiceId',
        'title',
        'subtitle',
        'badge',
        'mediaAssetId',
        'highlights',
        'sortOrder',
        'active',
      ].sort(),
    );
  });
});
