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
import { CreateHomeServiceBannerDto } from './dto/create-home-service-banner.dto';
import { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import { UpdateHomeServiceBannerDto } from './dto/update-home-service-banner.dto';
import { HomeServiceBannersService } from './home-service-banners.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@ApiTags('admin-home-service-banners')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/home/service-banners', version: '1' })
export class HomeServiceBannersAdminController {
  constructor(
    private readonly serviceBannersService: HomeServiceBannersService,
  ) {}

  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.serviceBannersService.listAdmin(
      pagination.skip,
      pagination.limit,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceBannersService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateHomeServiceBannerDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.serviceBannersService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHomeServiceBannerDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.serviceBannersService.update(
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
    return this.serviceBannersService.remove(
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
    return this.serviceBannersService.reorder(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
