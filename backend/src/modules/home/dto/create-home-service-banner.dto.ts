import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerTheme } from '@prisma/client';
import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import {
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class CreateHomeServiceBannerDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'MediaAsset id (must exist and not be soft-deleted). Unset/null renders no image, matching the same not-yet-uploaded state OrbitItem allows.',
  })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @HomeText(200)
  kicker: string;

  @ApiPropertyOptional({ enum: BannerTheme, default: BannerTheme.auto })
  @HomeOptional()
  @IsEnum(BannerTheme)
  theme?: BannerTheme;

  @ApiPropertyOptional({ default: false })
  @HomeOptional()
  @IsBoolean()
  wide?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
