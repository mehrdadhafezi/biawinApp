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

class HomeItemOrderEntryDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/** Shared by all 4 Home CMS resources — same shape as `ReorderOrbitItemsDto`. */
export class ReorderHomeItemsDto {
  @ApiProperty({ type: [HomeItemOrderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HomeItemOrderEntryDto)
  items: HomeItemOrderEntryDto[];
}
