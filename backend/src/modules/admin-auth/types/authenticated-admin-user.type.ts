import type { AdminRole } from '@prisma/client';

export interface AuthenticatedAdminUser {
  adminUserId: string;
  email: string;
  role: AdminRole;
}
