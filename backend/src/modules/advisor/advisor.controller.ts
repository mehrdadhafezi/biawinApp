import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListAdvisorQueryDto } from './dto/list-query.dto';
import { AdvisorService } from './advisor.service';

@ApiTags('advisor')
@Controller({ path: 'advisor', version: '1' })
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListAdvisorQueryDto) {
    return this.advisorService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.advisorService.findOneOrThrow(id);
  }
}
