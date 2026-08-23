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

class OrbitItemOrderEntryDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderOrbitItemsDto {
  @ApiProperty({ type: [OrbitItemOrderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrbitItemOrderEntryDto)
  items: OrbitItemOrderEntryDto[];
}
