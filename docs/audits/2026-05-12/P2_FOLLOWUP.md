# P2 Follow-up — Deferred to a second PR

User decision (2026-05-12): This branch ships **P0 + P1 only**. P2 items below are tracked for a follow-up branch.

For each cluster, see the original review manifest for the full plan, files, and acceptance criteria. This file is a checklist for the next iteration.

## Cluster A (Security / Deps / DB) — P2 items
See `review-A-security-deps-db.md` section "ACCEPT — P2". Approx. 10 items.

## Cluster B (Backend / Architecture) — P2 items
See `review-B-backend-arch.md` section "ACCEPT — P2". Approx. 6 items.

## Cluster C (Frontend / UI) — P2 items
See `review-C-frontend-ui.md` section "ACCEPT — P2". Approx. 5 items.

## Larger DEFER items (own branches)
- **Express 4 → 5** — clears remaining Express-transitive CVEs (path-to-regexp ReDoS, qs DoS, cookie). Suggested branch: `chore/express-5`.
- **Drizzle migrations adoption** — replace `pnpm db:push` with committed `drizzle-kit generate` migrations. Blocks most P2 DB column refactors. Suggested branch: `chore/drizzle-migrations`.
- **Structured logger (pino) rollout** — replace all `console.*` calls in server. Suggested branch: `chore/structured-logging`.
- **God-component decomposition** — Events.tsx (1617 LOC), Goennermitglieder.tsx (1670 LOC), admin/Dashboard.tsx (1008 LOC). Suggested branch: `refactor/page-decomposition`.
- **Full RHF + Zod form migration** — bulk migrate remaining forms (Contact is migrated in this branch as the reference pattern). Suggested branch: `refactor/forms-rhf`.
- **`sdk.*` permission key migration** — move from `adminProcedure` to `requirePermission('manage_sdk')` once new seed + UI is in place. Suggested branch: `feat/sdk-permission-key`.
- **TEXT → VARCHAR / charset / enums** — all non-additive DB column type changes (deferred until migrations are in place).
- **Vitest 2 → 3/4, TypeScript 6** — major dev-tool upgrades. Suggested branch: `chore/dev-tool-bumps`.
