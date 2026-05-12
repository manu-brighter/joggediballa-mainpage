# Architecture & Cross-Cutting Audit Report

**Date:** 2026-05-12
**Auditor:** Software Architect (subagent)
**Branch:** refactor/full-audit-2026-05

## Executive Summary

- **No CI gate exists.** `.github/workflows/deploy.yml` only SSH-triggers a server-side deploy on every `main` push. There is no `pnpm check`, `pnpm test`, or `pnpm build` job. Broken type-checks ship to prod. (F-ARCH-001)
- **Single `tsconfig.json` covers client, server, and shared.** The client gets Node types and `@types/express`; the server gets `dom`/`dom.iterable` and `vite/client`. `noEmit: true` everywhere — fine for dev but means there is no project-references graph for incremental builds. Already on the user's own backlog (todo-personal.md). (F-ARCH-002)
- **`_core/` convention is inconsistent and the boundary leaks.** `server/_core/` holds infra (Express, tRPC, auth, env, vite middleware) — appropriate. `client/src/_core/` only holds `googleAnalytics.ts` and `hooks/{useAuth,useCookieConsent}.ts` — too small to be its own concept and overlaps with `client/src/hooks/`. `shared/_core/errors.ts` is a one-file folder with HttpError, used nowhere by the server tRPC layer. (F-ARCH-003, F-ARCH-009)
- **Two-router split (`routers.ts` 1025 LOC vs `attendance_router.ts` 242 LOC) is purely stylistic.** `attendanceRouter` is already mounted as a sub-router; the naming, file location, and accompanying `attendance_db.ts` parallel `db.ts` look like a half-finished modularization attempt. The rest of the system stays monolithic in one router/db file. (F-ARCH-004)
- **Two SQL files at the repo root (`attendance_schema.sql`, `attendance_permission.sql`) are tracked but live outside `drizzle/`.** They are duplicated by `drizzle/attendance_schema.ts` and the permission INSERT is re-issued by the schema file itself. Manual deploy artifacts that should not be in git. (F-ARCH-005)
- **Documentation drift and root-level clutter.** `DEPLOYMENT.md` instructs `pm2 start dist/index.js --name joggediballa` while `ecosystem.config.cjs` (the actual prod entry per its own comments) is never referenced. `SELF_HOSTED_UPLOAD.md` exists at root AND in `docs/` (duplicate). `todo-personal.md` is tracked. `joggediballa-story.mdx` is tracked but never imported by client or server. (F-ARCH-006)
- **`.idea/` is committed despite being in `.gitignore`** (the entry was added later than the commit). `attached_assets` alias in `vite.config.ts`/`vitest.config.ts` points to a directory that does not exist. (F-ARCH-007, F-ARCH-013)
- **No observability, no structured logger, no Sentry/OTel.** 42 `console.*` calls across the server, no log levels, no error aggregation. For a self-hosted prod app behind nginx+PM2 this is the highest medium-severity gap. (F-ARCH-008)

## Findings

### F-ARCH-001: CI workflow only deploys, never validates

- **Severity:** high
- **Effort:** small
- **Location:** `.github/workflows/deploy.yml`
- **Issue:** The single workflow is a 30-line SSH trigger. There is no job that runs `pnpm check`, `pnpm test`, `pnpm build`, or `prettier --check`. Every push to `main` deploys whatever is at HEAD — even if it does not compile. The deploy step is `ssh deploy@45.81.235.147` with no command, relying entirely on a server-side trigger script with zero visibility from GitHub. Concurrency is set, but `cancel-in-progress: false` means stacked deploys queue up.
- **Recommendation:** Add a `validate` job (matrix or single) running `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build` on every push and PR. Make `deploy` depend on `validate` succeeding. Consider also `prettier --check`. For deploy, log the command being executed remotely (`ssh ... 'bash -lc "/path/to/deploy.sh"'`) so the action log is meaningful.
- **Rationale:** A type error in `routers.ts` shipped to prod is currently caught only by the dev's local IDE. CI gates are the standard 2026 baseline; for a one-developer project they are doubly important because there is no peer review.

