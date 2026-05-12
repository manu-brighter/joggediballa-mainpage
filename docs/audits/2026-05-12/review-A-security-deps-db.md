# Review Cluster A — Security, Dependencies, Database
**Reviewer:** Senior Tech Lead (subagent)
**Date:** 2026-05-12
**Reports decided:** 01-security.md, 02-dependencies.md, 06-database.md

## Summary
- Counts: P0=10, P1=14, P2=10, DEFER=6, REJECT=4
- Headline: This branch closes every critical/high security finding, eliminates ~60 of 80 npm audit advisories via targeted dep removals + minor/patch bumps, and lands purely additive Drizzle schema fixes (FK gaps, indexes, dead-file cleanup) without touching column types on the live DB. Express 4→5, full migrations switchover, TS 6, and Vitest 4 are deferred to dedicated branches.

## ACCEPT — P0 (must ship)

### A-P0-01 — F-SEC-001: JWT/session secret hardcoded fallback
- **Files:** `server/_core/googleAuthRoutes.ts`, `server/_core/env.ts`, `.env.example`
- **Plan:** Fail-fast at boot in `env.ts` if `JWT_SECRET` missing or `<32` chars (throw with clear message). Remove the `'fallback-secret-change-in-production'` literal in `googleAuthRoutes.ts`. Remove the `?? ''` on the verify side. Introduce separate `SESSION_SECRET` (only if F-SEC-018 keeps sessions; per A-P0-09 we remove sessions entirely). Update `.env.example` with `JWT_SECRET=<generate 32+ chars>` and a comment. Bundles F-SEC-023 (`client_secret` placeholder): same fail-fast on `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` missing.
- **Acceptance criteria:** Server refuses to start with missing/short secret; no source literals; tests pass.
- **Depends on:** —
- **Risk:** low

### A-P0-02 — F-SEC-002: Stored HTML-injection in notification emails
- **Files:** `server/_core/email.ts`, `server/_core/googleAuth.ts`, `server/routers.ts` (Zod inputs for `contact.send`, `harassenlauf.register`)
- **Plan:** Install/import a small escape helper (reuse `escapeXml` from `sitemap.ts` or add `escape-html`). HTML-escape every interpolated user value in `sendContactFormEmail`, `sendHarassenlaufEmail`, and the new-user notification. Strip `\r\n` from values used in mail headers (`replyTo`). Add Zod `.refine(v => !/\r|\n/.test(v))` on `name`, `email`, `subject`.
- **Acceptance criteria:** Sending an email body containing `<script>` and `<img onerror>` produces escaped output; new vitest covers escape behavior.
- **Depends on:** —
- **Risk:** low

### A-P0-03 — F-SEC-003 + F-SEC-010 + F-SEC-019: Upload routes — auth, size cap, MIME sniff, decompression-bomb protection, replace hand-rolled multipart
- **Files:** `server/uploadRoutes.ts`, `server/_core/index.ts`, `package.json`
- **Plan:** Add `multer` (memoryStorage) with `limits: { fileSize: 10 * 1024 * 1024, files: 1 }`. Replace the hand-rolled `body.toString('binary')` parser entirely. Gate all four `/api/upload/*` routes behind an auth middleware that verifies the JWT cookie and enforces `editor` role minimum. Add `file-type` MIME sniff; allowlist `image/jpeg`, `image/png`, `image/webp`. Sanitize filename → derive extension from sniffed MIME only. Wrap `sharp()` calls with `{ limitInputPixels: 50_000_000, failOn: 'error' }` and a `.metadata()` width×height preflight check (reject > 50M px). Sanitize `path.join` key inputs (no `..`).
- **Acceptance criteria:** Unauthenticated upload returns 401; 11 MB upload returns 413; non-image MIME rejected with 415; existing upload tests (if any) pass; manual smoke uploads from admin still work.
- **Depends on:** —
- **Risk:** medium — touches the largest single file in `server/`. Mitigate by smoke-testing each of the four endpoints from the admin UI before merge.

