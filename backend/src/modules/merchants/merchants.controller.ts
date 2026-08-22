import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListMerchantsQueryDto } from './dto/list-query.dto';
import { MerchantsService } from './merchants.service';

@ApiTags('merchants')
@Controller({ path: 'merchants', version: '1' })
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListMerchantsQueryDto) {
    return this.merchantsService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.merchantsService.findOneOrThrow(id);
  }
}
