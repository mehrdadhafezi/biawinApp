import { ApiPropertyOptional } from '@nestjs/swagger';
import { MosaicSlot, MosaicTheme } from '@prisma/client';
import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import {
  HomeNullableText,
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class UpdateHomeServiceMosaicTileDto {
  @ApiPropertyOptional()
  @HomeOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ nullable: true })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiPropertyOptional({ enum: MosaicSlot })
  @HomeOptional()
  @IsEnum(MosaicSlot)
  slotType?: MosaicSlot;

  @ApiPropertyOptional({ maxLength: 200 })
  @HomeOptional()
  @HomeText(200)
  kicker?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @HomeNullableText(200)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @HomeNullableText(500)
  lead?: string | null;

  @ApiPropertyOptional({ enum: MosaicTheme })
  @HomeOptional()
  @IsEnum(MosaicTheme)
  theme?: MosaicTheme;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
