# CLAUDE.md — drizzle/

This file provides guidance to Claude Code when working in the `drizzle/` directory.

## Schema Conventions

All 21 tables are in `drizzle/schema.ts`. The baseline for a new content table:

- `id: int().autoincrement().primaryKey()` — every table has this
- `createdAt: timestamp().defaultNow().notNull()`
- `updatedAt: timestamp().defaultNow().onUpdateNow().notNull()`
- `createdBy: int().references(() => users.id)` — nullable FK to users table (not enforced on delete)

The last three are **not** universal, so don't assume them when writing queries:

- `createdBy` exists on 5 tables only — add it when a row is authored by a user, skip it otherwise.
- Log-style tables carry a single timestamp instead of the `createdAt`/`updatedAt` pair (e.g. `submittedAt`).
- A few tables (`photos`, `sdkGameLog`, `slideshowPhotos`) have `createdAt` alone.

**Uploaded assets** always store two columns:

- `xxxUrl: text()` — public HTTPS URL for display
- `xxxKey: text()` — storage key (path relative to `UPLOAD_DIR`) for deletion

Storage is self-hosted on local disk via `server/storage.ts`, not S3.

**Deactivation over deletion**: the dominant pattern is `isActive: boolean` — used by `sponsors`, `teamMembers`, `goennermitglieder` and `attendanceMembers`. Filter those with `eq(table.isActive, true)`.

`deletedAt: timestamp()` soft delete exists on **`shotcounterTeams` only** (filter with `isNull(table.deletedAt)`). Don't introduce `deletedAt` on a new table without a reason to prefer it over `isActive`.

**displayOrder**: sortable tables use `displayOrder: int().default(0).notNull()` (sponsors, teamMembers, etc.)

## Drizzle Version

ORM: `drizzle-orm` 0.45.x, driver: `drizzle-orm/mysql2`, DB: MySQL 8.

Do **not** use the Drizzle Relations API (`relations()`) — the project uses plain joins and separate queries in `server/db.ts`.

## Applying Schema Changes

**`pnpm db:push` is often NOT used.** Changes are frequently applied directly to the MySQL database. Before writing queries against a new column, verify it actually exists in the live DB — don't assume `db:push` was run just because the column is in schema.ts.

When adding a column, write the raw SQL as a comment in schema.ts so it can be run manually:

```typescript
// ALTER TABLE events ADD COLUMN isPublished BOOLEAN NOT NULL DEFAULT TRUE;
isPublished: boolean("isPublished").default(true).notNull(),
```

## Migrations

There is **no `drizzle/migrations/` directory** — this project does not keep
generated SQL migration files. `drizzle/` contains only `schema.ts`. Schema changes
reach the database either via `pnpm db:push` (drizzle-kit) or, more often, by
running the hand-written `ALTER TABLE` comment directly against MySQL.

If you ever generate migrations, do not assume they are applied automatically —
check with the team before running anything in production.
