import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MosaicSlot, MosaicTheme } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateHomeServiceMosaicTileDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiProperty({ enum: MosaicSlot })
  @IsEnum(MosaicSlot)
  slotType: MosaicSlot;

  @ApiProperty()
  @IsString()
  kicker: string;

  @ApiPropertyOptional({
    description:
      'Only used by `wide` rows — `half` tiles use the joined category name.',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Only used by `wide` rows.' })
  @IsOptional()
  @IsString()
  lead?: string;

  @ApiPropertyOptional({ enum: MosaicTheme, default: MosaicTheme.home })
  @IsOptional()
  @IsEnum(MosaicTheme)
  theme?: MosaicTheme;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