### F-ARCH-002: Single tsconfig.json shared by client and server

- **Severity:** medium
- **Effort:** medium
- **Location:** `tsconfig.json`
- **Issue:** One `tsconfig.json` includes `client/src/**/*`, `server/**/*`, and `shared/**/*`. `lib` is `["esnext", "dom", "dom.iterable"]` — server files get DOM types. `types: ["node", "vite/client"]` — client files get Node globals. There is no project-references graph; `pnpm check` runs as one pass with `noEmit: true`. The `@/` alias points to `client/src/*`, which is meaningless from server code, yet TypeScript allows server code to import from `@/...` and resolve client modules.
- **Recommendation:** Split into `tsconfig.base.json` + `tsconfig.client.json` (lib: dom, jsx: preserve, types: vite/client) + `tsconfig.server.json` (lib: esnext, types: node) + optional `tsconfig.shared.json`, glued by project references. The user's own todo-personal.md already lists this as a deferred improvement.
- **Rationale:** Prevents accidental cross-layer imports (server importing React, client importing express). Project references also speed up `tsc` and enable `composite` for incremental builds. Low risk; the type system is already strict so the bulk of refactor is configuration.

### F-ARCH-003: `_core/` convention applied inconsistently

- **Severity:** medium
- **Effort:** medium
- **Location:** `server/_core/`, `client/src/_core/`, `shared/_core/`
- **Issue:**
  - `server/_core/` (10 files): Express bootstrap, tRPC base, auth, cookies, context, env, vite middleware, sdk, systemRouter, email. Cohesive — this is "framework plumbing". OK.
  - `client/src/_core/` (3 files): `googleAnalytics.ts`, `hooks/useAuth.ts`, `hooks/useCookieConsent.ts`. The naming implies "framework plumbing for the React app" but `client/src/hooks/` *also* exists with feature hooks (e.g. `usePermissions`). The boundary is unclear: why is `useAuth` core but `usePermissions` not? Why is `googleAnalytics` core but `useSEO` not?
  - `shared/_core/` (1 file): `errors.ts` (HttpError + helpers). A one-file `_core` folder is overkill, and the helpers are never used by the tRPC layer (which throws `TRPCError` instead).
- **Recommendation:**
  - Keep `server/_core/` as is — the boundary works.
  - Either move `client/src/_core/hooks/*` into `client/src/hooks/` and `googleAnalytics.ts` into `client/src/lib/`, OR codify a rule (e.g. "anything that touches auth/identity/analytics is core") and move `useSEO`, `usePermissions` into `_core/` consistently. I recommend the first — drop the client `_core/` entirely.
  - Flatten `shared/_core/errors.ts` to `shared/errors.ts`. One file does not need a folder, and the HttpError helpers should either be adopted by `uploadRoutes.ts`/`sitemap.ts` or deleted.
- **Rationale:** Convention should be predictable. A one-developer project earns its consistency budget back fast; an inconsistent `_core/` rule confuses every future module decision.

### F-ARCH-004: Two-router split is half-finished modularization

- **Severity:** medium
- **Effort:** medium
- **Location:** `server/routers.ts` (1025 LOC), `server/attendance_router.ts` (242 LOC), `server/db.ts` (1172 LOC), `server/attendance_db.ts`
- **Issue:** `attendanceRouter` is imported and mounted as a sub-router in `routers.ts` — architecturally fine. But it is the only feature that gets this treatment. `routers.ts` is 1025 lines and contains 13+ namespaces (auth, shotcounter, sponsors, events, photos, team, features, harassenlauf, contact, goennermitglieder, users, permissions, etc.). `db.ts` parallel-grows at 1172 lines. The naming `attendance_router.ts` uses snake_case while everything else is camelCase. The split feels like "I extracted this one feature and stopped".
- **Recommendation:** Either:
  - **(A) Full modularization** — split `routers.ts` into per-feature router files (`server/routers/events.ts`, `server/routers/shotcounter.ts`, etc.) merged in `server/routers.ts`, mirrored by `server/db/*.ts`. Rename `attendance_router.ts` → `routers/attendance.ts` for consistency.
  - **(B) Revert** — inline `attendanceRouter` back into `routers.ts` and keep the monolith until splitting is worth it.
  Pick A; the file size already warrants it and 13 namespaces in one file is the real maintenance pain.
