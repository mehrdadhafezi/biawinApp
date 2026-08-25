import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HomeServiceMosaicTilesService } from './home-service-mosaic-tiles.service';

@ApiTags('home-service-mosaic-tiles')
@Controller({ path: 'home/service-mosaic-tiles', version: '1' })
export class HomeServiceMosaicTilesController {
  constructor(
    private readonly mosaicTilesService: HomeServiceMosaicTilesService,
  ) {}

  @Public()
  @Get()
  list() {
    return this.mosaicTilesService.listPublic();
  }
}
