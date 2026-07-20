---
name: write-server-test
description: Generate a Vitest test file for a tRPC router in this project, following the exact context-factory and createCaller pattern already used. Usage: /write-server-test <router-name>
---

Generate a Vitest test file for the specified tRPC router.

**Before writing a single line, read these two files to match the exact patterns:**

- `server/shotcounter.test.ts` — canonical example for permission-based mutations
- `server/goennermitglieder.test.ts` — canonical example for CRUD + access control + date logic

Then read the target router's procedures in `server/routers.ts` to know what to test.

## Context factory pattern

Copy this exactly — the shape must match `TrpcContext` from `server/_core/context.ts` (`{ req, res, user }`). `role: null` means "not logged in"; `visitor` is a real role with a real user row, not a null user.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

function createContext(
  role: AuthenticatedUser['role'] | null,
): TrpcContext {
  const user: AuthenticatedUser | null =
    role === null
      ? null
      : {
          id: 1,
          openId: 'test-open-id',
          email: 'test@example.com',
          name: 'Test User',
          loginMethod: 'google',
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as AuthenticatedUser;

  return {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext['res'],
  };
}
```

## Test structure for each procedure

**Permission-based mutations — always test all three cases:**

```typescript
describe("<router>.<procedure>", () => {
  it("succeeds for user with the required permission", async () => {
    // mock DB call, call procedure, assert result
  });

  it("throws FORBIDDEN for authenticated user without permission", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.<router>.<procedure>(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws UNAUTHORIZED for unauthenticated request", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.<router>.<procedure>(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
```

**DB function mocking — spread `importActual`, then import the router dynamically:**

`routers.ts` pulls dozens of functions out of `./db`, so a mock factory that returns only the two you care about breaks the import. Always spread the real module first, and import `appRouter` *after* the mock so it picks it up (see `server/events.publishedFilter.test.ts`):

```typescript
vi.mock('./db', async () => {
  const actual = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...actual,
    getDb: async () => null,
    getEntityById: async (id: number) => ({ id, name: 'Test' }),
  };
});

const { appRouter } = await import('./routers');
```

**Integration tests against a live DB** — `server/CLAUDE.md` says not to mock the DB in integration tests. Those tests skip themselves in CI instead:

```typescript
const skipIntegration = !!process.env.CI;

it.skipIf(skipIntegration)('allows maintainers to create teams', async () => { … });
```

Match whichever pattern the existing tests for that feature area use.

## What to test per procedure type

| Procedure                    | Test cases                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Public query                 | Returns expected shape; handles empty result                                        |
| Protected query              | Works when authenticated; throws UNAUTHORIZED when not                              |
| Admin mutation               | Works as admin; throws FORBIDDEN for non-admin; throws UNAUTHORIZED for guest       |
| `requirePermission` mutation | Works with permission; throws FORBIDDEN without; throws UNAUTHORIZED for guest      |
| Input validation             | Throws BAD_REQUEST for invalid input (e.g. missing required field, string too long) |

## File location and naming

Place at: `server/<router-name>.test.ts`

`vitest.config.ts` only picks up `server/**/*.test.ts` and `server/**/*.spec.ts` — a test file anywhere else is silently never run.

Run after generation:

```bash
pnpm test server/<router-name>.test.ts
```

**Not this skill's job:** browser-level tests live in `tests/e2e/` and run on Playwright (`pnpm test:e2e`, config in `playwright.config.ts`). Never put a Playwright spec under `server/`, and never call tRPC procedures from an E2E test.
