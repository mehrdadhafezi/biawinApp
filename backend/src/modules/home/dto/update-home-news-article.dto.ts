import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  HomeNullableSlug,
  HomeNullableUuid,
  HomeSortOrder,
  HomeText,
  HomeOptional,
} from './home-dto.decorators';

export class UpdateHomeNewsArticleDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @HomeOptional()
  @HomeText(100)
  category?: string;

  @ApiPropertyOptional({ nullable: true })
  @HomeNullableUuid()
  mediaAssetId?: string | null;

  @ApiPropertyOptional({ maxLength: 200 })
  @HomeOptional()
  @HomeText(200)
  kicker?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @HomeOptional()
  @HomeText(300)
  title?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @HomeOptional()
  @HomeText(1000)
  lead?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @HomeNullableSlug()
  bodySlug?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @HomeSortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @HomeOptional()
  @IsBoolean()
  active?: boolean;
}
