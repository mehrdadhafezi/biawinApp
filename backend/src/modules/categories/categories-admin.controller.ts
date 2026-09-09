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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import type { AuthenticatedAdminUser } from '../admin-auth/types/authenticated-admin-user.type';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * SERVICES-R5.17 — matches HomeHeroCardsAdminController's exact shape:
 * list/detail open to any authenticated admin, mutations restricted to
 * SUPER_ADMIN/CONTENT_EDITOR. See docs/services-r5-17-admin-catalog-cms.md
 * "RBAC" for why there is no finer-grained split (e.g. a separate "Service
 * manager" role) — AdminRole has no such role today, and this stage does
 * not add one (see that doc's stated limitation, not a parallel auth system).
 */
@ApiTags('admin-categories')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/categories', version: '1' })
export class CategoriesAdminController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.categoriesService.listAdmin(pagination.skip, pagination.limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoriesService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoriesService.update(
      id,
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Patch('reorder')
  reorder(
    @Body() dto: ReorderCategoriesDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.categoriesService.reorder(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