### A-P0-04 — F-SEC-005: CSRF protection on cookie-authenticated mutations
- **Files:** `server/_core/index.ts`, `server/_core/trpc.ts` (or `context.ts`), `server/_core/googleAuthRoutes.ts`, `server/uploadRoutes.ts`, `client/src/lib/trpc.ts`
- **Plan:** Add an Express middleware mounted before `/api/trpc` and `/api/upload` that, for non-GET requests, requires either (a) `Origin` matching the configured app origin, or (b) the custom header `x-trpc-source: webapp`. Reject with 403 otherwise. Set the header on the tRPC link in `client/src/lib/trpc.ts`. Change `/api/auth/logout` from GET to POST and require the same origin check; update client logout caller. Set the cookie's `SameSite=strict` where compatible with OAuth callback redirect (keep `lax` only on the OAuth state cookie if present).
- **Acceptance criteria:** A curl with no `Origin`/`x-trpc-source` against a mutation returns 403; logout works from UI; OAuth flow still completes.
- **Depends on:** —
- **Risk:** low-medium — verify OAuth redirect still works after SameSite change.

### A-P0-05 — F-SEC-006 (= F-BE-003): Attendance router authorization gaps
- **Files:** `server/attendance_router.ts`, `server/permissions.ts`, `server/db.ts` (`initializeDefaultPermissions`)
- **Plan:** Add `manage_attendance` (mutations) and `view_attendance` (reads of internal data) permission keys to `permissions.ts`. Bootstrap them in `initializeDefaultPermissions()` (mapped to `editor`+ and `user`+ respectively, matching `attendance_permission.sql` intent). Replace every `protectedProcedure` mutation in `attendance_router.ts` with `requirePermission('manage_attendance')`. Reads stay on `protectedProcedure` or get `view_attendance` if data is sensitive.
- **Acceptance criteria:** A `user`-role caller hitting `deleteSession` gets `FORBIDDEN`; admin still works; vitest covers a forbidden + permitted case.
- **Depends on:** —
- **Risk:** low

### A-P0-06 — F-SEC-007: Unpublished events/photos leak to public
- **Files:** `server/routers.ts` (`events.list`, `events.getById`), `server/db.ts` (`getAllEvents`, `getEventById`)
- **Plan:** Compute `publishedOnly = !ctx.user || ctx.user.role === 'visitor'` in `events.list` and pass through. Add same filter on `getEventById` — return `NOT_FOUND` for unpublished when caller is public. Audit `photos.listByEvent` to ensure draft-event photos aren't returned to public.
- **Acceptance criteria:** Anonymous caller cannot read unpublished event by ID; admin still sees all.
- **Depends on:** —
- **Risk:** low

### A-P0-07 — F-SEC-008: Per-procedure rate limiting on sensitive tRPC paths
- **Files:** `server/_core/trpc.ts`, `server/routers.ts`, `server/_core/index.ts`
- **Plan:** Add a small in-memory token-bucket middleware keyed on `ctx.req.ip` (export a `rateLimit({ key, max, windowMs })` middleware factory). Apply to `contact.send`, `harassenlauf.register`, `auth.logout`, `users.*` mutations. Keep the Express limiter for non-tRPC routes. Add separate stricter limit for `/api/upload/*` and `/api/auth/*` Express routes.
- **Acceptance criteria:** 6th `contact.send` from same IP in 60s returns `TOO_MANY_REQUESTS`; tests pass; shotcounter polling unaffected.
- **Depends on:** —
- **Risk:** low

### A-P0-08 — F-SEC-004: OAuth `state` + PKCE
- **Files:** `server/_core/googleAuthRoutes.ts`, `server/_core/googleAuth.ts`
- **Plan:** Pass `state: true, pkce: true` (and `store: true` on the strategy) to `passport.authenticate('google', …)`. If F-SEC-018 (session removal) lands together, retain a minimal session-less state mechanism using a signed cookie — but `passport-google-oauth20` requires `express-session` for state storage. Therefore: keep `express-session` but switch to a non-MemoryStore implementation (cookie-session signed with `JWT_SECRET`, or move to `openid-client`). Pragmatic call for this branch: keep `express-session` + add `cookie-session` or a MySQL store, and set `cookie.secure` properly. If complexity balloons, fall back to `state: true` with a cookie-session, defer `openid-client` migration.
- **Acceptance criteria:** OAuth callback with mismatched/missing state returns an error; happy path login still works end-to-end in dev and prod.
- **Depends on:** A-P0-09 (coordinate session strategy)
- **Risk:** medium — Passport OAuth is fiddly; budget extra time and validate via real Google sign-in.

