import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListCategoryCardsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter to discovery cards for one Category.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
