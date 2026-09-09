import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { PurchaseMethod } from '@prisma/client';

/**
 * SERVICES-R5.1 / SERVICES-R5.19 — two mutually-exclusive purchase shapes
 * share this one DTO/endpoint (`POST /orders`), per this stage's explicit
 * "prefer reusing the existing Order endpoint" instruction:
 *
 * 1. Legacy Service purchase (R5.1, unchanged): `{ serviceId, method,
 *    idempotencyKey, merchantId? }`.
 * 2. CardProduct purchase (R5.19, new): `{ cardProductId, idempotencyKey }`
 *    — no `method` (CardProduct has no `availableMethods`-shaped concept
 *    yet), no `merchantId` (the server derives it from the CardProduct's
 *    parent Service; a client-supplied one is rejected outright for this
 *    shape — see OrdersService.create()`, stricter than the legacy shape's
 *    optional cross-validation hint).
 *
 * `@ValidateIf` makes `serviceId`/`method` required only when
 * `cardProductId` is absent, and vice versa — so omitting BOTH still fails
 * validation (each becomes required against the other's absence), but
 * supplying only one shape's fields never trips the other shape's
 * requiredness. Supplying BOTH shapes at once is rejected by
 * `OrdersService.create()` itself (an explicit, deterministic 400), since
 * class-validator's per-field `@ValidateIf` cannot express "these two
 * fields are mutually exclusive" on its own.
 *
 * `amount` is deliberately NOT a field here, for either shape — the client
 * cannot be trusted to state what it should pay; the server always
 * resolves it (`ServicePricingService` / `CardProductPricingService`).
 */
export class CreateOrderDto {
  @ApiPropertyOptional({
    description:
      'Legacy Service purchase shape. Mutually exclusive with cardProductId.',
  })
  @ValidateIf((dto: CreateOrderDto) => !dto.cardProductId)
  @IsString()
  @IsNotEmpty()
  serviceId?: string;

  @ApiPropertyOptional({
    description:
      'Merchant the client believes this purchase is for. Only meaningful for the legacy Service shape — validated against the service’s real merchant relationship there, never trusted to determine the stored value, and rejected outright when cardProductId is supplied (see OrdersService.create()).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  merchantId?: string;

  @ApiPropertyOptional({ enum: ['credit', 'installment', 'cash', 'free'] })
  @ValidateIf((dto: CreateOrderDto) => !dto.cardProductId)
  @IsIn(['credit', 'installment', 'cash', 'free'])
  method?: PurchaseMethod;

  @ApiPropertyOptional({
    description:
      'SERVICES-R5.19 CardProduct purchase shape. Mutually exclusive with serviceId/method.',
  })
  @ValidateIf((dto: CreateOrderDto) => !dto.serviceId)
  @IsString()
  @IsNotEmpty()
  cardProductId?: string;

  @ApiProperty({
    description:
      'Client-generated idempotency key. Retrying the same purchase request with the same key returns the original order instead of creating a duplicate.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
}
