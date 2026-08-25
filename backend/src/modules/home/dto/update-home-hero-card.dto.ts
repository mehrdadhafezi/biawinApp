import { ApiPropertyOptional } from '@nestjs/swagger';
import { HeroCardColor, HeroCardKey } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateHomeHeroCardDto {
  @ApiPropertyOptional({ enum: HeroCardKey })
  @IsOptional()
  @IsEnum(HeroCardKey)
  cardKey?: HeroCardKey;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

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
  displayNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerLabel?: string;

  @ApiPropertyOptional({ enum: HeroCardColor })
  @IsOptional()
  @IsEnum(HeroCardColor)
  colorPreset?: HeroCardColor;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
