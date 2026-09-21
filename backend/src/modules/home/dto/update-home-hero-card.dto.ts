import { ApiPropertyOptional } from '@nestjs/swagger';
import { HeroCardColor, HeroCardKey } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';
import { HomeOptional, HomeSortOrder, HomeText } from './home-dto.decorators';

export class UpdateHomeHeroCardDto {
  @ApiPropertyOptional({ enum: HeroCardKey })
  @HomeOptional()
  @IsEnum(HeroCardKey)
  cardKey?: HeroCardKey;

  @ApiPropertyOptional({ maxLength: 100 })
  @HomeOptional()
  @HomeText(100)
  label?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @HomeOptional()
  @HomeText(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @HomeOptional()
  @HomeText(500)
  subtitle?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @HomeOptional()
  @HomeText(50)
  displayNumber?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @HomeOptional()
  @HomeText(100)
  ownerLabel?: string;

  @ApiPropertyOptional({ enum: HeroCardColor })
  @HomeOptional()
  @IsEnum(HeroCardColor)
  colorPreset?: HeroCardColor;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
