import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HomeServiceBannersService } from './home-service-banners.service';

@ApiTags('home-service-banners')
@Controller({ path: 'home/service-banners', version: '1' })
export class HomeServiceBannersController {
  constructor(
    private readonly serviceBannersService: HomeServiceBannersService,
  ) {}

  @Public()
  @Get()
  list() {
    return this.serviceBannersService.listPublic();
  }
}
