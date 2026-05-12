# Backend Code Audit Report

**Date:** 2026-05-12
**Auditor:** Backend Engineer (subagent)
**Branch:** refactor/full-audit-2026-05
**Scope:** `server/**/*.ts` (~14 files + `_core/`, ~4,860 lines total)

---

## Executive Summary

- The tRPC layer is in good structural shape (single `appRouter`, namespaced sub-routers, SuperJSON, Zod inputs), but it has accumulated five overlapping authorization styles: `adminProcedure` defined locally in `routers.ts`, a second unused `adminProcedure` exported from `_core/trpc.ts`, `maintainerProcedure`, `editorProcedure`, `requirePermission()`, and bare `protectedProcedure` — three of these have zero call sites today.
- Two router files exist (`routers.ts` ~1,025 LOC and `attendance_router.ts` ~242 LOC). The seam is justifiable (attendance is a self-contained feature with its own DB module), but the conventions diverge sharply: `attendance_router` uses bare `protectedProcedure` everywhere (no role/permission gating), returns voids instead of `{ success: true }`, and passes dates as `z.string()` instead of `z.date()` like the rest of `routers.ts`.
- Multi-step writes that mutate two tables (e.g. shotcounter score+audit-log, sponsor logo replace+DB update, Gönnermitglied extend+payment update, photo/event delete + S3 cleanup) are not wrapped in DB transactions. A failure mid-flow leaves the system in an inconsistent state and there is no compensating logic.
- N+1 patterns: `bulkUpsertAttendanceRecords` does a sequential `SELECT`-then-`INSERT/UPDATE` per record in a `for` loop (no transaction either); `reorderAttendanceMembers` does sequential awaits while the equivalent `reorderTeamMembers` already uses `Promise.all`; `initializeDefaultPermissions` runs 14 sequential inserts; `getAttendanceStatistics` fetches all records then does `.find()` per (member × session) cell in JS.
- Error handling is inconsistent: many `db.ts` functions return empty arrays / `null` when the DB is down (silent failure on the read path), while writes throw raw `Error("Database not available")` instead of `TRPCError`. Logging is exclusively `console.log/warn/error` with ad-hoc `[Tag]` prefixes — no structured logger, no request correlation.
- Test coverage is sparse: only 5 procedures have any test (`auth.logout`, `contact.send`, `goennermitglieder`, `shotcounter`, `shotcounter.reset`). Everything in `sdk`, `events`, `photos`, `team`, `sponsors`, `users`, `admin`, `profile`, `permissions`, `features`, `harassenlauf`, `activityLog`, and the entire `attendance` router is untested. The SDK winner-detection logic in `sdkAwardPoint` is non-trivial and tested only manually.
- Dead/unused code: `getAuditLogsByTeam`, `getAllContactSubmissions`, `markContactSubmissionAsRead`, `getAttendanceRecord`, and the `_core/trpc.ts` `adminProcedure` export are all unreferenced outside their definition file. `maintainerProcedure` and `editorProcedure` in `routers.ts` are defined but never applied to a procedure. Commented-out sitemap blocks (lines 56-70 of `sitemap.ts`) and a commented-out cookie domain block (`cookies.ts` lines 28-41) should be deleted or implemented.
- `uploadRoutes.ts` reimplements multipart parsing by hand with `body.toString('binary')` and substring scans. This is fragile, allocates the entire body in memory, and silently truncates anything containing `\r\n` in binary content interpreted as a part boundary. `multer` or `busboy` already exists in the Node ecosystem.

---

## Findings

### F-BE-001: Multi-step writes are not transactional
- **Severity:** high
- **Effort:** medium
- **Location:**
  - `server/routers.ts:148-167` (createTeam + createAuditLog)
  - `server/routers.ts:176-196` (updateScore: getTeam → updateScore → createAuditLog)
  - `server/routers.ts:198-217` (deleteTeam: getTeam → createAuditLog → deleteTeam)
  - `server/routers.ts:701-721` (extend goennermitglied: extend → updateGoennermitglied for payment)
  - `server/routers.ts:111-128` (updateRole: getUserById → updateUserRole → createActivityLog)
  - `server/db.ts:313-338` (updateSponsor: select old → storageDelete → update)
  - `server/db.ts:415-443` (deleteEvent: select photos → loop storageDelete → delete event)
  - `server/db.ts:543-579` (updateTeamMember photo replacement)
  - `server/db.ts:1037-1061` (`sdkCreateSession`: update all sessions to isActive=false → insert new)
