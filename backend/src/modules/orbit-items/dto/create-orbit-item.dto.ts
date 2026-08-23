import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrbitItemAnimationDto } from './orbit-item-animation.dto';
import { OrbitItemPositionDto } from './orbit-item-position.dto';

export class CreateOrbitItemDto {
  @ApiProperty({ description: 'Stable, URL-safe identifier, e.g. "clothing".' })
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Media Library object key. Unset renders OrbitBubble's placeholder.",
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: OrbitItemPositionDto })
  @ValidateNested()
  @Type(() => OrbitItemPositionDto)
  positionConfig: OrbitItemPositionDto;

  @ApiProperty({ type: OrbitItemAnimationDto })
  @ValidateNested()
  @Type(() => OrbitItemAnimationDto)
  animationConfig: OrbitItemAnimationDto;
}
