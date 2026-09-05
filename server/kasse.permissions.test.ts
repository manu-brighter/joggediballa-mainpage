/**
 * Die Verwaltungs-Procedures der Kasse müssen `manage_kasse` verlangen. Ein
 * eingeloggter User allein reicht nicht (gleiche Logik wie A-P0-05 bei der
 * Anwesenheitsliste).
 *
 * `server/db.ts` wird gemockt, damit der Permission-Lookup eine feste Menge
 * liefert: `manage_kasse` nur für admin + maintainer. Keine DB nötig.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getDb: async () => null,
    getAllPermissions: async () => [
      { id: 1, permissionKey: 'manage_kasse', role: 'admin' },
      { id: 2, permissionKey: 'manage_kasse', role: 'maintainer' },
    ],
  };
});

const { appRouter } = await import('./routers');
const { clearPermissionCache } = await import('./permissions');
import type { TrpcContext } from './_core/context';

function makeCtx(
  role: 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor' | null,
): TrpcContext {
  return {
    user:
      role === null
        ? null
        : ({
            id: 1,
            openId: `test-${role}`,
            email: 'x@example.com',
            name: role,
            loginMethod: 'google',
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as TrpcContext['user']),
    req: { headers: {}, protocol: 'https' } as TrpcContext['req'],
    res: { clearCookie: () => undefined } as unknown as TrpcContext['res'],
  };
}

describe('kasse: Verwaltung verlangt manage_kasse', () => {
  beforeEach(() => {
    clearPermissionCache();
  });

  it('weist einen anonymen Aufruf von getSettings ab', async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.kasse.getSettings()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it("weist die Rolle 'user' bei listProducts ab", async () => {
    const caller = appRouter.createCaller(makeCtx('user'));
    await expect(caller.kasse.listProducts()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it("weist die Rolle 'editor' beim Anlegen eines Produkts ab", async () => {
    const caller = appRouter.createCaller(makeCtx('editor'));
    await expect(
      caller.kasse.createProduct({ name: 'Pommes', priceRappen: 600 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("weist die Rolle 'editor' beim Sortieren der Produkte ab", async () => {
    const caller = appRouter.createCaller(makeCtx('editor'));
    await expect(
      caller.kasse.reorderProducts({ ids: [1, 2] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // Die destruktivste Tisch-Operation: ein Klick räumt die ganze Liste aus.
  it("weist die Rolle 'editor' beim Löschen aller Tische ab", async () => {
    const caller = appRouter.createCaller(makeCtx('editor'));
    await expect(caller.kasse.deleteAllTables()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it("weist die Rolle 'user' beim Öffnen einer Kasse ab", async () => {
    const caller = appRouter.createCaller(makeCtx('user'));
    await expect(
      caller.kasse.openSession({ name: 'Fest' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("lässt 'admin' durch das Permission-Gate", async () => {
    // Der DB-Stub liefert null aus getDb(); die kasse_db-Helfer werfen dann
    // einen nicht-FORBIDDEN-Fehler. Geprüft wird nur, dass die Middleware
    // durchlässt.
    const caller = appRouter.createCaller(makeCtx('admin'));
    let code: string | null = null;
    try {
      await caller.kasse.listProducts();
    } catch (err) {
      if (err instanceof TRPCError) code = err.code;
    }
    expect(code).not.toBe('FORBIDDEN');
  });

  it("lässt 'maintainer' durch das Permission-Gate", async () => {
    const caller = appRouter.createCaller(makeCtx('maintainer'));
    let code: string | null = null;
    try {
      await caller.kasse.listTables();
    } catch (err) {
      if (err instanceof TRPCError) code = err.code;
    }
    expect(code).not.toBe('FORBIDDEN');
  });
});
