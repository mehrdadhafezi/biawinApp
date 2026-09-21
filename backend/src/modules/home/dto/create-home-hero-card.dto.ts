import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeroCardColor, HeroCardKey } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';
import { HomeOptional, HomeSortOrder, HomeText } from './home-dto.decorators';

export class CreateHomeHeroCardDto {
  @ApiProperty({ enum: HeroCardKey })
  @IsEnum(HeroCardKey)
  cardKey: HeroCardKey;

  @ApiProperty({ maxLength: 100 })
  @HomeText(100)
  label: string;

  @ApiProperty({ maxLength: 200 })
  @HomeText(200)
  title: string;

  @ApiProperty({ maxLength: 500 })
  @HomeText(500)
  subtitle: string;

  @ApiProperty({
    maxLength: 50,
    description: 'Decorative only — never a real card number.',
  })
  @HomeText(50)
  displayNumber: string;

  @ApiProperty({ maxLength: 100 })
  @HomeText(100)
  ownerLabel: string;

  @ApiPropertyOptional({ enum: HeroCardColor, default: HeroCardColor.blue })
  @HomeOptional()
  @IsEnum(HeroCardColor)
  colorPreset?: HeroCardColor;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
