import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CardProductStatus,
  CardType,
  CardValueDisplayType,
  JourneyType,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateCardProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

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

  @ApiPropertyOptional({ enum: CardType })
  @IsOptional()
  @IsEnum(CardType)
  cardType?: CardType;

  @ApiPropertyOptional({ enum: JourneyType })
  @IsOptional()
  @IsEnum(JourneyType)
  journeyType?: JourneyType;

  @ApiPropertyOptional({ description: 'Rial, integer.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  priceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priceLabel?: string;

  @ApiPropertyOptional({
    description:
      "SERVICES-R5.19. Rial, integer. The card's displayed commercial value/credit ceiling — NOT the payable price.",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  valueAmount?: number;

  @ApiPropertyOptional({ enum: CardValueDisplayType })
  @IsOptional()
  @IsEnum(CardValueDisplayType)
  valueDisplayType?: CardValueDisplayType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  validityDays?: number;

  @ApiPropertyOptional({ enum: CardProductStatus })
  @IsOptional()
  @IsEnum(CardProductStatus)
  status?: CardProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