### A-P0-09 — F-SEC-018: Remove `MemoryStore` foot-gun
- **Files:** `server/_core/googleAuthRoutes.ts`
- **Plan:** If A-P0-08 needs sessions for `state`, replace MemoryStore with a small cookie-based store (`cookie-session` — signed with `SESSION_SECRET`, distinct from `JWT_SECRET`) so OAuth state survives without server memory. Drop `passport.session()` (we never use server sessions for auth — JWT cookie is the truth). Set `cookie.secure: NODE_ENV === 'production'`, `sameSite: 'lax'` (required for OAuth callback), `httpOnly: true`.
- **Acceptance criteria:** No "MemoryStore not for production" warning at boot; OAuth still works; `connect.sid` is no longer set unconditionally.
- **Depends on:** Coordinate with A-P0-08.
- **Risk:** medium

### A-P0-10 — F-DEP-001 + F-DEP-002 + F-DEP-009: Critical/high CVE chain (AWS SDK, tRPC, nodemailer)
- **Files:** `package.json`, `pnpm-lock.yaml`, `server/_core/email.ts` (verify v8 API parity)
- **Plan:** Bump `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to current `^3.1045.0`. Bump `@trpc/server`, `@trpc/client`, `@trpc/react-query` to `^11.17.0`. Bump `nodemailer` to `^8.0.7` and remove `@types/nodemailer` (v8 ships own types). If audit chain still flags `fast-xml-parser` via `@aws-sdk/client-sesv2`, add `pnpm.overrides: { "fast-xml-parser": ">=5.5.6" }`. Verify `email.ts` compiles with nodemailer v8 (`createTransport`/`sendMail` API unchanged).
- **Acceptance criteria:** `pnpm audit` shows zero critical advisories and at most the Express 4 transitive cluster remaining; `pnpm test` passes; `pnpm build` passes; manual email send works.
- **Depends on:** —
- **Risk:** low — all are minor/major-stable bumps within v3/v11/v8 lines.

## ACCEPT — P1 (should ship)

### A-P1-01 — F-DEP-003 + F-DEP-004 + F-DEP-005 + F-DEP-006 + F-DEP-020 + F-DEP-010: Manus/scaffolding cleanup
- **Files:** `package.json`, `vite.config.ts`, `patches/wouter@3.7.1.patch` (delete), `pnpm-lock.yaml`
- **Plan:** `pnpm remove axios streamdown add @builder.io/vite-plugin-jsx-loc vite-plugin-manus-runtime`. Delete corresponding imports/usages on lines 1, 7, 12-13 of `vite.config.ts`. Trim `server.allowedHosts` to `['localhost', '127.0.0.1']` (F-DEP-020). Delete `patches/wouter@3.7.1.patch` and `pnpm.patchedDependencies` block; bump `wouter` to `^3.9.0` (F-DEP-010). Closes F-SEC-020 (route leakage via `window.__WOUTER_ROUTES__`).
- **Acceptance criteria:** `pnpm install --frozen-lockfile` succeeds after lockfile regen; `pnpm build` succeeds; client renders routes; `window.__WOUTER_ROUTES__` is `undefined` in prod build.
- **Risk:** low

### A-P1-02 — F-DEP-007 + F-DEP-008 + F-DEP-011 + F-DEP-018: Dep hygiene
- **Files:** `package.json`
- **Plan:** Remove `@types/helmet` (deprecated stub). Move `@types/express-session`, `@types/passport`, `@types/passport-google-oauth20` to `devDependencies`. Remove the `pnpm.overrides.tailwindcss>nanoid` block (Tailwind 4 doesn't use nanoid). Change `jose` from `6.1.0` exact pin to `^6.2.3` (or add inline comment if pin intentional — no git evidence of intent).
- **Acceptance criteria:** `pnpm install` clean; `pnpm check` passes; `pnpm why nanoid` shows only top-level.
- **Risk:** low

### A-P1-03 — F-DEP-014 + F-DEP-016 + F-DEP-015 + F-DEP-017: Engines pin, CI gate, linter, tsconfig flags
- **Files:** `package.json`, `tsconfig.json`, `.github/workflows/ci.yml` (new), `biome.json` (new) or eslint config
- **Plan:**
  - Add `"engines": { "node": ">=22.11.0 <25", "pnpm": ">=10" }`. Remove the redundant `pnpm` devDep entry; keep `packageManager`.
  - Add `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build` on PR + push to main. Update `deploy.yml` to `needs: ci`.
  - Add **Biome** (`pnpm add -D @biomejs/biome`) with a `biome.json` that enables recommended rules + import sorting. Add `pnpm lint` script. Don't replace Prettier in this branch (avoid scope creep); just add lint check.
  - tsconfig: add `target: "ES2023"`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`. Skip `verbatimModuleSyntax` (would require many import-type edits — defer).
