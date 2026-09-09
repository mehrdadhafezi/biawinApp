import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListServicesAdminQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter to Services under one Category.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
