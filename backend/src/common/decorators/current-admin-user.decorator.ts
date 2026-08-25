import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedAdminUser } from '../../modules/admin-auth/types/authenticated-admin-user.type';

/**
 * Extracts the admin attached by AdminJwtAuthGuard/AdminJwtStrategy at
 * `request.adminUser` — deliberately a different request property than
 * `request.user` (which CurrentUser/JwtStrategy own), so a route can never
 * accidentally read one authenticated identity through the other's decorator.
 */
export const CurrentAdminUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdminUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ adminUser: AuthenticatedAdminUser }>();
    return request.adminUser;
  },
);
