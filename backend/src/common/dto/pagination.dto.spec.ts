import { plainToInstance } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';
import { ListCardProductsQueryDto } from '../../modules/cards/dto/list-card-products-query.dto';

/**
 * SERVICES-R5.24 — `skip` is a getter-only computed value (`(page - 1) *
 * limit`), never a real client input. Nest's global `ValidationPipe`
 * (`transform: true`, `backend/src/main.ts`) builds every `@Query()` DTO
 * via `class-transformer`'s `plainToInstance()`, which assigns every
 * matching key from the raw query object onto the new instance —
 * including a stray `?skip=` a caller sends, even though it has no
 * `@IsInt()`/validator decorator and was never meant to be settable.
 * Before this stage, that assignment crashed with an unhandled
 * `TypeError: Cannot set property skip of #<PaginationQueryDto> which
 * has only a getter` for ANY of the 19 endpoints whose query DTO extends
 * `PaginationQueryDto` — reproduced live against `GET /cards?skip=0&limit=100`
 * (docs/services-r5-24-staging-catalog-media-qa-audit.md). This test
 * reproduces the exact same `plainToInstance` call the ValidationPipe
 * performs internally, without needing a full Nest app bootstrap.
 */
describe('PaginationQueryDto', () => {
  it('never throws when a raw `skip` query key is present (the exact crash this stage fixed)', () => {
    expect(() =>
      plainToInstance(PaginationQueryDto, { skip: '0', limit: '100' }),
    ).not.toThrow();
  });

  it('a stray `skip` is silently ignored — `skip` always reflects the real page/limit, never the client-supplied value', () => {
    const instance = plainToInstance(PaginationQueryDto, {
      skip: '999',
      page: '1',
      limit: '5',
    });
    expect(instance.skip).toBe(0);
  });

  it('page/limit still transform to real numbers and drive the computed skip correctly', () => {
    const instance = plainToInstance(PaginationQueryDto, {
      page: '3',
      limit: '10',
    });
    expect(instance.page).toBe(3);
    expect(instance.limit).toBe(10);
    expect(instance.skip).toBe(20);
  });

  it('a subclass (e.g. ListCardProductsQueryDto, the exact class GET /cards uses) is equally protected', () => {
    expect(() =>
      plainToInstance(ListCardProductsQueryDto, {
        skip: '0',
        limit: '100',
        serviceId: 'svc-1',
      }),
    ).not.toThrow();
    const instance = plainToInstance(ListCardProductsQueryDto, {
      skip: '50',
      page: '1',
      limit: '20',
      serviceId: 'svc-1',
    });
    expect(instance.skip).toBe(0);
    expect(instance.serviceId).toBe('svc-1');
  });
});
