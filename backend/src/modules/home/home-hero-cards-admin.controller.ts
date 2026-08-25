import {
  Body,
  Controller,
  Delete,
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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateHomeHeroCardDto } from './dto/create-home-hero-card.dto';
import { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import { UpdateHomeHeroCardDto } from './dto/update-home-hero-card.dto';
import { HomeHeroCardsService } from './home-hero-cards.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * `@Public()` opts out of the *customer* global guard; `AdminJwtAuthGuard`/
 * `AdminRolesGuard` (controller-level) are what actually protect this —
 * see `AdminJwtAuthGuard`'s own doc comment. List/detail: any authenticated
 * admin. Mutations: `SUPER_ADMIN`/`CONTENT_EDITOR` only, matching
 * `MediaController`'s exact role split.
 */
@ApiTags('admin-home-hero-cards')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/home/hero-cards', version: '1' })
export class HomeHeroCardsAdminController {
  constructor(private readonly heroCardsService: HomeHeroCardsService) {}

  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.heroCardsService.listAdmin(pagination.skip, pagination.limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.heroCardsService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateHomeHeroCardDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.heroCardsService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHomeHeroCardDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.heroCardsService.update(
      id,
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.heroCardsService.remove(
      id,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Patch('reorder')
  reorder(
    @Body() dto: ReorderHomeItemsDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.heroCardsService.reorder(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
