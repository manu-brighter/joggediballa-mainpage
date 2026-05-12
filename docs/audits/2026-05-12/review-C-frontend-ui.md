# Review Cluster C — Frontend & UI/Design
**Reviewer:** Senior Tech Lead (subagent)
**Date:** 2026-05-12
**Reports decided:** 04-frontend.md, 05-ui-design.md

## Summary
- Counts: P0=6, P1=11, P2=5, DEFER=8, REJECT=0
- Headline: This is a textbook "Manus scaffold never scrubbed" + "design tokens defined but bypassed" situation. We can deliver a visible, user-facing Überholung in one branch: route code-splitting, a fixed German `NotFound`, semantic color tokens everywhere, a global reduced-motion guard, `useAuth`/`usePersistFn`/`useSEO` cleanups, plus a `<PageContainer>`/`<Spinner>` migration. Full RHF migration and god-component decomposition are deferred to follow-up branches (one form is migrated as the pattern).

## ACCEPT — P0

### C-P0-01 — F-FE-001: Route-level code splitting via React.lazy + Suspense
- **Files:** `client/src/App.tsx`, new `client/src/components/RouteFallback.tsx`
- **Plan:** Convert every page import in `App.tsx` to `React.lazy(() => import('./pages/...'))`. Wrap the `<Switch>` in a top-level `<Suspense fallback={<RouteFallback />}>`. Keep `Home` and `Navigation` eager (above-the-fold). Group admin/overlay/gated routes implicitly via per-file lazy imports — Vite handles chunking. Verify Wouter accepts a lazy component (it does, transparently).
- **Acceptance criteria:** `pnpm build` produces a per-page chunk per lazy page (visible in build output). Initial JS for `/` drops noticeably (admin/overlay/Goennermitglieder code no longer in main chunk). All routes still navigate and render. `pnpm check` passes.
- **Depends on:** none
- **Risk:** low

### C-P0-02 — F-UI-001 / F-UI-021: Rewrite `NotFound.tsx` with semantic tokens + German copy
- **Files:** `client/src/pages/NotFound.tsx`
- **Plan:** Replace `from-slate-50`, `bg-blue-600`, `text-red-500`, hardcoded button styling with `bg-background`, `bg-destructive/10`, `text-destructive`, default `<Button>`. Translate copy to German ("Seite nicht gefunden" / "Die Seite existiert nicht oder wurde verschoben."). Keep the same visual structure (404 number, message, home button).
- **Acceptance criteria:** No raw palette classes in file. Looks correct in light and dark mode. Copy is German. `<Button>` default variant used (no inline color/shadow overrides).
- **Depends on:** none
- **Risk:** low

### C-P0-03 — F-FE-005: Remove `localStorage` write from `useMemo` in `useAuth`
- **Files:** `client/src/_core/hooks/useAuth.ts`
- **Plan:** Delete the `localStorage.setItem('manus-runtime-user-info', ...)` call entirely (no consumer reads it — confirmed in audit). The `useMemo` becomes pure. While here, also rename hook internals to drop the Manus prefix wherever it appears.
- **Acceptance criteria:** Grep for `manus-runtime-user-info` returns zero hits in `client/src/`. `useAuth.ts` `useMemo` is side-effect free. Auth flow still works (login + me query + logout).
- **Depends on:** none
- **Risk:** low

### C-P0-04 — F-FE-006 (partial): `Navigation` logout uses Wouter not `window.location.href`
- **Files:** `client/src/components/Navigation.tsx`, `client/src/_core/hooks/useAuth.ts`
- **Plan:** Replace `window.location.href = '/'` after logout with Wouter's `setLocation('/')`. In `useAuth`'s `redirectOnUnauthenticated` branch, use Wouter for internal SPA paths; keep `window.location.href` only for the external `/api/auth/google` OAuth path. Add a tiny `isExternalUrl()` helper if it improves readability.
- **Acceptance criteria:** Logout no longer triggers a full reload; user lands on `/` via SPA navigation. Cross-origin OAuth still works as before.
- **Depends on:** none
- **Risk:** low

