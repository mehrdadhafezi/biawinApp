import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: {
    create: jest.Mock;
    list: jest.Mock;
    findOneOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    ordersService = {
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findOneOrThrow: jest.fn().mockResolvedValue({ id: 'order-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

    controller = module.get(OrdersController);
  });

  it('requires authentication: no route on this controller opts out of the global guard', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OrdersController),
    ).toBeUndefined();
    /* eslint-disable @typescript-eslint/unbound-method -- reading
       reflect-metadata off the prototype, never invoking these as methods. */
    for (const handler of [
      OrdersController.prototype.create,
      OrdersController.prototype.list,
      OrdersController.prototype.findOne,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('creates an order scoped to the authenticated user, never a client-supplied one', async () => {
    const dto = {
      serviceId: 's1',
      method: 'free' as const,
      idempotencyKey: 'k1',
    };
    await controller.create({ userId: 'user-1', phone: '0000000000' }, dto);
    expect(ordersService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('lists orders scoped to the authenticated user', async () => {
    await controller.list(
      { userId: 'user-1', phone: '0000000000' },
      { page: 1, limit: 20, skip: 0 },
    );
    expect(ordersService.list).toHaveBeenCalledWith('user-1', 0, 20);
  });

  it('looks up a single order scoped to the authenticated user', async () => {
    await controller.findOne(
      { userId: 'user-1', phone: '0000000000' },
      'order-1',
    );
    expect(ordersService.findOneOrThrow).toHaveBeenCalledWith(
      'order-1',
      'user-1',
    );
  });
});
