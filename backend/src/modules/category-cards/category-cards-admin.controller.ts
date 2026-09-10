import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import type { Request } from 'express';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentAdminUser } from '../../common/decorators/current-admin-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import type { AuthenticatedAdminUser } from '../admin-auth/types/authenticated-admin-user.type';
import { CategoryCardsService } from './category-cards.service';
import { CreateCategoryCardDto } from './dto/create-category-card.dto';
import { ListCategoryCardsAdminQueryDto } from './dto/list-category-cards-admin-query.dto';
import { ReorderCategoryCardsDto } from './dto/reorder-category-cards.dto';
import { UpdateCategoryCardDto } from './dto/update-category-card.dto';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * SERVICES-R5.21 — matches `CategoriesAdminController`'s exact shape:
 * list/detail open to any authenticated admin, mutations restricted to
 * `SUPER_ADMIN`/`CONTENT_EDITOR`. No `DELETE` route exists — `active` is
 * the sole removal mechanism, the same zero-hard-delete convention every
 * other catalog model (`Category`/`Service`/`CardProduct`) already uses.
 */
@ApiTags('admin-category-cards')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/category-cards', version: '1' })
export class CategoryCardsAdminController {
  constructor(private readonly categoryCardsService: CategoryCardsService) {}

  @Get()
  list(@Query() query: ListCategoryCardsAdminQueryDto) {
    return this.categoryCardsService.listAdmin(
      query.skip,
      query.limit,
      query.categoryId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryCardsService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateCategoryCardDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoryCardsService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryCardDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoryCardsService.update(
      id,
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Patch('reorder')
  reorder(
    @Body() dto: ReorderCategoryCardsDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoryCardsService.reorder(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
