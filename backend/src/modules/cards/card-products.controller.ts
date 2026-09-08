import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CardProductsService } from './card-products.service';
import { ListCardProductsQueryDto } from './dto/list-card-products-query.dto';

@ApiTags('cards')
@Controller({ path: 'cards', version: '1' })
export class CardProductsController {
  constructor(private readonly cardProductsService: CardProductsService) {}

  @Public()
  @Get()
  list(@Query() query: ListCardProductsQueryDto) {
    return this.cardProductsService.list(
      query.skip,
      query.limit,
      query.serviceId,
    );
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cardProductsService.findOneOrThrow(id);
  }
}
