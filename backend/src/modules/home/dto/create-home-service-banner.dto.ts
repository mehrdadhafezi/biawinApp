import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerTheme } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateHomeServiceBannerDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({
    description:
      'MediaAsset id. Unset renders no image, matching the same not-yet-uploaded state OrbitItem allows.',
  })
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiProperty()
  @IsString()
  kicker: string;

  @ApiPropertyOptional({ enum: BannerTheme, default: BannerTheme.auto })
  @IsOptional()
  @IsEnum(BannerTheme)
  theme?: BannerTheme;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  wide?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
