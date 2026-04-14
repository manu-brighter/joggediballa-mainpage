# Verification: Role & Permission System

## Verdict
FAIL — One major factual error: `initializeDefaultPermissions()` is never called at startup. The function is dead code. The analysis states "Called once at startup (implicitly)" — this is incorrect.

## Confirmed Correct

- **Role hierarchy** `admin > maintainer > editor > user > visitor` confirmed from `routers.ts:27-62` procedure definitions.
- **`adminProcedure`**: role === 'admin' check — `routers.ts:27-35`. `maintainerProcedure`: ['admin', 'maintainer'] — `routers.ts:41-48`. `editorProcedure`: ['admin', 'maintainer', 'editor'] — `routers.ts:51-59`.
- **`requirePermission(permissionKey)`** defined at `routers.ts:65-72`: returns `protectedProcedure.use(async ({ ctx, next }) => hasPermission(ctx.user.role, permissionKey))`. Confirmed.
- **`permissions.ts` cache**: `permCache = new Map<string, { keys: string[]; exp: number }>()`, `PERM_TTL = 5 * 60 * 1000` — `permissions.ts:6-7`. Per-role cache confirmed.
- **`getUserPermissions`**: visitor short-circuit at line 21; cache hit/miss logic at lines 23-30; fetches all permissions with `db.getAllPermissions()` then filters by role — `permissions.ts:18-31`.
- **`hasPermission`**: visitor returns false at line 42; delegates to `getUserPermissions` — `permissions.ts:37-44`.
- **`clearPermissionCache()`**: clears entire map — `permissions.ts:10-12`. Called after permission toggle in routers.ts.
- **`rolePermissions` DB functions**: `getAllPermissions()` does `db.select().from(rolePermissions)` — `db.ts:914-918`. `addPermission()` inserts — `db.ts:920-940`. `removePermission()` deletes by permissionKey + role — `db.ts:942-958`.
- **Default permissions seeding**: 6 keys — `edit_events` (admin/maintainer/editor), `manage_sponsors` (admin/maintainer), `manage_goennermitglieder` (admin/maintainer), `edit_shotcounter` (admin/maintainer/editor), `reset_shotcounter` (admin), `edit_team` (admin/maintainer) — `db.ts:977-990`. Confirmed against analysis.
- **Frontend hook** `usePermission()`: fetches `trpc.permissions.getMyPermissions`, `staleTime: 30 * 1000`, `refetchOnMount: true` — `usePermissions.ts:14-19`. Returns `userPermissions.includes(permissionKey)` — `usePermissions.ts:27`. Confirmed.
- **`user` role not in default permissions** — confirmed by inspecting `defaultPermissions` in `db.ts:977-990`. No row for 'user' role.
- **No inheritance**: each permission row is an explicit role-key pair, confirmed by schema.

## Issues Found

- **CRITICAL: `initializeDefaultPermissions()` is never called anywhere in the codebase.** Searching all files confirms it appears only in `server/db.ts` (definition) and `.claude/agents/trpc-reviewer.md` (reference). It is NOT called from `server/_core/index.ts`, `server/routers.ts`, `systemRouter`, or any other file. The analysis states "Called once at startup (implicitly)" — **this is false**. The function is exported dead code. Consequence: on a fresh deployment with an empty `rolePermissions` table, no permissions are seeded, and every `requirePermission()` check returns false — including for admin. This is the "empty DB" edge case the analysis flags, but the analysis didn't realize it's not actually mitigated by any startup seeding.

## Gaps

- **Where do permissions come from on a fresh install?** Since `initializeDefaultPermissions()` is never called, an admin must manually add all permissions through the UI dashboard after first login. This is a significant operational gap not documented anywhere visible.
- **`visitor` role double short-circuit**: `hasPermission()` returns `false` for `visitor` at `permissions.ts:42` AND `getUserPermissions()` returns `[]` for `visitor` at `permissions.ts:21`. The `hasPermission` short-circuit is redundant with the `getUserPermissions` one — no bug, just unnecessary.
- **`addPermission` only accepts roles up to `'user'`** (`db.ts:922`: `role: 'admin' | 'maintainer' | 'editor' | 'user'`). `visitor` cannot be granted any permission through the API — consistent with the short-circuit design, but not documented.

## Unverifiable

- Whether the admin manually seeds permissions on the production instance after deployment, or uses another mechanism.
- Whether a future deployment on a clean DB would notice the missing seeding before users start getting denied.
- Multi-instance cache invalidation behavior — requires runtime testing.

## Security Notes

- **`initializeDefaultPermissions()` never being called** means fresh deployments have zero permissions. If the first admin doesn't know to go seed permissions via the UI, all `requirePermission()`-gated mutations (events, sponsors, shotcounter) are silently denied for everyone including admin. This should be: (a) called at startup, or (b) called the first time the admin dashboard loads, or (c) documented prominently in the deployment guide.
- **Two-system asymmetry** confirmed: `adminProcedure`-gated routes are always accessible to admin regardless of DB permissions; `requirePermission('reset_shotcounter')`-gated routes depend on the DB. If the `reset_shotcounter` permission is removed for admin in the UI, `adminProcedure` routes still work but that reset route does not. Currently not documented.
- **No audit log for permission changes** confirmed — `userActivityLog` records role changes but not permission toggles.
