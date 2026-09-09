import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardProductStatus, CardType, JourneyType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

/**
 * SERVICES-R5.17 — `priceAmount` is stored and managed by Admin directly,
 * per this stage's task and SERVICES-R5.2.1's resolved Model A decision
 * (Biawin owns pricing). No payment/gateway/wallet/installment/discount/
 * external-provider logic is implemented — this only lets Admin populate
 * the field R5.16 introduced but never filled in.
 */
export class CreateCardProductDto {
  @ApiProperty({ description: 'The Service this card product belongs to.' })
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty({ enum: CardType })
  @IsEnum(CardType)
  cardType: CardType;

  @ApiProperty({ enum: JourneyType })
  @IsEnum(JourneyType)
  journeyType: JourneyType;

  @ApiPropertyOptional({
    description: "Rial, integer. Admin-set — see this module's doc comment.",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  priceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priceLabel?: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  validityDays?: number;

  @ApiPropertyOptional({
    enum: CardProductStatus,
    default: CardProductStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(CardProductStatus)
  status?: CardProductStatus;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
