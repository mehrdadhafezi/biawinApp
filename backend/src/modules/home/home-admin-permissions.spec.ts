import { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { HomeHeroCardsAdminController } from './home-hero-cards-admin.controller';
import { HomeNewsArticlesAdminController } from './home-news-articles-admin.controller';
import { HomeServiceBannersAdminController } from './home-service-banners-admin.controller';
import { HomeServiceMosaicTilesAdminController } from './home-service-mosaic-tiles-admin.controller';

/**
 * "Permission checks work" for all 4 Home CMS admin controllers, at the
 * configuration level — `AdminRolesGuard`'s own decision logic already has
 * its own passing tests (Stage 5.16); what's specific here is confirming
 * every mutation (`create`/`update`/`remove`/`reorder`) actually declares
 * `[SUPER_ADMIN, CONTENT_EDITOR]` and every read (`list`/`findOne`)
 * deliberately doesn't (any authenticated admin, including
 * `SUPPORT_VIEWER`, can view) — mirrors `media.controller.spec.ts` exactly.
 */
describe('Home CMS admin controllers — role restrictions', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new AdminRolesGuard(reflector as never);

  function mockContext(handler: unknown, role: AdminRole) {
    return {
      getHandler: () => handler,
      getClass: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ adminUser: { role } }) }),
    } as never;
  }

  beforeEach(() => reflector.getAllAndOverride.mockReset());

  const controllers: {
    name: string;
    Controller: new (...args: never[]) => object;
  }[] = [
    {
      name: 'HomeHeroCardsAdminController',
      Controller: HomeHeroCardsAdminController,
    },
    {
      name: 'HomeServiceBannersAdminController',
      Controller: HomeServiceBannersAdminController,
    },
    {
      name: 'HomeServiceMosaicTilesAdminController',
      Controller: HomeServiceMosaicTilesAdminController,
    },
    {
      name: 'HomeNewsArticlesAdminController',
      Controller: HomeNewsArticlesAdminController,
    },
  ];

  it.each(controllers)(
    '$name: create/update/remove/reorder require SUPER_ADMIN or CONTENT_EDITOR; a SUPPORT_VIEWER is denied',
    ({ Controller }) => {
      const proto = Controller.prototype as unknown as Record<string, object>;
      for (const method of ['create', 'update', 'remove', 'reorder']) {
        const declaredRoles = Reflect.getMetadata(
          ADMIN_ROLES_KEY,
          proto[method],
        ) as AdminRole[];
        expect(declaredRoles).toEqual([
          AdminRole.SUPER_ADMIN,
          AdminRole.CONTENT_EDITOR,
        ]);

        reflector.getAllAndOverride.mockReturnValue(declaredRoles);
        expect(
          guard.canActivate(
            mockContext(proto[method], AdminRole.SUPPORT_VIEWER),
          ),
        ).toBe(false);
        expect(
          guard.canActivate(
            mockContext(proto[method], AdminRole.CONTENT_EDITOR),
          ),
        ).toBe(true);
      }
    },
  );

  it.each(controllers)(
    '$name: list/findOne declare no role restriction — any authenticated admin can view',
    ({ Controller }) => {
      const proto = Controller.prototype as unknown as Record<string, object>;
      for (const method of ['list', 'findOne']) {
        expect(
          Reflect.getMetadata(ADMIN_ROLES_KEY, proto[method]),
        ).toBeUndefined();

        reflector.getAllAndOverride.mockReturnValue(undefined);
        expect(
          guard.canActivate(
            mockContext(proto[method], AdminRole.SUPPORT_VIEWER),
          ),
        ).toBe(true);
      }
    },
  );
});
