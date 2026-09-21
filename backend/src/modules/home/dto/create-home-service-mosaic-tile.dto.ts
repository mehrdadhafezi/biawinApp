import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MosaicSlot, MosaicTheme } from '@prisma/client';
import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import {
  HomeNullableText,
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class CreateHomeServiceMosaicTileDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ nullable: true })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiProperty({ enum: MosaicSlot })
  @IsEnum(MosaicSlot)
  slotType: MosaicSlot;

  @ApiProperty({ maxLength: 200 })
  @HomeText(200)
  kicker: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 200,
    description:
      'Only used by `wide` rows — `half` tiles use the joined category name. Optional (BD-5): never required.',
  })
  @HomeNullableText(200)
  title?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    description: 'Only used by `wide` rows. Optional (BD-5): never required.',
  })
  @HomeNullableText(500)
  lead?: string | null;

  @ApiPropertyOptional({ enum: MosaicTheme, default: MosaicTheme.home })
  @HomeOptional()
  @IsEnum(MosaicTheme)
  theme?: MosaicTheme;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
