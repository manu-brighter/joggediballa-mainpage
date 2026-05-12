# Review Cluster B — Backend & Architecture
**Reviewer:** Senior Tech Lead (subagent)
**Date:** 2026-05-12
**Reports decided:** 03-backend.md, 07-architecture.md

## Summary
- Counts: P0=5, P1=9, P2=6, DEFER=14, REJECT=9
- Headline: Backend tRPC core is structurally healthy but riddled with dead auth helpers, missing transactions on multi-step writes, an authorization hole in `attendance_router`, and a hand-rolled multipart parser that doubles as a security risk. Architecture-side, the most important fix is adding a CI validation gate so type errors stop shipping to prod. Big-bang refactors (per-feature router split, structured logger everywhere, project-references tsconfig) are intentionally deferred — they want their own focused branches.

## ACCEPT — P0 (must ship)

### B-P0-01 — F-BE-003 / F-ARCH-010 / F-SEC-006: Attendance router authz hole
- **Files:** `server/attendance_router.ts`, `server/permissions.ts`, `drizzle/schema.ts` (or `attendance_permission.sql` seed)
- **Plan:**
  1. Add `manage_attendance` permission key to the default-permissions seed in `permissions.ts` (`initializeDefaultPermissions`) — granted to admin + maintainer by default. The key already exists in the legacy `attendance_permission.sql` but isn't in `initializeDefaultPermissions` consistently — verify and add if missing.
  2. Replace every `protectedProcedure` on mutations in `attendance_router.ts` (`createSession`, `updateSession`, `deleteSession`, `createMember`, `updateMember`, `deleteMember`, `reorderMembers`, `saveAttendance`, `updateEventWeight`) with `requirePermission('manage_attendance')`.
  3. Leave list/read procedures on `protectedProcedure` (logged-in only — acceptable; we don't need a `view_attendance` key for this branch).
- **Acceptance criteria:** A logged-in `user`-role account receives `FORBIDDEN` from all attendance mutations. Existing admin still passes. `pnpm test` green; new minimal test covers one denied + one allowed case (see B-P1-09).
- **Depends on:** none
- **Risk:** low

### B-P0-02 — F-BE-002 / F-ARCH-010: Remove dead auth procedure helpers
- **Files:** `server/routers.ts`, `server/_core/trpc.ts`
- **Plan:**
  1. Delete `adminProcedure` export from `server/_core/trpc.ts` (zero importers).
  2. Delete `maintainerProcedure` and `editorProcedure` definitions from `server/routers.ts` (zero usages).
  3. Keep the local `adminProcedure` in `routers.ts` (used ~14 times for admin-infrastructure procedures — users.*, features.*, activityLog.*, permissions.list/toggle, sdk.*, shotcounter.getAuditLog) as the single legacy-style.
  4. Convention is now: **`requirePermission('key')` for content management; `adminProcedure` for admin-infrastructure; `protectedProcedure` for self-edit / authenticated reads; `publicProcedure` for public.** Document this in `server/CLAUDE.md` (3–5 lines).
  5. Do NOT migrate `sdk.*` to `requirePermission` in this branch (would need a new permission key + seed change + UI surface — defer).
- **Acceptance criteria:** `pnpm check` passes. Grep for `maintainerProcedure|editorProcedure` returns zero hits. `_core/trpc.ts` no longer exports `adminProcedure`. Server CLAUDE.md has the rule.
- **Depends on:** none
- **Risk:** low — pure dead-code removal.

### B-P0-03 — F-BE-007 / F-SEC-019 / F-SEC-003 (partial): Replace hand-rolled multipart parser with `multer`
- **Files:** `server/uploadRoutes.ts`, `package.json`
- **Plan:**
  1. `pnpm add multer @types/multer` (devDependency for the types).
  2. Replace the four route handlers in `uploadRoutes.ts` with a single `multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: imageFilter })` instance.
  3. Extract a shared helper `processImageUpload(req, res, { resize: { width, height }, quality, storageKeyFn })` that handles: validate buffer with `sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error' }).metadata()`, resize, `storagePut`, return URL.
  4. Cluster A owns the **auth middleware** and **MIME magic-byte sniffing** parts of F-SEC-003 — we ship multer + size limits + sharp `limitInputPixels`. They wire `requireRole(...)` and `file-type` on top. Hand off cleanly: leave a comment in `uploadRoutes.ts` flagging where auth middleware plugs in.
- **Acceptance criteria:** All four endpoints still work end-to-end. Files > 10 MB rejected with 413. Decompression-bomb test image rejected (sharp throws cleanly, not OOM). Build green.
- **Depends on:** none (but coordinates with cluster A's F-SEC-003 auth-on-uploads work — they layer on top of our `multer` setup)
- **Risk:** medium — replacing the parser changes the upload happy path; needs manual smoke test of all 4 routes (profile pic, sponsor logo, event photo, team member photo).

### B-P0-04 — F-ARCH-001 / F-DEP-016: Add CI validation gate
- **Files:** `.github/workflows/ci.yml` (new), optionally tweak `.github/workflows/deploy.yml`
- **Plan:**
  1. New workflow `ci.yml` triggered on `pull_request` + `push` to non-main branches.
  2. Steps: checkout → setup Node 22 → enable corepack → `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm test` → `pnpm build`.
  3. Add `needs: [ci]` (or duplicate the validation steps) into `deploy.yml` so prod deploys are gated. Conservative version: just add the `ci.yml`, leave deploy.yml alone, document that branch protection requires CI green before merge.
- **Acceptance criteria:** Push to this branch triggers ci.yml and goes green. Intentionally introducing a TS error on a scratch commit makes it red.
- **Depends on:** none
- **Risk:** low — additive only.

### B-P0-05 — F-BE-001 (sub-subset): DB transactions for the 4 most dangerous multi-step writes
- **Files:** `server/db.ts`, `server/routers.ts`
- **Plan:** Wrap these four in `db.transaction(async tx => …)`:
  1. **`sdkCreateSession`** (`db.ts:1037-1061`) — deactivate-all + insert-new. Also fix the missing `WHERE isActive = true` on the deactivate (F-BE-017).
  2. **`sdkAwardPoint`** (`db.ts:1073-1150`) — insert game log + update session score/winner. This is the highest-value transaction in the codebase (real game-state).
  3. **`updateSponsor` photo replace** (`db.ts:313-338`) — old `storageDelete` is non-transactional by nature (S3 isn't), but the DB update + the audit/log path can be a tx. Sequence: take S3 snapshot of old key, do DB update in tx, then delete old S3 object after commit. If DB commit fails, S3 isn't touched.
  4. **`deleteEvent`** (`db.ts:415-443`) — wrap the photo-row deletes + event-row delete in a tx; S3 cleanup runs *after* successful commit (best-effort + log on failure).
- Defer all other transactions (`createTeam`, `updateScore`, `deleteTeam`, `updateRole`, `extend goennermitglied`, `updateTeamMember photo`) to a follow-up — they're lower-risk and we don't want one branch chasing 9 transaction sites.
- **Acceptance criteria:** Each wrapped function still works end-to-end. Manually verify `sdkCreateSession` no longer touches every historical row (`EXPLAIN UPDATE` shows index use). Tests still green.
- **Depends on:** none
- **Risk:** medium — Drizzle's `db.transaction` is well-trodden but `await db.transaction(async tx => …)` must thread `tx` instead of `db` in all calls; easy to miss a nested call.

## ACCEPT — P1

### B-P1-01 — F-BE-008 / F-ARCH-005: Repository cleanup (dead code, stray SQL, .idea, dead docs)
- **Files:** `server/_core/trpc.ts`, `server/db.ts`, `server/sitemap.ts`, `server/_core/cookies.ts`, `attendance_schema.sql`, `attendance_permission.sql`, `.idea/`, `SELF_HOSTED_UPLOAD.md` (root duplicate), `todo-personal.md`, `joggediballa-story.mdx`, `scripts/Anwesenheit.xlsx`
- **Plan:**
  1. Delete unused exports: `getAuditLogsByTeam`, `getAllContactSubmissions`, `markContactSubmissionAsRead` from `db.ts`.
  2. Delete commented-out blocks: `sitemap.ts:56-70`, `_core/cookies.ts:28-41`.
  3. `git rm` the two root-level SQL files (`attendance_schema.sql`, `attendance_permission.sql`) — content is duplicated in `drizzle/schema.ts` / `drizzle/attendance_schema.ts`.
  4. `git rm -r --cached .idea/` (already in `.gitignore` but tracked).
  5. `git rm` the root `SELF_HOSTED_UPLOAD.md` (keep `docs/SELF_HOSTED_UPLOAD.md`), `todo-personal.md`, `joggediballa-story.mdx` (never imported).
  6. `git rm --cached scripts/Anwesenheit.xlsx`, add `scripts/*.xlsx` to `.gitignore` — Swiss PII out of git (F-ARCH-016).
- **Acceptance criteria:** Build still green. `git ls-files | grep -E '(.idea|.xlsx|todo-personal|joggediballa-story|attendance_(schema|permission).sql|^SELF_HOSTED)'` returns empty.
- **Risk:** low

### B-P1-02 — F-BE-001 (broader): DB transactions for the remaining audit-log paths
- **Files:** `server/routers.ts:148-167` (createTeam+audit), `:176-196` (updateScore+audit), `:198-217` (deleteTeam+audit), `:111-128` (updateRole+activityLog), `:701-721` (extend goennermitglied)
- **Plan:** Push transaction boundary into a helper in `db.ts` per operation (e.g. `createTeamWithAudit(input, actorId)`) so callers don't manage `tx`. Five sites total; effort small once pattern is set by P0-05.
- **Acceptance criteria:** Audit-log invariant holds: a successful mutation always has its log entry; a failed mutation has neither.
- **Depends on:** B-P0-05 (pattern established first)
- **Risk:** medium

### B-P1-03 — F-BE-005: `bulkUpsertAttendanceRecords` — one query, in a tx
- **Files:** `server/attendance_db.ts:191-234`
- **Plan:** Replace the per-record loop with `db.insert(attendanceRecords).values(rows).onDuplicateKeyUpdate({ set: { status: sql\`VALUES(status)\`, notes: sql\`VALUES(notes)\` } })` inside a transaction. Reduces 30-person save from 60 round-trips to 1.
- **Acceptance criteria:** Saving attendance for an existing session updates existing rows and inserts missing ones in a single query. Test: insert 3, then upsert 5 (overlapping 2) — result is 5 rows with correct values.
- **Risk:** low

### B-P1-04 — F-BE-024: Remove duplicate `admin.*` procedures
- **Files:** `server/routers.ts:748-763`
- **Plan:** Delete `admin.getAllUsers` and `admin.promoteUser` — duplicates of `users.list` and `users.updateRole`, the latter pair has the activity-log write. Verify no client imports first (`Grep "admin\\.getAllUsers|admin\\.promoteUser"` in `client/`). Keep `admin.deleteUser` (no duplicate).
- **Acceptance criteria:** Build green; tests green; no client-side reference to the deleted procedures.
- **Risk:** low

### B-P1-05 — F-BE-010: Attendance dates use `z.date()` like the rest of the codebase
- **Files:** `server/attendance_router.ts`, possibly `client/src/pages/admin/Attendance.tsx`
- **Plan:** Change `z.string()` → `z.date()` on `createSession`, `updateSession`, and any other date inputs. SuperJSON handles the wire format. Drop the manual `new Date(...)` calls. Client side: pass Date objects directly (SuperJSON handles serialization).
- **Acceptance criteria:** Build green; manual smoke test: create + update an attendance session round-trips dates correctly.
- **Risk:** low

### B-P1-06 — F-BE-015: `reorderAttendanceMembers` uses `Promise.all`, wrapped in a tx
- **Files:** `server/attendance_db.ts:146-156`
- **Plan:** Mirror the pattern in `db.ts:609-622` (`reorderTeamMembers`). 5-line fix.
- **Acceptance criteria:** Reordering 30 members fires 30 concurrent updates inside one transaction. Tests green.
- **Risk:** low

### B-P1-07 — F-BE-017: `sdkCreateSession` adds `WHERE isActive = true`
- **Files:** `server/db.ts:1037-1061`
- **Plan:** Already covered by B-P0-05 (wrap in tx). Within that tx, change the deactivate to `db.update(sdkSession).set({ isActive: false }).where(eq(sdkSession.isActive, true))`. Note: do in same commit as the tx wrap.
- **Acceptance criteria:** Creating a new session deactivates only currently active sessions, not historical ones.
- **Depends on:** B-P0-05
- **Risk:** low

### B-P1-08 — F-BE-025: `health` procedure accepts no input
- **Files:** `server/_core/systemRouter.ts:9-19`
- **Plan:** Make input `z.void()` or drop the `.input()` clause entirely. Optionally echo `{ ok: true, now: Date.now() }`.
- **Acceptance criteria:** `curl https://joggediballa.ch/api/trpc/system.health` returns 200 without a body. Kubernetes-style liveness probes work.
- **Risk:** low

### B-P1-09 — Minimal tests for the procedures we touched
- **Files:** `server/attendance_router.test.ts` (new), `server/sdk.test.ts` (new)
- **Plan:** Add 2 small test files covering the procedures whose code we changed in this branch:
  1. `attendance_router.test.ts` — one happy-path test (admin can save attendance) + one denied test (`user` role gets FORBIDDEN on `saveAttendance`). Covers B-P0-01.
  2. `sdk.test.ts` — one test for `sdkCreateSession` (verify only one `isActive=true` row exists after; tx commits both operations). Covers B-P0-05.
- These are minimal — they pin the auth and tx changes against regression. Full SDK winner-logic test is deferred.
- **Acceptance criteria:** `pnpm test` runs them green.
- **Depends on:** B-P0-01, B-P0-05
- **Risk:** low

## ACCEPT — P2

### B-P2-01 — F-BE-009: `hasPermission` admin short-circuit
- **Files:** `server/permissions.ts`
- **Plan:** Add `if (userRole === 'admin') return true;` at the top of `hasPermission`. Saves a Map lookup + cache miss on every admin-side request. ~3 lines.
- **Risk:** low

### B-P2-02 — F-BE-020: `storage.ts` async fs
- **Files:** `server/storage.ts`
- **Plan:** Replace `fs.existsSync/mkdirSync/writeFileSync/unlinkSync` with `fs/promises` (`mkdir({ recursive: true })`, `writeFile`, `unlink`, `stat`). Already in a `multer`-touching file (B-P0-03) so the diff is co-located.
- **Risk:** low

### B-P2-03 — F-ARCH-007: `git rm -r --cached .idea/`
- Already part of B-P1-01; tagged here for visibility.

### B-P2-04 — F-DEP-006: Remove `add` devDependency typo
- **Files:** `package.json`
- **Plan:** `pnpm remove add`. Cross-listed with cluster A's dependency cleanup — if cluster A owns dep hygiene they should do this; if not, we sweep it.
- **Risk:** zero

### B-P2-05 — F-ARCH-012: Drop `attached_assets` alias
- **Files:** `vite.config.ts`, `vitest.config.ts`
- **Plan:** Remove the `@assets` alias from both — points to nonexistent dir.
- **Risk:** zero

### B-P2-06 — F-ARCH-013: Audit / remove dead Vite plugins
- **Files:** `vite.config.ts`
- **Plan:** Remove `vitePluginManusRuntime()` and `jsxLocPlugin()` if confirmed unused (cross-listed with F-DEP-004; cluster A may own). If they go, drop the `package.json` deps as well.
- **Risk:** low — but verify dev mode still works after.

## DEFER

- [F-BE-004] Two DB modules with divergent error semantics — **defer to `refactor/db-module-unification`**. Real work: pick a policy, migrate all of `attendance_db.ts`, convert raw `Error` → `TRPCError` across `db.ts`. Cross-cutting; needs its own PR.
- [F-BE-006] `getAttendanceStatistics` O(N×M) refactor — **defer to `refactor/attendance-stats`** alongside extracting `computeMemberStats` and adding tests. Out of scope (107-line rewrite, needs careful testing).
- [F-BE-011] `drizzle-zod` schema generation — **defer to `refactor/drizzle-zod-schemas`**. Each entity needs care; not a one-session change.
- [F-BE-012] Extract `computeNextSessionState` from `sdkAwardPoint` + add unit tests — **defer**, paired with B-P0-05's tx wrap. The transaction goes in now; the refactor + comprehensive tests are the next branch.
- [F-BE-013] + [F-BE-014] + [F-ARCH-008] Structured logger (`pino`) — **defer to `refactor/observability`**. Touches 50+ call sites; needs `pino-http` middleware + redaction config + decision on Sentry/Better Stack. Too invasive for this branch.
- [F-BE-016] `upsertUser` simplification — **defer**. Works fine; refactor is nice-to-have.
- [F-BE-018] Centralize JWT signing/verification — **cluster A** owns F-SEC-001 (JWT secret fallback) which dominates this finding. They'll touch the same code.
- [F-BE-019] Implement publish UI for events OR drop the column — **defer to a frontend ticket**. Frontend cluster (C) should own.
- [F-BE-021] Magic numbers → `_core/constants.ts` — **defer**. Cosmetic; nice when touched.
- [F-BE-022] Full test coverage drive — **defer**. We add 2 minimal tests in B-P1-09; the rest is its own multi-day effort.
- [F-BE-023] DB-down behavior on `harassenlauf.register` / `contact.send` — **defer**, depends on F-BE-004 decision (same error policy question).
- [F-ARCH-002] Split tsconfig into project references — **defer to `chore/tsconfig-split`**. Already on user's own backlog (`todo-personal.md`).
- [F-ARCH-003] Drop `client/src/_core/` and `shared/_core/` — **defer to `refactor/client-structure`** or fold into a frontend cluster pass. Cosmetic; ~10 file moves.
- [F-ARCH-004] Full per-feature router split (`routers/events.ts`, `routers/sdk.ts`, etc.) — **defer to `refactor/router-modularization`**. **Decision: keep the current 2-file split for this branch.** Going full modular touches every namespace and is the wrong scope for an audit-fix branch. Going back to monolith (re-inlining `attendance_router`) is backwards. Stay where we are; defer the proper split. Document the rule in `server/CLAUDE.md` so future features know whether to add a sub-router or grow `routers.ts`.
- [F-ARCH-015] Centralize `process.env` in `_core/env.ts` — **defer**. Worthwhile but cross-cuts every server file.
- [F-ARCH-017] Document the wouter patch / remove it — **cluster A** owns via F-DEP-010 / F-SEC-020.

## REJECT

- [F-BE-026] `nanoid` in `vite.ts` for cache-busting — leave as-is, audit notes it isn't worth the touch.
- [F-ARCH-009] Move `shared/_core/errors.ts` → `shared/errors.ts` — covered by deferred F-ARCH-003 client-structure pass. Don't half-do it now.
- [F-ARCH-011] Add Playwright E2E suite — out of scope. Worth doing but not in an audit-fix branch.
- [F-ARCH-014] pnpm workspaces — auditor explicitly recommends not doing it. Reject.
- [F-ARCH-016] (xlsx PII) is split: the `git rm --cached scripts/Anwesenheit.xlsx` part is ACCEPTED in B-P1-01. The "move scripts to archive/" naming convention reject as cosmetic.
- [F-BE-009] in-flight promise dedup for thundering-herd — admin short-circuit accepted as B-P2-01; the thundering-herd part is over-engineering for this app size.
- [F-ARCH-006] Documentation drift — DEFER the doc rewrite to a separate `docs/` PR. Cluster B does delete the duplicate `SELF_HOSTED_UPLOAD.md` (B-P1-01). The `DEPLOYMENT.md`/ecosystem.config.cjs reconciliation is out of code scope.
- [F-BE-022 full coverage] — already deferred; rejecting the "drive coverage to N%" framing.
- Middleware order concern in 07-architecture (session on every tRPC request) — interesting but optimization, not a fix. Reject for this branch.

## Sequencing & dependencies

1. **Independent / parallel:** B-P0-01, B-P0-02, B-P0-04, B-P1-01, B-P2-04, B-P2-05, B-P2-06 — start anywhere, no deps.
2. **Multer + storage async:** B-P0-03 → B-P2-02 (same file). Do P0-03 first, then P2-02 in the same touch.
3. **Transactions:** B-P0-05 establishes the `db.transaction(async tx => …)` pattern. B-P1-02 + B-P1-07 ride on it. B-P1-03 also uses the pattern.
4. **Tests last:** B-P1-09 after B-P0-01 and B-P0-05 (it tests them).
5. **Final:** `pnpm check && pnpm test && pnpm build` must all pass before opening the PR. The new CI workflow (B-P0-04) will re-run them on push.

Suggested commit order: cleanup (P1-01, P2-04/05/06) → dead auth helpers (P0-02) → attendance authz (P0-01) → small fixes (P1-04, P1-05, P1-06, P1-08, P2-01) → multer + storage (P0-03, P2-02) → transactions (P0-05, P1-07, P1-02, P1-03) → tests (P1-09) → CI workflow (P0-04, last so it can validate the branch on first push).

## Cross-cluster handoffs

**To Cluster A (Security / Dependencies / DB):**
- **F-SEC-003 (upload auth + MIME sniff)** — we ship `multer` + size limit + sharp pixel cap (B-P0-03). They layer `requireRole('editor'|'maintainer')` middleware + `file-type` magic-byte check on top. Coordinate in the same PR or sequentially.
- **F-SEC-001 / F-BE-018** — they own JWT secret fallback fix. We deferred the "centralize sign/verify" refactor; they may or may not pull it in.
- **F-DEP-001, -002, -006, -012** — dependency bumps + `add` package removal. We deferred to cluster A; do not duplicate. (B-P2-04 listed as a fallback if cluster A misses it.)
- **F-DB-016 / F-ARCH-005** — the stray SQL files; we delete them in B-P1-01 because they're repo-hygiene-shaped, but cluster A owns the broader "formalize Drizzle migrations" question.
- **F-DB-001 / F-DB-002 / F-DB-003** — duplicate Drizzle schema file, empty relations file, missing FK declarations. All DB-owned; we don't touch them.
- **F-SEC-020 / F-DEP-010** — wouter patch removal. Cluster A owns.

**To Cluster C (Frontend / UI):**
- **F-BE-019** (events.list returns unpublished events). We don't fix this branch; cluster C either builds the publish toggle UI or coordinates removal of the column.
- **F-SEC-007** (unpublished events leak) — cluster A's security responsibility but the actual fix touches the same `getAllEvents` call we noted; coordinate with cluster A.
- **F-FE-005/006** (`useAuth` localStorage in useMemo + hard redirect via `window.location.href`) — frontend's problem, but the auth model is intertwined. No work for us here.

## Open questions for the user

1. **`admin.deleteUser` keep or fold?** We're deleting `admin.getAllUsers` and `admin.promoteUser` as duplicates (B-P1-04). `admin.deleteUser` is the only unique procedure left in the `admin.*` namespace — fine to keep, but worth deciding if `admin.*` namespace stays or its one survivor moves to `users.delete`. Default plan: keep `admin.deleteUser` as-is, no rename.
2. **`manage_attendance` seed roles.** Should attendance management belong to `admin` only, or `admin + maintainer`? Plan: admin + maintainer (matches `manage_goennermitglieder` pattern). Confirm if you want it more restrictive.
3. **`sdk.*` permission key migration.** Backend audit recommends converting `sdk.*` mutations from `adminProcedure` to `requirePermission('manage_sdk')` for consistency. We're **deferring** that to a follow-up because it needs a new seed + UI surface. Confirm OK to defer.
4. **CI gate strictness.** New `ci.yml` will fail PRs on type / test / build errors. Do you also want `prettier --check` as a hard gate, or just type/test/build for now? Plan: type/test/build only; add prettier as a follow-up once formatting is uniform.
5. **Multer size limit.** Default plan: 10 MB per file, 1 file per request. Override if your real-world event photos are bigger (RAW exports can be ~25-40 MB).
