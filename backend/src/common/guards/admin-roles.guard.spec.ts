import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AdminRolesGuard } from './admin-roles.guard';

function mockContext(adminUser?: { role: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ adminUser }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminRolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: AdminRolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new AdminRolesGuard(reflector as unknown as Reflector);
  });

  it('denies access when the authenticated admin does not have a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN']);
    const context = mockContext({ role: 'SUPPORT_VIEWER' });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when the authenticated admin has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'SUPER_ADMIN',
      'CONTENT_EDITOR',
    ]);
    const context = mockContext({ role: 'CONTENT_EDITOR' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when the route declares no role restriction at all', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockContext({ role: 'SUPPORT_VIEWER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when no admin user is attached to the request', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPER_ADMIN']);
    const context = mockContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });
});
