# Analysis: Role & Permission System

## Summary
The app uses a two-tier authorization system. A **static tier** provides hardcoded role-based procedures (`adminProcedure`, `maintainerProcedure`, `editorProcedure`) for infrastructure-level access control. A **dynamic tier** (`requirePermission("key")`) checks permissions stored in MySQL with an in-memory cache. The frontend mirrors this with a `usePermission()` hook backed by a tRPC query. The system handles `admin > maintainer > editor > user > visitor` role hierarchy.

## Key Files
| File | Role |
|---|---|
| `server/permissions.ts` | Cache layer: `hasPermission()`, `getUserPermissions()`, `clearPermissionCache()` |
| `server/routers.ts` (top section) | Middleware definitions: `adminProcedure`, `maintainerProcedure`, `editorProcedure`, `requirePermission()` |
| `drizzle/schema.ts` (`rolePermissions` table) | DB schema: permission_key + role pairs |
| `server/db.ts` | `getAllPermissions()`, `addPermission()`, `removePermission()`, `initializeDefaultPermissions()` |
| `client/src/hooks/usePermissions.ts` | `usePermission(key)` and `useUserPermissions()` React hooks |
| `server/routers.ts` (`permissions` router) | Admin CRUD for permission management + `getMyPermissions` |

## How It Works

### Role Hierarchy
```
admin > maintainer > editor > user > visitor
```
Roles are stored as a MySQL enum on the `users` table. Each role is cumulative in the static procedures:
- `adminProcedure`: role === 'admin'
- `maintainerProcedure`: role in ['admin', 'maintainer']
- `editorProcedure`: role in ['admin', 'maintainer', 'editor']

`visitor` has no access to any protected or dynamic-permission procedures.

### Static Procedures (`routers.ts`)
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx });
});
```
Used for: user management, activity logs, shotcounter audit, SDK overlay control. These never touch the DB for authorization.

### Dynamic Permission Middleware (`routers.ts`)
```typescript
const requirePermission = (permissionKey: string) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await hasPermission(ctx.user.role, permissionKey);
    if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });
    return next({ ctx });
  });
```
Used for: edit_events, manage_sponsors, manage_goennermitglieder, edit_shotcounter, reset_shotcounter, edit_team.

### Permission Cache (`permissions.ts`)
```typescript
const permCache = new Map<string, { keys: string[]; exp: number }>();
const PERM_TTL = 5 * 60 * 1000; // 5 minutes

export async function getUserPermissions(role: UserRole): Promise<string[]> {
  if (role === 'visitor') return [];           // short-circuit, no DB call
  const cached = permCache.get(role);
  if (cached && cached.exp > Date.now()) return cached.keys;
  const all = await db.getAllPermissions();    // fetches ALL permissions once
  const keys = all.filter(p => p.role === role).map(p => p.permissionKey);
  permCache.set(role, { keys, exp: Date.now() + PERM_TTL });
  return keys;
}
```
- Cache is keyed per role (not per user)
- One DB call fetches **all** permissions, then filters in-memory per role
- Cache invalidated globally by `clearPermissionCache()` — called when admin toggles a permission
- `visitor` always returns `[]` without touching DB or cache

### Default Permission Seeding (`db.ts` → `initializeDefaultPermissions()`)
Called once at startup (implicitly). Seeds 6 permission keys across roles:
```
edit_events        → admin, maintainer, editor
manage_sponsors    → admin, maintainer
manage_goennermitglieder → admin, maintainer
edit_shotcounter   → admin, maintainer, editor
reset_shotcounter  → admin
edit_team          → admin, maintainer
```
Seeding is skipped if any permissions already exist in the DB.

### Database Schema
```typescript
rolePermissions = mysqlTable("role_permissions", {
  id, permissionKey (varchar 100), role (enum), createdAt, updatedAt,
  UNIQUE(permissionKey, role)
})
```
Each row = one permission for one role. No inheritance — `admin` permissions must be explicitly seeded.

### Frontend (`usePermissions.ts`)
```typescript
export function usePermission(permissionKey: string): boolean {
  const { data: userPermissions = [] } = trpc.permissions.getMyPermissions.useQuery(undefined, {
    enabled: isAuthenticated && !!user,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
  return userPermissions.includes(permissionKey);
}
```
- Fetches all permission keys for the current user's role via `getMyPermissions` tRPC query
- Results cached 30s client-side with refetch on every component mount
- `getMyPermissions` calls server-side `getUserPermissions(ctx.user.role)` (uses the 5-min server cache)

## Data Flow (request hits requirePermission middleware)
```
1. tRPC request arrives with valid session cookie
2. ctx.user populated with User from DB (includes role)
3. requirePermission("edit_events") middleware runs
4. hasPermission(ctx.user.role, "edit_events") called
5. getUserPermissions(role) checks permCache
   a. Cache hit (< 5min old): return cached keys immediately
   b. Cache miss: db.getAllPermissions() → filter by role → cache result
6. keys.includes("edit_events") → true/false
7. TRPCError FORBIDDEN thrown or next() called
```

## Edge Cases & Error Handling
- **Empty DB (permissions not seeded)**: `getAllPermissions()` returns `[]` → every `requirePermission()` check returns `false` → everyone including admin is denied dynamic-permission procedures
- **Cache after toggle**: `clearPermissionCache()` clears the entire map — next request for any role re-fetches from DB
- **`user` role**: not in default permissions — user role cannot perform any dynamic-permission action by default
- **`admin` role + `requirePermission`**: admin IS in the default seeded permissions, but only if `initializeDefaultPermissions()` ran and the DB has those rows

## ⚠️ Architectural Gap: Two Coexisting Systems
`adminProcedure` (static) and `requirePermission('reset_shotcounter')` (dynamic, also admin-only by default) are inconsistent patterns. If an admin changes permissions in the UI and removes their own `reset_shotcounter` permission, `adminProcedure`-gated routes would still work but `requirePermission`-gated routes would not. This asymmetry is by design but not documented.

## Security Observations
- Cache is process-memory only — in a multi-instance deployment, permission updates would only invalidate cache in the instance that processed the toggle request
- `visitor` short-circuit at the cache level (no DB call) is correct and intentional
- No audit log for permission changes (unlike role changes which are logged in `userActivityLog`)
- Permission keys are free-form strings — no centralized registry, typos would silently deny access

## Assumptions
- `initializeDefaultPermissions()` is assumed to be called somewhere at server startup — not visible in `server/_core/index.ts` directly; may be called from `systemRouter` or another init path
- Single-instance deployment assumed for cache correctness
