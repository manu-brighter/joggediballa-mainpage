# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # tsx watch on server/_core/index.ts — single Express process on :3000
                  # with Vite in middleware mode (no separate Vite dev server)
pnpm build        # Build client (Vite) + server (esbuild) for production
pnpm start        # Run production build (NODE_ENV=production node dist/index.js)
pnpm check        # TypeScript type checking (tsc --noEmit)
pnpm lint         # Biome lint (pnpm lint:fix to autofix)
pnpm format       # Prettier formatting
pnpm test         # Vitest (server/**/*.test.ts and server/**/*.spec.ts only)
pnpm test:e2e     # Playwright (smoke + visual); see Testing below
pnpm db:push      # Push Drizzle schema changes to MySQL
```

Run a single test file: `pnpm test server/path/to/file.test.ts`

**Linting vs. formatting:** Biome is the linter only — its formatter is explicitly
disabled in `biome.json`. All formatting goes through Prettier (`.prettierrc`).
Do not enable Biome's formatter.

## Architecture

Full-stack TypeScript monorepo: React frontend + Express backend with end-to-end type safety via tRPC.

**Key directories:**

- `client/src/` — React 19 app (Vite, Wouter routing, Tailwind 4)
- `server/` — Express + tRPC backend
- `server/_core/` — Framework plumbing: Express setup, tRPC context, auth routes
- `drizzle/` — Drizzle ORM schema (`schema.ts`). No migrations directory; schema
  changes are pushed with `pnpm db:push` or applied manually (see `drizzle/CLAUDE.md`)
- `tests/e2e/` — Playwright smoke + visual regression specs

### API Layer (tRPC)

All client–server communication goes through tRPC v11. The main router is defined in `server/routers.ts`. On the client, use `trpc.<namespace>.<procedure>.useQuery()` / `.useMutation()` from `client/src/lib/trpc.ts`. SuperJSON is used as the transformer.

### Authentication & Authorization

- **Auth:** Google OAuth 2.0 (primary) via Passport, with JWT stored in HTTP-only cookies. Routes in `server/_core/googleAuthRoutes.ts`.
- **Roles:** `admin > maintainer > editor > user > visitor`
- **Procedures:**
  - `requirePermission('<key>')` — **preferred**; dynamic permissions from DB, so admins can flip access at runtime
  - `adminProcedure` — hardcoded admin check, reserved for admin infrastructure (`users.*`, `features.*`, `activityLog.*`, `permissions.*`, `sdk.*`). Defined locally in `routers.ts`
  - The former `maintainerProcedure` / `editorProcedure` helpers were removed — do not reintroduce them. See `server/CLAUDE.md`.
- First user matching `ADMIN_EMAIL` env var is auto-promoted to admin.

### Database

MySQL 8 via Drizzle ORM. Schema is the single source of truth in `drizzle/schema.ts` (21 tables: Users, ShotcounterTeams, Events, Sponsors, ContactSubmissions, Attendance*, Slideshow*, Sdk\*, etc.). Run `pnpm db:push` after schema changes.

### File Storage

**Self-hosted on local disk — not S3.** `server/storage.ts` writes uploads under
`UPLOAD_DIR` (default `/var/www/joggediballa-mainpage/uploads`); nginx serves them
at `PUBLIC_UPLOAD_URL/<key>`. Upload endpoints are Express routes (not tRPC) in
`server/uploadRoutes.ts`, using multer memory storage + `sharp` for validation and
processing. The client posts the file directly — there are no pre-signed URLs.

### Frontend Patterns

- **Routing:** Wouter (not React Router). Routes defined in `client/src/App.tsx`, which also holds the Beamer mode context for the shotcounter.
- **State:** React Query v5 (via tRPC hooks) for server state; React contexts for UI state (theme, auth).
- **UI components:** Radix UI primitives wrapped in `client/src/components/ui/` using CVA for variants.
- **Forms:** React Hook Form + Zod.

### Testing

**Vitest** covers the server only (`server/**/*.test.ts`). Tests use `appRouter.createCaller(context)` to call tRPC procedures directly—no HTTP layer involved. There are no component-level frontend tests.

**Playwright** (`playwright.config.ts`, specs in `tests/e2e/`) covers the frontend end-to-end with two projects:

- `smoke` (`tests/e2e/smoke/`) — black-box page loads, routing, security headers. Runs against `SMOKE_URL` (default `http://localhost:3000`); `pnpm test:e2e:smoke:live` points it at production.
- `visual` (`tests/e2e/visual/`) — full-page screenshot regression against committed baselines. Always runs against the local dev server. Refresh baselines with `pnpm test:e2e:update-snapshots`.

Both auto-start `pnpm dev` via Playwright's `webServer` unless `PLAYWRIGHT_NO_SERVER=1`.

## Environment

Requires a `.env` file (see `.env.example`). Key variables include database credentials, Google OAuth client ID/secret, JWT secret, upload storage paths (`UPLOAD_DIR`, `PUBLIC_UPLOAD_URL`), SMTP settings, and `ADMIN_EMAIL`. `PORT` defaults to 3000. The Express server sets `trust proxy 1` for Nginx deployments.

## Commit Style

Conventional commits: `feat:`, `fix:`, `ui:`, etc.
