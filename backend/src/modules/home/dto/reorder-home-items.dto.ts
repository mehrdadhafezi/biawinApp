import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { HOME_SORT_ORDER_MAX } from './home-dto.decorators';

class HomeItemOrderEntryDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty({ minimum: 0, maximum: HOME_SORT_ORDER_MAX })
  @IsInt()
  @Min(0)
  @Max(HOME_SORT_ORDER_MAX)
  sortOrder: number;
}

/**
 * Shared by all 4 Home CMS resources. PARTIAL semantics (BD-3, kept): only
 * the listed rows are touched, unlisted rows keep their `sortOrder`. Strict
 * payload rules (all 400, validated before anything is written): non-empty,
 * every id a uuid, no duplicate ids, no duplicate positions. Unknown ids are
 * a 422 raised by the service after this DTO passes.
 */
export class ReorderHomeItemsDto {
  @ApiProperty({ type: [HomeItemOrderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((entry: HomeItemOrderEntryDto) => entry.id, {
    message: 'items must not contain duplicate ids',
  })
  @ArrayUnique((entry: HomeItemOrderEntryDto) => entry.sortOrder, {
    message: 'items must not contain duplicate sortOrder positions',
  })
  @ValidateNested({ each: true })
  @Type(() => HomeItemOrderEntryDto)
  items: HomeItemOrderEntryDto[];
}
