import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { InstallmentsController } from './installments.controller';
import { InstallmentsService } from './installments.service';

describe('InstallmentsController', () => {
  let controller: InstallmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstallmentsController],
      providers: [
        InstallmentsService,
        {
          provide: PrismaService,
          useValue: {
            installment: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((ops: Promise<unknown>[]) =>
              Promise.all(ops),
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(InstallmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
