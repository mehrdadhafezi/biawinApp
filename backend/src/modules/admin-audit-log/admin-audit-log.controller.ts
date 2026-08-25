import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { ListAdminAuditLogQueryDto } from './dto/list-admin-audit-log-query.dto';
import { AdminAuditLogService } from './admin-audit-log.service';

/**
 * `SUPER_ADMIN`-only (audit history is inherently more sensitive than the
 * content it describes) — also the concrete route this stage's "unauthorized
 * role access" test exercises. `@Public()` opts this controller out of the
 * *customer* global guard; `AdminJwtAuthGuard`/`AdminRolesGuard` are what
 * actually protect it (see AdminJwtAuthGuard's own doc comment).
 */
@ApiTags('admin-audit-log')
@ApiBearerAuth()
@Public()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @AdminRoles(AdminRole.SUPER_ADMIN)
  @Get()
  list(@Query() pagination: ListAdminAuditLogQueryDto) {
    return this.auditLogService.list(pagination.skip, pagination.limit);
  }
}