- **Issue:** Several procedures perform 2-3 dependent writes back-to-back without a `db.transaction(async (tx) => …)`. If the second call fails the first is not rolled back, leaving orphan audit log entries, stale active sessions, score updates without an audit trail, or a Gönnermitglied with extended end date but un-updated payment status.
- **Recommendation:** Use Drizzle's `db.transaction(async (tx) => { … })` for any procedure that touches multiple rows. Push the transaction boundary as low as possible — into the `db.ts` helper rather than into the router — so callers don't have to remember.
- **Rationale:** Audit logs are supposed to be the source of truth for who changed what. A partial failure silently breaks the audit invariant.

### F-BE-002: Five overlapping authorization styles, three unused
- **Severity:** high
- **Effort:** small-medium
- **Location:** `server/routers.ts:27-78`, `server/_core/trpc.ts:30-45`
- **Issue:**
  - `_core/trpc.ts` exports `adminProcedure` — **never imported**.
  - `routers.ts` redefines its own `adminProcedure` (line 27).
  - `routers.ts` defines `maintainerProcedure` (line 41) and `editorProcedure` (line 51) — **never used on any procedure**.
  - `requirePermission()` is the documented preferred style.
  - `protectedProcedure` is used on its own in `goennermitglieder.list/listActive/listExpired`, `profile.*`, `permissions.getMyPermissions`, and across the entire `attendance` router.
  - Mapping of every procedure → style is in §Cross-Domain Notes below.
- **Recommendation:**
  1. Delete `adminProcedure` from `_core/trpc.ts` (dead export).
  2. Delete `maintainerProcedure` and `editorProcedure` from `routers.ts` (dead definitions).
  3. Keep `adminProcedure` in `routers.ts` only for "admin-infrastructure" (users, permissions, feature toggles, activity log) as the project CLAUDE.md states. Convert `sdk.*` mutations from `adminProcedure` to `requirePermission('manage_sdk')` for consistency with the rest of the content-editing surface.
  4. Audit `attendance` for which procedures should be gated by a permission key (likely `manage_attendance`).
- **Rationale:** Dead code in the auth layer is the most confusing kind of dead code — readers can't tell whether a procedure they don't see in the list is "allowed to anyone logged in" by accident or by design.

### F-BE-003: Attendance router uses bare `protectedProcedure` for all mutations
- **Severity:** high
- **Effort:** small
- **Location:** `server/attendance_router.ts:22-242`
- **Issue:** Every procedure including `deleteSession`, `deleteMember`, `saveAttendance`, `updateEventWeight` is just `protectedProcedure`. Any logged-in user (role `user` or above) can delete sessions or change the global event-weight multiplier. The rest of the codebase has migrated to `requirePermission()` — attendance was left behind.
- **Recommendation:** Add a `manage_attendance` permission key and gate all mutations. Reads can stay on `protectedProcedure` or get their own `view_attendance` permission.
- **Rationale:** Inconsistent permission model is a real footgun; today's "everyone is admin" team will not always be so.

### F-BE-004: Two separate DB modules, inconsistent guard patterns
- **Severity:** medium
- **Effort:** medium
- **Location:** `server/db.ts` vs `server/attendance_db.ts`
- **Issue:**
  - `db.ts` returns `[] | null | undefined` when DB is down on the read path, and `throw new Error("Database not available")` on the write path.
  - `attendance_db.ts` `throw`s on **every** path, even reads (e.g. `listAttendanceSessions:20`, `listAttendanceMembers:90`).
  - `db.ts` exposes `getDb()`; `attendance_db.ts` re-imports it. The split is justifiable on size grounds but the convention divergence isn't.
  - In `attendance_db.ts:22-32` and `:92-95`, query reassignment is cast to `as any` because Drizzle's narrowed type doesn't unify on conditional `.where()` chains. The pattern is solved in `db.ts:365-372` via ternary in the same expression.
- **Recommendation:**
  1. Pick one error-on-DB-down policy and apply it everywhere (recommendation: return empty/`null` on reads, throw `TRPCError` on writes — convert raw `Error` to `TRPCError({ code: 'INTERNAL_SERVER_ERROR' })`).
  2. Replace the `as any` reassignment pattern in `attendance_db.ts` with the ternary pattern from `db.ts`.
  3. Either merge `attendance_db.ts` into `db.ts` (file would be ~1,550 LOC — borderline acceptable for the "one file per layer" convention) or split `db.ts` itself by domain and document the convention.
- **Rationale:** Today a tRPC procedure that calls `attendance_db` throws a non-tRPC `Error` ("Database not available") which becomes a generic `INTERNAL_SERVER_ERROR` on the client with no useful message. Procedures calling `db.ts` silently return empty arrays. Same client, two error semantics for the same outage.

