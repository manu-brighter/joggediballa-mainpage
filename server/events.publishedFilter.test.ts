/**
 * A-P0-06 / F-SEC-007: events.list and events.getById must hide unpublished
 * events from anonymous + non-editor users.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publishedEvent = { id: 1, title: 'Public Event', isPublished: true };
const draftEvent = { id: 2, title: 'Draft Event', isPublished: false };

vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getDb: async () => null,
    getAllEvents: async (publishedOnly: boolean) =>
      publishedOnly ? [publishedEvent] : [publishedEvent, draftEvent],
    getEventById: async (id: number) =>
      id === 1 ? publishedEvent : id === 2 ? draftEvent : undefined,
  };
});

// Import AFTER the mock so the routers pick up the mocked db.
const { appRouter } = await import('./routers');
import type { TrpcContext } from './_core/context';

function ctxWith(
  role: 'admin' | 'editor' | 'user' | 'visitor' | null,
): TrpcContext {
  return {
    user:
      role === null
        ? null
        : ({
            id: 1,
            openId: 'x',
            email: 'x@example.com',
            name: 'x',
            loginMethod: 'google',
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as any),
    req: { headers: {}, protocol: 'https' } as any,
    res: { clearCookie: () => undefined } as any,
  };
}

describe('events draft lockdown (A-P0-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides drafts from anonymous events.list callers', async () => {
    const caller = appRouter.createCaller(ctxWith(null));
    const list = await caller.events.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(1);
  });

  it("hides drafts from a 'user' role", async () => {
    const caller = appRouter.createCaller(ctxWith('user'));
    const list = await caller.events.list();
    expect(list).toHaveLength(1);
  });

  it("shows drafts to an 'editor' role", async () => {
    const caller = appRouter.createCaller(ctxWith('editor'));
    const list = await caller.events.list();
    expect(list).toHaveLength(2);
  });

  it('returns NOT_FOUND for a draft event accessed anonymously by id', async () => {
    const caller = appRouter.createCaller(ctxWith(null));
    await expect(caller.events.getById({ eventId: 2 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns the draft event to an editor by id', async () => {
    const caller = appRouter.createCaller(ctxWith('editor'));
    const ev = await caller.events.getById({ eventId: 2 });
    expect(ev?.id).toBe(2);
  });
});
