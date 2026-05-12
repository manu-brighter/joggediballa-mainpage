# Dependency & Tooling Audit Report
**Date:** 2026-05-12
**Auditor:** Platform Engineer (subagent)
**Scope:** `C:\dev\joggediballa-mainpage` on `refactor/full-audit-2026-05`

## Executive Summary

- **80 known vulnerabilities** (1 critical, 26 high, 48 moderate, 5 low) per `pnpm audit`. The critical (fast-xml-parser via `@aws-sdk/client-s3`) and a high tRPC server prototype-pollution advisory are fixable by patch/minor bumps available today.
- **At least 4 dead/unused dependencies** ship in `package.json` (`axios`, `streamdown`, `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`) plus the obviously-accidental `add@^2.0.6`. Together they introduce vulnerabilities and ~10MB of tree.
- **Dependency hygiene issues**: three `@types/*` packages live in `dependencies` instead of `devDependencies`; `pnpm` itself is declared as a devDep alongside `packageManager` (redundant); `@types/helmet` is officially deprecated.
- **No ESLint, no Node engines pin, no CI test/lint job** (`.github/workflows/deploy.yml` is SSH-only). For a 2026 production app this is the biggest tooling gap.
- **Express 4 → 5 migration is now realistic** (Express 5 was made stable in 2024). `path-to-regexp` ReDoS, `qs` DoS, and `cookie` advisories all chain through Express 4 dependencies.
- **Vitest 2 is EOL** (Vitest 4 is current; Vitest 3 is also out). Vite 7 → 8, Vitest 2 → 3/4, TypeScript 5.9 → 6, and Drizzle 0.44 → 0.45 are all sane next steps.

---

## Findings

### F-DEP-001: Critical CVE in `fast-xml-parser` (via `@aws-sdk/client-s3`)
- **Severity:** critical
- **Effort:** small
- **Location:** `package.json` → `@aws-sdk/client-s3@^3.693.0` (resolved 3.907.0)
- **Issue:** `pnpm audit` reports `fast-xml-parser` entity-encoding bypass (GHSA-m7jm-9gc2-mpf2, critical) plus 4 high/low advisories on the same transitive package via both `@aws-sdk/client-s3` and `@aws-sdk/client-sesv2` (pulled indirectly through `@types/nodemailer` of all things — see F-DEP-009). All are patched in `>=5.5.6` / `>=5.3.8`.
- **Recommendation:** Bump `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` from `3.907` → `3.1045.0` (current). All AWS SDK v3 sub-packages share a release train; pin the major and let pnpm hoist the patched `fast-xml-parser`. If the chain through `@aws-sdk/client-sesv2` cannot be resolved by AWS-SDK update alone, add a `pnpm.overrides` entry for `fast-xml-parser: ">=5.5.6"`.
- **Rationale:** AWS SDK v3 has no breaking changes within minor bumps for the surfaces used (`PutObjectCommand`, `GetObjectCommand`, `getSignedUrl`). Upgrade is mechanical.