### C-P0-05 — F-FE-011: `ErrorBoundary` no longer leaks stack to end users
- **Files:** `client/src/components/ErrorBoundary.tsx`
- **Plan:** Render stack only when `import.meta.env.DEV`. In prod, show a friendly German message + reload button. Add a `componentDidCatch` that `console.error`s the error (no Sentry yet — Cluster A owns observability).
- **Acceptance criteria:** Triggering an error in dev shows the stack; a prod build does not. Error is logged via `console.error`.
- **Depends on:** none — note that Cluster A also flagged this; we own the rendering side, they own monitoring.
- **Risk:** low

### C-P0-06 — F-UI-012: Global `prefers-reduced-motion` CSS guard + framer-motion `useReducedMotion`
- **Files:** `client/src/index.css`, hero MotionDivs in `client/src/pages/Home.tsx` and `client/src/pages/Harassenlauf.tsx`
- **Plan:** Add the standard `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }` block to `index.css`. In Home and Harassenlauf hero animations, call `useReducedMotion()` from framer-motion and skip/zero-out entry animations when true.
- **Acceptance criteria:** Toggling reduced-motion in DevTools disables `animate-pulse`, `glow-pulse`, hero entry animations, and floating blob pulses. WCAG 2.3.3 baseline satisfied.
- **Depends on:** none
- **Risk:** low

## ACCEPT — P1

### C-P1-01 — F-DEP-004 / F-ARCH-012 / F-FE-016 cross-ref: Manus scaffold sweep (frontend side)
- **Files:** `client/src/hooks/usePersistFn.ts` (delete), `client/src/hooks/useComposition.ts` (simplify or delete), `client/src/components/ui/input.tsx`, `client/src/components/ui/textarea.tsx`, `client/src/const.ts`, `vite.config.ts` (frontend-relevant aliases — `attached_assets` alias removal; the `vite-plugin-manus-runtime`/`@builder.io/vite-plugin-jsx-loc` removal is Cluster A territory but list as cross-handoff)
- **Plan:** Delete `usePersistFn`. Replace its usage in `useComposition` with direct handlers (the IME composition workaround for Safari is over-engineered for a German Latin-script audience; keep a minimal composition guard if any). Strip the Chinese-language comments and the "MANUS OAUTH CONFIGURATION" block from `const.ts`. Remove the `attached_assets` Vite alias (points to a non-existent directory per F-ARCH-012).
- **Acceptance criteria:** Grep for `manus`, `usePersistFn`, `attached_assets`, and the Chinese-comment strings returns zero hits in `client/`. Forms still work; IME on shadcn input still functional for the (rare) edge case.
- **Depends on:** none — coordinate with Cluster A who removes the corresponding npm packages
- **Risk:** medium (IME composition is rarely tested manually)

### C-P1-02 — F-FE-012: Delete `useSEO`, use native React 19 `<title>`/`<meta>` hoisting
- **Files:** `client/src/hooks/useSEO.ts` (delete), new `client/src/components/SEO.tsx`, all callers (per page that uses useSEO today)
- **Plan:** Build a tiny `<SEO title description image? />` component that renders `<title>`, `<meta name="description">`, OG/Twitter tags as JSX. React 19 hoists them to `<head>` automatically. Delete the 130-line imperative hook. Replace each `useSEO(...)` call with `<SEO ... />` at the top of the page's return.
- **Acceptance criteria:** `useSEO.ts` deleted. Each page renders correct `<title>` and meta tags (verify in DevTools). No imperative `document.querySelector` for head tags remains.
- **Depends on:** none
- **Risk:** low

### C-P1-03 — F-UI-005: Migrate raw Tailwind palette colors to semantic tokens (mechanical sweep)
- **Files:** 17 files, ~88 occurrences. Worst offenders: `Goennermitglieder.tsx`, `admin/Dashboard.tsx`, `AttendanceSessionCard.tsx`, `Home.tsx`, `admin/UserManagement.tsx`, `Navigation.tsx` visitor banner
- **Plan:** Mechanical Find/Replace pass:
  - `text-red-{400,500,600}` → `text-destructive`
  - `bg-red-{50,100}/text-red-{700,800,900}` → `bg-destructive/10 text-destructive`
  - `text-green-{500,600,700}` → `text-success`
  - `bg-green-50` etc. → `bg-success/10`
  - `text-orange-{500,600,700} dark:text-orange-300` → `text-warning`
  - `bg-yellow-50 / text-yellow-800` → `bg-warning/10 text-warning-foreground`
  - `bg-blue-600` etc. (where used as primary CTA) → `bg-primary`
  Audit each file post-change so a context-appropriate token is chosen, not a blanket swap. Visitor banner in `Navigation.tsx` gets `bg-warning/10 border-warning/20`.
