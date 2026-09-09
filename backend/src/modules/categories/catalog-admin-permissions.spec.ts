import { AdminRole } from '@prisma/client';
import { ADMIN_ROLES_KEY } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CardProductsAdminController } from '../cards/card-products-admin.controller';
import { ServicesAdminController } from '../services/services-admin.controller';
import { CategoriesAdminController } from './categories-admin.controller';

/**
 * SERVICES-R5.17 — "permission tests" for the 3 new catalog admin
 * controllers, at the same configuration level as
 * `home-admin-permissions.spec.ts` (Stage 5.19). No new AdminRole was
 * added — see docs/services-r5-17-admin-catalog-cms.md "RBAC" — so every
 * mutation here declares the same [SUPER_ADMIN, CONTENT_EDITOR] pair as
 * every other Admin CRUD surface in this codebase, and every read is open
 * to any authenticated admin, including SUPPORT_VIEWER.
 */
describe('Catalog admin controllers — role restrictions', () => {
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
    mutations: string[];
    reads: string[];
  }[] = [
    {
      name: 'CategoriesAdminController',
      Controller: CategoriesAdminController,
      mutations: ['create', 'update', 'reorder'],
      reads: ['list', 'findOne'],
    },
    {
      name: 'ServicesAdminController',
      Controller: ServicesAdminController,
      mutations: ['create', 'update'],
      reads: ['list', 'findOne'],
    },
    {
      name: 'CardProductsAdminController',
      Controller: CardProductsAdminController,
      mutations: ['create', 'update'],
      reads: ['list', 'findOne'],
    },
  ];

  it.each(controllers)(
    '$name: mutations require SUPER_ADMIN or CONTENT_EDITOR; a SUPPORT_VIEWER is denied',
    ({ Controller, mutations }) => {
      const proto = Controller.prototype as unknown as Record<string, object>;
      for (const method of mutations) {
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
        expect(
          guard.canActivate(mockContext(proto[method], AdminRole.SUPER_ADMIN)),
        ).toBe(true);
      }
    },
  );

  it.each(controllers)(
    '$name: reads declare no role restriction — any authenticated admin, including SUPPORT_VIEWER, can view',
    ({ Controller, reads }) => {
      const proto = Controller.prototype as unknown as Record<string, object>;
      for (const method of reads) {
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