- **Rationale:** Either-or. Right now the codebase signals "we modularize features" while only one feature is modularized — a confusing pattern signal for future contributors (and for the LLM writing code from it).

### F-ARCH-005: Stray SQL files at repo root

- **Severity:** medium
- **Effort:** small
- **Location:** `/attendance_schema.sql`, `/attendance_permission.sql`
- **Issue:** Both files are tracked in git, sit at repo root, and duplicate content that exists in `drizzle/schema.ts` + `drizzle/attendance_schema.ts`. `attendance_schema.sql` even contains the same `INSERT INTO role_permissions ...` block as `attendance_permission.sql`. They appear to be a one-off manual deploy artifact ("the schema we ran by hand on prod because db:push was risky" — confirmed by `server/CLAUDE.md`: *"Manual DB changes: Schema changes are often applied directly to MySQL rather than via pnpm db:push"*).
- **Recommendation:** Delete both. If manual SQL is the actual deploy strategy, formalize it: move to `drizzle/manual-migrations/YYYY-MM-DD-description.sql` and document the convention in `drizzle/CLAUDE.md`. Otherwise, commit to `drizzle-kit` migrations (not push) for any non-trivial change.
- **Rationale:** Two duplicated SQL files at the root is the kind of artifact that quietly accumulates. Either delete or formalize — pick one.

### F-ARCH-006: Documentation drift between DEPLOYMENT.md and ecosystem.config.cjs

- **Severity:** medium
- **Effort:** small
- **Location:** `DEPLOYMENT.md` §3.7, `ecosystem.config.cjs`, `docs/SELF_HOSTED_UPLOAD.md` + `SELF_HOSTED_UPLOAD.md`
- **Issue:**
  - `DEPLOYMENT.md` step 3.7 says `pm2 start dist/index.js --name joggediballa && pm2 save && pm2 startup`. `ecosystem.config.cjs` is the actual canonical PM2 config — but is never referenced in `DEPLOYMENT.md`. The comment block inside `ecosystem.config.cjs` is the only place its existence is documented.
  - `SELF_HOSTED_UPLOAD.md` exists at the repo root AND in `docs/SELF_HOSTED_UPLOAD.md`. `docs/` also has `DATABASE_MIGRATION.md`, `SELF_HOSTED_EMAIL.md`, and several `analysis-*.md`/`verify-*.md` files — these read like LLM-generated audit notes, not living documentation.
  - `DEPLOYMENT.md` documents `cwd: /var/www/joggediballa` but `ecosystem.config.cjs` declares `cwd: /var/www/joggediballa-mainpage`. The prod path is inconsistent across docs.
  - `DEPLOYMENT.md` predates the `helmet`, `express-rate-limit`, and `trust proxy 1` additions to `server/_core/index.ts` — it never explains them.
- **Recommendation:**
  - Update `DEPLOYMENT.md` step 3.7 to: `pm2 start ecosystem.config.cjs && pm2 save && pm2 startup`.
  - Reconcile `cwd` mismatch.
  - Delete the duplicate `SELF_HOSTED_UPLOAD.md` at root; keep the `docs/` copy. Same for any other duplicates.
  - Triage `docs/analysis-*.md` and `docs/verify-*.md` — if they are one-off audit artifacts, archive them or delete; if they are living docs, name them like docs.
