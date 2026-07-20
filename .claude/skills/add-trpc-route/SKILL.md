---
name: add-trpc-route
description: Scaffold a new tRPC procedure with a matching DB helper function, following this project's exact patterns. Usage: /add-trpc-route <router-name> <procedure-name> <query|mutation> <public|protected|admin|permission:key>
---

Scaffold a new tRPC route. The user provides: router name, procedure name, operation type, and auth level.

## Step 1 — DB helper in server/db.ts

Always add a corresponding DB function first. `getDb()` is **async** and returns `null` when `DATABASE_URL` is unset — the guard is **mandatory**, it's what lets the server start cleanly without MySQL (e.g. in tests or local dev). Reads fall back to an empty value; writes throw.

**Query pattern:**

```typescript
export async function get<Entity>(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(<table>)
    .where(eq(<table>.id, id));
  return results[0] ?? null;
}
```

**List pattern (with active filter):**

```typescript
export async function getAll<Entities>() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(<table>)
    .where(eq(<table>.isActive, true))
    .orderBy(<table>.displayOrder);
}
```

Most tables mark inactive rows with an `isActive` boolean. Only `shotcounterTeams` uses a `deletedAt` timestamp — for that one filter with `isNull(shotcounterTeams.deletedAt)` instead. Ordering helpers (`desc`, `eq`, `isNull`, …) are imported from `drizzle-orm` at the top of `db.ts`; add to that import if you need one that isn't there yet.

**Mutation pattern:**

```typescript
export async function create<Entity>(data: NewEntity) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(<table>).values(data);
  return Number(result[0].insertId);
}
```

Note: The actual DB schema might be ahead of `drizzle/schema.ts` if changes were made manually. If you're adding a column that exists in the DB but not in `schema.ts`, update `schema.ts` to match reality before writing the query.

## Step 2 — Procedure in server/routers.ts

**Auth level → procedure type:**

| Auth level                            | Procedure builder                               |
| ------------------------------------- | ----------------------------------------------- |
| `public`                              | `publicProcedure`                               |
| `protected`                           | `protectedProcedure`                            |
| `admin`                               | `adminProcedure`                                |
| `permission:edit_events`              | `requirePermission("edit_events")`              |
| `permission:manage_sponsors`          | `requirePermission("manage_sponsors")`          |
| `permission:manage_goennermitglieder` | `requirePermission("manage_goennermitglieder")` |
| `permission:edit_shotcounter`         | `requirePermission("edit_shotcounter")`         |
| `permission:reset_shotcounter`        | `requirePermission("reset_shotcounter")`        |
| `permission:edit_team`                | `requirePermission("edit_team")`                |
| `permission:manage_attendance`        | `requirePermission("manage_attendance")`        |
| `permission:manage_slideshow`         | `requirePermission("manage_slideshow")`         |

Use `requirePermission()` for all content mutations. `adminProcedure` is defined locally in `routers.ts` and reserved for admin infrastructure (`users.*`, `features.*`, `activityLog.*`, `permissions.*`, `sdk.*`). The old `editorProcedure` / `maintainerProcedure` helpers no longer exist — do not reintroduce them.

A permission key only works if it is also listed in `initializeDefaultPermissions()` in `server/db.ts`; otherwise no role will ever hold it.

**Query template:**

```typescript
list: publicProcedure
  .query(async ({ ctx }) => {
    return await getAll<Entities>();
  }),
```

**Mutation template:**

```typescript
create: requirePermission("edit_<feature>")
  .input(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const id = await create<Entity>({ ...input, createdBy: ctx.user.id });
    return { id };
  }),
```

**Zod rules:**

- IDs: `z.number().int().positive()`
- Required strings: `z.string().min(1).max(N)` — never bare `z.string()`
- Optional strings: `.optional()` after `.max(N)`
- Nullable string from form: pass through `value === "" ? null : value` before writing to DB

## Step 3 — Verify

```bash
pnpm check   # must pass with no new errors
```
