import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuthService } from './admin-auth.service';
import { hashPassword } from './password-hash.util';

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- `expect.any(...)`/
   `expect.objectContaining(...)` are typed `any` in @types/jest; every use
   below is a plain Jest assertion helper, not a real unsafe value. */

const CONFIG_VALUES: Record<string, unknown> = {
  ADMIN_LOGIN_MAX_ATTEMPTS: 5,
  ADMIN_LOGIN_LOCK_MINUTES: 15,
  ADMIN_JWT_ACCESS_TTL: '10m',
  ADMIN_JWT_REFRESH_TTL_DAYS: 7,
  ADMIN_JWT_ACCESS_SECRET: 'test-admin-access-secret-at-least-16',
};

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let prisma: {
    adminUser: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    adminRefreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let auditLog: { record: jest.Mock };

  const meta = { ip: '127.0.0.1', userAgent: 'jest' };
  let correctPasswordHash: string;

  beforeAll(async () => {
    correctPasswordHash = await hashPassword('correct-horse-battery');
  });

  function makeAdmin(overrides: Record<string, unknown> = {}) {
    return {
      id: 'admin-1',
      email: 'admin@biawin.ir',
      passwordHash: correctPasswordHash,
      fullName: 'Test Admin',
      role: 'SUPER_ADMIN',
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      adminUser: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      adminRefreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminAuditLogService, useValue: auditLog },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown): unknown =>
              CONFIG_VALUES[key] ?? fallback,
            getOrThrow: (key: string): unknown => CONFIG_VALUES[key],
          },
        },
      ],
    }).compile();

    service = module.get(AdminAuthService);
  });

  describe('login', () => {
    it('succeeds with correct email/password, issues tokens, and records a LOGIN_SUCCESS audit entry', async () => {
      const admin = makeAdmin();
      prisma.adminUser.findUnique.mockResolvedValue(admin);
      prisma.adminUser.update.mockResolvedValue(admin);

      const result = await service.login(
        'admin@biawin.ir',
        'correct-horse-battery',
        meta,
      );

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.expiresIn).toBe(600);
      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_SUCCESS',
          resourceType: 'AdminUser',
        }),
      );
    });

    it('rejects an unknown email with a generic error and records a LOGIN_FAILED audit entry (no adminUserId)', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nobody@biawin.ir', 'whatever12', meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: null,
          action: 'LOGIN_FAILED',
          afterJson: expect.objectContaining({ reason: 'not_found' }),
        }),
      );
    });

    it('rejects a wrong password, increments failedLoginAttempts, and records a LOGIN_FAILED audit entry', async () => {
      const admin = makeAdmin({ failedLoginAttempts: 1 });
      prisma.adminUser.findUnique.mockResolvedValue(admin);
      prisma.adminUser.update.mockResolvedValue({
        ...admin,
        failedLoginAttempts: 2,
      });

      await expect(
        service.login('admin@biawin.ir', 'totally-wrong-password', meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_FAILED',
          afterJson: expect.objectContaining({ reason: 'bad_password' }),
        }),
      );
    });

    it('locks the account after reaching the max failed-attempt threshold', async () => {
      const admin = makeAdmin({ failedLoginAttempts: 4 });
      prisma.adminUser.findUnique.mockResolvedValue(admin);
      prisma.adminUser.update
        .mockResolvedValueOnce({ ...admin, failedLoginAttempts: 5 }) // increment call
        .mockResolvedValueOnce({}); // lockedUntil-set call

      await expect(
        service.login('admin@biawin.ir', 'totally-wrong-password', meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.adminUser.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'admin-1' },
        data: { lockedUntil: expect.any(Date) },
      });
    });

    it('rejects a disabled admin user without checking the password, and records the reason', async () => {
      const admin = makeAdmin({ active: false });
      prisma.adminUser.findUnique.mockResolvedValue(admin);

      await expect(
        service.login('admin@biawin.ir', 'correct-horse-battery', meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_FAILED',
          afterJson: expect.objectContaining({ reason: 'disabled' }),
        }),
      );
      // password path never reached — no counter mutation for a disabled account
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it('rejects a locked admin user before checking active/password', async () => {
      const admin = makeAdmin({
        lockedUntil: new Date(Date.now() + 60_000),
      });
      prisma.adminUser.findUnique.mockResolvedValue(admin);

      await expect(
        service.login('admin@biawin.ir', 'correct-horse-battery', meta),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_FAILED',
          afterJson: expect.objectContaining({ reason: 'locked' }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and records a LOGOUT audit entry', async () => {
      prisma.adminRefreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        adminUserId: 'admin-1',
      });

      await service.logout('some-refresh-token');

      expect(prisma.adminRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ adminUserId: 'admin-1', action: 'LOGOUT' }),
      );
    });
  });
});
