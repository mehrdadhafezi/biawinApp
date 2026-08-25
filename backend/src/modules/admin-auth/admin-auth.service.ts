import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminRole, AdminUser } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { verifyPassword } from './password-hash.util';

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  lastLoginAt: Date | null;
}

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * Deliberately independent of `AuthService` (customer): separate table
 * (`AdminUser`, not `User`), separate credential type (email+password, not
 * phone+OTP), separate JWT secret/audience, separate refresh-token table
 * (`AdminRefreshToken`, not `RefreshToken`) — see
 * docs/admin-architecture-decision-record.md §3. No code path here ever
 * reads or writes a customer `User`/`RefreshToken` row.
 *
 * Login-failure messages are deliberately NOT uniform: "wrong email or
 * password" is generic (an unknown email and a wrong password return the
 * identical message, so a caller can't use the response to enumerate valid
 * admin emails), but "account disabled" / "account locked" are distinct and
 * specific. This is intentional for a small, internal, staff-only surface
 * (not a public-abuse target the way customer auth is): a locked-out admin
 * should know why, rather than retry blindly and extend their own lockout.
 * The audit log records the real reason either way, regardless of what the
 * client is told.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: SessionMeta,
  ): Promise<AdminAuthTokens> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!admin) {
      await this.auditLog.record({
        adminUserId: null,
        action: 'LOGIN_FAILED',
        resourceType: 'AdminUser',
        afterJson: { email, reason: 'not_found' },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است.');
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await this.auditLog.record({
        adminUserId: admin.id,
        action: 'LOGIN_FAILED',
        resourceType: 'AdminUser',
        resourceId: admin.id,
        afterJson: { reason: 'locked', lockedUntil: admin.lockedUntil },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException(
        'حساب کاربری به دلیل تلاش‌های ناموفق مکرر موقتاً قفل شده است.',
      );
    }

    if (!admin.active) {
      await this.auditLog.record({
        adminUserId: admin.id,
        action: 'LOGIN_FAILED',
        resourceType: 'AdminUser',
        resourceId: admin.id,
        afterJson: { reason: 'disabled' },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('این حساب کاربری غیرفعال شده است.');
    }

    const passwordValid = await verifyPassword(password, admin.passwordHash);
    if (!passwordValid) {
      await this.registerFailedAttempt(admin);
      await this.auditLog.record({
        adminUserId: admin.id,
        action: 'LOGIN_FAILED',
        resourceType: 'AdminUser',
        resourceId: admin.id,
        afterJson: { reason: 'bad_password' },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است.');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.issueTokens(
      admin.id,
      admin.email,
      admin.role,
      meta,
    );

    await this.auditLog.record({
      adminUserId: admin.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AdminUser',
      resourceId: admin.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async refresh(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<AdminAuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('نشست منقضی شده است، دوباره وارد شوید.');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: record.adminUserId },
    });
    if (!admin || !admin.active) {
      throw new UnauthorizedException(
        'حساب کاربری ادمین نامعتبر یا غیرفعال است.',
      );
    }

    await this.prisma.adminRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(admin.id, admin.email, admin.role, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
    });

    await this.prisma.adminRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (record) {
      await this.auditLog.record({
        adminUserId: record.adminUserId,
        action: 'LOGOUT',
        resourceType: 'AdminUser',
        resourceId: record.adminUserId,
      });
    }
  }

  async getProfile(adminUserId: string): Promise<AdminProfile> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  private async registerFailedAttempt(admin: AdminUser): Promise<void> {
    const maxAttempts = this.config.get<number>('ADMIN_LOGIN_MAX_ATTEMPTS', 5);
    const lockMinutes = this.config.get<number>('ADMIN_LOGIN_LOCK_MINUTES', 15);

    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (updated.failedLoginAttempts >= maxAttempts) {
      await this.prisma.adminUser.update({
        where: { id: admin.id },
        data: { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) },
      });
    }
  }

  private async issueTokens(
    adminUserId: string,
    email: string,
    role: AdminRole,
    meta: SessionMeta,
  ): Promise<AdminAuthTokens> {
    const accessTtl = this.config.get<string>('ADMIN_JWT_ACCESS_TTL', '10m');
    const accessTtlSeconds = parseTtlToSeconds(accessTtl);
    const accessToken = await this.jwt.signAsync(
      { sub: adminUserId, email, role },
      {
        secret: this.config.getOrThrow<string>('ADMIN_JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSeconds,
        audience: 'admin',
        issuer: 'biawin-admin',
      },
    );

    const refreshTtlDays = this.config.get<number>(
      'ADMIN_JWT_REFRESH_TTL_DAYS',
      7,
    );
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.adminRefreshToken.create({
      data: {
        adminUserId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/** Parses "10m" / "1h" / "7d" style TTL strings (as used by @nestjs/jwt) into seconds. */
function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 600;
  const [, value, unit] = match;
  const n = Number(value);
  const perUnit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (perUnit[unit] ?? 1);
}