- **Acceptance criteria:** CI workflow visible on next PR; `pnpm lint` produces output; `pnpm check` passes with new flags (fix any breakage encountered — most likely `noUncheckedIndexedAccess` will surface a handful of `arr[0]` sites). If `noUncheckedIndexedAccess` causes >20 type errors, downgrade to leaving it off and file a follow-up.
- **Risk:** medium — `noUncheckedIndexedAccess` may surface latent issues. Mitigation: tackle late in the branch; revert that single flag if cost exceeds benefit.

### A-P1-04 — F-SEC-009: Enable Helmet CSP
- **Files:** `server/_core/index.ts`, possibly `client/src/components/ui/chart.tsx`
- **Plan:** Replace `contentSecurityPolicy: false` with a strict directive set: `default-src 'self'; script-src 'self'; img-src 'self' https://*.googleusercontent.com data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`. Add `Permissions-Policy` denying camera/microphone/geolocation. Verify the chart `<style dangerouslySetInnerHTML>` block works with `'unsafe-inline'` (kept for now); plan a nonce approach as follow-up.
- **Acceptance criteria:** Pages render in prod build; no CSP violation in console for normal flows.
- **Risk:** medium — CSP can break things; test all major routes manually before merge.

### A-P1-05 — F-SEC-011: Open redirect via Host/X-Forwarded-Proto
- **Files:** `server/_core/googleAuthRoutes.ts`
- **Plan:** Replace the post-OAuth redirect with a fixed `res.redirect('/')`. Remove protocol/host header juggling.
- **Acceptance criteria:** OAuth returns user to root; no header-based redirection paths remain.
- **Risk:** low

### A-P1-06 — F-SEC-012: Project safe DTOs for `auth.me` and `users.list`
- **Files:** `server/routers.ts`, possibly `server/db.ts`
- **Plan:** Add a `toPublicUser(u)` helper that strips `openId`, `loginMethod`, and any future secret columns. Apply in `auth.me` and `users.list` (for `users.list` keep `email` since admins need it; still strip `openId`).
- **Acceptance criteria:** `auth.me` response no longer includes `openId`; client still works.
- **Risk:** low — client may rely on `openId` somewhere; grep before deleting.

### A-P1-07 — F-SEC-014: Bound text inputs
- **Files:** `server/routers.ts`
- **Plan:** Audit every `z.string()` in mutations; add `.max(N)` (10_000 for descriptions/bios/notes; 500 for names/subjects; 2048 for URLs; 100 for IDs/keys). Same for `attendance_router.ts`.
- **Acceptance criteria:** Pasting a 1MB string into the contact form returns a validation error; existing tests pass.
- **Risk:** low

### A-P1-08 — F-SEC-015: Enum-validate `permissions.toggle` key
- **Files:** `server/routers.ts`, `server/permissions.ts`
- **Plan:** Export a `PERMISSION_KEYS` const tuple from `permissions.ts`; replace `permissionKey: z.string()` with `z.enum(PERMISSION_KEYS)`.
- **Risk:** low

