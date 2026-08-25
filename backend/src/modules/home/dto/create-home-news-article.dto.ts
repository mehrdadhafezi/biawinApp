import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateHomeNewsArticleDto {
  @ApiProperty({
    description: 'Editorial display label, not an FK to Category.',
  })
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiProperty()
  @IsString()
  kicker: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  lead: string;

  @ApiPropertyOptional({
    description:
      'Reserved for when "مشاهده مقاله" becomes a real link — unused today.',
  })
  @IsOptional()
  @IsString()
  bodySlug?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
