import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HomeNewsArticlesService } from './home-news-articles.service';

@ApiTags('home-news-articles')
@Controller({ path: 'home/news-articles', version: '1' })
export class HomeNewsArticlesController {
  constructor(private readonly newsArticlesService: HomeNewsArticlesService) {}

  @Public()
  @Get()
  list() {
    return this.newsArticlesService.listPublic();
  }
}