### F-BE-005: `bulkUpsertAttendanceRecords` is N×2 sequential round trips with no transaction
- **Severity:** high
- **Effort:** small
- **Location:** `server/attendance_db.ts:215-234`, `server/attendance_db.ts:191-213`
- **Issue:**
  ```ts
  for (const record of records) {
    await upsertAttendanceRecord({ sessionId, memberId: …, status: …, notes: … });
  }
  // each upsertAttendanceRecord = SELECT + INSERT or UPDATE (2 round trips)
  ```
  Saving attendance for a 30-person session = 60 sequential queries. MySQL supports `INSERT … ON DUPLICATE KEY UPDATE` (already used in `db.ts:108` for users); `attendanceRecords` has a `unique(sessionId, memberId)` index per schema.
- **Recommendation:** Replace with a single `INSERT ... ON DUPLICATE KEY UPDATE` over the whole array, wrapped in a transaction. Drizzle: `db.insert(attendanceRecords).values(rows).onDuplicateKeyUpdate({ set: { status: sql\`VALUES(status)\`, notes: sql\`VALUES(notes)\` } })`.
- **Rationale:** Currently every attendance save is O(N) round trips and can be partially applied on failure.

### F-BE-006: `getAttendanceStatistics` is O(members × sessions) in JS with no index hints
- **Severity:** medium
- **Effort:** medium
- **Location:** `server/attendance_db.ts:276-381`
- **Issue:** Loads all sessions, all members, all records, then for each (member, session) pair does `memberRecords.find(r => r.sessionId === session.id)`. With 30 members × 50 sessions/year = 1,500 nested lookups, plus an inline raw SQL subquery (`sql\`${attendanceRecords.sessionId} IN (SELECT id FROM attendance_sessions WHERE YEAR(date) = ${year})\``) that bypasses Drizzle's type safety. The aggregation logic (107 lines) mixes data loading, calculation, sorting, and presentation.
- **Recommendation:**
  1. Replace the raw subquery with `inArray(attendanceRecords.sessionId, sessions.map(s => s.id))` or a proper `INNER JOIN`.
  2. Build a `Map<memberId, Map<sessionId, record>>` once instead of `.find()` per cell.
  3. Extract the calculation into a pure function `computeMemberStats(members, sessions, records, eventWeight)` for unit-testability.
- **Rationale:** This is the one procedure with non-trivial business logic and zero tests.

### F-BE-007: Manual multipart parser in `uploadRoutes.ts`
- **Severity:** high
- **Effort:** medium
- **Location:** `server/uploadRoutes.ts:9-53`, used by all four `/api/upload/*` routes
- **Issue:** Hand-rolled multipart parser using `body.toString('binary')` and `.split(boundary)`. Problems:
  - Buffers the entire upload in memory before parsing.
  - Round-trips binary through `'binary'` string encoding — fragile for large images and a known foot-gun (`indexOf('\r\n\r\n')` can match inside JPEG payloads).
  - Only extracts the first `name="file"` part; ignores additional form fields entirely.
  - The four routes (`/profile-picture`, `/sponsor-logo`, `/event-photo`, `/team-member-photo`) duplicate the same `chunks + parseMultipartFormData + validate + upload` boilerplate ~70 lines each.
  - `req.on('data')` / `req.on('end')` with no `.on('error')` — a client aborting mid-upload will leak the response.
- **Recommendation:** Switch to `multer` (in-memory storage with `limits: { fileSize }`) or `busboy` for streaming. Extract the shared "upload + validate image MIME + storagePut + sharp resize" flow into a single helper used by all four routes.
- **Rationale:** Security agent will flag this too (the size limit gap), but even on pure quality grounds it's the densest copy-paste in the codebase.

