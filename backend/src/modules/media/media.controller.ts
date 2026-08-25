import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import type { Request } from 'express';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentAdminUser } from '../../common/decorators/current-admin-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import type { AuthenticatedAdminUser } from '../admin-auth/types/authenticated-admin-user.type';
import { ListMediaQueryDto } from './dto/list-media-query.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService, type UploadedFileLike } from './media.service';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * `@Public()` opts this controller out of the *customer* global guard;
 * `AdminJwtAuthGuard`/`AdminRolesGuard` (applied here, at controller level,
 * so every route is at minimum "any authenticated admin") are what
 * actually protect it — see `AdminJwtAuthGuard`'s own doc comment. Upload/
 * delete narrow further to `SUPER_ADMIN`/`CONTENT_EDITOR` via
 * `@AdminRoles(...)`; a `SUPPORT_VIEWER` can list/view but not mutate,
 * matching that role's own name.
 */
@ApiTags('admin-media')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/media', version: '1' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  list(@Query() pagination: ListMediaQueryDto) {
    return this.mediaService.list(pagination.skip, pagination.limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  // `limits.fileSize` here is a generous, hardcoded network-level backstop
  // (rejects a payload before it's even fully buffered) — deliberately
  // looser than MEDIA_MAX_FILE_SIZE_BYTES (the real, tested business limit
  // MediaService.upload() enforces), since FileInterceptor's options are
  // resolved at module-init time and can't read ConfigService per-request
  // without a heavier async-factory setup this foundation stage doesn't
  // need. Both are defense-in-depth for the same concern, not required to
  // match exactly.
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('upload')
  upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentAdminUser() admin: AuthenticatedAdminUser,
    @Req() req: Request,
  ) {
    return this.mediaService.upload(
      file,
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
    return this.mediaService.remove(id, admin.adminUserId, sessionMeta(req));
  }
}
