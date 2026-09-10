import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CategoryCardOrderEntryDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/** Same shape as ReorderCategoriesDto/ReorderHomeItemsDto — kept local to this module, matching module-boundary convention. */
export class ReorderCategoryCardsDto {
  @ApiProperty({ type: [CategoryCardOrderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryCardOrderEntryDto)
  items: CategoryCardOrderEntryDto[];
}
