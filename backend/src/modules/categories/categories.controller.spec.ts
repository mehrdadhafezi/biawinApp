import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MediaStorageService } from '../media/media-storage.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((ops: Promise<unknown>[]) =>
              Promise.all(ops),
            ),
          },
        },
        {
          provide: MediaStorageService,
          useValue: {
            resolvePublicUrl: jest.fn(
              (key: string) => `https://media.test/${key}`,
            ),
          },
        },
        {
          provide: AdminAuditLogService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
