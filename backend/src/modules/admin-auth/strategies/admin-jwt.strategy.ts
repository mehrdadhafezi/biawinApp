import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthenticatedAdminUser } from '../types/authenticated-admin-user.type';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Registered under the passport strategy name "admin-jwt" (not the default
 * "jwt" the customer JwtStrategy uses) so the two never collide, and signed/
 * verified against ADMIN_JWT_ACCESS_SECRET — a secret distinct from
 * JWT_ACCESS_SECRET (docs/admin-architecture-decision-record.md §3/§12.1).
 * `audience`/`issuer` are checked in addition to the secret so a
 * misconfiguration that ever pointed both strategies at the same secret
 * would still fail closed, not open.
 *
 * Unlike the customer JwtStrategy (which trusts the token payload for the
 * lifetime of its TTL with no DB round-trip), this strategy re-checks
 * `AdminUser.active` on every request. Admin access must be revocable
 * immediately — disabling a compromised or terminated staff account
 * shouldn't have to wait out an already-issued token's TTL — and the cost is
 * one indexed primary-key lookup per authenticated admin request, which is
 * negligible at this project's admin traffic volume.
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('ADMIN_JWT_ACCESS_SECRET'),
      audience: 'admin',
      issuer: 'biawin-admin',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AuthenticatedAdminUser> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.active) {
      throw new UnauthorizedException(
        'حساب کاربری ادمین نامعتبر یا غیرفعال است.',
      );
    }

    return { adminUserId: admin.id, email: admin.email, role: admin.role };
  }
}
