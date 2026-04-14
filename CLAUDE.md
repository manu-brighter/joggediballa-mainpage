# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Vite on :3000 + tsx watch for server)
pnpm build        # Build client (Vite) + server (esbuild) for production
pnpm start        # Run production build (NODE_ENV=production node dist/index.js)
pnpm check        # TypeScript type checking
pnpm format       # Prettier formatting
pnpm test         # Vitest (server/**/*.test.ts and server/**/*.spec.ts only)
pnpm db:push      # Push Drizzle schema changes to MySQL
```

Run a single test file: `pnpm test server/path/to/file.test.ts`

## Architecture

Full-stack TypeScript monorepo: React frontend + Express backend with end-to-end type safety via tRPC.

**Key directories:**

- `client/src/` — React 19 app (Vite, Wouter routing, Tailwind 4)
- `server/` — Express + tRPC backend
- `server/_core/` — Framework plumbing: Express setup, tRPC context, auth routes
- `drizzle/` — Drizzle ORM schema (`schema.ts`) and SQL migrations

### API Layer (tRPC)

All client–server communication goes through tRPC v11. The main router is defined in `server/routers.ts`. On the client, use `trpc.<namespace>.<procedure>.useQuery()` / `.useMutation()` from `client/src/lib/trpc.ts`. SuperJSON is used as the transformer.

### Authentication & Authorization

- **Auth:** Google OAuth 2.0 (primary) via Passport, with JWT stored in HTTP-only cookies. Routes in `server/_core/googleAuthRoutes.ts`.
- **Roles:** `admin > maintainer > editor > user > visitor`
- **Procedures:** Two approaches coexist:
  - Legacy: `adminProcedure`, `maintainerProcedure`, `editorProcedure` (hardcoded role checks)
  - Modern: `requirePermission()` middleware with dynamic permissions from DB
- First user matching `ADMIN_EMAIL` env var is auto-promoted to admin.

### Database

MySQL 8 via Drizzle ORM. Schema is the single source of truth in `drizzle/schema.ts` (16+ tables: Users, ShotcounterTeams, Events, Sponsors, ContactSubmissions, etc.). Run `pnpm db:push` after schema changes.

### File Storage

S3 (AWS SDK) for all user-uploaded files (profile pictures, sponsor logos, event photos). Upload routes are in `server/uploadRoutes.ts`; the client requests pre-signed URLs from there.

### Frontend Patterns

- **Routing:** Wouter (not React Router). Routes defined in `client/src/App.tsx`, which also holds the Beamer mode context for the shotcounter.
- **State:** React Query v5 (via tRPC hooks) for server state; React contexts for UI state (theme, auth).
- **UI components:** Radix UI primitives wrapped in `client/src/components/ui/` using CVA for variants.
- **Forms:** React Hook Form + Zod.

### Testing

Vitest tests only cover the server. Tests use `appRouter.createCaller(context)` to call tRPC procedures directly—no HTTP layer involved. There are no frontend tests.

## Environment

Requires a `.env` file (see `.env.example`). Key variables include database credentials, Google OAuth client ID/secret, JWT secret, S3 config, and `ADMIN_EMAIL`. The Express server sets `trust proxy 1` for Nginx deployments.

## Commit Style

Conventional commits: `feat:`, `fix:`, `ui:`, etc.
