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
}
