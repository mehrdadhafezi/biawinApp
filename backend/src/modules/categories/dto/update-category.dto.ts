import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    description:
      'SERVICES-R5.21 — public URL identifier for the Category Landing route (/categories/[slug]).',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'SERVICES-R5.22 — MediaAsset id for the hero image.',
  })
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