- **Rationale:** Docs that disagree with reality erode trust. The cheapest cleanup wins.

### F-ARCH-007: `.idea/` directory is committed despite being in `.gitignore`

- **Severity:** medium
- **Effort:** small
- **Location:** `.gitignore` line 19, repo root `.idea/`
- **Issue:** `.gitignore` excludes `.idea/`, but the directory was committed before the entry existed. `git rm -r --cached .idea/` was never run. The folder still ships to every clone of the repo.
- **Recommendation:** `git rm -r --cached .idea/` and commit. Verify `.gitignore` is now effective.
- **Rationale:** Standard Git hygiene. IDE files leaking into the repo are noise and occasionally leak local paths/secrets.

### F-ARCH-008: No observability, no structured logger

- **Severity:** medium
- **Effort:** medium
- **Location:** entire `server/`
- **Issue:** Grep finds 42 `console.log`/`console.warn`/`console.error` calls in the server. No Sentry, no OpenTelemetry, no `pino`/`winston`. PM2 stdout/stderr is the entire error surface. `helmet` is configured but there's no error reporting if a CSP violation lands. The contact form, auth flow, S3 upload errors — all stack-trace to `pm2 logs` only.
- **Recommendation:**
  - Add a structured logger (`pino` is the simplest — single file, very fast, JSON output PM2 picks up cleanly). Replace `console.*` in the server.
  - Add Sentry (`@sentry/node` for server, `@sentry/react` for client). The user already mentions in their personal notes that Sentry access exists at $employer — they're familiar with it. Free tier covers a hobby-scale site.
  - Alternative: skip Sentry, use `pino` only, and ship logs to a log host (Better Stack, Axiom) via a transport.
- **Rationale:** This is the single biggest 2026-readiness gap. Self-hosted hobby projects without crash reporting silently break for users with no signal to the maintainer.

### F-ARCH-009: `shared/` is thin and `@shared` boundary is fuzzy

- **Severity:** low
- **Effort:** small
- **Location:** `shared/types.ts`, `shared/const.ts`, `shared/_core/errors.ts`
- **Issue:** `shared/types.ts` is 13 lines and just re-exports drizzle schema types + one interface. `shared/const.ts` is 5 lines. `shared/_core/errors.ts` is the HttpError class — used nowhere on the server. The `@shared/` alias is wired in `tsconfig.json`, `vite.config.ts`, AND `vitest.config.ts` — three places to keep in sync. Almost no payoff for the indirection.
- **Recommendation:**
  - Move `shared/_core/errors.ts` → `shared/errors.ts` (drop the one-file folder).
  - Either start using `HttpError` in `uploadRoutes.ts`/`sitemap.ts` for non-tRPC routes, or delete it. Currently dead code.
  - Keep `shared/` itself — it's the right pattern even if small. Just make sure types/const that get added to shared are actually consumed by both client and server.
- **Rationale:** Micro-housekeeping. The `_core/` inside `shared/` is the part to drop.

### F-ARCH-010: Auth procedure styles coexist; legacy ones still in active use

- **Severity:** low
- **Effort:** medium
- **Location:** `server/routers.ts` lines 27-78, all router definitions
- **Issue:** Three styles coexist:
  - **adminProcedure** (hardcoded role check) — used ~20 times for users.*, shotcounter sessions, features.*, audit logs. Defended in `server/CLAUDE.md` as "only for admin-infrastructure, not content".
  - **maintainerProcedure / editorProcedure** — defined at lines 41 and 51 but Grep finds **zero call sites** in `routers.ts`. The legacy procedures are defined but unused. The CLAUDE.md notes "Legacy — do not add new uses" but they aren't even used anywhere currently. Pure dead code.
  - **requirePermission("key")** — used ~17 times for content management (events, sponsors, photos, team, shotcounter edit/reset, goennermitglieder, attendance via the sub-router using `protectedProcedure` directly).
  Inconsistency: attendanceRouter uses raw `protectedProcedure` even though `manage_attendance` is a defined permission key (per `attendance_permission.sql`). So a logged-in `editor` who shouldn't manage attendance can probably hit those endpoints.
