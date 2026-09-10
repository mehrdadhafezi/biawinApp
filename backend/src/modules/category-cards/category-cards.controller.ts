import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoryCardsService } from './category-cards.service';
import { ListCategoryCardsQueryDto } from './dto/list-category-cards-query.dto';

/**
 * SERVICES-R5.21 — public, read-only, `active: true`-only (see
 * CategoryCardsService.list's own comment) — the Category Landing route's
 * data source. Mirrors `CardProductsController`'s exact shape.
 */
@ApiTags('category-cards')
@Controller({ path: 'category-cards', version: '1' })
export class CategoryCardsController {
  constructor(private readonly categoryCardsService: CategoryCardsService) {}

  @Public()
  @Get()
  list(@Query() query: ListCategoryCardsQueryDto) {
    return this.categoryCardsService.list(
      query.skip,
      query.limit,
      query.categoryId,
    );
  }
}