### A-P1-09 — F-SEC-016: First-user admin promotion requires `email_verified`
- **Files:** `server/_core/googleAuth.ts`
- **Plan:** Read `profile._json.email_verified` from Google profile; require `=== true` AND exact email match before promoting to admin. If unverified, log and skip promotion.
- **Risk:** low

### A-P1-10 — F-SEC-017: `__Host-` cookie prefix
- **Files:** `server/_core/cookies.ts`, `shared/const.ts`
- **Plan:** Rename `COOKIE_NAME` to `__Host-app_session`. Verify the cookie shape (`Secure`, `Path=/`, no `Domain`) — current shape qualifies. Only enable in production (HTTPS); in dev, fall back to `app_session_id` since `__Host-` requires `Secure`.
- **Risk:** low — verify after deploy that users get logged out cleanly once on cutover (cookie name change invalidates existing sessions, which is acceptable).

### A-P1-11 — F-SEC-024: Trust `req.ip`, drop X-Forwarded-For fallback
- **Files:** `server/routers.ts` (contact.send IP capture)
- **Plan:** Use only `ctx.req?.ip ?? null`. With `trust proxy 1`, Express does the right thing.
- **Risk:** low

### A-P1-12 — F-DB-001 + F-DB-002 + F-ARCH-005: Delete dead schema and SQL files
- **Files:** `drizzle/attendance_schema.ts` (delete), `drizzle/relations.ts` (delete), `attendance_schema.sql` (delete), `attendance_permission.sql` (delete)
- **Plan:** Delete all four files. `attendance_permission.sql` data is already covered by `manage_attendance` being added to `initializeDefaultPermissions()` in A-P0-05. Verify no import sites with Grep before deletion.
- **Acceptance criteria:** `pnpm build` and `pnpm check` still pass; runtime starts; permissions are seeded on boot.
- **Risk:** low

### A-P1-13 — F-DB-003: Add FK `.references()` on `attendance_records`
- **Files:** `drizzle/schema.ts`
- **Plan:** Add `.references(() => attendanceSessions.id, { onDelete: 'cascade' })` and `.references(() => attendanceMembers.id, { onDelete: 'cascade' })` to `sessionId` and `memberId`. Purely additive — the live DB already has these FKs per the legacy `.sql`, so `pnpm db:push` should be a no-op or align the schema with reality. Test in dev DB first; if `db:push` wants to alter anything, fall back to a hand-written `ALTER TABLE` script committed to `drizzle/manual-migrations/`.
- **Acceptance criteria:** `pnpm db:push` against a fresh dev DB succeeds and produces the FK; against the live DB it is a no-op (verify with `--dry`).
- **Risk:** low

### A-P1-14 — F-DB-004: Add missing indexes on FK and hot-filter columns
- **Files:** `drizzle/schema.ts`
- **Plan:** Add explicit `index()` declarations for: `photos.eventId`, `shotcounter_audit_log.teamId`, `sdk_game_log.sessionId`, `user_activity_log.userId`, `user_activity_log.timestamp`, composite `(events.isPublished, events.eventDate)`, composite `(sponsors.isActive, sponsors.displayOrder)`, composite `(contact_submissions.isArchived, contact_submissions.submittedAt)`, composite `(goennermitglieder.isActive, goennermitglieder.membershipEndDate)`, composite `(team_members.isActive, team_members.displayOrder)`, composite `(shotcounter_teams.year, shotcounter_teams.deletedAt)`. Purely additive. If `pnpm db:push` shows surprising diffs on live DB, capture each `CREATE INDEX` statement as a manual SQL file in `drizzle/manual-migrations/` and apply by hand (per project convention).
- **Acceptance criteria:** Schema diff is index-only; no column alterations; tests pass.
- **Risk:** low — indexes are non-destructive.

## ACCEPT — P2 (ship if cheap)

### A-P2-01 — F-SEC-013: Replace raw `sql\`\`` with `inArray()` in attendance stats
- **Files:** `server/attendance_db.ts`
- **Plan:** Use Drizzle `inArray()` subquery instead of `sql\`${...} IN (SELECT ...)\``.
- **Risk:** low — semantic equivalent, defends against future regression.

