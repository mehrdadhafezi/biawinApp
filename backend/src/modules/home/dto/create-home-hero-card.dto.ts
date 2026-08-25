import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeroCardColor, HeroCardKey } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateHomeHeroCardDto {
  @ApiProperty({ enum: HeroCardKey })
  @IsEnum(HeroCardKey)
  cardKey: HeroCardKey;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  subtitle: string;

  @ApiProperty({ description: 'Decorative only — never a real card number.' })
  @IsString()
  displayNumber: string;

  @ApiProperty()
  @IsString()
  ownerLabel: string;

  @ApiPropertyOptional({ enum: HeroCardColor, default: HeroCardColor.blue })
  @IsOptional()
  @IsEnum(HeroCardColor)
  colorPreset?: HeroCardColor;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
