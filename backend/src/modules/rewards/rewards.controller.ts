import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListRewardsQueryDto } from './dto/list-query.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller({ path: 'rewards', version: '1' })
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListRewardsQueryDto) {
    return this.rewardsService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rewardsService.findOneOrThrow(id);
  }
}
