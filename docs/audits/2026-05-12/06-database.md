# Database Schema Audit Report
**Date:** 2026-05-12
**Auditor:** Database Engineer (subagent)
**Scope:** `drizzle/schema.ts`, `drizzle/relations.ts`, `drizzle/attendance_schema.ts`, `drizzle.config.ts`, repo-root `attendance_*.sql`, plus `server/db.ts` / `server/attendance_db.ts` / `server/storage.ts` for usage patterns.

## Executive Summary
- **Duplicate schema definition.** `drizzle/attendance_schema.ts` is a verbatim copy of the attendance block in `schema.ts`. Both are exported as named bindings from drizzle-orm. The project imports the canonical one (`schema.ts`), but `attendance_schema.ts` is dead and will cause a drift bug the moment anyone edits one and not the other. **Highest-priority cleanup item.**
- **`relations.ts` is an empty stub** (`import {} from './schema';`). It's referenced by `drizzle.config.ts` not at all (`drizzle-kit` only reads `schema.ts`). Either delete it or commit to a real Drizzle relations layer — but the project explicitly does plain joins (see `drizzle/CLAUDE.md`), so deletion is correct.
- **Foreign-key gaps in critical tables.** `attendance_records.sessionId/memberId` are declared without `.references()` in `schema.ts` (only the legacy `.sql` file declares them). `events.thumbnailPhotoId` and `sdkSession.createdBy` (the latter is fine, but `sdkSession.winnerId` is a meaningless `int` with no FK semantics — see F-DB-005). `attendance_records` therefore has no cascading delete enforced at the ORM layer.
- **Missing indexes on FK and high-traffic filter columns** across non-attendance tables — `photos.eventId`, `shotcounter_audit_log.teamId`, `sdk_game_log.sessionId`, `user_activity_log.userId`, `events.isPublished + eventDate`, `sponsors.isActive + displayOrder`, `goennermitglieder.membershipEndDate`. The attendance domain has thoughtful indexes; the rest of the schema has zero.
- **`pnpm db:push` in production is risky AND not even the actual workflow.** `drizzle/CLAUDE.md` explicitly says schema changes are often run as raw SQL by hand. There is no `drizzle/migrations/` directory and no generated migration files in the repo. This is a data-integrity time bomb: schema.ts and live DB can silently diverge, which the codebase already acknowledges ("verify the column exists in the live DB").
- **TEXT overused for short, bounded strings** (S3 URLs, S3 keys, eventUrl, profilePictureUrl/Key, gameNames JSON, eventLinks JSON). Should be `VARCHAR(N)` to allow indexing and reduce row format overhead. Charset/collation is not declared anywhere — relies on MySQL server default (often still `utf8mb4_general_ci` or `utf8mb4_0900_ai_ci` depending on install).

## Findings

### F-DB-001: `drizzle/attendance_schema.ts` is a duplicate of `schema.ts` attendance block
- **Severity:** high
- **Effort:** small
- **Location:** `drizzle/attendance_schema.ts` (entire file) vs `drizzle/schema.ts:271-359`
- **Issue:** The same 4 tables (`attendanceSessions`, `attendanceMembers`, `attendanceRecords`, `attendanceSettings`) are defined twice with the same `mysqlTable('attendance_sessions', ...)` etc. names. One subtle but real divergence: `attendance_schema.ts` uses `uniqueIndex('unique_session_member')` while `schema.ts` uses `unique('unique_session_member')`. Both compile, but they emit slightly different DDL via drizzle-kit (`UNIQUE INDEX` vs `UNIQUE KEY`). Nothing in `server/` imports from `attendance_schema.ts` — confirmed by Grep: all attendance imports go through `../drizzle/schema`.
- **Recommendation:** Delete `drizzle/attendance_schema.ts`. Keep the consolidated definitions in `schema.ts`.
- **Rationale:** Two sources of truth = guaranteed drift. The file is dead code today.

