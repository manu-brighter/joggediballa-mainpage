# CLAUDE.md — server/

This file provides guidance to Claude Code when working in the `server/` directory.

## Architecture

```
server/
  _core/          # Express bootstrap, tRPC setup, auth, cookies, context
  routers.ts      # All tRPC procedures (single file)
  db.ts           # All database queries (single file — no ORM relations layer)
  permissions.ts  # Role permission checks with in-memory cache (5-min TTL)
  storage.ts      # Self-hosted file storage on local disk (put/get/delete)
  uploadRoutes.ts # File uploads (Express routes, not tRPC)
  attendance_router.ts  # Attendance feature (separate router, mounted in routers.ts)
  attendance_db.ts      # Attendance queries
  sitemap.ts      # Sitemap Express route
```

## Procedure Types — When to Use Which

| Procedure                  | Use case                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| `publicProcedure`          | No auth required, visible to everyone                                 |
| `protectedProcedure`       | Auth required, any logged-in user                                     |
| `requirePermission("key")` | **Preferred for new content procedures** — checks DB permission       |
| `adminProcedure`           | Hardcoded admin-only (use only for admin-infrastructure, not content) |

**Convention (post-Phase 3b/3c, B-P0-02):** A single `adminProcedure` is
defined locally in `routers.ts` (and re-implemented inline in
`attendance_router.ts` to avoid a circular import). It is reserved for
admin-infrastructure procedures — `users.*`, `features.*`, `activityLog.*`,
`permissions.list/toggle`, `sdk.*`, `shotcounter.getAuditLog`. Everything else
that gates by role should use `requirePermission('<key>')` so admins can flip
permissions at runtime from the dashboard. The legacy `maintainerProcedure`
and `editorProcedure` helpers and the unused `_core/trpc.ts` export of
`adminProcedure` were removed.

## Database Pattern

`db.ts` exports plain async functions — no ORM relation objects, no query builder chained outside db.ts. The DB connection is lazy and returns `null` if `DATABASE_URL` is missing; all db functions must guard with:

```typescript
const db = await getDb();
if (!db) {
  console.warn('...');
  return fallback;
}
```

**Manual DB changes**: Schema changes are often applied directly to MySQL rather than via `pnpm db:push`. Do not assume `db:push` was run — verify the live DB reflects schema.ts before writing queries against new columns.

## Testing

Tests live in `server/*.test.ts`. Run with `pnpm test`.

**Test pattern** — create a typed context manually, use `appRouter.createCaller(ctx)`:

```typescript
const ctx: TrpcContext = {
  user: { id: 1, openId: "x", role: "admin", ... },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
};
const caller = appRouter.createCaller(ctx);
```

Tests that require a live DB, a writable upload dir, or SMTP are **expected to fail in CI** (no infra). Do not mock the DB in integration tests — we've been burned by mock/prod divergence before.

## Upload Pattern

Storage is **self-hosted on local disk** — S3/AWS was removed. `storage.ts` writes
under `UPLOAD_DIR` (default `/var/www/joggediballa-mainpage/uploads`) and returns a
public URL built from `PUBLIC_UPLOAD_URL`; nginx serves that path. The `@aws-sdk/*`
dependencies still sit in `package.json` but are not imported anywhere.

Upload routes are Express (not tRPC) in `uploadRoutes.ts`. Each endpoint:

1. Parses the multipart body with `multer` (memory storage, strict size + file-count caps)
2. Requires a logged-in user with role >= editor (JWT cookie verified at the Express layer)
3. Validates the bytes via `sharp.metadata()` — this doubles as a magic-byte sniff;
   only `image/jpeg`, `image/png`, `image/webp` are accepted. `limitInputPixels`
   guards against decompression bombs
4. Generates the filename server-side via `nanoid()` + sniffed extension — the
   client-supplied name is never written to disk
5. Writes via `storagePut()` and stores both `xxxUrl` (public URL) and `xxxKey`
   (storage key for deletion) in the DB

Always store the key — deletion (`storageDelete()`) requires the key, not just the URL.

## Soft Delete Convention

Tables with `deletedAt: timestamp` use soft delete. Filter with `isNull(table.deletedAt)` in queries. The `shotcounterTeams` table uses soft delete; teams are never hard-deleted.

## Permission Cache

`permissions.ts` caches per-role permission lists with 5-min TTL. Call `clearPermissionCache()` after any mutation that changes `rolePermissions` (already done in `permissions.toggle` in routers.ts).

## Rate Limiting Note

tRPC batch URLs (`/api/trpc/proc1,proc2`) bypass Express route-specific rate limiters. Per-procedure rate limiting must be implemented as tRPC middleware, not Express middleware.
