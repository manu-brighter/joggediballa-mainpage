/**
 * A-P0-05: attendance mutations must require the `manage_attendance`
 * permission, not just any logged-in user.
 *
 * We mock server/db.ts so the permission lookup returns a fixed set, with
 * `manage_attendance` only granted to admin + maintainer. No DB required.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getDb: async () => null,
    getAllPermissions: async () => [
      { id: 1, permissionKey: 'manage_attendance', role: 'admin' },
      { id: 2, permissionKey: 'manage_attendance', role: 'maintainer' },
    ],
  };
});

const { appRouter } = await import('./routers');
const { clearPermissionCache } = await import('./permissions');
import type { TrpcContext } from './_core/context';

function makeCtx(
  role: 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor',
): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'test-' + role,
      email: 'x@example.com',
      name: role,
      loginMethod: 'google',
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { headers: {}, protocol: 'https' } as any,
    res: { clearCookie: () => undefined } as any,
  };
}

describe('attendance permissions (A-P0-05)', () => {
  beforeEach(() => {
    clearPermissionCache();
  });

  it("rejects a 'user' role calling createMember", async () => {
    const caller = appRouter.createCaller(makeCtx('user'));
    await expect(
      caller.attendance.createMember({ name: 'Test Member' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("rejects a 'user' calling deleteSession", async () => {
    const caller = appRouter.createCaller(makeCtx('user'));
    await expect(
      caller.attendance.deleteSession({ sessionId: 1 }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows an 'admin' past the permission gate", async () => {
    // The DB stub returns null from getDb(); the attendance_db helpers handle
    // that gracefully or throw a non-FORBIDDEN error. We only assert that the
    // call did NOT throw FORBIDDEN — i.e. the auth middleware let it through.
    const caller = appRouter.createCaller(makeCtx('admin'));
    let caughtCode: string | null = null;
    try {
      await caller.attendance.createMember({ name: 'Admin Test Member' });
    } catch (err) {
      if (err instanceof TRPCError) caughtCode = err.code;
    }
    expect(caughtCode).not.toBe('FORBIDDEN');
  });

  it("allows a 'maintainer' past the permission gate", async () => {
    const caller = appRouter.createCaller(makeCtx('maintainer'));
    let caughtCode: string | null = null;
    try {
      await caller.attendance.createMember({ name: 'Maintainer Test Member' });
    } catch (err) {
      if (err instanceof TRPCError) caughtCode = err.code;
    }
    expect(caughtCode).not.toBe('FORBIDDEN');
  });
});