### F-DB-002: `drizzle/relations.ts` is an empty placeholder
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/relations.ts` (single line: `import {} from './schema';`)
- **Issue:** File exists but defines nothing. `drizzle.config.ts` only points at `./drizzle/schema.ts`. The project's stated convention (`drizzle/CLAUDE.md`) is "do **not** use the Drizzle Relations API."
- **Recommendation:** Delete the file. If the team ever wants a relations layer later, add it then.
- **Rationale:** Less noise, less confusion about whether relations are actually used.

### F-DB-003: `attendance_records` is missing FK declarations in Drizzle schema
- **Severity:** high
- **Effort:** small
- **Location:** `drizzle/schema.ts:323-342`
- **Issue:** `sessionId` and `memberId` are plain `int().notNull()` columns. No `.references(() => attendanceSessions.id, { onDelete: 'cascade' })`. The legacy `attendance_schema.sql:38-39` *does* declare the FKs with `ON DELETE CASCADE`, so the live DB probably has them — but `pnpm db:push` from current schema would either (a) leave the orphaned FKs alone (likely) or (b) drop them if drizzle-kit reconciles. Either way schema.ts lies about the actual DB.
- **Recommendation:**
  ```typescript
  sessionId: int('sessionId').notNull()
    .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
  memberId: int('memberId').notNull()
    .references(() => attendanceMembers.id, { onDelete: 'cascade' }),
  ```
- **Rationale:** The `deleteAttendanceSession()` in `attendance_db.ts:74-82` *relies on* the CASCADE behavior ("Records will be deleted automatically due to CASCADE"). If a future migration drops the FK, attendance records become orphaned silently.

### F-DB-004: Missing indexes on foreign-key columns outside the attendance domain
- **Severity:** high
- **Effort:** small
- **Location:** Multiple tables in `drizzle/schema.ts`
- **Issue:** Every table that uses `.references()` should have an index on that column for join performance and FK enforcement speed. The attendance tables do this correctly. The rest of the schema does not. Missing indexes on these hot paths:
  - `photos.eventId` — queried by `eq(photos.eventId, eventId)` in `getPhotosByEvent`
  - `shotcounter_audit_log.teamId` — queried by `getAuditLogsByTeam`
  - `sdk_game_log.sessionId` — queried by `sdkGetGameLog` / `sdkDeleteSessionGameLog`
  - `user_activity_log.userId` — queried by `getActivityLogsByUser`
  - `user_activity_log.timestamp` — used for `ORDER BY desc` on every list
  - `events.isPublished` + `events.eventDate` — used together in `getAllEvents`
  - `sponsors.isActive` + `sponsors.displayOrder` — used together in `getAllSponsors`
  - `contact_submissions.isArchived` + `contact_submissions.submittedAt`
  - `goennermitglieder.isActive` + `goennermitglieder.membershipEndDate`
  - `team_members.isActive` + `team_members.displayOrder`
  - `shotcounter_teams.year` + `shotcounter_teams.deletedAt`
- **Recommendation:** Add `index('idx_<col>').on(table.<col>)` declarations in the Drizzle table builder for each. Composite indexes for the multi-column WHERE/ORDER pairs.
- **Rationale:** MySQL InnoDB auto-creates a secondary index on a column declared as a FK, **only at FK creation time**. Drizzle's `.references()` does emit the FK, but since the project frequently bypasses `db:push`, you can't rely on the implicit FK-index existing. Explicit indexes are safer and self-documenting.

### F-DB-005: `sdkSession.winnerId` is a sentinel integer, not a real reference
- **Severity:** medium
- **Effort:** small
- **Location:** `drizzle/schema.ts:418` and `schema.ts:438`
- **Issue:** Two columns named `winnerId` (in `sdk_session` and `sdk_game_log`) hold the values `1` or `2` meaning "player 1 / player 2". This is not a foreign key — it's an enum encoded as int. Confusing: anyone reading the schema thinks it's a `users.id` FK.
- **Recommendation:** Use `mysqlEnum('winnerId', ['player1', 'player2'])` (nullable in `sdkSession`, non-null in `sdkGameLog`). Rename to `winner` to remove the `Id` suffix that implies FK.
- **Rationale:** Type safety + readability. Right now the TS type is `number | null` with no documented domain.

### F-DB-006: TEXT used where VARCHAR is appropriate
- **Severity:** medium
- **Effort:** small
- **Location:** Many fields in `drizzle/schema.ts`
- **Issue:** S3 URLs, S3 keys, profilePictureUrl/Key, sponsor websiteUrl, photoUrl, eventUrl, photoKey, logoUrl, logoKey, compressedUrl/Key, thumbnailUrl/Key are all `text()`. These are bounded — S3 keys are ≤1024 chars, URLs are practically ≤2048. `text()` columns:
  - Cannot be fully indexed (only prefix index)
  - Are stored off-row in InnoDB DYNAMIC row format, costing an extra page lookup
  - Make schema intent unclear
  - The same applies to `events.eventLinks` and `sdkSession.gameNames` which are JSON-encoded — they should be `json()` columns (MySQL 8 supports it; Drizzle has `json<T>()` for typed access).
- **Recommendation:**
  - `xxxUrl: varchar({ length: 2048 })`
  - `xxxKey: varchar({ length: 1024 })`
  - `eventLinks: json<EventLink[]>('eventLinks')` (replace manual `JSON.stringify` in `db.ts:393`)
  - `gameNames: json<string[]>('gameNames')`
  - Keep `text()` only for genuinely unbounded text: `bio`, `description`, `notes`, `details`, `userAgent`.
- **Rationale:** Better storage layout, type-safe JSON access, ability to add an index on URL/key for de-dup queries if ever needed.

### F-DB-007: Missing audit columns / inconsistent `deletedAt`
- **Severity:** medium
- **Effort:** small
- **Location:** Several tables
- **Issue:** Soft-delete strategy is inconsistent:
  - `shotcounterTeams` has `deletedAt` — used.
  - `sponsors` has no `deletedAt` — `deleteSponsor()` flips `isActive` to false (different soft-delete shape).
  - `teamMembers` — same as sponsors (`isActive` flip).
  - `goennermitglieder` — hard-deletes (`db.delete(...)`).
  - `attendanceMembers` — soft-deletes via `isActive` flip.
  - `photos`, `events`, `users`, `sdkGameLog` — hard-delete.
- Also: `attendance_records`, `harassenlauf_registrations` have `createdAt`/`updatedAt` but no `createdBy`. `sdk_game_log` has only `createdAt`, no `updatedAt` (which is fine since it's append-only — call this out, not a bug).
- **Recommendation:** Pick one soft-delete convention per data-class:
  - **User content** (sponsors, team members, events, attendance members) → `deletedAt: timestamp()` (nullable). Drop the `isActive`-as-soft-delete dual-purpose pattern; `isActive` should mean "user toggled visibility," not "deleted."
  - **Logs / append-only** (audit logs, activity log, sdk_game_log) → hard delete or no delete.
  - **Personal data** (`goennermitglieder`, `users`, `contact_submissions`) → hard-delete to honor GDPR/Swiss DSG erasure requests.
- **Rationale:** Without a clear convention, future devs guess wrong and either leak data (forget soft-delete filter) or "delete" something that comes back.

### F-DB-008: No collation/charset declared; relies on server default
- **Severity:** medium
- **Effort:** medium
- **Location:** `drizzle/schema.ts` (all tables) and `attendance_schema.sql` declares `utf8mb4_unicode_ci`
- **Issue:** Drizzle's `mysqlTable()` doesn't set table-level charset/collation. MySQL 8's modern default is `utf8mb4_0900_ai_ci`. The legacy `.sql` file uses `utf8mb4_unicode_ci`. Either way, names like "Gönnermitglieder," "Schießen," "Müller" can sort/compare unexpectedly across tables created at different times.
- **Recommendation:** Set the server-level default to `utf8mb4_0900_ai_ci` and verify all existing tables match: `SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = '<db>';`. Drizzle-kit doesn't let you set this declaratively yet, so document it in `drizzle/CLAUDE.md`.
- **Rationale:** Modern Unicode collation, accent-insensitive but case-insensitive name searches.

### F-DB-009: `users.openId` length 64 may be tight for future OIDC providers
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:21`
- **Issue:** Google's `sub` claim fits in 64 (typically 21 digits). Other providers (Apple, Microsoft) can produce longer opaque IDs.
- **Recommendation:** `varchar({ length: 191 })` (191 keeps the UNIQUE index under the 767-byte limit on legacy MySQL — moot on MySQL 8 but conventional).
- **Rationale:** Forward-compat with adding other OIDC providers.

