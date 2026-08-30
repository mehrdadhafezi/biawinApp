import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { PurchaseMethod } from '@prisma/client';

/**
 * SERVICES-R5.1 — `amount` is deliberately NOT a field here. The client
 * cannot be trusted to state what it should pay; the server resolves it via
 * ServicePricingService. `merchantId`, if supplied, is used only to validate
 * against the service's real merchant relationship — it is never trusted to
 * decide what is actually stored on the Order (see OrdersService.create()).
 */
export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiPropertyOptional({
    description:
      'Merchant the client believes this purchase is for. Validated against the service’s real merchant relationship; never trusted to determine the stored value.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  merchantId?: string;

  @ApiProperty({ enum: ['credit', 'installment', 'cash', 'free'] })
  @IsIn(['credit', 'installment', 'cash', 'free'])
  method: PurchaseMethod;

  @ApiProperty({
    description:
      'Client-generated idempotency key. Retrying the same purchase request with the same key returns the original order instead of creating a duplicate.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey: string;
}