- **Acceptance criteria:** Grep for `(text|bg|border)-(red|green|orange|yellow|blue|purple)-\d` returns near-zero in `client/src/pages/*` and `client/src/components/*` (except brand colors documented in C-P1-04).
- **Depends on:** none
- **Risk:** medium (volume — but mechanical)

### C-P1-04 — F-UI-002 / F-UI-003 / F-UI-004: Replace hex-literal colors with tokens
- **Files:** `client/src/components/CookieConsentBanner.tsx`, `client/src/components/ManusDialog.tsx`, `client/src/pages/overlay/SdkControl.tsx`, `client/src/pages/overlay/SdkOverlay.tsx`, `client/src/pages/Home.tsx`, `client/src/index.css`
- **Plan:** Replace `#0B93A7` with `text-primary`/`bg-primary` (it is the primary teal). Replace `#E93F56` with the existing `--coral` token (add `bg-coral` utility via `@theme` if not present). Add `--color-twitch: #9146FF` token in `index.css` and reference once for the Home Twitch CTA. In `ManusDialog`, replace `#1a1a19`/`#f8f8f7`/`#34322d` with `bg-popover text-popover-foreground` / `text-muted-foreground` so dark mode works (and rename file `ManusDialog.tsx` → `Dialog.tsx` only if usage allows — defer rename if risky).
- **Acceptance criteria:** Grep for `\[#[0-9A-Fa-f]` in `client/src/` returns only the few documented brand-color overrides (Twitch token declaration, maybe Instagram). Cookie banner and ManusDialog look correct in dark mode.
- **Depends on:** none
- **Risk:** low

### C-P1-05 — F-UI-006: Add `<PageContainer>` + `<PageHeader>` primitive and migrate top pages
- **Files:** new `client/src/components/ui/page.tsx`, migrate `Contact.tsx`, `Sponsors.tsx`, `Datenschutz.tsx`, `Impressum.tsx`, `Dienstleistungen.tsx` first (small pages with consistent shape)
- **Plan:** Export `<PageContainer size="default|narrow|wide">` and `<PageHeader title description icon?>`. Migrate the 5 small pages. Leave large pages (Events, Goennermitglieder, Team, Profile, Shotcounter) to a follow-up branch where they're decomposed.
- **Acceptance criteria:** Migrated pages render identically (visual diff small). 5 fewer `container py-X space-y-Y` recipes in the codebase. Vertical rhythm consistent on those pages.
- **Depends on:** none
- **Risk:** low

### C-P1-06 — F-UI-008: Migrate hand-rolled `Loader2` to existing `<Spinner>` primitive
- **Files:** `client/src/components/ui/spinner.tsx` (verify size variants), `Events.tsx`, `Profile.tsx`, `Sponsors.tsx`, `Team.tsx`, `admin/Dashboard.tsx`, `ProfilePictureUpload.tsx`
- **Plan:** Ensure `<Spinner size="sm|md|lg">` maps to `h-4 w-4` / `h-6 w-6` / `h-8 w-8`. Replace all 17 hand-rolled `<Loader2 className="h-X w-X animate-spin text-primary" />` callsites with `<Spinner size=... />`. Keep button-internal spinners (form submitting) as `<Spinner size="sm" />`.
- **Acceptance criteria:** Grep for `Loader2.*animate-spin` returns zero in pages (only `<Spinner>` internals may still import Loader2). Visuals unchanged.
- **Depends on:** none
- **Risk:** low

