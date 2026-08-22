import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

describe('AdvisorController', () => {
  let controller: AdvisorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvisorController],
      providers: [
        AdvisorService,
        {
          provide: PrismaService,
          useValue: {
            advisorPersona: {
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

    controller = module.get(AdvisorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
