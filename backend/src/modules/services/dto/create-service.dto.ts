import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PurchaseMethod } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

const PURCHASE_METHODS: PurchaseMethod[] = [
  'credit',
  'installment',
  'cash',
  'free',
];

/**
 * SERVICES-R5.17 — Admin-facing DTO for the real `Service` row (`backend/
 * prisma/schema.prisma`). No `journeyType` field: per SERVICES-R5.16's own
 * resolved decision, journey type lives on `CardProduct` (one Service can
 * offer several journeys via several cards) — adding a duplicate field here
 * would directly contradict that decision. No `purchasable`/KYC flags:
 * `active` already gates purchasability (R5.1's `OrdersService`), and no
 * identity/KYC concept exists anywhere in this schema — see
 * docs/services-r5-17-admin-catalog-cms.md.
 */
export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Optional real Merchant this Service is fulfilled by.',
  })
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  groupLabel: string;

  @ApiProperty({
    description:
      'Short descriptive text (the closest existing field to a "description").',
  })
  @IsString()
  subtitle: string;

  @ApiProperty()
  @IsString()
  badge: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Storage object key for an uploaded image, if any.',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    description:
      'Rial, integer. Presentation-only today — see docs/services-r5-2-pricing-and-eligibility-domain.md. Not used as transaction authority.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  priceFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priceLabel?: string;

  @ApiPropertyOptional({ enum: PURCHASE_METHODS, isArray: true, default: [] })
  @IsOptional()
  @IsArray()
  @IsIn(PURCHASE_METHODS, { each: true })
  availableMethods?: PurchaseMethod[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentMinMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentMaxMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditMultiplierLabel?: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryKeys?: string[];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
