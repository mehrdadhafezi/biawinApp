import { ApiPropertyOptional } from '@nestjs/swagger';
import { BannerTheme } from '@prisma/client';
import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import {
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class UpdateHomeServiceBannerDto {
  @ApiPropertyOptional()
  @HomeOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'MediaAsset id. Pass null to clear it.',
    nullable: true,
  })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiPropertyOptional({ maxLength: 200 })
  @HomeOptional()
  @HomeText(200)
  kicker?: string;

  @ApiPropertyOptional({ enum: BannerTheme })
  @HomeOptional()
  @IsEnum(BannerTheme)
  theme?: BannerTheme;

  @ApiPropertyOptional()
  @HomeOptional()
  @IsBoolean()
  wide?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
