import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import type { AuthenticatedAdminUser } from '../../modules/admin-auth/types/authenticated-admin-user.type';

/**
 * Must run AFTER AdminJwtAuthGuard on the same route
 * (`@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)` — NestJS runs guards in
 * array order) since it reads `request.adminUser`, which only
 * AdminJwtAuthGuard populates. A route with no `@AdminRoles(...)` at all is
 * allowed through unchanged — role narrowing is opt-in per route, matching
 * `docs/admin-architecture-decision-record.md` §4's "any authenticated admin
 * by default, this decorator only narrows further" design.
 */
@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ adminUser?: AuthenticatedAdminUser }>();
    const adminUser = request.adminUser;
    if (!adminUser) return false;

    return requiredRoles.includes(adminUser.role);
  }
}
