import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListCardProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter to card products for one Service.',
  })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({
    description:
      "Filter to card products whose owning Service belongs to one Category (the Category Landing's product list).",
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
