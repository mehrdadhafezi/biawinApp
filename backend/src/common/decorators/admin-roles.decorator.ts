import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

export const ADMIN_ROLES_KEY = 'adminRoles';

/**
 * Declares which AdminRole(s) may call a route — read by AdminRolesGuard.
 * An admin route with no @AdminRoles() at all is reachable by any
 * authenticated admin (AdminJwtAuthGuard alone already gates it); this
 * decorator only narrows further (see docs/admin-architecture-decision-record.md §4).
 */
export const AdminRoles = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
