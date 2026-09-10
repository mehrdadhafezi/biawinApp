import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * SERVICES-R5.21 — deliberately contains ONLY discovery/marketing fields.
 * No `priceAmount`/`valueAmount`/`status`/any CardProduct-shaped field
 * exists here — a Content Editor cannot touch Service pricing or
 * CardProduct data through this DTO even in principle, since there is no
 * code path connecting them (see catalog-admin-permissions.spec.ts's
 * CategoryCard DTO-shape assertion).
 */
export class CreateCategoryCardDto {
  @ApiProperty({ description: 'The Category this discovery card belongs to.' })
  @IsString()
  categoryId: string;

  @ApiProperty({
    description:
      'The Service this card links to on click. Must belong to the SAME Category as categoryId — validated server-side, never trusted from the client (see CategoryCardsService.assertOwnership).',
  })
  @IsString()
  targetServiceId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({
    description:
      'MediaAsset id. Unset renders no image, matching the same not-yet-uploaded state Home CMS already allows.',
  })
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiPropertyOptional({
    type: [String],
    default: [],
    description:
      'Short marketing bullets — real reference cards use exactly 2 (SERVICES-R5.20 audit), capped here in the Admin form, not enforced at the database.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