### F-DB-010: `users.email` declared `varchar(320)` is correct length, but nullable + no UNIQUE
- **Severity:** medium
- **Effort:** small
- **Location:** `drizzle/schema.ts:24`
- **Issue:** `email` is nullable and has no UNIQUE constraint. `ADMIN_EMAIL` auto-promotion (mentioned in CLAUDE.md) and the contact-form/Gönnermitglied flows assume email uniqueness per user. Two Google accounts with the same primary email (rare but possible) would create two `users` rows.
- **Recommendation:** Add `.unique()` on `email`. Keep nullable, since legacy/anonymous users may not have one — but `UNIQUE` in MySQL allows multiple NULLs.
- **Rationale:** Prevent duplicate user rows by email; allows lookups by email for admin promotion to use the index.

### F-DB-011: `contact_submissions.ipAddress` and `user_activity_log.ipAddress` should be considered PII
- **Severity:** medium
- **Effort:** medium
- **Location:** `drizzle/schema.ts:192, 237`
- **Issue:** Stored in cleartext. Under Swiss DSG and GDPR, IP addresses are personal data. The schema has no retention policy and no `userActivityLog` cleanup function exists in `db.ts` (only inserts and reads).
- **Recommendation:** Either (a) hash IPs at write time (HMAC with a server-side secret, allows rate-limit lookups but no PII), or (b) document a retention TTL and add a cron job to delete rows older than N days. Storing the raw IP is fine if there's a documented purpose + retention.
- **Rationale:** Compliance + reduce blast radius if DB is dumped.

