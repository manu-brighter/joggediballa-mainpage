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

Copy this exactly — the shape must match `TrpcContext` from `server/_core/context.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

function createContext(
  role: 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor' | null,
): TrpcContext {
  const user =
    role === null || role === 'visitor'
      ? null
      : {
          id: 1,
          openId: 'test-open-id',
          role,
          name: 'Test User',
          displayName: 'Test User',
          email: 'test@example.com',
          loginMethod: 'google' as const,
          profilePictureUrl: null,
          profilePictureKey: null,
          memberSince: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };

  return {
    user,
    req: { protocol: 'https', headers: {}, ip: '127.0.0.1' } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
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

**DB function mocking — mock at the module level:**

```typescript
vi.mock('./db', () => ({
  createEntity: vi.fn().mockResolvedValue(1),
  getEntityById: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  deleteEntity: vi.fn().mockResolvedValue(undefined),
}));
```

Look at the existing test files for the exact mock structure — some tests use real DB calls (require a running MySQL) and some mock. Match whichever pattern the existing tests for that feature area use.

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

Run after generation:

```bash
pnpm test server/<router-name>.test.ts
```