### F-BE-008: Dead code — unused exports, defined-but-never-applied procedures, commented-out blocks
- **Severity:** medium
- **Effort:** small
- **Location:**
  - `server/_core/trpc.ts:30-45` — `adminProcedure` exported, no importers.
  - `server/routers.ts:41-59` — `maintainerProcedure` and `editorProcedure` defined, no usages.
  - `server/db.ts:253-261` — `getAuditLogsByTeam` exported, no callers.
  - `server/db.ts:688-709` — `getAllContactSubmissions` and `markContactSubmissionAsRead` exported, no tRPC procedure for the contact-submission inbox feature exists.
  - `server/attendance_db.ts:173-189` — `getAttendanceRecord` is used only inside `upsertAttendanceRecord` (intra-module), not exported usefully.
  - `server/sitemap.ts:56-70` — commented-out "we could add lastmod dynamically" block + two TODO blocks for events/team/sponsors that are explicitly "not needed".
  - `server/_core/cookies.ts:28-41` — 14 lines of commented-out cookie-domain logic.
  - `server/db.ts:96-98` — comment about the removed `OWNER_OPEN_ID` env var (keep this one — it's load-bearing context).
- **Recommendation:** Delete unused exports and commented blocks. If `getAllContactSubmissions` / `markContactSubmissionAsRead` are for a planned admin inbox UI, add at least a stub tRPC procedure or open a TODO ticket.
- **Rationale:** Dead code in a 1k-line router file especially camouflages real bugs.

### F-BE-009: `requirePermission()` does a DB read on every request
- **Severity:** medium
- **Effort:** small
- **Location:** `server/routers.ts:65-78` calling `hasPermission` → `getUserPermissions` (`server/permissions.ts:18-31`)
- **Issue:** Cache is in `permissions.ts` and is per-role (good), but `hasPermission` is called in middleware on *every* `requirePermission`-gated request. Cache hit cost is low (one Map lookup), but cache miss after toggle clears the cache and N concurrent requests will each independently fire `db.getAllPermissions()` — small thundering-herd. Also `getUserPermissions` is called even when `userRole === 'admin'` whereas admin always has every permission by convention.
- **Recommendation:**
  - Add a short-circuit for `userRole === 'admin'` in `hasPermission` (admin always allowed). This also matches the data model where admins have all permissions inserted by `initializeDefaultPermissions`, but skips the DB read entirely.
  - For the thundering-herd, store an in-flight `Promise<string[]>` in the cache so concurrent callers share the same fetch.
- **Rationale:** Latency win is small but admin requests on a cold cache currently do an unnecessary DB read for every gated call (the shotcounter polls every 1-2s per the comment in `_core/index.ts:62`).

### F-BE-010: `attendance_router` date handling diverges from the rest of the codebase
- **Severity:** medium
- **Effort:** small
- **Location:** `server/attendance_router.ts:52`, `:71-83`
- **Issue:** Dates are sent as `z.string()` ISO strings and manually `new Date()`-ed in the procedure, while the rest of the codebase (events, gönnermitglieder, profile) uses `z.date()` and relies on SuperJSON to transport `Date` objects. Mixed conventions in a typed monorepo defeat the point of E2E type safety.
- **Recommendation:** Switch attendance procedures to `z.date()` and let SuperJSON handle the wire format.
- **Rationale:** Consistency; one fewer place for "date came through as string in production" bugs.

### F-BE-011: Inline duplicated Zod schemas for Gönnermitglied / Team / Event / Photo
- **Severity:** medium
- **Effort:** small
- **Location:**
  - `server/routers.ts:649-693` — `goennermitglieder.create` and `.update` repeat 13 fields, only difference is `.optional()` chains and the `memberId` field.
  - `server/routers.ts:292-328` — `events.create` and `.update` likewise repeat ~8 fields.
  - `server/routers.ts:411-441` — `team.create` and `.update`.
  - `server/routers.ts:372-383` — photo create schema duplicates field names already present in `InsertPhoto` from drizzle.
- **Recommendation:** Define a base Zod schema once per entity (`goennermitgliedFields`, `eventFields`, …) and use `.partial()` + `.extend({ memberId: z.number() })` for updates. Even better: use `drizzle-zod`'s `createInsertSchema(table)` to generate schemas from the Drizzle table definition.
- **Rationale:** Today changing a constraint (e.g. `street.max(255)` → `max(200)`) requires editing two places per entity, and drift will happen.

### F-BE-012: `sdkAwardPoint` mixes business logic, DB writes, and JSON parsing in one 80-line function
- **Severity:** medium
- **Effort:** medium
- **Location:** `server/db.ts:1073-1150`
- **Issue:** The function does: validate session state → insert game log → compute scores → compute `maxRemaining` (numerical) → determine winner-by-points or winner-by-mathematical-elimination → parse `session.gameNames` JSON → update session. Nested error swallowing (`try { JSON.parse } catch { /* ignore */ }` appears 4 times across `db.ts` and `routers.ts`). No transaction; the insert + update can desync.
- **Recommendation:**
  1. Wrap insert + update in a transaction.
  2. Extract `computeNextSessionState(session, winnerId): { newPlayer1Score, newPlayer2Score, nextGame, winnerId, nextGameName }` as a pure function. This is the highest-value unit test target in the project.
  3. Store `gameNames` as JSON column (not text + manual `JSON.parse`) so the parsing happens in Drizzle once.
- **Rationale:** This is the only piece of real domain logic in the backend and currently has no tests.

### F-BE-013: Silent error swallowing across multiple files
- **Severity:** medium
- **Effort:** small
- **Location:**
  - `server/routers.ts:962, :987` — `try { JSON.parse } catch { /* ignore */ }`
  - `server/db.ts:1051, :1132` — same
  - `server/routers.ts:572-578` — Harassenlauf email failure swallowed with only `console.error`
  - `server/db.ts:879-883` — `createActivityLog` swallows DB errors, returns void
  - `server/_core/context.ts:18-21` — auth error swallowed silently (`user = null`); intentional for public procedures but logs nothing, so a misconfigured JWT_SECRET in prod yields silent "no users authenticate" with no log
- **Recommendation:** Adopt a structured logger (pino, winston, or even a thin wrapper around console with levels and JSON output). At minimum, every swallowed catch should log with enough context to be findable in Sentry/journalctl. Failed JSON parses on `gameNames` should log the bad payload and session id.
- **Rationale:** The project has Sentry mentioned in the global CLAUDE.md but no Sentry SDK integration here — and the current logging convention (`[Tag]` prefixed `console.*`) would make Sentry breadcrumbs hard.

### F-BE-014: `console.*` logging without correlation, levels, or redaction
- **Severity:** low-medium
- **Effort:** medium
- **Location:** Pervasive — `console.log/warn/error` in 50+ places across `_core/index.ts`, `_core/googleAuth.ts`, `_core/googleAuthRoutes.ts`, `_core/sdk.ts`, `db.ts`, `storage.ts`, `uploadRoutes.ts`, `routers.ts`, `sitemap.ts`.
- **Issue:** No structured fields, no request correlation, no log level configuration. Some lines log user emails on every successful login (`googleAuthRoutes.ts:95`) — PII without retention policy.
- **Recommendation:** Replace with pino (`{ level, msg, requestId, userId, … }`). Add `pino-http` middleware in `_core/index.ts` for request-level correlation.
- **Rationale:** Quality-of-life for ops, and pre-requisite for Sentry integration.

### F-BE-015: `reorderAttendanceMembers` is sequential while `reorderTeamMembers` is parallel
- **Severity:** low
- **Effort:** small
- **Location:** `server/attendance_db.ts:146-156` vs `server/db.ts:609-622`
- **Issue:** Same operation, two implementations. `db.ts:609-622` does `Promise.all(memberIds.map(…))` with a comment "Run all updates in parallel instead of sequentially" — the lesson was learned but not propagated to attendance.
- **Recommendation:** Use `Promise.all` in `reorderAttendanceMembers` as well, and wrap in a transaction.
- **Rationale:** Trivial, and a 30-member reorder is currently 30 sequential round trips.

### F-BE-016: Hand-coded `upsertUser` in `db.ts:53-115` re-implements `onDuplicateKeyUpdate` plumbing
- **Severity:** low
- **Effort:** medium
- **Location:** `server/db.ts:53-115`
- **Issue:** ~60 lines of "build values object, build updateSet object, special-case textFields, special-case lastSignedIn, special-case empty updateSet" — code that Drizzle's `onConflictDoUpdate` + `getTableColumns` can express in ~10 lines.
- **Recommendation:** Refactor using `set: { ...user, lastSignedIn: new Date() }` and let MySQL no-op equal updates. Or `set: getTableColumns(users)`.
- **Rationale:** Function is far longer than the work it does.

### F-BE-017: `sdkCreateSession` deactivates *all* sessions globally
- **Severity:** medium (correctness, but matches comment "Deactivate all existing sessions first")
- **Effort:** small
- **Location:** `server/db.ts:1037-1061`
- **Issue:** `await db.update(sdkSession).set({ isActive: false });` — no `WHERE`. Currently intended (one active session at a time), but:
  1. The update has no `WHERE isActive = true`, so it touches every historical row on every new session — works but wastes work.
  2. The insert and the deactivate are not in a transaction; a crash between the two yields zero active sessions (UI shows "no active session").
- **Recommendation:** Wrap in a transaction and add `WHERE isActive = true` to the deactivate.
- **Rationale:** Cheap fix, removes a wide table scan.

### F-BE-018: Cookie + JWT signing logic duplicated between `googleAuthRoutes.ts` and `_core/sdk.ts`
- **Severity:** medium
- **Effort:** small
- **Location:**
  - JWT signing: `_core/googleAuthRoutes.ts:70-80` (uses `process.env.JWT_SECRET` directly)
  - JWT verification: `_core/sdk.ts:37-66` (uses `ENV.cookieSecret` which is `process.env.JWT_SECRET`)
- **Issue:** Two paths to the same secret with different defaults (`'fallback-secret-change-in-production'` vs `''`). Different code branches handle the not-set case differently. Verifier accepts `HS256` only, signer also uses `HS256` — but coordination is implicit.
- **Recommendation:** Centralize signing+verification in one module (`_core/auth-token.ts`), import both ends from it, and have `ENV` fail-fast if `JWT_SECRET` is empty in production.
- **Rationale:** A typo or env mismatch silently allows the fallback secret in production today.

### F-BE-019: `events.list` shows unpublished events because there is no publish UI
- **Severity:** low (documented inline)
- **Effort:** small (UI work, out of scope here, but flag)
- **Location:** `server/routers.ts:278-282`
- **Issue:** `getAllEvents(false)` returns all events regardless of `isPublished`. The comment says this is intentional pending a publish UI. The DB column exists, the public endpoint lies about respecting it.
- **Recommendation:** Either implement the publish toggle now or drop the column. Inconsistent state ("we built it but it does nothing") rots fast.
- **Rationale:** Cross-cuts to frontend audit; just noting.

### F-BE-020: `storage.ts` uses synchronous fs calls
- **Severity:** low
- **Effort:** small
- **Location:** `server/storage.ts:42-48, 67-83`
- **Issue:** `fs.existsSync`, `fs.mkdirSync`, `fs.writeFileSync`, `fs.unlinkSync` block the event loop. Each upload writes up to ~10 MB synchronously.
- **Recommendation:** Use `fs/promises` (`mkdir(dir, { recursive: true })`, `writeFile`, `unlink`, `stat` instead of `existsSync`).
- **Rationale:** Under any concurrency this serializes uploads behind whatever else is running.

### F-BE-021: Magic numbers and inline string literals
- **Severity:** low
- **Effort:** small
- **Location:** Various
  - `server/_core/googleAuthRoutes.ts:30, :86` — `24 * 60 * 60 * 1000`, `7 * 24 * 60 * 60 * 1000` (session vs JWT lifetimes; differ by 7×)
  - `server/_core/index.ts:67` — `windowMs: 15 * 60 * 1000`, `limit: 300` (no named constant)
  - `server/uploadRoutes.ts:225, :239, :322` — `1200`, `400`, `512`, quality `65/60/70` for sharp resize
  - `server/db.ts:263, :886, :898` — default `limit` values `100`, `100`, `50` repeated
  - `server/routers.ts:661` — `contributionAmount: z.number().min(1).default(20)` — what is "20"? CHF? Document.
- **Recommendation:** Extract a `server/_core/constants.ts` with named values, especially for the photo-resize dimensions (which need to match frontend `<img sizes>` to be useful for performance).

### F-BE-022: Test coverage map
- **Severity:** medium
- **Effort:** large (writing tests is the work)
- **Location:** `server/*.test.ts` — 5 files
- **Issue:** Tested today:
  - `auth.logout.test.ts` — covers `auth.logout`
  - `contact.send.test.ts` — covers `contact.send`
  - `goennermitglieder.test.ts` — covers create + extend basics
  - `shotcounter.test.ts` — covers create/update/delete
  - `shotcounter.reset.test.ts` — covers reset

  Untested (highest-value first):
  1. **`sdk.*`** — `awardPoint`, `undoLastGame`, `resetSession` — non-trivial winner logic, currently zero coverage.
  2. **`attendance.*`** — entire router, including `bulkUpsertAttendanceRecords` and `getStatistics` business logic.
  3. **`events.*`** — `eventLinks` JSON serialization round-trip.
  4. **`permissions.toggle`** — cache invalidation behavior.
  5. **`users.updateRole`** and **`admin.deleteUser`** — guard rails (can't delete self, can't change own role).
  6. **`harassenlauf.register`** — input validation thresholds (memberCount 1-5, wurst 0-10).
  7. **`photos.create` / `photos.delete`** — S3 key tracking.
  8. **`team.reorder`** — display order sequence.
- **Recommendation:** Prioritize SDK and attendance — they have the most logic and zero coverage. Pure-function extraction (see F-BE-006, F-BE-012) makes these much easier to test without a DB.

### F-BE-023: `harassenlauf.register` saves email + form data even if DB is unavailable
- **Severity:** low (correctness)
- **Effort:** small
- **Location:** `server/routers.ts:554-580`
- **Issue:** If `database` is `null` (DB outage), the DB save is silently skipped and the email is still sent. Returns `{ success: true }` either way. Same pattern in `contact.send` (`server/routers.ts:600-628`).
- **Recommendation:** Either:
  - Treat email as the source of truth and accept silent DB-skip (current behavior — document it), or
  - Throw `TRPCError` when DB is unavailable so the client sees the failure.
  - Currently the client thinks the registration is persisted when it might not be.
- **Rationale:** Surprise mode: form submits "successfully" during a DB outage but no record exists for the organizers.

### F-BE-024: `users.updateRole` and `admin.promoteUser` are near-duplicates
- **Severity:** low
- **Effort:** small
- **Location:** `server/routers.ts:104-128` vs `server/routers.ts:753-763`
- **Issue:** Both procedures take `{ userId, role }` and update the role. The only difference: `users.updateRole` writes an `activityLog` entry, `admin.promoteUser` does not. The client should call exactly one of them; having two is a footgun.
- **Recommendation:** Delete `admin.promoteUser`. Keep `users.updateRole`. If `admin.*` namespace exists for organization reasons, move `users.list`/`users.updateRole` there.
- **Rationale:** Same with `users.list` (line 101) vs `admin.getAllUsers` (line 748) — exact duplicates.

### F-BE-025: `health` procedure requires a timestamp input
- **Severity:** low
- **Effort:** small
- **Location:** `server/_core/systemRouter.ts:9-19`
- **Issue:** `health` is a probe endpoint that requires `{ timestamp: number ≥ 0 }`. This makes it unusable from curl / Kubernetes liveness probes / uptime monitors that won't supply a timestamp. The timestamp is also discarded — the handler returns `{ ok: true }`.
- **Recommendation:** Make input optional or drop it entirely. Optionally echo `now`.
- **Rationale:** Friction for ops tooling with zero benefit.

### F-BE-026: `nanoid` re-imported in vite.ts for cache-busting the `main.tsx?v=` query
- **Severity:** low (cosmetic)
- **Effort:** small
- **Location:** `server/_core/vite.ts:4, :39`
- **Issue:** `nanoid` generates a fresh ID on every dev-mode request to bust browser cache. Works, but `Date.now()` would do the same job without a dependency. Not worth removing the dep just for this, but unusual choice.
- **Recommendation:** Leave as-is unless the dep is removed for other reasons.

---

## Cross-Domain Notes

### Procedure → Authorization Style Mapping

| Router       | Procedure                                                                                                     | Style                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| system       | health                                                                                                        | public                                                                 |
| attendance   | listSessions, getSession, createSession, updateSession, deleteSession                                         | **protected** (no role check — high risk, F-BE-003)                    |
| attendance   | listMembers, getMember, createMember, updateMember, deleteMember, reorderMembers                              | **protected** (no role check)                                          |
| attendance   | listRecords, saveAttendance                                                                                   | **protected** (no role check)                                          |
| attendance   | getSetting, updateEventWeight                                                                                 | **protected** (no role check)                                          |
| attendance   | getStatistics                                                                                                 | **protected** (no role check)                                          |
| auth         | me, logout                                                                                                    | public                                                                 |
| users        | list                                                                                                          | adminProcedure                                                         |
| users        | updateRole                                                                                                    | adminProcedure                                                         |
| shotcounter  | getTeams                                                                                                      | public                                                                 |
| shotcounter  | createTeam, updateScore, deleteTeam                                                                           | requirePermission('edit_shotcounter')                                  |
| shotcounter  | resetYear, resetScores                                                                                        | requirePermission('reset_shotcounter')                                 |
| shotcounter  | getAuditLog                                                                                                   | adminProcedure                                                         |
| sponsors     | list                                                                                                          | public                                                                 |
| sponsors     | create, delete                                                                                                | requirePermission('manage_sponsors')                                   |
| events       | list, getById                                                                                                 | public                                                                 |
| events       | create, update, delete, setThumbnail                                                                          | requirePermission('edit_events')                                       |
| photos       | listByEvent, listAll                                                                                          | public                                                                 |
| photos       | create, delete                                                                                                | requirePermission('edit_events')                                       |
| team         | list                                                                                                          | public                                                                 |
| team         | create, update, delete, reorder                                                                               | requirePermission('edit_team')                                         |
| features     | list, get                                                                                                     | public                                                                 |
| features     | toggle, create                                                                                                | adminProcedure                                                         |
| harassenlauf | register                                                                                                      | public                                                                 |
| contact      | send                                                                                                          | public                                                                 |
| goennermitglieder | list, listActive, listExpired                                                                            | **protected** (no role check — any logged-in user sees member data, possibly intended) |
| goennermitglieder | create, update, extend, confirmPayment, delete                                                          | requirePermission('manage_goennermitglieder')                          |
| admin        | getAllUsers                                                                                                   | adminProcedure (duplicate of users.list, F-BE-024)                     |
| admin        | promoteUser                                                                                                   | adminProcedure (duplicate of users.updateRole, F-BE-024)               |
| admin        | deleteUser                                                                                                    | adminProcedure                                                         |
| profile      | updatePicture, updateProfile                                                                                  | protected (self-edit, intended)                                        |
| permissions  | list                                                                                                          | adminProcedure                                                         |
| permissions  | getMyPermissions                                                                                              | protected                                                              |
| permissions  | toggle                                                                                                        | adminProcedure                                                         |
| sdk          | getActive, getGameLog                                                                                         | public                                                                 |
| sdk          | createSession, updateSession, awardPoint, undoLastGame, resetSession                                          | adminProcedure (could be requirePermission('manage_sdk'))              |
| activityLog  | list, getByUser                                                                                               | adminProcedure                                                         |

**Style usage totals:**
- `publicProcedure`: 17 procedures
- `protectedProcedure` (no role check): 19 procedures (15 attendance + 3 goennermitglieder reads + profile.updatePicture + profile.updateProfile + permissions.getMyPermissions — wait, 19)
- `adminProcedure` (local in routers.ts): 14 procedures
- `requirePermission(...)`: 19 procedures
- `adminProcedure` (from _core/trpc.ts): **0** (dead export)
- `maintainerProcedure`: **0** (dead definition)
- `editorProcedure`: **0** (dead definition)

### File seam: `routers.ts` vs `attendance_router.ts`

The split is defensible: attendance is a self-contained feature with its own DB module (`attendance_db.ts`, 381 LOC) and ~16 procedures that would push `routers.ts` past 1,250 lines. The seam is mounted cleanly at `routers.ts:86` (`attendance: attendanceRouter`). **Recommendation: keep the split, but**:
1. Apply consistent auth (F-BE-003).
2. Apply consistent date types (F-BE-010).
3. Apply consistent DB-down behavior (F-BE-004).
4. If more features warrant their own files (events, sdk, gönnermitglieder all have enough surface), establish a `server/routers/` directory convention rather than a flat `*_router.ts` suffix.

### Middleware order in `_core/index.ts`

Order is sensible:
1. `trust proxy 1` — required first
2. `helmet` — security headers before any route
3. `rate-limit` (skipping tRPC) — before body parsing so abusive clients don't consume buffering
4. `express.json`, `express.urlencoded` — body parsing
5. `registerGoogleAuthRoutes` — installs `session`, `passport.initialize`, `passport.session`, then OAuth routes
6. tRPC at `/api/trpc`
7. Upload routes at `/api/upload`
8. Sitemap
9. Vite (dev) or static (prod) — last, as catch-all for SPA

**Concern:** `registerGoogleAuthRoutes` adds `app.use(session({...}))` at runtime *after* `rate-limit`. Session is set up before the OAuth routes themselves, which is fine, but the session middleware runs on *every* request including `/api/trpc/*` — pulling in `express-session` for tRPC requests is wasted work since tRPC uses its own JWT cookie. Mount session middleware only on the OAuth routes (e.g. `app.use('/api/auth', session(...))`).

### Test infrastructure

The `createCaller(ctx)` pattern is solid and consistent across the 5 test files. Context is built by hand each time — a `makeTestContext(overrides)` helper would reduce boilerplate. No mocking of the DB, per project convention. CI test failures are expected when DB/S3/SMTP are absent, which means CI is effectively "lint + typecheck" — the test signal in CI is weak. Consider a docker-compose CI step that brings up MySQL for integration tests.

---

## Methodology

- Read all 24 `.ts` files under `server/` and `server/_core/` end-to-end (~4,860 lines).
- Cross-referenced exports vs imports across the project using `Grep` for dead-code detection (`maintainerProcedure`, `editorProcedure`, `adminProcedure` from `_core/trpc.ts`, `getAuditLogsByTeam`, `getAllContactSubmissions`, `markContactSubmissionAsRead`, `getAttendanceRecord`, `upsertAttendanceRecord`).
- Mapped every tRPC procedure in the project to its authorization style by reading `routers.ts` and `attendance_router.ts` linearly.
- Counted multi-step writes and looked for `db.transaction(` — **zero call sites** for transactions in the entire backend.
- Identified N+1 patterns by looking for `for (… of …) { await db.…` and `.map(… await …)` patterns.
- Confirmed test file count (5) and cross-referenced procedure list against test files.
- Excluded security findings from this report — covered by a separate security agent. (Items touching security boundaries — JWT secret fallback, S3 uploads, rate limiting — are flagged here only for code quality, not for exploitability.)
- File line counts via `wc -l`; total backend surface area = 4,859 lines.

— Backend audit complete.
