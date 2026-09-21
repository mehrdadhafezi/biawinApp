import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  HomeNullableSlug,
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class CreateHomeNewsArticleDto {
  @ApiProperty({
    maxLength: 100,
    description: 'Editorial display label, not an FK to Category.',
  })
  @HomeText(100)
  category: string;

  @ApiPropertyOptional({ nullable: true })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @HomeText(200)
  kicker: string;

  @ApiProperty({ maxLength: 300 })
  @HomeText(300)
  title: string;

  @ApiProperty({ maxLength: 1000 })
  @HomeText(1000)
  lead: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    description:
      'Reserved for when "مشاهده مقاله" becomes a real link — unused today. Unique; lowercase letters, digits and single hyphens.',
  })
  @HomeNullableSlug()
  bodySlug?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