### A-P2-02 — F-SEC-021: Drop HSTS `preload`
- **Files:** `server/_core/index.ts`
- **Plan:** Remove `preload: true` from helmet hsts config; keep `includeSubDomains` only if all subdomains are confirmed HTTPS.
- **Risk:** low

### A-P2-03 — F-SEC-022: Sanitize error responses (small step)
- **Files:** `server/routers.ts`, `server/permissions.ts`
- **Plan:** Don't echo permission keys in error messages (return `FORBIDDEN` without specifics). Full structured logger is out of scope (architect's cluster).
- **Risk:** low

### A-P2-04 — F-DB-005: `winnerId` → `mysqlEnum`/rename
- **Files:** `drizzle/schema.ts`, callers in `server/db.ts`
- **Plan:** SKIP for this branch — column-type change risks live data. Mark as DEFER instead; see DEFER list.
- **Decision:** DEMOTED to DEFER (see below).

### A-P2-04 — F-DB-009: `users.openId` length to 191
- **Files:** `drizzle/schema.ts`
- **Plan:** Skip — column-type widening might still trigger `pnpm db:push` to ALTER. Defer.
- **Decision:** DEMOTED to DEFER.

### A-P2-04 — F-DB-010: `users.email` UNIQUE
- **Files:** `drizzle/schema.ts`
- **Plan:** Add `.unique()` on `email`. SQL effect is `CREATE UNIQUE INDEX`. **Risk:** if live DB has duplicate emails, the index creation fails. Mitigation: run a one-off `SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1` first; only ship if zero dupes. If dupes exist, defer.
- **Acceptance criteria:** Pre-check passes; index applied via `db:push` or hand-written SQL.
- **Risk:** low-medium contingent on pre-check.

### A-P2-05 — F-DB-012: `featureToggles.createdAt`
- **Files:** `drizzle/schema.ts`
- **Plan:** Add nullable `createdAt timestamp` (so existing rows are unaffected). Purely additive.
- **Risk:** low

### A-P2-06 — F-DB-013: `harassenlauf_registrations.year`
- **Files:** `drizzle/schema.ts`, `server/routers.ts` (harassenlauf.register)
- **Plan:** Add nullable `year int` column; populate on new registrations. Skip if it bloats the PR.
- **Risk:** low

### A-P2-07 — F-DB-017: `events.thumbnailPhotoId` FK with `onDelete: 'set null'`
- **Files:** `drizzle/schema.ts`
- **Plan:** Add `.references(() => photos.id, { onDelete: 'set null' })`. Additive FK; verify live DB doesn't have orphan thumbnails first (one-off SELECT).
- **Risk:** low

### A-P2-08 — F-DB-015: Move/delete repo-root SQL files
- **Files:** Already covered in A-P1-12.
- **Decision:** Merged into A-P1-12.

### A-P2-09 — F-DEP-019 (subset): Safe minor/patch bumps
- **Files:** `package.json`
- **Plan:** Bump `drizzle-orm 0.44 → 0.45`, `drizzle-kit 0.31` minor, `superjson 1 → 2.2.6` (compatible), `lucide-react` patch only (NOT 0→1 codemod), `cross-env`, `tsx`, `esbuild 0.25 → 0.28`. Skip vite 7→8, vitest 2→3/4, recharts 2→3, react-day-picker 9→10, react-resizable-panels 3→4, typescript 5.9→6.
- **Acceptance criteria:** `pnpm test`, `pnpm check`, `pnpm build` pass.
- **Risk:** low-medium per package; back out individually if any breaks.

### A-P2-10 — F-DB-020: Drop dead `events.eventUrl` column
- **Decision:** DEFER — column drop is destructive; pre-flight migration check needed. See DEFER list.

## DEFER (real value, separate branch later)