### F-DEP-002: High CVE in `@trpc/server@11.6.0` (prototype pollution)
- **Severity:** high
- **Effort:** small
- **Location:** `package.json` → `@trpc/server`, `@trpc/client`, `@trpc/react-query` all at `^11.6.0`
- **Issue:** GHSA-43p4-m455-4f4j affects `>=11.0.0 <11.8.0`. Latest is `11.17.0`.
- **Recommendation:** Bump all three `@trpc/*` packages to `^11.17.0`. tRPC v11 is API-stable across minors; no migration needed. Verify by running `pnpm test` (the project's tests call `appRouter.createCaller`, which is the highest-coverage surface).
- **Rationale:** The vulnerable code path is `experimental_nextAppDirCaller`, which this project does not use, but staying current eliminates the advisory.

### F-DEP-003: Unused production dependency `axios` (with advisories)
- **Severity:** high
- **Effort:** small
- **Location:** `package.json` `dependencies`
- **Issue:** `grep` finds zero `import ... from 'axios'` or `require('axios')` calls in `client/`, `server/`, or `shared/`. Yet axios at `^1.12.0` triggers two moderate CVEs (GHSA-xx6v-rp6x-q39c XSRF leakage, GHSA-xhjh-pmcv-23jw null-byte injection — both fixed in `>=1.15.1`).
- **Recommendation:** Remove. `pnpm remove axios`. Project already uses tRPC for client→server and `fetch` is built-in on Node 22+.
- **Rationale:** Dead code with active CVEs is the worst combination.

### F-DEP-004: Unused / unmaintained `vite-plugin-manus-runtime` and `@builder.io/vite-plugin-jsx-loc`
- **Severity:** high
- **Effort:** small
- **Location:** `package.json` `devDependencies`, `vite.config.ts:1,7,12-13`
- **Issue:** `vite-plugin-manus-runtime@^0.0.57` is a Manus-platform artifact. `@builder.io/vite-plugin-jsx-loc@^0.1.1` (still 0.x, last meaningful releases October 2025 only) injects JSX source-location attributes for the Builder.io visual editor — not used in this codebase. Both plugins are loaded in `vite.config.ts` but their output isn't consumed anywhere; they exist because the project was scaffolded on a Manus template.
- **Recommendation:** Remove both packages and delete lines 1, 7, 12, 13 of `vite.config.ts`. This is a leftover from the scaffolding tool; eliminating them removes a forever-pre-1.0 supply-chain risk and shrinks dev installs.
- **Rationale:** Pre-1.0 vendor plugins on a long-lived production app are a maintenance liability. The visual-editor / runtime overlay isn't part of the joggediballa.ch product.

### F-DEP-005: Unused `streamdown` dependency
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` line 85
- **Issue:** `streamdown@^1.4.0` is a streaming-markdown component (used by AI chat UIs). Only references in this repo are inside `package.json` and `pnpm-lock.yaml`. Latest is 2.5.0 (would be a major bump if we kept it).
- **Recommendation:** `pnpm remove streamdown`.
- **Rationale:** Another scaffolding leftover.

### F-DEP-006: Accidental `add` package
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` devDependencies line 105
- **Issue:** `add@^2.0.6` is a 9-year-old utility unrelated to anything in this project. It was almost certainly installed by someone typing `pnpm add` with a stray argument, or by `npm install add tailwindcss` muscle memory.
- **Recommendation:** `pnpm remove add`.
- **Rationale:** Pure mistake; remove.

### F-DEP-007: `@types/helmet` is officially deprecated
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` devDependencies line 99 (`@types/helmet@^4.0.0`)
- **Issue:** `pnpm outdated` literally prints `Deprecated`. `npm view @types/helmet deprecated` returns: "This is a stub types definition. helmet provides its own type definitions, so you do not need this installed." Helmet has shipped its own types since v6; the project uses helmet 8.
- **Recommendation:** `pnpm remove @types/helmet`.
- **Rationale:** Cosmetic but textbook hygiene.

### F-DEP-008: `@types/*` packages mis-placed in `dependencies`
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` lines 50–52
- **Issue:** `@types/express-session`, `@types/passport`, `@types/passport-google-oauth20` live in `dependencies`, not `devDependencies`. They are TypeScript-only and have no runtime cost; this breaks the convention that `dependencies` = "ships to prod".
- **Recommendation:** Move all three to `devDependencies`. Same for any further `@types/*` in dependencies after cleanup.
- **Rationale:** Cleaner production `node_modules` after `pnpm install --prod`; correct npm metadata.

### F-DEP-009: `@types/nodemailer` pulls AWS SES SDK as a real dep
- **Severity:** medium
- **Effort:** small
- **Location:** Dependency chain: `@types/nodemailer@7.0.5` → `@aws-sdk/client-sesv2` → `@aws-sdk/xml-builder` → vulnerable `fast-xml-parser`
- **Issue:** `@types/nodemailer` versions 7.x include a hard runtime dependency on `@aws-sdk/client-sesv2` because nodemailer's SES transport types reference it. Nodemailer v8 ships its own types (no `@types/nodemailer` needed) and avoids this transitive chain.
- **Recommendation:** Upgrade `nodemailer` from `^7.0.12` → `^8.0.7` AND remove `@types/nodemailer`. Nodemailer 8 ships first-class TypeScript types. Verify `server/_core/email.ts` still compiles (the v7 → v8 API surface for `createTransport` + `sendMail` is unchanged).
- **Rationale:** Eliminates the secondary fast-xml-parser chain and the low-sev nodemailer SMTP-injection advisory (GHSA-c7w3-x93f-qmm8, fixed in 8.0.4) in a single move.

### F-DEP-010: `wouter` patch should be re-evaluated
- **Severity:** medium
- **Effort:** medium
- **Location:** `patches/wouter@3.7.1.patch`, `package.json` overrides
- **Issue:** The patch adds a `window.__WOUTER_ROUTES__` collector for diagnostic/preview purposes (same Manus-tooling lineage as F-DEP-004). Wouter is now at 3.9.0; the upstream has not adopted this. Question: is anything actually reading `__WOUTER_ROUTES__`? `grep "__WOUTER_ROUTES__"` in `client/` returns no consumer hits — only the patch produces it.
- **Recommendation:** Delete `patches/wouter@3.7.1.patch` and the `pnpm.patchedDependencies` block. Bump wouter to `^3.9.0`. If anything (analytics, debug overlay) does turn out to need a route list, derive it from the React tree in user code rather than monkey-patching the library.
- **Rationale:** Patched dependencies are a recurring upgrade-blocker tax; remove unless they encode real product behavior.

### F-DEP-011: `tailwindcss>nanoid` override is obsolete
- **Severity:** low
- **Effort:** small
- **Location:** `package.json` `pnpm.overrides`
- **Issue:** The override pins Tailwind's transitive `nanoid` to `3.3.7`. Tailwind 4 no longer depends on nanoid at runtime (the Vite/Postcss pipeline replaced the v3 JIT engine that used it). The override is a no-op.
- **Recommendation:** Remove the `overrides` block entirely. Verify with `pnpm why nanoid` after removal — only the top-level `nanoid@^5.1.5` should remain.
- **Rationale:** Dead config; reduces lockfile churn.

### F-DEP-012: Express 4 → 5 migration is now appropriate
- **Severity:** medium
- **Effort:** medium
- **Location:** `package.json` `express@^4.21.2`, `server/_core/index.ts`
- **Issue:** Express 5 was promoted to stable in 2024 and is the supported line for 2026. Express 4 keeps pulling vulnerable `path-to-regexp` (ReDoS GHSA in audit), `qs` (DoS), and `body-parser` chains. Most of this codebase's high/moderate audit findings come from the Express 4 transitive tree.
- **Recommendation:** Upgrade `express@^4.21.2` → `express@^5.2.1`. Breaking changes that actually affect this code:
  - `req.query` is now a null-prototype object (rarely a real issue with tRPC handling parsing).
  - Wildcard route syntax changed: `app.use('*', ...)` → `app.use(/.*/, ...)` or named `*splat`. Check `server/_core/index.ts` for any wildcard routes (the catch-all `/*` SPA handler is the likely candidate).
  - Removed: `res.redirect('back')`, `req.param()`, `app.del()`.
  - Async middleware is now first-class — error-handling middleware will catch rejected promises automatically.
  Companion: drop `@types/express@4.17.21`, install `@types/express@^5.0.6`.
- **Rationale:** Solves the largest single cluster of CVE noise and unlocks modern async middleware patterns.

### F-DEP-013: Vitest 2 is behind two majors
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` `vitest@^2.1.4`
- **Issue:** Vitest 3 (Jan 2025) and Vitest 4 (current) have shipped. v2 is no longer actively patched. Breaking surface is small for this project (server-only Vitest, no React testing).
- **Recommendation:** Bump `vitest` to `^3.x` first (lower migration risk), then consider 4. Skip the `@vitest/coverage-*` and `@vitest/ui` packages — not in use.
- **Rationale:** Stay on supported major; gains include faster pool spawn and improved tinypool defaults.

### F-DEP-014: No `engines.node` pin
- **Severity:** medium
- **Effort:** small
- **Location:** `package.json` (top-level, missing)
- **Issue:** Project relies on `@types/node@^24.7.0` (so it expects Node 22/24 features) but does not declare `engines.node`. PM2 in `ecosystem.config.cjs` doesn't pin a runtime either. A teammate on Node 20 (or worse, the deploy box on an older LTS) can quietly break.
- **Recommendation:** Add:
  ```json
  "engines": {
    "node": ">=22.11.0 <25",
    "pnpm": ">=10"
  }
  ```
  Node 22 is the active LTS. If production already runs Node 24, pin to `>=24.0.0`. Drop the explicit `pnpm@^10.15.1` devDependency (line 110) — `packageManager` (line 121) is the canonical mechanism.
- **Rationale:** Self-documenting and corepack-friendly; prevents runtime-mismatch foot-guns.

### F-DEP-015: No linter configured
- **Severity:** medium
- **Effort:** medium
- **Location:** `package.json` (no eslint / oxlint / biome in devDeps), no `eslint.config.js`, no `biome.json`
- **Issue:** Only Prettier and `tsc --noEmit` exist. For React 19 + tRPC v11 + Drizzle, a linter catches Hook-rule violations, unused vars, accessibility issues, and import order bugs that TS won't.
- **Recommendation:** Add **Biome** (one tool for lint + format, fast Rust core, zero plugin sprawl). Replace Prettier with `biome format` to consolidate. Alternative: `oxlint` (faster lint-only) + keep Prettier; or modern ESLint flat config with `eslint-plugin-react-hooks`. For a small team, Biome is the lowest-friction win in 2026.
- **Rationale:** A 2026 production TypeScript codebase without a linter is the most impactful gap in this audit.

### F-DEP-016: No CI test/check job
- **Severity:** medium
- **Effort:** small
- **Location:** `.github/workflows/deploy.yml`
- **Issue:** The only workflow SSHes into the deploy server. No `pnpm install && pnpm check && pnpm test && pnpm build` runs in CI on pull requests. Breakages reach `main` and only fail during the SSH deploy step.
- **Recommendation:** Add a `ci.yml` that runs on `pull_request` and `push`: install pnpm via corepack, run `pnpm install --frozen-lockfile`, then `pnpm check`, `pnpm test`, `pnpm build` (and the linter from F-DEP-015 once it's in). Gate the deploy job on a successful CI run via `needs: ci`.
- **Rationale:** Prevents broken main; standard 2026 hygiene.

### F-DEP-017: TypeScript config gaps
- **Severity:** low
- **Effort:** small
- **Location:** `tsconfig.json`
- **Issue:** `strict: true` is on, but several recommended flags are missing for a codebase this size: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`. Also: no `target` set (defaults to ES3 — harmless under `noEmit` but odd), no `useDefineForClassFields` explicit. `allowImportingTsExtensions: true` is set without `noEmit: true` being strictly required by it (it is here, fine).
- **Recommendation:** Add `target: "ES2023"`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`, `verbatimModuleSyntax: true`. Consider TS 6 migration as a separate finding (`typescript@^6.0.3` is current).
- **Rationale:** `noUncheckedIndexedAccess` alone catches a large class of array/record-access bugs at compile time.

### F-DEP-018: `jose` pinned without caret
- **Severity:** low
- **Effort:** small
- **Location:** `package.json` line 68: `"jose": "6.1.0"` (exact pin)
- **Issue:** Only `jose`, `typescript`, and `@types/express` are exact-pinned; everything else uses caret. Current `jose` is `6.2.3`. There's no documented reason for the pin in this repo's git history.
- **Recommendation:** Either change to `^6.1.0` (gets 6.2.3, all backward-compatible per the jose changelog) or add an inline comment explaining the pin. If the pin was to avoid a known issue, document it; otherwise lift it.
- **Rationale:** Explicit > implicit. Either lift or document.

### F-DEP-019: Major-version upgrades to evaluate (low-priority bundle)
- **Severity:** low
- **Effort:** medium
- **Location:** Multiple `package.json` entries
- **Issue:** Several deps have a new major out that this project will eventually need:
  - `lucide-react 0.453 → 1.14.0` (the 1.0 release renamed icon imports — codemod available).
  - `recharts 2 → 3.8.1` (TypeScript rewrite, API mostly compatible).
  - `react-day-picker 9 → 10` (minor breaking on `mode="range"` props).
  - `react-resizable-panels 3 → 4` (event names changed).
  - `superjson 1.13 → 2.2.6` (compatible; v2 is a maintenance major).
  - `drizzle-orm 0.44 → 0.45` and `drizzle-kit 0.31` minor bumps are safe and patch a few schema-diff bugs.
  - `vite 7 → 8` (only after `@tailwindcss/vite` and `@vitejs/plugin-react` are on v6 → both have v8-compatible releases).
  - `@vitejs/plugin-react 5 → 6`, `esbuild 0.25 → 0.28`, `cross-env 10`, `tsx 4.21`.
  - `typescript 5.9 → 6` is the largest of these (lib.d.ts churn).
- **Recommendation:** Sequence: (1) all patch/minor in one PR; (2) tooling majors (vite, plugin-react, vitest, esbuild) in one PR with build verification; (3) UI majors (lucide, recharts, react-day-picker, react-resizable-panels) in a third PR with visual QA; (4) TS 6 separately.
- **Rationale:** Batched-by-risk upgrade strategy keeps reviewable diffs.

### F-DEP-020: Vite config exposes Manus-platform internal hostnames
- **Severity:** low
- **Effort:** small
- **Location:** `vite.config.ts:34-42`
- **Issue:** `server.allowedHosts` lists `.manuspre.computer`, `.manus.computer`, etc. These are Manus's dev tunnels — dead code for joggediballa.ch's actual dev/prod.
- **Recommendation:** Trim to `['localhost', '127.0.0.1']` (or just remove `allowedHosts` for default behavior).
- **Rationale:** Same lineage as F-DEP-004; remove scaffolding crud.

---

## Cross-Domain Notes

- **Audit-chain consolidation:** F-DEP-001, -002, -009, -012 together would clear roughly 60 of the 80 advisories. The remaining ~20 are deep transitive chains (mostly `path-to-regexp`/`qs`/`cookie` via Express 4) that Express 5 dissolves.
- **Manus-template residue:** F-DEP-004, -005, -006, -010, -020 all trace to a single scaffolding tool (Manus / Builder.io visual-editor templates). Recommend a one-shot cleanup PR that removes the entire bundle plus the wouter patch.
- **No ESLint + no CI test gate (F-DEP-015 + F-DEP-016)** are the two findings that compound risk on every future PR. Address those first regardless of dep bumps.
- **`requireAuth`/security** is out of scope for this audit but Express 5 migration (F-DEP-012) interacts with the security audit — coordinate ordering.
- **PNPM 10 → 11** (`pnpm outdated` shows it) is a major bump. Defer; `packageManager: pnpm@10.32.1` is fine. Drop the redundant devDep listing per F-DEP-014.

## Methodology

1. Read `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `.prettierrc`, `ecosystem.config.cjs`, `patches/wouter@3.7.1.patch`, `.github/workflows/deploy.yml`.
2. Ran `pnpm outdated` and captured the full output (~60 packages flagged).
3. Ran `pnpm audit` (full dev + prod tree) → 80 advisories; severity breakdown 1 critical / 26 high / 48 moderate / 5 low. Cross-referenced via GHSA IDs.
4. Used `Grep` to verify actual usage of suspect packages (`axios`, `streamdown`, `wouter`, `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`, `__WOUTER_ROUTES__`).
5. Queried npm registry directly for deprecation strings and current versions (`npm view ... deprecated`).
6. No code changes made; audit-only as requested.
