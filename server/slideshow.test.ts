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

  it('listApproved returns an array (no internal keys leaked) for the correct token', async () => {
    const settings = await db.getSlideshowSettings();
    const caller = appRouter.createCaller(ctx(null));
    const list = await caller.slideshow.listApproved({ token: settings.uploadToken });
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) {
      expect(typeof list[0].id).toBe('number');
      expect('thumbnailKey' in list[0]).toBe(false);
    }
  });
});

describe('slideshow maintainer access', () => {
  it('getSettings is forbidden for editor', async () => {
    const caller = appRouter.createCaller(ctx('editor'));
    await expect(caller.slideshow.getSettings()).rejects.toThrow();
  });

  it('getSettings is forbidden for visitor/anonymous', async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.slideshow.getSettings()).rejects.toThrow();
  });

  it('updateSettings persists eventTitle for maintainer', async () => {
    const caller = appRouter.createCaller(ctx('maintainer'));
    await caller.slideshow.updateSettings({ eventTitle: 'Jogge di Balla 2026' });
    const s = await caller.slideshow.getSettings();
    expect(s.eventTitle).toBe('Jogge di Balla 2026');
  });

  it('rotateToken changes the token', async () => {
    const caller = appRouter.createCaller(ctx('admin'));
    const before = (await caller.slideshow.getSettings()).uploadToken;
    const { token } = await caller.slideshow.rotateToken();
    expect(token).not.toBe(before);
  });
});

describe('slideshow moderation', () => {
  it('approve bumps photoVersion', async () => {
    const admin = appRouter.createCaller(ctx('admin'));
    const before = (await admin.slideshow.getSettings()).photoVersion;
    const id = await db.createSlideshowPhoto({
      status: 'pending',
      displayUrl: 'https://example.com/d.jpg',
      displayKey: 'slideshow/display/test.jpg',
      thumbnailUrl: 'https://example.com/t.jpg',
      thumbnailKey: 'slideshow/thumb/test.jpg',
      width: 1000,
      height: 1500,
      bytes: 12345,
      uploaderIp: null,
    });
    await admin.slideshow.approve({ id });
    const after = (await admin.slideshow.getSettings()).photoVersion;
    expect(after).toBe(before + 1);
    await admin.slideshow.deletePhoto({ id });
  });

  it('editor cannot approve', async () => {
    const editor = appRouter.createCaller(ctx('editor'));
    await expect(editor.slideshow.approve({ id: 999999 })).rejects.toThrow();
  });
});
