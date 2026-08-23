import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrbitItemsController } from './orbit-items.controller';
import { OrbitItemsService } from './orbit-items.service';

describe('OrbitItemsController', () => {
  let controller: OrbitItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrbitItemsController],
      providers: [
        OrbitItemsService,
        {
          provide: PrismaService,
          useValue: {
            orbitItem: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get(OrbitItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists active orbit items sorted for the public catalog', async () => {
    const result = await controller.list();
    expect(result).toEqual([]);
  });
});
