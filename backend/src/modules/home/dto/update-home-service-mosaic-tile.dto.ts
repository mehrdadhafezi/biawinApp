import { ApiPropertyOptional } from '@nestjs/swagger';
import { MosaicSlot, MosaicTheme } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateHomeServiceMosaicTileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mediaAssetId?: string | null;

  @ApiPropertyOptional({ enum: MosaicSlot })
  @IsOptional()
  @IsEnum(MosaicSlot)
  slotType?: MosaicSlot;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kicker?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  lead?: string | null;

  @ApiPropertyOptional({ enum: MosaicTheme })
  @IsOptional()
  @IsEnum(MosaicTheme)
  theme?: MosaicTheme;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