- **Recommendation:**
  - Delete `maintainerProcedure` and `editorProcedure` from `routers.ts` — they are unused.
  - Migrate `attendance_router.ts` to use `requirePermission('manage_attendance')` instead of bare `protectedProcedure`.
  - Keep `adminProcedure` for infrastructure (user role changes, feature flags, audit) — the rationale in CLAUDE.md is sound.
  - Document the rule in `server/CLAUDE.md`: "Content management → `requirePermission()`. Admin infrastructure → `adminProcedure`. No other styles."
- **Rationale:** The migration is mostly done. Finishing it removes 20 lines and one mental model. Attendance is a real authorization gap worth fixing.

### F-ARCH-011: No client tests and no E2E tests

- **Severity:** low
- **Effort:** large
- **Location:** test layout
- **Issue:** Vitest is configured for `server/**/*.test.ts` only. The client has zero tests. There is no Playwright/Cypress E2E. For a single-developer project this is a pragmatic choice, but the application has Twitch-overlay shotcounter, beamer mode, OAuth flow, file uploads — all integration-heavy paths that server-unit tests cannot cover. The 5 existing server tests are valuable but document a thin slice.
- **Recommendation:** Add Playwright with a minimal smoke suite (3-5 tests): login flow (mocked Google), public events page renders, admin can create an event, shotcounter increment works, contact form submit. Run in CI as the validate step's last gate.
- **Rationale:** "2026 stance" question — yes, Playwright on a hobby project is justified, but only for *critical paths*. Don't aim for coverage; aim for "the site is not broken end-to-end". The user has 5 years of Cypress experience at $employer — Playwright transfers easily.

### F-ARCH-012: `attached_assets` alias points to a missing directory

- **Severity:** low
- **Effort:** small
- **Location:** `vite.config.ts:22`, `vitest.config.ts:11`
- **Issue:** Both Vite and Vitest configure `@assets` → `attached_assets/`. That directory does not exist. Likely a leftover from the Manus.im scaffold.
- **Recommendation:** Remove the alias from both config files unless `attached_assets/` is intentionally created at deploy time.
- **Rationale:** Dead config; mildly confusing.

### F-ARCH-013: `vite-plugin-manus-runtime` and `@builder.io/vite-plugin-jsx-loc` in prod build

- **Severity:** low
- **Effort:** small
- **Location:** `vite.config.ts:7,13`
- **Issue:** `vitePluginManusRuntime()` (Manus platform integration, now unused per the comment in `server/_core/index.ts` line 82) and `jsxLocPlugin()` (Builder.io visual editor) both run in every build, including prod. They add weight or hooks the app no longer relies on.
- **Recommendation:** Audit and remove if confirmed unused. Run `pnpm build` before/after to verify bundle-size impact. Move to dev-only (`if (mode === 'development') plugins.push(...)`) if any have a dev-time value but no prod role.
- **Rationale:** Cleanup of the same Manus-removal cleanup pass that already touched `server/_core/index.ts`.

### F-ARCH-014: No pnpm workspace despite shared/server/client structure

- **Severity:** low
- **Effort:** large
- **Location:** root `package.json`
- **Issue:** A single `package.json` lists everything from React to express, helmet, sharp, drizzle, AWS SDK. No workspace structure. Question: is `pnpm workspaces` with `client/`, `server/`, `shared/` packages worth it?
- **Recommendation:** **Don't migrate.** At this size (~5k LOC, one developer, one deploy target) workspaces add ceremony (per-package tsconfig, per-package package.json, dependency hoisting weirdness) without payoff. The current structure works. Revisit only if a second app shares `shared/`.
- **Rationale:** YAGNI. Workspaces shine when you have multiple deployables or when dep graph hygiene matters across teams.

