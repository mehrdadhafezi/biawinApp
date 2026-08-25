import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { AdminAuditLogService } from './admin-audit-log.service';

describe('AdminAuditLogController', () => {
  let controller: AdminAuditLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditLogController],
      providers: [
        AdminAuditLogService,
        {
          provide: PrismaService,
          useValue: {
            adminAuditLog: {
              create: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            $transaction: jest.fn((ops: Promise<unknown>[]) =>
              Promise.all(ops),
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminAuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
