import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OrbitItemsService } from './orbit-items.service';

@ApiTags('orbit-items')
@Controller({ path: 'orbit-items', version: '1' })
export class OrbitItemsController {
  constructor(private readonly orbitItemsService: OrbitItemsService) {}

  @Public()
  @Get()
  list() {
    return this.orbitItemsService.listPublic();
  }
}
