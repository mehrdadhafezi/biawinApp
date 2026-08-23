import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrbitItemsService } from './orbit-items.service';

describe('OrbitItemsService', () => {
  let service: OrbitItemsService;
  let prisma: {
    orbitItem: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      orbitItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'uuid-1',
            title: 'پوشاک',
            imageKey: 'orbit/orbit_01_clothing.webp',
            sortOrder: 2,
            isActive: true,
            positionConfig: { leftPercent: 50, topPercent: 25.4 },
            animationConfig: { variant: 'b', delaySeconds: -0.47 },
          },
        ]),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrbitItemsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrbitItemsService);
  });

  it('resolves imageUrl from imageKey via the static asset bridge', async () => {
    const [item] = await service.listPublic();
    expect(item.imageKey).toBe('orbit/orbit_01_clothing.webp');
    expect(item.imageUrl).toBe('/orbit/orbit_01_clothing.webp');
    expect(item.active).toBe(true);
    expect(item.position).toEqual({ leftPercent: 50, topPercent: 25.4 });
  });

  it('queries only active items ordered by sortOrder', async () => {
    await service.listPublic();
    expect(prisma.orbitItem.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  });
});