- **F-DEP-012 Express 4 → 5** — Real migration (wildcard routes, async middleware semantics). Worth its own branch `refactor/express-5`. Mention in PR description as the natural next step that would clear most remaining audit advisories.
- **F-DEP-013 Vitest 2 → 3/4** — Bigger surface area than the patch bumps; branch `chore/vitest-3`.
- **F-DEP-019 (majors)** — TS 6, vite 8, recharts 3, lucide 1, react-day-picker 10, react-resizable-panels 4 — separate per-major branches.
- **F-DB-016 Adopt drizzle-kit migrations** — Requires baseline migration capture from live DB. Branch `chore/drizzle-migrations`. Strongly recommend doing this next.
- **F-DB-006 TEXT → VARCHAR conversions** — Column-type changes on live data; risky without migrations workflow (F-DB-016) in place first. Branch `refactor/db-column-types` after migrations land.
- **F-DB-007 / F-DB-008 / F-DB-011 / F-DB-018 / F-DB-019 / F-DB-020 / F-DB-014 / F-DB-005 / F-DB-009** — All require column-type changes, charset alterations, or data backfills that the project's manual db:push workflow makes risky. Cluster into the `refactor/db-column-types` branch following F-DB-016.

## REJECT

- **F-DEP-017 (`verbatimModuleSyntax`)** — Would require touching almost every import statement; cost > benefit for this codebase size. Skip; revisit if/when migrating to TS 6.
- **F-DB-007 soft-delete refactor (broad)** — Conceptually correct but rewrites lots of business logic; this is a product decision, not a refactor. Belongs in a feature design doc, not an audit branch.
- **F-DB-011 IP hashing** — Real compliance concern but requires legal/product input on retention policy. Not a code-mechanical fix; defer to product decision.
- **F-DB-008 collation/charset migration** — Requires whole-database ALTER; risky without a migration framework. Reject for this branch; revisit after F-DB-016.

## Sequencing & dependencies

1. **First**: A-P0-01 (env validation) — every other change can boot under the new contract.
2. **Then**: A-P0-10 + A-P1-01 + A-P1-02 (dep bumps + cleanup) — lockfile churn done once.
3. **Then**: A-P1-03 (CI/lint/tsconfig) — fail fast on subsequent changes.
4. **Then in any order**:
   - Security cluster: A-P0-02, A-P0-03, A-P0-04, A-P0-05, A-P0-06, A-P0-07, A-P0-08+A-P0-09 (paired), A-P1-04…A-P1-11
   - DB cluster (additive only): A-P1-12, A-P1-13, A-P1-14, A-P2-05, A-P2-06, A-P2-07
   - A-P2-04 (`users.email` UNIQUE) only after the dupe pre-check.
5. **Last**: A-P2-09 (safe minor/patch bumps) and A-P2 polish; run full `pnpm check && pnpm test && pnpm build` + smoke test.
6. A-P0-08 (OAuth state/PKCE) MUST land together with A-P0-09 (session strategy) — they share infrastructure.
7. A-P0-05 (attendance permission) requires `manage_attendance` to be seeded in `initializeDefaultPermissions()` BEFORE A-P1-12 deletes the legacy SQL files.

## Open questions for the user

1. **Express 4 → 5 (F-DEP-012)** — Confirm DEFER. This would clear the remaining Express-transitive CVEs (`path-to-regexp` ReDoS, `qs` DoS, `cookie`). Recommended next branch immediately after this one. Go/no-go?
2. **Drizzle migrations (F-DB-016)** — Confirm we adopt `drizzle-kit generate` in the next branch and stop `db:push` in prod. This unblocks all the deferred DB-column refactors.
3. **OAuth state storage (A-P0-08 detail)** — `passport-google-oauth20` needs *some* session-like store for the `state` parameter. Acceptable options: (a) `cookie-session` (signed cookie, simple, recommended); (b) MySQL-backed `express-session`; (c) full migration to `openid-client`. Default plan: (a). Confirm or override.
4. **`users.email` UNIQUE constraint (A-P2-04 / F-DB-010)** — Only safe to ship if live DB has zero duplicate emails. Should the implementer run the dupe pre-check and (if dupes exist) defer this finding?
5. **CSP strictness (A-P1-04)** — The chart component uses `dangerouslySetInnerHTML` for `<style>`. Are you OK keeping `'unsafe-inline'` in `style-src` for this branch, with a follow-up to add nonces? Default plan: yes.
6. **Biome vs Prettier (A-P1-03)** — Default plan: add Biome for lint only, keep Prettier for format (no migration). OK, or do you want Biome to take over formatting too?
