import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListSubscriptionsQueryDto } from './dto/list-query.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscriptionsService.findOneOrThrow(id);
  }
}
