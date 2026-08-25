import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        AdminAuthService,
        JwtService,
        {
          provide: PrismaService,
          useValue: { adminUser: {}, adminRefreshToken: {} },
        },
        { provide: AdminAuditLogService, useValue: { record: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(() => 'test-secret'),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
