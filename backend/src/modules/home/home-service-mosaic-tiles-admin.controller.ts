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
import { CreateHomeServiceMosaicTileDto } from './dto/create-home-service-mosaic-tile.dto';
import { ReorderHomeItemsDto } from './dto/reorder-home-items.dto';
import { UpdateHomeServiceMosaicTileDto } from './dto/update-home-service-mosaic-tile.dto';
import { HomeServiceMosaicTilesService } from './home-service-mosaic-tiles.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@ApiTags('admin-home-service-mosaic-tiles')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/home/service-mosaic-tiles', version: '1' })
export class HomeServiceMosaicTilesAdminController {
  constructor(
    private readonly mosaicTilesService: HomeServiceMosaicTilesService,
  ) {}

  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.mosaicTilesService.listAdmin(pagination.skip, pagination.limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mosaicTilesService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateHomeServiceMosaicTileDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.mosaicTilesService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHomeServiceMosaicTileDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.mosaicTilesService.update(
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
    return this.mosaicTilesService.remove(
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
    return this.mosaicTilesService.reorder(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