### F-ARCH-015: `process.env.*` access scattered across modules; partial centralization in `_core/env.ts`

- **Severity:** low
- **Effort:** medium
- **Location:** `server/db.ts:38,40`, `server/storage.ts:15,17`, `server/_core/googleAuth.ts:19-24,111,125`, `server/_core/googleAuthRoutes.ts:9-10,28`, `server/_core/index.ts:99,105`, `server/_core/vite.ts:52`
- **Issue:** `server/_core/env.ts` exposes a typed `ENV` object — but only for SMTP + DB + JWT secret. The Google OAuth env vars, `UPLOAD_DIR`, `PUBLIC_UPLOAD_URL`, `NODE_ENV` checks, `PORT` are still read directly from `process.env` everywhere else. The `ENV` abstraction is started but not finished.
- **Recommendation:** Centralize ALL env reads in `server/_core/env.ts`, with Zod validation at startup that fails fast on missing required vars. Document required vs optional. Cross-check against `.env.example`.
- **Rationale:** Currently a missing env var fails at request time with a confusing error or silently uses an empty string (`?? ''`). Fail-fast at startup is the modern pattern.

### F-ARCH-016: `scripts/` is one-off migration scripts mixed with a real data file

- **Severity:** low
- **Effort:** small
- **Location:** `scripts/`
- **Issue:** Three files: `generate-thumbnails.ts` (one-off thumbnail backfill, marked as such in its docstring), `import_attendance_excel.ts` (one-off Excel import), `Anwesenheit.xlsx` (the personal data file fed to the script). Both scripts are one-shot migrations whose work is presumably already done.
- **Recommendation:**
  - Move completed one-off scripts to `scripts/archive/` or delete after confirming they have been run.
  - **Don't commit `Anwesenheit.xlsx`** — it likely contains member names (personal data). Add `scripts/*.xlsx` to `.gitignore` and `git rm --cached scripts/Anwesenheit.xlsx`.
  - For future one-offs, document a convention: "one-off scripts live in `scripts/`, archive after running by adding a `.done` marker or moving to `scripts/archive/`".
- **Rationale:** Personal data in git is a real concern (revDSG / Swiss DPA). Even if names are public-ish (team roster), keep them out of public repos.

### F-ARCH-017: `patches/wouter@3.7.1.patch` is justified but undocumented

- **Severity:** low
- **Effort:** small
- **Location:** `patches/wouter@3.7.1.patch`
- **Issue:** The patch adds a `window.__WOUTER_ROUTES__` global, populating an array of all route paths registered with `<Switch>`. This is presumably consumed by something (sitemap generation? Builder.io? a custom dev tool?). Grep finds zero usages of `__WOUTER_ROUTES__` in the codebase, so it appears to be consumed by an external tool or no longer used.
- **Recommendation:**
  - Grep the prod bundle and dev-time tooling for `__WOUTER_ROUTES__`. If unused, **remove the patch entirely** — the `pnpm.patchedDependencies` block in `package.json` and the patch file itself.
  - If used, add a `patches/README.md` documenting *why each patch exists* and *when it can be removed* (e.g. "wouter@3.7.1 patch: exposes route list for X; can be removed when X is dropped or when wouter ships native support in vX.Y").
- **Rationale:** Patches are a maintenance tax — every wouter upgrade requires patch rebase. Their justification needs to be obvious.

## Env var matrix

