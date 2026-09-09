import {
  Body,
  Controller,
  Get,
  Param,
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
import { CardProductsService } from './card-products.service';
import { CreateCardProductDto } from './dto/create-card-product.dto';
import { ListCardProductsAdminQueryDto } from './dto/list-card-products-admin-query.dto';
import { UpdateCardProductDto } from './dto/update-card-product.dto';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * SERVICES-R5.17 — same RBAC shape as CategoriesAdminController/
 * ServicesAdminController. Status transitions (DRAFT/ACTIVE/INACTIVE/
 * EXPIRED) go through the same `PUT :id` as every other field — see
 * `CardProduct.status`'s schema doc comment for why no separate
 * transition-restricting endpoint exists.
 */
@ApiTags('admin-card-products')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/card-products', version: '1' })
export class CardProductsAdminController {
  constructor(private readonly cardProductsService: CardProductsService) {}

  @Get()
  list(@Query() query: ListCardProductsAdminQueryDto) {
    return this.cardProductsService.listAdmin(
      query.skip,
      query.limit,
      query.serviceId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cardProductsService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateCardProductDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.cardProductsService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCardProductDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.cardProductsService.update(
      id,
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
