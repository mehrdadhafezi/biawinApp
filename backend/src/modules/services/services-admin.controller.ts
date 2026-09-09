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
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesAdminQueryDto } from './dto/list-services-admin-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** SERVICES-R5.17 — same shape as CategoriesAdminController; see that file's doc comment for the RBAC rationale. */
@ApiTags('admin-services')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/services', version: '1' })
export class ServicesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(@Query() query: ListServicesAdminQueryDto) {
    return this.servicesService.listAdmin(
      query.skip,
      query.limit,
      query.categoryId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOneAdmin(id);
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Post()
  create(
    @Body() dto: CreateServiceDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.servicesService.create(
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }

  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.servicesService.update(
      id,
      dto,
      admin.adminUserId,
      sessionMeta(req),
    );
  }
}
