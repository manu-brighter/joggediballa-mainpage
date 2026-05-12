# Frontend Code Audit Report
**Date:** 2026-05-12
**Auditor:** Frontend Engineer (subagent)
**Branch:** refactor/full-audit-2026-05
**Scope:** `client/src/**` — React 19.2 + Vite + Wouter + tRPC + Radix UI

---

## Executive Summary

- The codebase is large and functional, but has accumulated several **god-components** in `pages/` — `Goennermitglieder.tsx` (1670 LOC), `Events.tsx` (1617 LOC), `admin/Dashboard.tsx` (1008 LOC), `Team.tsx` (984 LOC), `Attendance.tsx` (864 LOC), `Shotcounter.tsx` (804 LOC), `Profile.tsx` (775 LOC), `Harassenlauf.tsx` (774 LOC). These need to be decomposed.
- **Zero React 19 idioms** are in use. No `Suspense`, no `lazy()`, no `useTransition`, no `useOptimistic`, no `useFormStatus`, no Actions, no `use()` hook. The whole app imports every page eagerly in `App.tsx` — there is no code-splitting and no route-level lazy loading.
- **Forms are entirely uncontrolled-by-state** (manual `useState` per field + manual `e.preventDefault()` handlers). React Hook Form + Zod are installed and a `components/ui/form.tsx` wrapper exists, but **only the shadcn wrapper imports `useForm`** — no page uses it. `parseErrorMessage` patches over the absence of field-level validation.
- **tRPC query hygiene is inconsistent**: most public queries omit `staleTime`, causing constant refetch on focus. `useAuth` and `usePermission` re-query the same endpoint per consumer — should be centralized or have explicit `staleTime` and `gcTime`.
- **`useAuth` has two correctness bugs**: it writes to `localStorage` inside a `useMemo` (a side effect during render) and the `redirectOnUnauthenticated` branch performs a hard `window.location.href` redirect that bypasses Wouter.
- **`usePersistFn`** (used by `useComposition`) is an anti-pattern: it stores the function in a `useRef` and mutates it during render. With React 19 + Strict Mode this can silently corrupt closures; the official replacement is `useEffectEvent` (React 19 stable).
- **Dead code**: `ProfilePictureUpload.tsx` (212 LOC) is never imported anywhere — `Profile.tsx` reimplements the same logic inline.
- **Accessibility code is very thin** outside Radix primitives. The pages have almost no `aria-*` on custom interactive elements (lightbox, score-edit button, drag/resize handles, mobile menu state, image carousels), and many `<img>` tags use generic alt text (e.g., user.name, file.name) without `loading="lazy"`/`decoding="async"`.

---

## Findings