### C-P1-07 — F-FE-004 (pattern only): Migrate `Contact.tsx` to RHF + Zod as the reference implementation
- **Files:** `client/src/pages/Contact.tsx`, share Zod schema with the server tRPC procedure (re-export from `shared/`)
- **Plan:** Use `useForm({ resolver: zodResolver(schema) })` + `<Form>` / `<FormField>` from `components/ui/form.tsx`. Import the same Zod schema the server uses (move to `shared/contactSchema.ts` if not already). Replace all `useState` field state and manual regex email validation. Field-level error UI via `<FormMessage>`.
- **Acceptance criteria:** `Contact.tsx` has no `useState` for field values. Email validation runs client-side from the same schema as server. Submission flow + toast on success works. This file becomes the documented pattern for the deferred bulk migration.
- **Depends on:** none — Cluster B may want to coordinate the `shared/` schema move
- **Risk:** low

### C-P1-08 — F-FE-018 / F-UI-023: Fix Navigation smooth-scroll
- **Files:** `client/src/components/Navigation.tsx`
- **Plan:** Change `behavior: 'smooth'` to `behavior: 'instant'` (or omit). Gate the effect on `pathname` only, not the full location tuple. Naturally respects reduced-motion now that the smooth behavior is gone.
- **Acceptance criteria:** Route changes scroll instantly to top. Future anchor links would not be fought.
- **Depends on:** none
- **Risk:** low

### C-P1-09 — F-FE-019: `Home.tsx` stops calling `window.matchMedia` in render
- **Files:** `client/src/pages/Home.tsx`
- **Plan:** Replace the inline `theme === 'system' && window.matchMedia(...).matches` branch with `resolvedTheme === 'dark'` (already exposed by `ThemeContext`).
- **Acceptance criteria:** No `window.matchMedia` call in Home render path. Visual identical.
- **Depends on:** none
- **Risk:** low

### C-P1-10 — F-FE-013: `<Image>` wrapper with native lazy/decoding defaults; replace inline `LazyImage` in Events
- **Files:** new `client/src/components/ui/image.tsx`, `client/src/pages/Events.tsx` (remove inline `LazyImage` + `SmartCoverImage`)
- **Plan:** Build a thin `<Image>` wrapper around `<img>` defaulting `loading="lazy"` `decoding="async"` and requiring/accepting `width`/`height` (CLS-safe). Migrate the inline `LazyImage` (IntersectionObserver-based, reimplementing what the browser does for free) and `SmartCoverImage` out of `Events.tsx`. Keep them colocated in `components/ui/` so other gallery work can reuse them. Sweep `Dashboard.tsx` user avatars, `Footer.tsx`, `Sponsors.tsx`, `Team.tsx` `<img>` tags to use the wrapper.
- **Acceptance criteria:** No remaining `<img` tag in pages without `loading="lazy"` (verify via grep). `Events.tsx` no longer contains the inline `LazyImage` definition.
- **Depends on:** none
- **Risk:** low

### C-P1-11 — F-FE-008: Centralize tRPC query defaults + dedupe `features.get`
- **Files:** `client/src/main.tsx` (QueryClient init), `client/src/App.tsx` (`features.get` call), `client/src/_core/hooks/useAuth.ts`
- **Plan:** Set `QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false }}})` in `main.tsx`. Remove per-call duplicated `staleTime` where it now equals the default. In `App.tsx`, replace the standalone `features.get` (for `maintenance_mode`) with a `select` on the cached `features.list` query (which is already fetched elsewhere). Confirm `usePermission(key)` derives from one cached `getMyPermissions` query (React Query dedupes by key; we only need consistent `staleTime`).
- **Acceptance criteria:** Network tab shows one `features.list` query per session, not two. `auth.me` does not refetch on every mount within 30s.
- **Depends on:** none
- **Risk:** low

## ACCEPT — P2

### C-P2-01 — F-FE-010 / F-FE-017: Move `BeamerModeContext` and its effects out of `App.tsx` into `Shotcounter`
- **Files:** `client/src/App.tsx`, `client/src/pages/Shotcounter.tsx`
- **Plan:** Move provider, escape-key listener, route-change exit logic into `Shotcounter.tsx` (or a `<BeamerModeProvider>` wrapping that route only). `App.tsx` loses two `useEffect`s.
- **Acceptance criteria:** `App.tsx` no longer references `BeamerMode`. Shotcounter beamer mode still toggles via Escape and exits on route change.
- **Depends on:** none
- **Risk:** low