### F-DB-012: `featureToggles` table has no `createdAt`
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:167-174`
- **Issue:** Has `updatedAt` and `updatedBy` but no `createdAt` / `createdBy`. Inconsistent with every other table in the schema.
- **Recommendation:** Add `createdAt: timestamp().defaultNow().notNull()` and optionally `createdBy: int().references(() => users.id)`.
- **Rationale:** Consistency; useful for "when did we introduce flag X?"

### F-DB-013: `harassenlauf_registrations` has no FK to `events`
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:364-380`
- **Issue:** Registrations are floating — no link to an `events.id`. So you can't run "registrations for the 2026 Harassenlauf vs the 2027 Harassenlauf" cleanly. Currently the year is implicit in `createdAt`.
- **Recommendation:** Either add `eventId: int().references(() => events.id)` (nullable for backward compat), or accept the design and add a `year: int().notNull()` column for explicit filtering.
- **Rationale:** Future-proofing for multi-edition reporting.

### F-DB-014: `shotcounter_audit_log.action` is a stringly-typed enum
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:66`
- **Issue:** `action: varchar(50)` with comment listing 5 known values: "add", "subtract", "reset", "create_team", "delete_team". Same pattern in `user_activity_log.action`.
- **Recommendation:** `mysqlEnum('action', ['add','subtract','reset','create_team','delete_team'])`. Same for `user_activity_log.action` once you nail down its domain.
- **Rationale:** Type safety in TS via `$inferSelect`, storage efficiency, query optimizer can use it.

### F-DB-015: Legacy SQL files at repo root are inconsistent with Drizzle schema
- **Severity:** medium
- **Effort:** small
- **Location:** `attendance_schema.sql`, `attendance_permission.sql` (repo root)
- **Issue:**
  - `attendance_schema.sql` declares `COLLATE=utf8mb4_unicode_ci` — schema.ts is silent.
  - It uses `UNIQUE KEY` syntax — schema.ts emits `UNIQUE` via `unique()`.
  - It includes a seed `INSERT INTO attendance_settings ... event_weight_multiplier 2.0` which is not in schema.ts.
  - It includes a seed `INSERT INTO role_permissions` for `manage_attendance` — duplicate of `attendance_permission.sql`.
- **Recommendation:** Move both files to `drizzle/seeds/` (or delete if already applied to prod), with a README pointing to whoever ran them. Add the seed inserts to `initializeDefaultPermissions()` in `db.ts` so `manage_attendance` is part of bootstrap.
- **Rationale:** Bootstrap is currently a tribal-knowledge two-step (push schema + run two SQL files manually).

### F-DB-016: No migration files committed — `db:push` plus manual SQL is the workflow
- **Severity:** high (process risk; not a code defect)
- **Effort:** large
- **Location:** Repo-wide; documented in `drizzle/CLAUDE.md`
- **Issue:** No `drizzle/migrations/` directory exists. `drizzle.config.ts`'s `out: './drizzle'` would generate migrations next to `schema.ts` — but there are none. Schema changes are applied either by `db:push` or by hand-written SQL. There is no audit trail of "what changed and when." There is no rollback path. Multi-env deploys are impossible to verify.
- **Recommendation:** Adopt `drizzle-kit generate` for all schema changes:
  1. `pnpm drizzle-kit generate` → produces SQL migration in `drizzle/migrations/`
  2. Commit the SQL file to git
  3. Apply via `drizzle-kit migrate` (or `mysql < file.sql`) in a deployment hook
  4. Use `db:push` only for local dev, never prod
  This requires a one-time baseline: dump current prod schema, hand-write the initial migration, then everything additive after.
- **Rationale:** This is the *number one* DB engineering practice gap. In 2026 the consensus is: never `push` to prod. The fact that the project even acknowledges in CLAUDE.md "verify the column actually exists in the live DB — don't assume `db:push` was run" is itself the smoking gun.

### F-DB-017: `events.thumbnailPhotoId` references `photos.id` without a FK
- **Severity:** medium
- **Effort:** small
- **Location:** `drizzle/schema.ts:109`
- **Issue:** Comment says "Reference to photo used as thumbnail" but no `.references()`. Worse: photos are cascade-deleted when an event is deleted (`photos.eventId.references(events.id, { onDelete: 'cascade' })`). If a photo from a different event is set as thumbnail, deleting that *other* event nulls nothing — leaves a dangling `thumbnailPhotoId` pointing at a no-longer-existing row.
- **Recommendation:**
  ```typescript
  thumbnailPhotoId: int('thumbnailPhotoId')
    .references(() => photos.id, { onDelete: 'set null' }),
  ```
- **Rationale:** Avoid dangling references; let the DB clean it up.

### F-DB-018: `goennermitglieder.contributionAmount` should be DECIMAL not INT
- **Severity:** medium
- **Effort:** small
- **Location:** `drizzle/schema.ts:219`
- **Issue:** Stored as `int` representing CHF. Fine *today* (only 20 CHF flat fee). If anyone wants 15.50 CHF or pro-rated contributions, you're stuck.
- **Recommendation:** `decimal('contributionAmount', { precision: 10, scale: 2 }).default('20.00').notNull()`. Even if the current value is always integer francs, money should never be a binary float; INT is safe but not flexible.
- **Rationale:** Money columns are a one-way door — easier to widen now than after rows exist.

### F-DB-019: `users.name` is TEXT — should be VARCHAR
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:22`
- **Issue:** `name: text('name')` — names are bounded. `displayName` right next to it is correctly `varchar(255)`.
- **Recommendation:** `name: varchar('name', { length: 255 })`.
- **Rationale:** Consistency with `displayName`, indexability.

