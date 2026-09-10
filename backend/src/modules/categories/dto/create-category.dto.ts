import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Storage object key for an uploaded image, if any.',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    description:
      'SERVICES-R5.21 — public URL identifier for the Category Landing route (/categories/[slug]). Unset means no Landing route exists for this Category yet.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
