import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HomeHeroCardsService } from './home-hero-cards.service';

@ApiTags('home-hero-cards')
@Controller({ path: 'home/hero-cards', version: '1' })
export class HomeHeroCardsController {
  constructor(private readonly heroCardsService: HomeHeroCardsService) {}

  @Public()
  @Get()
  list() {
    return this.heroCardsService.listPublic();
  }
}
