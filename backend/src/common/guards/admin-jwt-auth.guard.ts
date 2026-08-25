import {
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedAdminUser } from '../../modules/admin-auth/types/authenticated-admin-user.type';

/**
 * Applied explicitly per-route via `@UseGuards(AdminJwtAuthGuard)` — never
 * registered globally. Admin controllers instead carry `@Public()` (the
 * decorator the global *customer* JwtAuthGuard already honors) so the
 * customer guard skips them entirely; this guard is what actually protects
 * them. This is a deliberate reuse of `@Public()` for its literal meaning
 * ("exempt from the global customer guard"), not a claim that these routes
 * have no auth — read `@Public() + @UseGuards(AdminJwtAuthGuard)` together.
 *
 * Overrides `handleRequest` to attach the validated admin to
 * `request.adminUser` instead of passport's default `request.user`, so it
 * can never collide with (or be misread through) the customer `CurrentUser`
 * decorator on a route that — by mistake — carries both guards.
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest<TUser = AuthenticatedAdminUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('احراز هویت ادمین نامعتبر است.');
    }
    const request = context.switchToHttp().getRequest<{ adminUser?: TUser }>();
    request.adminUser = user;
    return user;
  }
}
