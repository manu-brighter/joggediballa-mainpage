/**
 * Service- und Küchenseite laufen ohne Login — der Zugang hängt allein am
 * Token. Diese Tests prüfen, dass ohne gültigen Token nichts geht.
 *
 * Integrationstests gegen die echte DB (wie slideshow/shotcounter); in CI
 * übersprungen, weil dort keine Infrastruktur läuft. Sie schreiben nichts:
 * `createOrder` scheitert am Token, bevor irgendetwas angelegt wird.
 */
import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { getKasseSettings } from './kasse_db';

const skipIntegration = !!process.env.CI;

function anonCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: () => {} } as unknown as TrpcContext['res'],
  };
}

describe('kasse — Token-Gate', () => {
  it.skipIf(skipIntegration)(
    'publicState liefert valid:false bei falschem Token',
    async () => {
      const caller = appRouter.createCaller(anonCtx());
      const state = await caller.kasse.publicState({ token: 'nope' });
      expect(state.valid).toBe(false);
      expect(state.session).toBeNull();
    },
  );

  it.skipIf(skipIntegration)(
    'publicState liefert valid:true beim richtigen Token',
    async () => {
      const settings = await getKasseSettings();
      const caller = appRouter.createCaller(anonCtx());
      const state = await caller.kasse.publicState({
        token: settings.accessToken,
      });
      expect(state.valid).toBe(true);
    },
  );

  it.skipIf(skipIntegration)('menu weist einen falschen Token ab', async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.kasse.menu({ token: 'nope' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it.skipIf(skipIntegration)(
    'listOpenOrders weist einen falschen Token ab',
    async () => {
      const caller = appRouter.createCaller(anonCtx());
      await expect(
        caller.kasse.listOpenOrders({ token: 'nope' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  it.skipIf(skipIntegration)(
    'createOrder weist einen falschen Token ab, bevor etwas geschrieben wird',
    async () => {
      const caller = appRouter.createCaller(anonCtx());
      await expect(
        caller.kasse.createOrder({
          token: 'nope',
          tableId: 1,
          items: [{ productId: 1, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  it.skipIf(skipIntegration)(
    'setOrderStatus weist einen falschen Token ab',
    async () => {
      const caller = appRouter.createCaller(anonCtx());
      await expect(
        caller.kasse.setOrderStatus({
          token: 'nope',
          orderId: 1,
          status: 'ready',
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  it.skipIf(skipIntegration)(
    'menu liefert nur aktive Produkte und Tische',
    async () => {
      const settings = await getKasseSettings();
      const caller = appRouter.createCaller(anonCtx());
      const menu = await caller.kasse.menu({ token: settings.accessToken });
      expect(Array.isArray(menu.products)).toBe(true);
      expect(Array.isArray(menu.tables)).toBe(true);
      for (const product of menu.products) {
        expect(typeof product.priceRappen).toBe('number');
      }
    },
  );
});