| Env var                          | Used in (files)                                                                                                            | Documented in .env.example | Required |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------- |
| `DATABASE_URL`                   | `server/db.ts`, `server/_core/env.ts`, `drizzle.config.ts`                                                                 | Y                          | Y        |
| `JWT_SECRET`                     | `server/_core/env.ts`, `server/_core/googleAuthRoutes.ts`                                                                  | Y                          | Y        |
| `SESSION_SECRET`                 | `server/_core/googleAuthRoutes.ts`                                                                                         | Y                          | N (falls back to `JWT_SECRET`) |
| `GOOGLE_CLIENT_ID`               | `server/_core/googleAuth.ts`                                                                                               | Y                          | Y        |
| `GOOGLE_CLIENT_SECRET`           | `server/_core/googleAuth.ts`                                                                                               | Y                          | Y        |
| `GOOGLE_CALLBACK_URL`            | `server/_core/googleAuth.ts` (also referenced for admin email link)                                                        | Y                          | Y        |
| `ADMIN_EMAIL`                    | `server/_core/googleAuth.ts`                                                                                               | Y                          | Y (auto-promote first admin) |
| `NODE_ENV`                       | `server/_core/env.ts`, `server/_core/index.ts`, `server/_core/googleAuthRoutes.ts`, `server/_core/vite.ts`                 | Y                          | Y        |
| `PORT`                           | `server/_core/index.ts`                                                                                                    | Y                          | N (default 3000) |
| `SMTP_HOST`                      | `server/_core/env.ts`                                                                                                      | **N**                      | Y for contact form |
| `SMTP_PORT`                      | `server/_core/env.ts`                                                                                                      | **N**                      | N (default 587) |
| `SMTP_SECURE`                    | `server/_core/env.ts`                                                                                                      | **N**                      | N        |
| `SMTP_USER`                      | `server/_core/env.ts`                                                                                                      | **N**                      | Y for contact form |
| `SMTP_PASS`                      | `server/_core/env.ts`                                                                                                      | **N**                      | Y for contact form |
| `CONTACT_EMAIL_TO`               | `server/_core/env.ts`, `server/_core/googleAuth.ts` (with hardcoded fallback `joggediballa@gmail.com`)                     | **N**                      | Y for contact form |
| `CONTACT_EMAIL_FROM`             | `server/_core/env.ts`                                                                                                      | **N**                      | Y for contact form |
| `UPLOAD_DIR`                     | `server/storage.ts`                                                                                                        | **N**                      | N (default `/var/www/joggediballa-mainpage/uploads`) |
| `PUBLIC_UPLOAD_URL`              | `server/storage.ts`                                                                                                        | **N**                      | N (default `https://joggediballa.ch/uploads`) |
| `BASE_URL`                       | (only documented; no runtime usage found — `server/sitemap.ts` hardcodes `https://joggediballa.ch`)                        | Y                          | N (orphan) |
| `VITE_APP_TITLE`                 | (none found in client code — likely consumed by `index.html` or removed)                                                   | Y                          | N (orphan?) |
| `VITE_APP_LOGO`                  | (none found in client code)                                                                                                | Y                          | N (orphan?) |
| `VITE_FRONTEND_FORGE_API_KEY`    | `client/src/components/Map.tsx`                                                                                            | Y (commented "optional / Manus only") | N (used for Maps proxy) |
| `VITE_FRONTEND_FORGE_API_URL`    | `client/src/components/Map.tsx`                                                                                            | Y (commented "optional / Manus only") | N        |
| `VITE_APP_ID`                    | (none found — Manus relic)                                                                                                 | Y (commented out)          | N (orphan) |
| `OAUTH_SERVER_URL`               | (none — confirmed dead by comment in `server/_core/index.ts:82`)                                                           | Y (commented out)          | N (orphan) |
| `VITE_OAUTH_PORTAL_URL`          | mentioned in `client/src/const.ts:5` comment only                                                                          | Y (commented out)          | N (orphan) |
| `OWNER_OPEN_ID`                  | (none — confirmed dead by comment in `server/db.ts:96`)                                                                    | Y (commented out)          | N (orphan) |
| `OWNER_NAME`                     | (none)                                                                                                                     | Y (commented out)          | N (orphan) |
| `BUILT_IN_FORGE_API_URL`         | referenced in `server/storage.ts:3` comment only                                                                           | Y (commented out)          | N (orphan) |
| `BUILT_IN_FORGE_API_KEY`         | (none — referenced in storage.ts comment)                                                                                  | Y (commented out)          | N (orphan) |
| `VITE_ANALYTICS_ENDPOINT`        | (none)                                                                                                                     | Y (commented out)          | N (orphan) |
| `VITE_ANALYTICS_WEBSITE_ID`      | (none)                                                                                                                     | Y (commented out)          | N (orphan) |

