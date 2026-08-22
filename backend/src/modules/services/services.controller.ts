import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListServicesQueryDto } from './dto/list-query.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListServicesQueryDto) {
    return this.servicesService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOneOrThrow(id);
  }
}