### C-P2-02 — F-FE-023: `useIsMobile` lazy-initializes from `window.innerWidth`
- **Files:** `client/src/hooks/useMobile.tsx`
- **Plan:** `useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)`. No more flash of desktop layout on phones.
- **Acceptance criteria:** First render on mobile devtools returns `true` immediately.
- **Depends on:** none
- **Risk:** low

### C-P2-03 — F-FE-015: Decide `ProfilePictureUpload.tsx` — refactor `Profile.tsx` to use it (or delete)
- **Files:** `client/src/components/ProfilePictureUpload.tsx`, `client/src/pages/Profile.tsx`
- **Plan:** Preferred: enhance `ProfilePictureUpload.tsx` with the crop UI that `Profile.tsx` has inline, then have `Profile.tsx` import it (eliminating ~150 LOC of duplicate logic). Fallback if integration is risky: delete `ProfilePictureUpload.tsx`.
- **Acceptance criteria:** No dead component. Profile picture upload flow still works including crop.
- **Depends on:** none
- **Risk:** medium (touches Profile picture flow)

### C-P2-04 — F-UI-019: Add `xl`/`2xl` Button sizes; migrate Home hero buttons
- **Files:** `client/src/components/ui/button.tsx`, `client/src/pages/Home.tsx`
- **Plan:** Add `xl: 'h-12 rounded-md px-8 text-base'`, `2xl: 'h-14 rounded-md px-10 text-base font-bold'` to CVA size variants. Migrate the two hero CTA buttons from `h-14 px-10`/`h-12 px-8` overrides to `size="2xl"`/`size="xl"`.
- **Acceptance criteria:** Hero buttons render identically. Two fewer ad-hoc size overrides.
- **Depends on:** none
- **Risk:** low

### C-P2-05 — F-UI-022: Move `--glow-*` token redeclaration into top-level `:root` / `.dark`
- **Files:** `client/src/index.css`
- **Plan:** Move the `@layer components` redeclaration of `--glow-base` into the main token blocks at the top of the file.
- **Acceptance criteria:** Visuals unchanged. All token declarations live in one place.
- **Depends on:** none
- **Risk:** low

## DEFER

- [F-FE-002] God-component breakdown of Goennermitglieder/Events/admin/Dashboard/Team/Attendance/Shotcounter/Profile/Harassenlauf — huge scope, deserves its own branch per page. Suggested: `refactor/decompose-events-page`, then sequential branches per god-page.
- [F-FE-003] Suspense boundaries + `useSuspenseQuery` migration — depends on F-FE-002 outcome. Branch: `refactor/suspense-loading-pattern`.
- [F-FE-004 bulk] RHF/Zod migration for remaining forms (Events, Goennermitglieder, Team, Profile, Shotcounter, admin/UserManagement, Harassenlauf, Sponsors). Branch: `refactor/forms-rhf-zod`. Contact migrated in C-P1-07 as the pattern.
- [F-FE-007 + F-FE-016] Full `usePersistFn` / `useComposition` overhaul to `useEffectEvent` — partial in C-P1-01 (deletion of `usePersistFn`), but the full IME composition decision (keep vs delete) should be made after user testing. Branch: `refactor/composition-handlers`.
- [F-FE-009] Move feature-toggle seeding off the client `useEffect` — server change, defer to Cluster B (`server/_core/` migration/seed). Cross-handoff.
- [F-FE-020 + F-UI-015] Full a11y sweep: `aria-*` on icon-only buttons, lightbox → Radix Dialog, mobile menu `aria-expanded`/`aria-controls`, focus rings on non-Button anchors, etc. Branch: `refactor/a11y-sweep`. Reduced-motion handled in C-P0-06.
- [F-FE-021 + F-UI-017] framer-motion deduplication + inline-style migration in `SdkOverlay.tsx` — touches the overlay rendering pipeline; defer to a perf-focused branch. Branch: `refactor/motion-and-overlay-styles`.
- [F-UI-007 + F-UI-009 + F-UI-010 + F-UI-011 + F-UI-013 + F-UI-014] Design system v2 (Heading primitive, list Skeletons, EmptyState, ErrorState, HeroBackdrop, icon-size scale, inline error UI for the bulk forms). Branch: `refactor/design-system-v2`. The token sweep (C-P1-03/04) and `<PageContainer>` (C-P1-05) lay groundwork; full primitive expansion comes next.

