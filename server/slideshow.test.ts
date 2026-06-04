import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import * as db from './db';

function ctx(role: 'admin' | 'maintainer' | 'editor' | 'visitor' | null): TrpcContext {
  const user =
    role === null
      ? null
      : ({
          id: 1,
          openId: 'x',
          name: 'Test',
          displayName: null,
          email: 't@example.com',
          loginMethod: 'google',
          role,
          profilePictureUrl: null,
          profilePictureKey: null,
          memberSince: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext['user']);
  return {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: () => {} } as unknown as TrpcContext['res'],
  };
}

describe('slideshow.publicState', () => {
  it('returns valid:false for a wrong token', async () => {
    const caller = appRouter.createCaller(ctx(null));
    const state = await caller.slideshow.publicState({ token: 'definitely-wrong' });
    expect(state.valid).toBe(false);
  });

  it('returns valid:true for the correct token', async () => {
    const settings = await db.getSlideshowSettings();
    const caller = appRouter.createCaller(ctx(null));
    const state = await caller.slideshow.publicState({ token: settings.uploadToken });
    expect(state.valid).toBe(true);
    expect(typeof state.photoVersion).toBe('number');
  });

  it('listApproved returns [] for a wrong token', async () => {
    const caller = appRouter.createCaller(ctx(null));
    const list = await caller.slideshow.listApproved({ token: 'nope' });
    expect(list).toEqual([]);
  });
});
