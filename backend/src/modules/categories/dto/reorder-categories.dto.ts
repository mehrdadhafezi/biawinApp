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

class CategoryOrderEntryDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/** Same shape as Home CMS's `ReorderHomeItemsDto` — kept local to this module rather than shared, matching module-boundary convention. */
export class ReorderCategoriesDto {
  @ApiProperty({ type: [CategoryOrderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CategoryOrderEntryDto)
  items: CategoryOrderEntryDto[];
}
