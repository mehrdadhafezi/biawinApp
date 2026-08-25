import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { ADMIN_ROLES_KEY } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

/* eslint-disable @typescript-eslint/unbound-method -- every `MediaController.prototype.X` reference below is used purely as an opaque Reflect-metadata key / mock ExecutionContext handler, never invoked with `this`, so the rule's actual concern (losing `this` binding on a call) doesn't apply. */

describe('MediaController', () => {
  let controller: MediaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,
        {
          provide: MediaStorageService,
          useValue: {
            buildKey: jest.fn(),
            store: jest.fn(),
            remove: jest.fn(),
            resolvePublicUrl: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: { mediaAsset: {} } },
        { provide: AdminAuditLogService, useValue: { record: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn(() => 'x') },
        },
      ],
    }).compile();

    controller = module.get(MediaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /**
   * "Permission rejection" for Media, at the configuration level:
   * `AdminRolesGuard`'s own decision logic already has its own passing
   * tests (Stage 5.16) — what's specific to Media is confirming upload/
   * delete actually declare the restriction and list/detail deliberately
   * don't (any authenticated admin, including SUPPORT_VIEWER, can view).
   * Exercised as a real guard decision, not just metadata presence, via
   * `AdminRolesGuard.canActivate()` itself with a mocked request.
   */
  describe('role restrictions', () => {
    const reflector = { getAllAndOverride: jest.fn() };
    const guard = new AdminRolesGuard(reflector as never);

    function mockContext(handler: unknown, role: AdminRole) {
      return {
        getHandler: () => handler,
        getClass: () => MediaController,
        switchToHttp: () => ({ getRequest: () => ({ adminUser: { role } }) }),
      } as never;
    }

    beforeEach(() => reflector.getAllAndOverride.mockReset());

    it('upload requires SUPER_ADMIN or CONTENT_EDITOR — a SUPPORT_VIEWER is denied', () => {
      const declaredRoles = Reflect.getMetadata(
        ADMIN_ROLES_KEY,
        MediaController.prototype.upload,
      ) as AdminRole[];
      expect(declaredRoles).toEqual([
        AdminRole.SUPER_ADMIN,
        AdminRole.CONTENT_EDITOR,
      ]);

      reflector.getAllAndOverride.mockReturnValue(declaredRoles);
      expect(
        guard.canActivate(
          mockContext(
            MediaController.prototype.upload,
            AdminRole.SUPPORT_VIEWER,
          ),
        ),
      ).toBe(false);
      expect(
        guard.canActivate(
          mockContext(
            MediaController.prototype.upload,
            AdminRole.CONTENT_EDITOR,
          ),
        ),
      ).toBe(true);
    });

    it('delete requires SUPER_ADMIN or CONTENT_EDITOR — a SUPPORT_VIEWER is denied', () => {
      const declaredRoles = Reflect.getMetadata(
        ADMIN_ROLES_KEY,
        MediaController.prototype.remove,
      ) as AdminRole[];
      expect(declaredRoles).toEqual([
        AdminRole.SUPER_ADMIN,
        AdminRole.CONTENT_EDITOR,
      ]);

      reflector.getAllAndOverride.mockReturnValue(declaredRoles);
      expect(
        guard.canActivate(
          mockContext(
            MediaController.prototype.remove,
            AdminRole.SUPPORT_VIEWER,
          ),
        ),
      ).toBe(false);
    });

    it('list/detail declare no role restriction — any authenticated admin, including SUPPORT_VIEWER, can view', () => {
      expect(
        Reflect.getMetadata(ADMIN_ROLES_KEY, MediaController.prototype.list),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(ADMIN_ROLES_KEY, MediaController.prototype.findOne),
      ).toBeUndefined();

      reflector.getAllAndOverride.mockReturnValue(undefined);
      expect(
        guard.canActivate(
          mockContext(MediaController.prototype.list, AdminRole.SUPPORT_VIEWER),
        ),
      ).toBe(true);
    });
  });
});
