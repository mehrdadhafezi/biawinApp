import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateOrbitItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description:
      "Media Library object key. Pass null to clear it back to OrbitBubble's placeholder.",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: OrbitItemPositionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrbitItemPositionDto)
  positionConfig?: OrbitItemPositionDto;

  @ApiPropertyOptional({ type: OrbitItemAnimationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrbitItemAnimationDto)
  animationConfig?: OrbitItemAnimationDto;
}
