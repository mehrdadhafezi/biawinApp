import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PurchaseMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ServiceFaqItemDto } from './service-faq-item.dto';

const PURCHASE_METHODS: PurchaseMethod[] = [
  'credit',
  'installment',
  'cash',
  'free',
];

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    description: 'SERVICES-R5.22 — MediaAsset id for the main image.',
  })
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryMediaAssetIds?: string[];

  @ApiPropertyOptional({
    description: 'SERVICES-R5.22 — long-form description.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  priceFrom?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priceLabel?: string;

  @ApiPropertyOptional({ enum: PURCHASE_METHODS, isArray: true })
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryKeys?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [ServiceFaqItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceFaqItemDto)
  faq?: ServiceFaqItemDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  usageGuide?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  terms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