## REJECT

(None — all findings in this cluster are valid; the ones not accepted are deferred to focused follow-up branches because of scope, not because they're wrong.)

## Sequencing & dependencies

Implement in this order to minimize merge conflicts and let later items rely on the established patterns:

1. C-P0-03, C-P0-04, C-P0-05 (tiny `useAuth` / `Navigation` / `ErrorBoundary` fixes — touch small files, no cross-cutting).
2. C-P1-01 (Manus scaffold sweep — touches many files but mechanically; do early so subsequent changes don't re-touch the same lines).
3. C-P1-02 (`useSEO` → `<SEO>` component — touches every page header but each diff is small).
4. C-P0-02 (NotFound rewrite — standalone).
5. C-P1-03 + C-P1-04 (color token sweep — large mechanical pass; do as one focused commit).
6. C-P0-06 (reduced-motion CSS + framer-motion `useReducedMotion` — small, contained).
7. C-P1-05 (`<PageContainer>` primitive + 5 small page migrations).
8. C-P1-06 (`<Spinner>` migration).
9. C-P1-10 (`<Image>` wrapper + Events inline removal).
10. C-P1-07 (Contact RHF/Zod — coordinate with Cluster B on `shared/` schema location).
11. C-P1-08, C-P1-09, C-P1-11 (small fixes; can ride alongside others).
12. C-P2-01..C-P2-05 (P2 polish, at the end).
13. C-P0-01 (route code-splitting — LAST, so it runs against the final tree and chunk boundaries reflect the cleaned-up imports).

## Cross-cluster handoffs

- **Cluster A (security/deps):**
  - F-DEP-004 (npm package removal: `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`, `axios`, `streamdown`, `add`) — they own `package.json`; we delete the consumer code in C-P1-01.
  - F-DEP-010 + F-SEC-020 (Wouter patch & `__WOUTER_ROUTES__` leak) — their call on whether to drop the patch.
  - F-FE-011 (ErrorBoundary): we render-side it in C-P0-05; they own monitoring/Sentry wiring (F-ARCH-008).
- **Cluster B (backend/arch):**
  - F-FE-009 (feature-toggle seeding from client `useEffect`) — server seed/migration is theirs; deferred entirely.
  - F-FE-004/C-P1-07 (Contact form Zod schema in `shared/`) — coordinate on the canonical `shared/` schema location and naming.
  - F-FE-014 (`event.eventLinks` typed as JSON on the server, not parsed on the client with `any`) — Drizzle column `mode: 'json'` is their territory; we'll consume the typed shape.
  - F-ARCH-003 (`client/src/_core/` boundary) — they own the rename/flatten if they decide to do it; we don't move `useAuth` in this branch.
  - F-ARCH-012 (`attached_assets` alias removal) — we delete the Vite alias in C-P1-01; they confirm no server reference.

## Open questions for the user

1. **Contact RHF migration scope:** OK to move the `contactSubmissions` Zod schema into `shared/` so client and server import the same source? (Coordinates with Cluster B.)
2. **`ManusDialog.tsx` rename:** Should we rename the file to `BrandDialog.tsx` (or similar) as part of the Manus scrub, or only fix its colors and keep the filename? (Pure rename has zero visual benefit but improves grep.)
3. **`ProfilePictureUpload.tsx` (C-P2-03):** Prefer "refactor Profile.tsx to use the component" or "delete the dead component"? Refactor is more invasive but eliminates duplication.
4. **`useComposition` (C-P1-01):** Are there any known users of IME composition (Chinese/Japanese/Korean) in the audience? If not, we can delete `useComposition` entirely instead of simplifying it.
5. **First migrated form for RHF pattern (C-P1-07):** Confirm Contact is the right choice. Alternatives: Harassenlauf (longer form, better stress test) or admin/UserManagement (admin-only, lower risk if anything breaks).