### F-DB-020: `events.eventUrl` is dead code
- **Severity:** low
- **Effort:** small
- **Location:** `drizzle/schema.ts:107`
- **Issue:** Comment says "Legacy: kept for migration compatibility." Grep shows it's referenced only in `schema.ts` and `routers.ts` (likely just for the type to round-trip). All new code uses `eventLinks`.
- **Recommendation:** Confirm with a one-time SELECT `WHERE eventUrl IS NOT NULL AND eventUrl <> ''`, migrate any surviving values into `eventLinks`, then drop the column.
- **Rationale:** Less columns = less confusion.

## Dead / unused inventory

Confirmed-used columns are skipped; only suspicious findings listed.

| Table | Column | Status | Notes |
|---|---|---|---|
| events | eventUrl | **deprecated** | Legacy; replaced by eventLinks. See F-DB-020. |
| users | loginMethod | **probably written, rarely read** | Written by `upsertUser()`. Grep shows no read sites for filtering/branching logic. Candidate for removal or actual use. |
| contact_submissions | honeypot | **written, never read for filtering** | Comment "Spam-Schutz" but Grep finds no `where(eq(contactSubmissions.honeypot, ...))` site. The honeypot check happens in `docs/SELF_HOSTED_EMAIL.md` example only — verify it's actually wired in `routers.ts:contact.send`. If not, it's a fake spam check. |
| shotcounter_audit_log | performedByName | **fallback for deleted users** | OK — keep, documented purpose. |
| user_activity_log | userName | same pattern | OK — keep. |
| user_activity_log | userAgent | written, rarely read | Probably fine for audit/forensics; document retention. |
| sdk_session | createdBy | written, never read | The session is a singleton-ish per app; `createdBy` is informational only. Low priority. |
| goennermitglieder | paymentPendingSince | written, never read in queries | Used as a flag; no `where()` site on this column. Could drop, or actually use it for "remind me about pending payments older than 30 days." |
| events | thumbnailPhotoId | written, read in client | OK, but see F-DB-017 (missing FK). |
| harassenlauf_registrations | wurstKalb/wurstKloepfer/wurstVegi | written | Domain-specific; assumed read by the registration export view (verify in client). |

