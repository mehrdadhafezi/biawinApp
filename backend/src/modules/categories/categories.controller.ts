import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListCategoriesQueryDto } from './dto/list-query.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(@Query() pagination: ListCategoriesQueryDto) {
    return this.categoriesService.list(pagination.skip, pagination.limit);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOneOrThrow(id);
  }

  /**
   * SERVICES-R5.21 — a dedicated path segment (not `:id`) so a slug value
   * can never collide with a real Category UUID in the route matcher; the
   * existing `GET /categories/:id` above is completely untouched.
   */
  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlugOrThrow(slug);
  }
}
