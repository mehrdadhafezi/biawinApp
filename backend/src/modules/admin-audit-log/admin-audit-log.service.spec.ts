import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from './admin-audit-log.service';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;
  let prisma: {
    adminAuditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      adminAuditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AdminAuditLogService);
  });

  it('creates an audit log row with the given actor, action, and resource', async () => {
    await service.record({
      adminUserId: 'admin-1',
      action: 'LOGIN_SUCCESS',
      resourceType: 'AdminUser',
      resourceId: 'admin-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: 'admin-1',
        action: 'LOGIN_SUCCESS',
        resourceType: 'AdminUser',
        resourceId: 'admin-1',
        beforeJson: undefined,
        afterJson: undefined,
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    });
  });

  it('records a null adminUserId (e.g. a failed login for an unknown email) without throwing', async () => {
    await service.record({
      adminUserId: null,
      action: 'LOGIN_FAILED',
      resourceType: 'AdminUser',
      afterJson: { email: 'unknown@biawin.ir', reason: 'not_found' },
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: null,
        action: 'LOGIN_FAILED',
        resourceType: 'AdminUser',
        resourceId: null,
        beforeJson: undefined,
        afterJson: { email: 'unknown@biawin.ir', reason: 'not_found' },
        ip: undefined,
        userAgent: undefined,
      },
    });
  });

  it('never throws when the underlying write fails — a transient audit failure must not break the caller', async () => {
    prisma.adminAuditLog.create.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.record({
        adminUserId: 'admin-1',
        action: 'LOGIN_SUCCESS',
        resourceType: 'AdminUser',
      }),
    ).resolves.toBeUndefined();
  });
});