No fully-dead tables found — every table has at least one read site.

## Cross-Domain Notes

- **`server/_core/CLAUDE.md` parity check:** the server-side CLAUDE.md tells future devs "verify the column actually exists in the live DB before writing queries." That should not be a sustainable engineering practice in 2026. F-DB-016 is the root cause.
- **The `_core/` boundary is good** — drizzle/storage layers stay out of `_core`. No findings there.
- **Test coverage of schema:** `server/*.test.ts` files exist for shotcounter, contact, goennermitglieder, auth — but none exercise FK/cascade behavior. A FK regression (e.g. someone removes `onDelete: 'cascade'` from `photos.eventId`) would not be caught by tests.
- **Cross-cutting recommendation:** introduce a `drizzle/CHECKS.md` listing the cascade chains and unique constraints that the application *depends on*, so future migrations don't accidentally weaken them.

## Methodology

1. Read all four schema-related files in `drizzle/` plus `drizzle.config.ts` and the two repo-root `.sql` files.
2. Read `server/db.ts` (full), `server/attendance_db.ts` (full), `server/storage.ts` (full) to map every WHERE/ORDER BY/INSERT site to a column.
3. Grepped each schema column name across the repo (`Grep` tool, code-only paths) to identify read/write sites for the dead-inventory section.
4. Cross-checked Drizzle table declarations against the legacy `.sql` DDL to spot drift (charset, FK, unique key syntax).
5. Verified absence of `drizzle/migrations/` to confirm F-DB-016.
6. Severity scale: critical = data corruption/loss path; high = missing index or missing FK that materially affects prod; medium = process or naming inconsistency that will hurt within 6 months; low = stylistic / forward-compat.
7. Did **not** modify any files. Audit-only.
