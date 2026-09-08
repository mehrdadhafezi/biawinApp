import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { CustomerCardsController } from './customer-cards.controller';
import { CustomerCardsService } from './customer-cards.service';

describe('CustomerCardsController', () => {
  let controller: CustomerCardsController;
  let customerCardsService: {
    list: jest.Mock;
    findOneOrThrow: jest.Mock;
    listUsage: jest.Mock;
  };

  beforeEach(async () => {
    customerCardsService = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findOneOrThrow: jest.fn().mockResolvedValue({ id: 'card-1' }),
      listUsage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerCardsController],
      providers: [
        { provide: CustomerCardsService, useValue: customerCardsService },
      ],
    }).compile();

    controller = module.get(CustomerCardsController);
  });

  it('requires authentication: no route on this controller opts out of the global guard', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, CustomerCardsController),
    ).toBeUndefined();
    /* eslint-disable @typescript-eslint/unbound-method -- reading
       reflect-metadata off the prototype, never invoking these as methods. */
    for (const handler of [
      CustomerCardsController.prototype.list,
      CustomerCardsController.prototype.findOne,
      CustomerCardsController.prototype.listUsage,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('lists cards scoped to the authenticated user', async () => {
    await controller.list(
      { userId: 'user-1', phone: '0000000000' },
      { page: 1, limit: 20, skip: 0 },
    );
    expect(customerCardsService.list).toHaveBeenCalledWith('user-1', 0, 20);
  });

  it('looks up a single card scoped to the authenticated user', async () => {
    await controller.findOne(
      { userId: 'user-1', phone: '0000000000' },
      'card-1',
    );
    expect(customerCardsService.findOneOrThrow).toHaveBeenCalledWith(
      'card-1',
      'user-1',
    );
  });

  it('lists usage scoped to the authenticated user', async () => {
    await controller.listUsage(
      { userId: 'user-1', phone: '0000000000' },
      'card-1',
      { page: 1, limit: 20, skip: 0 },
    );
    expect(customerCardsService.listUsage).toHaveBeenCalledWith(
      'card-1',
      'user-1',
      0,
      20,
    );
  });
});