**Critical gaps:** all SMTP vars, `CONTACT_EMAIL_TO`, `CONTACT_EMAIL_FROM`, `UPLOAD_DIR`, `PUBLIC_UPLOAD_URL` are used by the app but **not in `.env.example`**. A fresh self-hosted deploy following the README will silently have a broken contact form and use default upload paths.

**Orphans:** `BASE_URL`, `VITE_APP_TITLE`, `VITE_APP_LOGO` are advertised but not consumed (or consumed only by removed code paths). The whole "MANUS OAUTH CONFIGURATION" + "BUILT-IN API CONFIGURATION" + "ANALYTICS" blocks in `.env.example` should be deleted — they belong to a previous platform.

## Cross-Domain Notes

- **Build outputs (`dist/`):** correctly `.gitignored`, but the directory exists locally with both `dist/index.js` (server bundle, esbuild) and `dist/public/` (client bundle, vite). The server `serveStatic` reads from `dist/public/` — consistent with `vite.config.ts`'s `outDir`. No issues.
- **`trust proxy 1`:** correctly set in `server/_core/index.ts:39`. The single-hop value (`1`) matches the nginx-only reverse proxy described in `DEPLOYMENT.md` §4.2. Cloudflare → nginx → node would technically be two hops; if Cloudflare is in front (and the helmet HSTS comment says "behind Cloudflare"), this should be `2`. Possible bug — flag for security audit.
- **`pnpm-lock.yaml` IS committed**, which is correct, but `.prettierignore` excludes it from formatting — also correct.
- **`pnpm` itself is in `devDependencies`** (`"pnpm": "^10.15.1"`). This is unusual — pnpm is the package manager, not a dep. Remove unless there is a specific Vercel/CI reason.
- **`add: ^2.0.6`** in devDependencies is the npm package `add` (a noop) — almost certainly a typo from someone running `pnpm add add ...`. Remove.
- **No CODEOWNERS, no Dependabot/Renovate config** — for a one-developer hobby project this is fine, but Renovate's auto-PRs would catch the same dep drift that the dep-audit subagent is finding manually.

## Methodology

1. Listed repo structure (root, `shared/`, `scripts/`, `.github/workflows/`, `patches/`, `dist/`, `server/_core/`, `client/src/_core/`, `drizzle/`).
2. Read every top-level config file: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `ecosystem.config.cjs`, `components.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, `package.json`, `.env.example`, `.github/workflows/deploy.yml`.
3. Read `shared/types.ts`, `shared/const.ts`, `shared/_core/errors.ts` to confirm shared-code surface.
4. Read top-level docs (`DEPLOYMENT.md`, root `CLAUDE.md`, client/server `CLAUDE.md` via system-reminder).
5. Grep'd `process.env\.` across `server/` and `import.meta.env\.` across `client/`; cross-referenced each hit against `.env.example`.
6. Counted procedure styles in `routers.ts` with regex; confirmed `maintainerProcedure`/`editorProcedure` are defined but unused (zero call sites in file body).
7. Grep'd for observability (`sentry`, `pino`, `winston`, `otel`) — none.
8. Grep'd `joggediballa-story` and `__WOUTER_ROUTES__` to confirm consumption — none.
9. `git ls-files` to verify which root-level loose files are actually tracked (`.idea/`, story.mdx, todo-personal.md, SQL files).
10. Checked routers / db.ts line counts to gauge "monolith vs split" tension.

Did not run code. No files were modified by this audit.
