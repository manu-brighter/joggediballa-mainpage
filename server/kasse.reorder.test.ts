/**
 * `reorderProducts` bekommt die vollständige neue Reihenfolge und setzt
 * `displayOrder` auf den Index. Eine doppelte ID in dieser Liste hiesse, dass
 * zwei Positionen dasselbe Produkt beanspruchen — der Rest der Liste rutschte
 * dann still um eins, in eine Reihenfolge, die niemand so geklickt hat. Der
 * Router lehnt das ab, bevor die DB überhaupt gefragt wird.
 *
 * `server/db.ts` wird gemockt, damit die Berechtigung ohne DB durchlässt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getDb: async () => null,
    getAllPermissions: async () => [
      { id: 1, permissionKey: 'manage_kasse', role: 'admin' },
    ],
  };
});

const { appRouter } = await import('./routers');
const { clearPermissionCache } = await import('./permissions');
import type { TrpcContext } from './_core/context';

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: 'test-admin',
      email: 'x@example.com',
      name: 'admin',
      loginMethod: 'google',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext['user'],
    req: { headers: {}, protocol: 'https' } as TrpcContext['req'],
    res: { clearCookie: () => undefined } as unknown as TrpcContext['res'],
  };
}

describe('kasse.reorderProducts', () => {
  beforeEach(() => {
    clearPermissionCache();
  });

  it('lehnt doppelte Produkt-IDs ab', async () => {
    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.kasse.reorderProducts({ ids: [3, 1, 3] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('lehnt eine leere Liste ab', async () => {
    const caller = appRouter.createCaller(adminCtx());
    await expect(caller.kasse.reorderProducts({ ids: [] })).rejects.toThrow();
  });

  it('kommt bei sauberer Liste bis zur DB-Schicht', async () => {
    // Der DB-Stub liefert null aus getDb(); reorderKasseProducts wirft dann.
    // Geprüft wird nur, dass die Eingabevalidierung sie durchgelassen hat.
    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.kasse.reorderProducts({ ids: [3, 1, 2] }),
    ).rejects.toThrow(/Database not available/);
  });
});

describe('kasse.listClosedOrders: Filter', () => {
  it('nimmt waiterName und categoryKeys entgegen', async () => {
    // Beide Filter laufen serverseitig, vor dem LIMIT von 50. Ohne sie sah
    // eine Servicekraft „nichts abgeschlossen“, sobald die 50 neuesten
    // Bestellungen von anderen stammten.
    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.kasse.listClosedOrders({
        token: 'egal',
        waiterName: 'Anna',
        categoryKeys: ['food', 'weiteres'],
      }),
    ).rejects.toThrow(/Database not available/);
  });

  it('lehnt einen zu langen Namen ab', async () => {
    const caller = appRouter.createCaller(adminCtx());
    await expect(
      caller.kasse.listClosedOrders({
        token: 'egal',
        waiterName: 'x'.repeat(61),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
