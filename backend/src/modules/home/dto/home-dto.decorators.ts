import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Stage 5.16-B limits — each is >= 2x the largest value observed in real staging data (docs/STAGE-5.16-HOME-BACKEND-HARDENING-PLAN.md §4.1). */
export const HOME_SORT_ORDER_MAX = 100_000;
export const BODY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `''`/whitespace becomes `null` (what the Admin form already means by "blank"); non-strings are left for the validators to reject. */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * "Absent is fine, but if the key is present it must be valid" — used for every
 * NON-nullable optional field. Unlike `@IsOptional()` it does NOT let an explicit
 * `null` through: `null` on a NOT NULL column used to reach Prisma and surface as
 * a 500; it is now a 400. Nullable fields (`mediaAssetId`, `title`, `lead`,
 * `bodySlug`) keep `@IsOptional()` semantics inside their own decorators.
 */
export function HomeOptional() {
  return ValidateIf((_object: unknown, value: unknown) => value !== undefined);
}

/** Required-when-present text: trimmed, non-empty, bounded. Pair with `@IsOptional()` on update DTOs. */
export function HomeText(maxLength: number) {
  return applyDecorators(
    Transform(trim),
    IsString(),
    IsNotEmpty(),
    MaxLength(maxLength),
  );
}

/** Nullable text (`title`/`lead`): `null` is valid, blank normalizes to `null`, otherwise bounded. */
export function HomeNullableText(maxLength: number) {
  return applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsString(),
    MaxLength(maxLength),
  );
}

/** Nullable uuid reference (`mediaAssetId`): `null`/absent skip validation (`@IsOptional`), a value must be a uuid. */
export function HomeNullableUuid() {
  return applyDecorators(IsOptional(), IsUUID());
}

export function HomeSortOrder() {
  return applyDecorators(
    HomeOptional(),
    IsInt(),
    Min(0),
    Max(HOME_SORT_ORDER_MAX),
  );
}

/** Nullable, trimmed, lowercase-slug (`bodySlug`). */
export function HomeNullableSlug() {
  return applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsString(),
    MaxLength(100),
    Matches(BODY_SLUG_PATTERN, {
      message:
        'bodySlug must contain only lowercase letters, digits and single hyphens',
    }),
  );
}
