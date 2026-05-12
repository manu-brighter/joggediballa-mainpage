import { describe, expect, it } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: () => {},
    } as TrpcContext['res'],
  };
}

describe('system.health', () => {
  // B-P1-08 / F-BE-025: parameterless probe — must accept no input so that
  // k8s liveness / uptime monitors can hit it with a plain GET.
  it('returns status:ok with an ISO timestamp', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.system.health();

    expect(result.status).toBe('ok');
    expect(typeof result.time).toBe('string');
    expect(() => new Date(result.time)).not.toThrow();
    expect(new Date(result.time).toISOString()).toBe(result.time);
  });
});
