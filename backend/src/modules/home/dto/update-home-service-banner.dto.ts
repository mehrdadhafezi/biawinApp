import { ApiPropertyOptional } from '@nestjs/swagger';
import { BannerTheme } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateHomeServiceBannerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'MediaAsset id. Pass null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  mediaAssetId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kicker?: string;

  @ApiPropertyOptional({ enum: BannerTheme })
  @IsOptional()
  @IsEnum(BannerTheme)
  theme?: BannerTheme;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wide?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