### F-FE-001: No route-level code splitting — entire app ships as one bundle
- **Severity:** high
- **Effort:** small
- **Location:** `client/src/App.tsx:1-34`
- **Issue:** Every page (`Home`, `Shotcounter`, `Team`, `Events`, `Sponsors`, `Profile`, `Attendance`, `AttendanceStatistics`, `Goennermitglieder`, `Harassenlauf`, three admin pages, two overlay pages, `Maintenance`, `Datenschutz`, `Impressum`, `Dienstleistungen`, `Contact`, `NotFound`) is statically imported in `App.tsx`. With Events ~1617 LOC, Goennermitglieder ~1670 LOC, admin/Dashboard ~1008 LOC, the public visitor downloads admin code, attendance code, overlay code, etc., on first paint. Total pages: ~14k LOC of TSX.
- **Recommendation:** Convert `Router()` in `App.tsx` to use `React.lazy()` + a top-level `<Suspense fallback={...}>`. Group routes into 3 chunks: public (Home, Events, Sponsors, Team, Contact, etc.), gated (Profile, Attendance, Goennermitglieder), admin (admin/* + overlay/*).
- **Rationale:** Wouter supports lazy `component` props transparently. React 19 has stable `<Suspense>` for data + lazy — no API changes needed. This is the single highest-ROI change in the audit.

### F-FE-002: God-components — pages mix data fetching, dialogs, forms, and UI
- **Severity:** high
- **Effort:** large
- **Location:** `pages/Goennermitglieder.tsx` (1670), `pages/Events.tsx` (1617), `pages/admin/Dashboard.tsx` (1008), `pages/Team.tsx` (984), `pages/Attendance.tsx` (864), `pages/Shotcounter.tsx` (804), `pages/Profile.tsx` (775), `pages/Harassenlauf.tsx` (774)
- **Issue:** Each of these holds 8–15 `useState` + 4–8 mutation hooks + several dialogs + form logic + lightbox/cropping logic + render. `Events.tsx` defines `LazyImage` and `SmartCoverImage` inline (lines 100–221) — both reusable. `Profile.tsx` reimplements image crop logic that `Team.tsx` already does via `react-easy-crop`. `Goennermitglieder.tsx` and `Team.tsx` each carry their own member-row + edit-dialog code.
- **Recommendation:** Extract per page:
  - dialogs → `components/<domain>/CreateEventDialog.tsx`, `EditMemberDialog.tsx`, …
  - lightbox → `components/Lightbox.tsx` (shared with future galleries)
  - `LazyImage`, `SmartCoverImage` → `components/ui/lazy-image.tsx` (or `image.tsx` with `loading="lazy"` `decoding="async"` by default)
  - cropper UI → `components/ImageCropper.tsx`
  - admin permission rows / feature-toggle rows → `components/admin/*`
- **Rationale:** Pages should orchestrate, not implement. The "components/ui already exists, use it" rule in `client/src/CLAUDE.md` is being violated because higher-level reusable pieces never made it out of the pages.

### F-FE-003: No `Suspense` boundaries — every loading state is a manual `Loader2` spinner
- **Severity:** medium
- **Effort:** medium
- **Location:** every page; e.g. `pages/admin/Dashboard.tsx:284-289`, `pages/Team.tsx`, `pages/Events.tsx`, `pages/Profile.tsx`
- **Issue:** Loading is handled with `isLoading`/`loading &&` branches everywhere. React 19's pattern is `<Suspense fallback={<Skeleton/>}>` around each section. tRPC v11 supports `useSuspenseQuery`.
- **Recommendation:** Once F-FE-001 lands (lazy routes), wrap content sections in `<Suspense>` and migrate hot-path queries to `trpc.<...>.useSuspenseQuery`. Keep `<ErrorBoundary>` per section (currently only one at root).
- **Rationale:** Lets Vite split the bundle further and consolidates the dozens of bespoke spinners into a single skeleton component per section.

### F-FE-004: Forms hand-rolled with `useState` — React Hook Form + Zod is configured but unused
- **Severity:** high
- **Effort:** large
- **Location:** `pages/Contact.tsx:18-58`, `pages/Events.tsx:245-252,428-463`, `pages/Goennermitglieder.tsx` (member form), `pages/Team.tsx`, `pages/Profile.tsx`, `pages/Shotcounter.tsx`, `pages/admin/UserManagement.tsx`. Only consumer of `useForm` is `components/ui/form.tsx` (the shadcn wrapper).
- **Issue:** Every form uses a `useState` per field, `onChange={e => setX(e.target.value)}`, ad-hoc client-side validation (regex for email in `Contact.tsx:47`, length checks elsewhere), and relies on `parseErrorMessage` to extract Zod errors from the server response and toast them. No field-level error UI, no controlled vs uncontrolled consistency, lots of boilerplate.
- **Recommendation:** Adopt `useForm({ resolver: zodResolver(schema) })` consistently. Re-export the **same** Zod schemas the tRPC procedures use from `shared/` so client & server share validation. Use `<Form>` / `<FormField>` from `components/ui/form.tsx` everywhere.
- **Rationale:** Eliminates dozens of `useState` calls, gives free field-level errors, removes the need for `parseErrorMessage` for client-side validation, single source of truth for validation rules.

### F-FE-005: `useAuth` writes to `localStorage` inside `useMemo`
- **Severity:** high
- **Effort:** small
- **Location:** `client/src/_core/hooks/useAuth.ts:44-48`
- **Issue:**
  ```ts
  const state = useMemo(() => {
    localStorage.setItem('manus-runtime-user-info', JSON.stringify(meQuery.data));
    return { ... };
  }, [...]);
  ```
  A `useMemo` callback must be pure. Strict Mode double-renders will write twice; future React features (Compiler, concurrent rendering, transitions) may discard the memo and re-execute it arbitrarily. Also: the key prefix `manus-runtime-` is a leftover from the Manus.im scaffold (cf. `const.ts` comment).
- **Recommendation:** Move the write into a `useEffect(() => { localStorage.setItem(...) }, [meQuery.data])`, or remove it entirely — nothing else in the codebase reads `manus-runtime-user-info`.
- **Rationale:** React 19 contract violation. Fixing it is a 3-line change.

### F-FE-006: `useAuth` hard-redirects via `window.location.href`, bypassing Wouter
- **Severity:** medium
- **Effort:** small
- **Location:** `client/src/_core/hooks/useAuth.ts:63-77`; also `pages/Profile.tsx`, `pages/Goennermitglieder.tsx` use `getLoginUrl()` which → `/api/auth/google` (full page nav, acceptable for OAuth) but other call sites use the same hook to redirect to internal SPA paths.
- **Issue:** Even when `redirectPath` is a SPA route, `window.location.href = ...` causes a full reload. Also `Navigation.tsx:62` does `window.location.href = '/'` after logout instead of `setLocation('/')`.
- **Recommendation:** Inject the navigator (`useLocation()[1]` from Wouter) and use it for internal paths; only use `window.location.href` for cross-origin (OAuth) redirects. Add a small `isExternalUrl()` helper.

### F-FE-007: `usePersistFn` is an anti-pattern — replace with React 19 `useEffectEvent`
- **Severity:** medium
- **Effort:** small
- **Location:** `client/src/hooks/usePersistFn.ts`, used by `client/src/hooks/useComposition.ts`
- **Issue:** Mutates `fnRef.current` on every render and stores the function in a second ref that is initialized lazily. Documented purpose ("reduce cognitive load over `useCallback`") is no longer relevant in React 19 — `useEffectEvent` ([React docs, stable in 19](https://react.dev/reference/react/useEffectEvent)) is exactly this primitive and is compiler-aware.
- **Recommendation:** Remove `usePersistFn` entirely. In `useComposition`, use `useEffectEvent` for the handlers or just `useCallback` — the handlers are CompositionEvent handlers that don't need to outlive a render. The `any` typing in `usePersistFn` also weakens types.
- **Rationale:** Removes a brittle 20-line hook in favour of a 0-line stdlib.

### F-FE-008: tRPC queries called per-component with inconsistent `staleTime` — duplicates fetching
- **Severity:** medium
- **Effort:** medium
- **Location:** `useAuth.ts:16-19` (`auth.me`), `usePermissions.ts:14-19` and `36-43` (twice), `useNavVisibility.ts:17-19`, `Home.tsx:52`, `Navigation.tsx:56`, `App.tsx:103`, `admin/Dashboard.tsx:145-172`
- **Issue:**
  - `trpc.permissions.getMyPermissions.useQuery` is called inside `usePermission(key)` and `useUserPermissions()` independently — every call mounts its own query observer (React Query dedupes by key, but `staleTime` differs in spots).
  - `trpc.features.list` is fetched in `Home.tsx`, `Navigation.tsx`, `useNavVisibility.ts`, `admin/Dashboard.tsx`, each with their own `staleTime`. `App.tsx` then calls `features.get` separately for `maintenance_mode`. That's two queries for the same row.
  - `auth.me` has `refetchOnWindowFocus: false` but no `staleTime` — refetches on every mount even within the same session.
- **Recommendation:**
  - Set a global default in `main.tsx` `QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false }}})`.
  - Replace the duplicate `features.get` call in `App.tsx` with a `select` on the cached `features.list`.
  - In `usePermission(key)`, derive from a single cached `getMyPermissions` query — currently good (React Query dedupes), but unify `staleTime: 30 * 1000` across both hooks (or remove `refetchOnMount`).

### F-FE-009: `useEffect` orchestrates feature-toggle seeding from the client
- **Severity:** medium
- **Effort:** small
- **Location:** `pages/admin/Dashboard.tsx:259-273`
- **Issue:** An admin loading the page triggers `createFeatureMutation.mutate(...)` for each `DEFAULT_FEATURES` row that doesn't exist. This is server-state seeding done in client `useEffect` — races between admins are possible, and the `useEffect` deps include `featureToggles` which changes after each create → potential re-trigger (mutation is fire-and-forget, no `enabled` guard).
- **Recommendation:** Move default-feature seeding into a server migration / startup hook. The admin UI should only read & toggle.
- **Rationale:** Server state in client side-effects is the most common source of "why did duplicates appear?" bugs.

### F-FE-010: `BeamerModeContext` lives in `App.tsx` and is only used by `Shotcounter`
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/App.tsx:39-50,82,112-127,147-149`, consumed in `pages/Shotcounter.tsx:42,144`
- **Issue:** The context provider, escape-key handler, and route-change exit logic are in `App.tsx`. They concern exactly one route (`/shotcounter`). `App.tsx` carries state and key listeners for a page that may not even be mounted.
- **Recommendation:** Move the context provider into `pages/Shotcounter.tsx` (or wrap that route with a `<BeamerModeProvider>`). Keeps cross-cutting concerns out of `App.tsx`.

### F-FE-011: `ErrorBoundary` shows raw stack to end users
- **Severity:** medium
- **Effort:** small
- **Location:** `client/src/components/ErrorBoundary.tsx:36-40`
- **Issue:** `{this.state.error?.stack}` is rendered for any visitor. In production this leaks server hostnames, file paths, env-specific code. It also doesn't `console.error` the error (no Sentry, no GA event).
- **Recommendation:** Show a friendly message + reload button always; render `error.stack` only when `import.meta.env.DEV`. Call `componentDidCatch(error, info)` to log to a monitoring sink.

### F-FE-012: `useSEO` mutates the document directly and resets to a hard-coded default on unmount
- **Severity:** medium
- **Effort:** medium
- **Location:** `client/src/hooks/useSEO.ts`
- **Issue:** 130 lines of manual `document.querySelector` and `meta` element creation. The unmount cleanup resets `<title>` to a hard-coded Jogge-di-Balla string and tries to clean up only some tags. With concurrent rendering / strict-mode double-effects, races are likely. There is no SSR — fine — but this duplicates work React 19 ships natively.
- **Recommendation:** React 19 natively supports `<title>`, `<meta>`, `<link>` rendered inside components (they hoist to `<head>` automatically). Replace `useSEO()` with a tiny `<SEO title=... description=... />` component that renders those tags as JSX. Removes 100+ LOC and removes all the imperative DOM mutation. ([React docs: special tags in head](https://react.dev/reference/react-dom/components/title))

### F-FE-013: `<img>` tags ship without `loading="lazy"`, `decoding="async"`, or sizing
- **Severity:** medium
- **Effort:** small
- **Location:** Almost everywhere except `pages/Events.tsx:LazyImage` (which uses IntersectionObserver). Only 3 files use `loading=` / `lazy=` / `decoding=` attributes. Examples: `pages/admin/Dashboard.tsx:386-390` (user avatars), `components/Footer.tsx`, `pages/Sponsors.tsx`, `pages/Team.tsx`.
- **Issue:** Every uploaded photo, sponsor logo, and team picture loads eagerly. The custom `LazyImage` in `Events.tsx` reimplements what the browser does natively for free.
- **Recommendation:** Make a `components/ui/image.tsx` wrapper that defaults to `loading="lazy"` `decoding="async"` and accepts explicit `width`/`height` (prevents CLS). Replace the inline `LazyImage` IntersectionObserver implementation with native lazy loading unless there's a measured reason to keep it.

### F-FE-014: `pages/Events.tsx:479` casts to `any` to access `event.eventLinks`
- **Severity:** medium
- **Effort:** small
- **Location:** `pages/Events.tsx:479` — `parsedLinks = JSON.parse((event as any).eventLinks || '[]');`. Also several `any` types in mutation callbacks (`Contact.tsx:34`, `Goennermitglieder.tsx`, `Harassenlauf.tsx`, `Profile.tsx`, `Sponsors.tsx`, `Team.tsx`, `errorMessages.ts:87`).
- **Issue:** The Drizzle row already types `eventLinks` (or should). Storing JSON-as-text on the server then `JSON.parse`-ing on the client and `any`-casting is fragile.
- **Recommendation:** Make the server parse `eventLinks` once (Drizzle column with `mode: 'json'`, or a tRPC `.transform`) and ship a typed `EventLink[]` to the client. Remove the `any` cast.

### F-FE-015: Dead component — `ProfilePictureUpload.tsx` (212 LOC) never imported
- **Severity:** medium (dead code)
- **Effort:** small
- **Location:** `client/src/components/ProfilePictureUpload.tsx`
- **Issue:** No file imports it. `Profile.tsx` reimplements the same dialog + upload + crop flow inline (~150 LOC of duplicate logic, plus a custom transform-based crop).
- **Recommendation:** Either delete `ProfilePictureUpload.tsx` or refactor `Profile.tsx` to use it (preferred — then enhance it with the crop UI that `Profile.tsx` has).

### F-FE-016: `useComposition` hook (81 LOC) and `usePersistFn` (20 LOC) used only by stock shadcn `input.tsx` / `textarea.tsx`
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/hooks/useComposition.ts`, `client/src/hooks/usePersistFn.ts`
- **Issue:** Both are Manus.im scaffold leftovers (Chinese comments "使用两层 setTimeout 来处理 Safari 浏览器中 compositionEnd 先于 onKeyDown 触发的问题", "在 composition 状态下，阻止 ESC 和 Enter…"). They paper over a Safari IME race that almost never affects this app's audience (German-speaking, Latin-script). The double `setTimeout` is a code smell.
- **Recommendation:** Audit whether any user actually needs IME composition support. If not, strip both hooks and inline the simpler handlers in `input.tsx`/`textarea.tsx`. If kept, replace `usePersistFn` with `useEffectEvent` (see F-FE-007).

### F-FE-017: `App.tsx` has 3 chained `useEffect`s that should be merged or eliminated
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/App.tsx:88-127`
- **Issue:**
  - `useEffect([consent.analytics, isLoaded])` toggles GA — fine.
  - `useEffect([location, isBeamerMode])` exits beamer mode on route change — derived state; could be handled inside the consumer of `useBeamerMode` or by resetting on Shotcounter unmount.
  - `useEffect([isBeamerMode])` attaches Escape listener — only relevant inside `/shotcounter`. Move to that page (also F-FE-010).
- **Recommendation:** Move the two beamer-related effects into `pages/Shotcounter.tsx`. App-level effects should be app-level concerns only.

### F-FE-018: `Navigation.tsx` triggers smooth scroll on every location change
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/components/Navigation.tsx:51-53`
- **Issue:** `useEffect(() => window.scrollTo({top:0, behavior:'smooth'}), [location])`. On a hash-link change (when later added) or back-button navigation this would override the natural scroll restoration. Also visually slow ("smooth") on tab navigation.
- **Recommendation:** Use `behavior: 'instant'` (or no behavior — default) and gate on `pathname` only, not the full location tuple.

### F-FE-019: `Home.tsx` reads `window.matchMedia` during render
- **Severity:** medium
- **Effort:** small
- **Location:** `client/src/pages/Home.tsx:74-79`
- **Issue:**
  ```ts
  const isDark = resolvedTheme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  ```
  `window.matchMedia` is called every render. `ThemeContext` already exposes `resolvedTheme` (which is computed from system pref). The `theme === 'system' && matchMedia...` branch is redundant.
- **Recommendation:** Just use `resolvedTheme === 'dark'`. Removes the SSR-unsafe call (even though no SSR here today).

### F-FE-020: Accessibility — custom interactive elements have no `aria-*`/`role`
- **Severity:** medium
- **Effort:** medium
- **Location:** `pages/Shotcounter.tsx:122-130` (score `<button>` without `aria-label`); `pages/Events.tsx` lightbox container (no `role="dialog"`, no `aria-modal`, no focus trap, no `aria-label` for prev/next buttons); `pages/Team.tsx` crop area; `components/Navigation.tsx` mobile menu button (no `aria-expanded`, `aria-controls`). Across the codebase only 64 `aria-*`/`role` occurrences and the vast majority are inside `components/ui/*` (Radix wrappers).
- **Recommendation:** Add `aria-label` for icon-only buttons (`<X />` close, `<ChevronLeft/>` prev, `<ChevronRight/>` next, `<Plus/>` increment). Lightbox should use the existing Radix `Dialog` (already imported) instead of a hand-rolled overlay — gets focus trap + `aria-modal` for free. Mobile menu button needs `aria-expanded={mobileMenuOpen}` and `aria-controls="mobile-nav"`.

### F-FE-021: `framer-motion` imported per-page; bundle bloat
- **Severity:** low
- **Effort:** small
- **Location:** every page imports `motion`, `AnimatePresence` directly; each defines `const MotionDiv = motion.div` locally
- **Issue:** Eight pages duplicate the `const MotionDiv = motion.div` pattern. Framer Motion is ~50 KB gzipped — being bundled into the main chunk because there is no lazy loading.
- **Recommendation:** Either (a) export a single `MotionDiv`/`MotionCard` from `components/ui/motion.tsx`, or (b) replace simple `initial/animate` patterns with CSS keyframes (Tailwind 4 `@keyframes` works inline). After F-FE-001, this matters less; until then it doubles the entry-bundle.

### F-FE-022: Inline `style={{ ... }}` for things Tailwind already supports
- **Severity:** low
- **Effort:** small
- **Location:** `pages/overlay/SdkOverlay.tsx` (22 occurrences), `pages/Home.tsx:88-97` (background pattern + radial-gradient — radial-gradient ok inline, but pattern repeat could be a class), `pages/Events.tsx:201-203`, `pages/Profile.tsx`
- **Issue:** `SdkOverlay.tsx` is the worst offender — 22 inline styles in a single overlay page. Tailwind 4 supports arbitrary values like `bg-[url(...)]` and `bg-[length:1129px_610px]`.
- **Recommendation:** Migrate to Tailwind arbitrary values; reserve inline `style` for genuinely dynamic numeric values (e.g., `style={{ transform: \`scale(${cropScale})\` }}`).

### F-FE-023: `useIsMobile` returns `false` on the first render (always)
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/hooks/useMobile.tsx:5-21`
- **Issue:** Initial state is `undefined`; the effect only sets it after mount. `return !!isMobile` therefore returns `false` on SSR/hydration/first paint, even on phones — causing a flash of desktop layout.
- **Recommendation:** Initialize lazily: `useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)`. Or use a CSS media query (this project is client-only, so CSS is preferable).

### F-FE-024: `ThemeContext` has two effects that fight each other
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/contexts/ThemeContext.tsx:52-71`
- **Issue:** One effect listens to media query change when `theme === 'system'`; another sets `resolvedTheme` when `theme` changes. Both run on theme change. Could be one `useEffect` that derives `resolvedTheme` and subscribes only when needed. Initial `useState` also reads `window.matchMedia` — SSR-unsafe (not used today, but the early-return guard in `getSystemTheme` is then mirrored elsewhere inconsistently).
- **Recommendation:** Use `useSyncExternalStore` for the system-pref subscription — it's the React-19-idiomatic primitive for external mutable values. Removes both effects.

### F-FE-025: `parseErrorMessage(error: any)` weakens types app-wide
- **Severity:** low
- **Effort:** small
- **Location:** `client/src/lib/errorMessages.ts:87`
- **Issue:** Signature is `any`. Every mutation `onError` callback then takes `any` and propagates. tRPC v11 errors are typed (`TRPCClientErrorLike<AppRouter>`).
- **Recommendation:** Type the parameter as `unknown` and narrow with `instanceof TRPCClientError`. Provides type-safe `.data?.code` access (which the function already uses by string-matching message contents — fragile).

---

## Cross-Domain Notes

- **Tests:** No frontend tests exist (confirmed in `CLAUDE.md`). After F-FE-002 / F-FE-004 the extracted components are pure enough that React Testing Library + Vitest would be cheap to add — out of scope for this audit but worth flagging.
- **Build / bundle:** The biggest single performance win (F-FE-001 lazy routes) also unlocks F-FE-003 (Suspense). Recommend doing them as one PR.
- **Security:** The `ErrorBoundary` stack leak (F-FE-011) is the only code-quality finding with a security flavour — defer to the security agent for the final call.
- **UI/visual:** Inline styles (F-FE-022) and motion duplication (F-FE-021) overlap with the visual consistency agent's scope; this report flags only the code-quality angle.
- **Manus.im scaffold leftovers:** `useComposition`, `usePersistFn`, `localStorage['manus-runtime-user-info']`, the long comment block in `const.ts`, the `'/' + 'api/auth/google'` indirection, and the chinese-language comments are all artifacts of a Manus template that was never fully scrubbed. Worth a sweep.

---

## Methodology

1. Enumerated `client/src/**/*.{ts,tsx}` via Glob; bucketed by `pages/`, `components/`, `components/ui/`, `hooks/`, `contexts/`, `lib/`, `_core/`.
2. Read entry points (`main.tsx`, `App.tsx`) and global plumbing (`lib/trpc.ts`, `contexts/ThemeContext.tsx`, `_core/hooks/useAuth.ts`, `_core/hooks/useCookieConsent.ts`, `_core/googleAnalytics.ts`).
3. Counted LOC per page/component to identify god-components.
4. Greps:
   - `forwardRef` → only 2 hits, both in `ui/` (good).
   - `\bany\b` → 24 hits across 12 files.
   - `as <Type>` casts → 145 hits across 67 files (most are `as const` / Radix `as` prop — manually filtered).
   - `useTransition|useOptimistic|useFormStatus|useActionState|^use\(` → **0 hits** (no React 19 idioms).
   - `Suspense|lazy\(` → **0 hits**.
   - `useForm|zodResolver` → only `components/ui/form.tsx`.
   - `aria-|role=` → 64 hits, ~95% in `components/ui/*` (Radix).
   - `<img\s` → no direct hits via Grep due to escaping, but spot-checked in `Dashboard.tsx`, `Footer.tsx`, `Home.tsx`, `Sponsors.tsx`, `Team.tsx`.
   - `style=\{\{` → 37 hits (22 in `SdkOverlay.tsx`).
   - `useEffect` → 57 occurrences across 24 files.
   - `staleTime|enabled:|refetchOn` → 23 occurrences across 12 files; cross-checked for inconsistency.
5. Sampled all pages >700 LOC for structural issues; read first 100–200 lines of each.
6. Verified dead code with explicit Grep for component names (`ProfilePictureUpload` → only self-import).
