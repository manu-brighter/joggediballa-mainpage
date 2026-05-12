# UI / Design Consistency Audit Report

**Date:** 2026-05-12
**Auditor:** Senior Product Designer (subagent)
**Branch:** refactor/full-audit-2026-05
**Scope:** `client/src/` — pages, shared components, design tokens, motion, a11y, responsive

---

## Executive Summary

- **The token system is strong but bypassed.** `index.css` defines a clean OKLCH-based token system (primary/secondary/coral/teal/warning/success, dark-mode parity) — but multiple pages bypass it with hex literals (`#0B93A7`, `#E93F56`, `#9146FF`, `#1a1a19`, `#f8f8f7`) and raw Tailwind palette colors (`text-red-500`, `bg-blue-600`, `bg-orange-500`, `text-slate-900`). Across 17 files there are **88 occurrences** of raw-palette utility classes that should be semantic tokens.
- **`NotFound.tsx` is a complete design-system escape.** It uses `from-slate-50`, `bg-blue-600`, `text-slate-900`, `text-red-500` and inline button styling — none of which are dark-mode aware. It is the single worst offender for design-system fidelity.
- **Loading states are inconsistent.** A `Spinner` UI primitive and a `Skeleton` primitive both exist but pages mostly hand-roll `<Loader2 className="h-8 w-8 animate-spin text-primary" />` (17 occurrences). Skeletons are used in only 2 places (`DashboardLayoutSkeleton`, admin Dashboard cards). Most async lists go from blank → content with no skeleton state.
- **Heading scale is improvised per page.** No `<Heading>` primitive. H1 sizes vary widely: `text-3xl`, `text-4xl md:text-5xl`, `text-4xl md:text-5xl font-black`, `text-4xl sm:text-5xl lg:text-6xl xl:text-7xl`. Some pages use `font-bold`, others `font-black`. There is no documented type scale.
- **Page-container pattern is repeated but slightly different on every page.** `container py-12 space-y-8`, `container py-8 max-w-7xl`, `container py-8 space-y-8 overflow-x-hidden max-w-full`, `container py-8 md:py-12 space-y-8`, `container py-12 space-y-12`. A `<PageContainer>` / `<Section>` primitive would eliminate ~15 lines of duplication and enforce rhythm.
- **Hero/background decoration is copy-pasted three times** in `Home.tsx`, `Harassenlauf.tsx` (twice — submitted + form view) — identical pattern image, two `radial-gradient` overlays, two floating blobs. Strong candidate for a `<HeroBackdrop>` component.
- **`prefers-reduced-motion` is not respected anywhere** — framer-motion is used in 14 files, plus 8+ CSS keyframe animations (`animate-pulse`, `fadeIn`, `slideIn`, `glow-pulse`, `scaleIn`). No `useReducedMotion()` hook, no `@media (prefers-reduced-motion)` guard. This is an a11y blocker.
- **Inline form validation is uniformly handled via toast** (`toast.error('Bitte fülle alle Pflichtfelder aus')`) rather than inline field errors. Reasonable for short forms, but `Field`/`form` primitives exist in `components/ui/` and are not used — meaning React Hook Form + Zod (stated convention in CLAUDE.md) is **not actually used** in `Contact.tsx`, `Sponsors.tsx`, `Team.tsx`, `Harassenlauf.tsx`.

---

## Findings

### F-UI-001: `NotFound.tsx` ignores the design system entirely

- **Severity:** high
- **Effort:** small
- **Location:** `client/src/pages/NotFound.tsx:13-49`
- **Issue:** Hardcoded slate gradient, hardcoded blue button (`bg-blue-600 hover:bg-blue-700`), `text-red-500`, no dark-mode awareness. Page also bypasses `<Button>` defaults by inline-styling color and shadow. English text on an otherwise German site.
- **Recommendation:** Rewrite with semantic tokens (`bg-background`, `bg-destructive/10`, `text-destructive`, `<Button>` default variant), translate to German to match the site, drop the manual color choices on the inner button.
- **Rationale:** This is the page users land on most often when something goes wrong. It currently looks like a different product.

### F-UI-002: Hex-literal colors in `CookieConsentBanner` and `ManusDialog`

- **Severity:** high
- **Effort:** small
- **Location:**
  - `client/src/components/CookieConsentBanner.tsx:57,79,202,213`
  - `client/src/components/ManusDialog.tsx:54,70,76,85`
- **Issue:** `text-[#0B93A7]`, `bg-[#0B93A7]`, `text-[#34322d]`, `bg-[#1a1a19]`, `bg-[#f8f8f7]` — `#0B93A7` is approximately the primary teal token. The Manus dialog colors look like leftover scaffolding-template defaults.
- **Recommendation:** Replace `#0B93A7` with `text-primary`/`bg-primary`, replace Manus dialog grays with `bg-popover text-popover-foreground` / `text-muted-foreground` so dark mode works.
- **Rationale:** `ManusDialog` currently has no dark-mode story — the off-white background will glare against the dark UI. The cookie banner already has `dark:hover:text-[#0a7a8a]` partial coverage but the base teal stays the same in dark mode where it should lighten (`oklch(0.65 0.14 195)`).

### F-UI-003: `SdkControl.tsx` / `SdkOverlay.tsx` use hex literals for player colors

- **Severity:** medium
- **Effort:** small
- **Location:** `client/src/pages/overlay/SdkControl.tsx` (10 hits), `SdkOverlay.tsx` (33 inline `style={{}}` blocks)
- **Issue:** `#E93F56` (player 1 red) and `#0B93A7` (player 2 teal) repeated as string literals. Many sibling inline-style objects with backgrounds, borders, transforms.
- **Recommendation:** Introduce two named tokens `--color-player-1` / `--color-player-2` (or reuse `--coral`/`--teal` which are already defined and nearly identical) and add Tailwind utilities via the `@theme` block. Move repeated inline styles to either Tailwind utility classes or a small set of CVA variants.
- **Rationale:** These two pages are the overlay/control surface — they're externally visible. Keeping the player colors as semantic tokens makes a future re-skin (or e.g. team-A/team-B swap) a one-line change.

### F-UI-004: Twitch button uses brand hex on `Home.tsx`

- **Severity:** low
- **Effort:** small
- **Location:** `client/src/pages/Home.tsx:476`
- **Issue:** `bg-[#9146FF]/10 border-[#9146FF]/30 text-[#9146FF]` for the Twitch CTA. Defensible (Twitch brand color) but the value is repeated four times.
- **Recommendation:** Define `--color-twitch: #9146FF` in `index.css` and reference once. Same applies if Instagram brand color is hard-coded elsewhere.

### F-UI-005: Raw Tailwind palette colors used instead of semantic tokens

- **Severity:** high
- **Effort:** medium
- **Location:** 17 files, 88 occurrences. Worst offenders: `Goennermitglieder.tsx` (21), `admin/Dashboard.tsx` (13), `AttendanceSessionCard.tsx` (6), `Home.tsx` (8 hits via search), `admin/UserManagement.tsx` (6).
- **Issue:** Frequent usage of `text-green-500`, `text-red-500`, `bg-orange-500/10`, `text-orange-700 dark:text-orange-300`, `bg-yellow-50` etc. when `--success`, `--warning`, `--destructive` tokens already exist.
- **Recommendation:** Add a small migration:
  - `text-green-*` → `text-success` (or `text-success-foreground` on success bg)
  - `text-red-*` → `text-destructive`
  - `text-orange-*`/`bg-yellow-*` → `text-warning` / `bg-warning/10`
  - For the visitor banner (`Navigation.tsx:472-480`), use `bg-warning/10 border-warning/20 text-warning-foreground`.
- **Rationale:** Dark mode currently breaks subtly (`text-red-500` is unreadable on `--card` in dark mode; `text-orange-700 dark:text-orange-300` is the workaround pattern, but it's per-occurrence rather than tokenized).

### F-UI-006: No `<PageContainer>` / `<Section>` primitive

- **Severity:** medium
- **Effort:** small
- **Location:** All pages
- **Issue:** Every page opens with a slightly different `container py-X space-y-Y` combination. There's also a custom `.container` rule in `index.css` that overrides Tailwind's container — non-obvious to a new dev.
- **Recommendation:** Add `client/src/components/ui/page.tsx` exporting `<PageContainer size="default|narrow|wide" padding="default|tight">` and `<PageHeader title description icon>`. Migrate pages one at a time.
- **Rationale:** Vertical rhythm currently varies by page (py-8, py-12, py-8 md:py-12). A primitive would also let you add scroll-to-top, page-transition animation, and SEO defaults in one place.

### F-UI-007: No `<Heading>` primitive — H1 sizes diverge

- **Severity:** medium
- **Effort:** small
- **Location:** see Grep dump in methodology
- **Issue:** H1 ranges from `text-3xl font-bold` (Attendance, AttendanceStatistics, admin pages) to `text-4xl md:text-5xl font-bold` (Contact, Datenschutz, Impressum) to `text-4xl md:text-5xl font-black` (Events, Sponsors, Dienstleistungen, Goennermitglieder) to `text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black` (Home). Mix of `font-bold` and `font-black` for "main heading" with no rule.
- **Recommendation:** Define a 3-tier type scale (display / page-title / section-title) in `@theme` or via a `<Heading level={1|2|3} variant="display|page|section">` component. Pages route their style through that.
- **Rationale:** Brand voice (festive, bold) currently varies — Home reads like a landing page, admin pages read like a back office. Both are fine, but the *transition* between them looks like two different apps because the heading size jumps from 5xl to 3xl as you click "Anwesenheit".

### F-UI-008: Hand-rolled Loader2 spinners instead of `<Spinner>` primitive

- **Severity:** medium
- **Effort:** small
- **Location:** 17 occurrences across `Events.tsx`, `Profile.tsx`, `Sponsors.tsx`, `Team.tsx`, `admin/Dashboard.tsx`, `ProfilePictureUpload.tsx`
- **Issue:** `Spinner` exists in `components/ui/spinner.tsx` (per the file listing) and is never imported by any page. Pages all do `<Loader2 className="h-8 w-8 animate-spin text-primary" />` or `h-6 w-6` / `h-4 w-4` variants.
- **Recommendation:** Migrate to `<Spinner size="sm|md|lg" />`. Sizes today are 4/6/8 — keep that scale.
- **Rationale:** Centralizes color (currently each callsite re-specifies `text-primary`, `text-white/70`, none), enables `prefers-reduced-motion` (could swap spin for pulse), and lets you replace lucide-Loader with a custom indicator later.

### F-UI-009: Skeleton primitive exists but is barely used

- **Severity:** medium
- **Effort:** medium
- **Location:** `client/src/components/ui/skeleton.tsx` exists; only `DashboardLayoutSkeleton.tsx` and parts of `admin/Dashboard.tsx` consume it.
- **Issue:** Async list pages (Events, Sponsors, Team, Goennermitglieder, AttendanceStatistics, UserManagement, ActivityLog) all show either a full-screen `<Loader2>` or nothing while loading. Layout shift is visible.
- **Recommendation:** Add `<EventCardSkeleton>`, `<SponsorCardSkeleton>`, `<TeamMemberSkeleton>`, `<TableRowSkeleton>` that mirror their loaded counterparts. Render an array of 6–8 during `isLoading`.
- **Rationale:** This is the highest-perceived-perf upgrade you can ship for the user-facing pages.

### F-UI-010: Empty states absent or ad-hoc; `<Empty>` primitive unused

- **Severity:** medium
- **Effort:** small-medium
- **Location:** `client/src/components/ui/empty.tsx` exists; usage grep returned no page imports.
- **Issue:** Pages either render lists silently when empty or have one-off "Noch keine X" messages without iconography or CTA.
- **Recommendation:** Standardize on `<Empty icon title description action>` and apply to Events, Sponsors, Team, Goennermitglieder, Attendance lists.
- **Rationale:** Consistent empty-state pattern doubles as a discoverability surface for admin-only "create" actions.

### F-UI-011: Error states are toast-only — no inline error UI

- **Severity:** medium
- **Effort:** medium
- **Location:** Contact.tsx, Sponsors.tsx, Team.tsx, Harassenlauf.tsx
- **Issue:** All form errors surface via `toast.error()` (sonner). For multi-field forms, this means the user sees the error but the failing field is not highlighted. There is also no list-level error state when a query fails — `isError` is not handled in the pages I sampled.
- **Recommendation:** Use the existing `Field` / `form.tsx` primitives + react-hook-form + zod (per CLAUDE.md convention) for Contact and Harassenlauf forms. Add an `<ErrorState>` component for failed queries.
- **Rationale:** Toast is great for success and global errors. It is not great for "this email is invalid" — that needs to sit under the field. Currently the page falls back to native HTML5 `required` validation which has inconsistent styling across browsers.

### F-UI-012: `prefers-reduced-motion` not respected

- **Severity:** high (a11y)
- **Effort:** small
- **Location:** global — `index.css` keyframes (lines 240–375), all framer-motion usages
- **Issue:** No global `@media (prefers-reduced-motion: reduce)` block that disables `animate-pulse`, `glow-pulse`, `fadeIn`, `slideInLeft`, `slideInRight`, `scaleIn`. framer-motion respects this via `useReducedMotion()`, which is unused.
- **Recommendation:** Add a single CSS block:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
  Plus a `useReducedMotion()` check on the Home/Harassenlauf hero MotionDivs to skip the entry animation entirely.
- **Rationale:** WCAG 2.3.3 compliance; the floating background blobs on Home and Harassenlauf are large `animate-pulse` elements that some users find genuinely nauseating.

### F-UI-013: Hero/backdrop decoration duplicated three times

- **Severity:** medium
- **Effort:** small
- **Location:** `Home.tsx:84-101`, `Harassenlauf.tsx:226-282` (twice — submitted state + form state)
- **Issue:** The same 5-element decorative stack (`hero-gradient` div + pattern overlay div + 2 radial gradients + 2 floating blur blobs) is copy-pasted. Pattern image path and size hardcoded each time.
- **Recommendation:** Extract `<HeroBackdrop variant="default|festive" />`. Move pattern image constant to a single import. Consider a `<Hero>` layout primitive with a `background` slot.
- **Rationale:** Drift risk — any future change to the brand backdrop needs to be applied N times.

### F-UI-014: Mixed icon-size conventions

- **Severity:** low
- **Effort:** small
- **Location:** entire codebase — 273 occurrences of `h-X w-X` paired patterns in pages
- **Issue:** Same icon used at `h-3 w-3`, `h-3.5 w-3.5`, `h-4 w-4`, `h-5 w-5`, `h-6 w-6`, `h-8 w-8`, `h-12 w-12`, `h-16 w-16`, `h-24 w-24` without a clear semantic scale. Tailwind also offers `size-X` (used by `<Button>`) but pages prefer `h-X w-X`.
- **Recommendation:** Document an icon size scale (xs=3, sm=4, md=5, lg=6, xl=8) and use `size-X` shorthand. Optionally wrap lucide imports in `<Icon size>` helper.
- **Rationale:** Low impact but improves grep-ability and unblocks a future icon-set swap.

### F-UI-015: Focus rings — partial coverage

- **Severity:** medium (a11y)
- **Effort:** small
- **Location:** `index.css:164` (`outline-ring/50` global), individual components
- **Issue:** Global `outline-ring/50` set, but several handwritten anchors and divs with `role="button"` (Goennermitglieder, Events) don't get the focus-visible ring that `<Button>` provides. The visitor banner in Navigation has no focusable element but uses warning colors that suggest interactivity.
- **Recommendation:** Audit all `<a href>` with `className=` that don't pass through `<Button asChild>` or a `Link` styled wrapper. Add `focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2`.
- **Rationale:** Keyboard users currently lose focus indication when tabbing through cards on Events, Sponsors, Team, Goennermitglieder.

### F-UI-016: Inconsistent dark-mode coverage on public pages

- **Severity:** medium
- **Effort:** small
- **Location:** see grep — `NotFound.tsx` (no dark), `Maintenance.tsx` (no `.dark` overrides, relies on tokens), `ManusDialog.tsx` (hardcoded light), `CookieConsentBanner.tsx` (partial), `Goennermitglieder.tsx` (5 `dark:` overrides), `Home.tsx` (1 `dark:` override for pattern opacity).
- **Issue:** Some pages exercise zero dark-mode utilities (which is correct if tokens are used everywhere) — but they're mixed with raw colors that don't switch.
- **Recommendation:** Test every page in dark mode visually. The token system is good; the violations are concentrated in F-UI-001/002/005.

### F-UI-017: `style={{}}` inline styles — 30+ occurrences

- **Severity:** low
- **Effort:** small (overlay) / large (full migration)
- **Location:** `pages/overlay/SdkOverlay.tsx` (28), `SdkControl.tsx` (2), `Events.tsx` (2), `Profile.tsx` (1), `Home.tsx` (1), `Harassenlauf.tsx` (2), `Shotcounter.tsx` (1)
- **Issue:** `SdkOverlay.tsx` is dominated by inline styles. Reasonable for an overlay whose layout is computed (positioning, dynamic sizes), but readability suffers and dark mode is impossible.
- **Recommendation:** For SdkOverlay specifically, accept the inline-style approach but extract a `styles` object at the top so it can be reviewed in one place. Elsewhere (Profile, Events) the inline `style` is for `backgroundImage` URLs only — fine.

### F-UI-018: `<Spinner>` is the canonical loader but Skeletons are the right tool

- **Severity:** low (DX)
- **Effort:** small
- **Location:** documentation gap
- **Issue:** No documented rule for when to use Skeleton vs Spinner. Pages reach for spinners by default.
- **Recommendation:** Add a one-paragraph rule in `client/src/CLAUDE.md` (or a `components/ui/README.md`): use `<Spinner>` for mutations (form submits, button states) and `<Skeleton>` for initial query loads / lists.

### F-UI-019: `<Button>` `size="lg"` is `h-10` but pages override to `h-12` and `h-14`

- **Severity:** medium
- **Effort:** small
- **Location:** `Home.tsx:134` (`h-14`), `Home.tsx:147` (`h-12`)
- **Issue:** CVA `lg` size produces `h-10 px-6`. Hero CTA buttons override to `h-12`/`h-14`. Indicates a missing `xl` size.
- **Recommendation:** Add `xl: 'h-12 rounded-md px-8 text-base'` and `2xl: 'h-14 rounded-md px-10 text-base font-bold'` to the size variants. Migrate Home hero buttons.
- **Rationale:** Eliminates the `btn-animate text-base h-14 px-10 w-full sm:w-auto font-bold` recipe in two pages.

### F-UI-020: Sonner toast is consistent (good) — but `react-hot-toast` / Radix toast leftovers absent

- **Severity:** none (positive finding)
- **Location:** all pages use `import { toast } from 'sonner'`. Grep confirms no `react-hot-toast` or `useToast` callsites. Keep this.

### F-UI-021: Microcopy is consistently German on user-facing pages — `NotFound` is the exception

- **Severity:** low
- **Effort:** trivial
- **Location:** `NotFound.tsx:27-33` — "Page Not Found / Sorry, the page you are looking for doesn't exist."
- **Recommendation:** "Seite nicht gefunden / Die Seite existiert nicht oder wurde verschoben."

### F-UI-022: `:root` `--glow-base` redeclared inside `@layer components`

- **Severity:** low (housekeeping)
- **Effort:** trivial
- **Location:** `client/src/index.css:223-234`
- **Issue:** `:root` and `.dark` are reopened inside the `@layer components` block to declare `--glow-*` variables — they should live next to the rest of the token declarations at the top of the file.
- **Recommendation:** Move into the top-level `:root` / `.dark` blocks (lines 52-160) for consistency.

### F-UI-023: `Navigation` smooth-scroll on every route change can fight `useLocation` jumps

- **Severity:** low
- **Effort:** trivial
- **Location:** `Navigation.tsx:51-53`
- **Issue:** `window.scrollTo({ top: 0, behavior: 'smooth' })` on every route change. On long pages with anchor links this can fight the user.
- **Recommendation:** Use `behavior: 'instant'` (or `auto`) for cross-page nav; reserve smooth scroll for in-page anchors. Also: this should respect `prefers-reduced-motion`.

### F-UI-024: `.container` redefined in `index.css` overriding Tailwind v4 default

- **Severity:** low
- **Effort:** trivial
- **Location:** `client/src/index.css:194-220`
- **Issue:** Tailwind v4 ships a `.container` utility; the project redefines it manually. Works, but unusual — and Tailwind 4 has `@theme` config for `--container-*` that would be the idiomatic answer.
- **Recommendation:** Either configure container in `@theme` (preferred for v4) or document in CLAUDE.md why the manual override exists.

---

## Design System Recommendations

Missing primitives (in order of payoff):

1. **`<PageContainer>` + `<PageHeader>`** — kills 15+ lines of duplication, fixes vertical rhythm.
2. **`<Heading level variant>`** — fixes H1-size chaos; lets you keep festive feel on public pages and quieter feel on admin.
3. **`<HeroBackdrop>`** — three-times duplicated decoration becomes one component; pattern path centralized.
4. **`<EmptyState>`, `<ErrorState>`, list `<Skeleton>` variants** — async pages get their missing two states.
5. **Use existing `<Spinner>`** instead of hand-rolled Loader2.
6. **Brand color tokens for `--color-twitch`, `--color-instagram`** if more social CTAs are coming. Player tokens (`--color-player-1/-2`) for the shotcounter.
7. **`<IconButton>`** — there are several `Button variant="ghost" size="icon"` callsites with extra aria-label handling.
8. **Type scale tokens** in `@theme inline { --text-display: ...; --text-page-title: ...; }` for v4.
9. **Reduced-motion global** + `useReducedMotion()` adoption in framer-motion sections.

Documentation to add to `client/src/CLAUDE.md`:

- When to use Skeleton vs Spinner.
- Forbidden classes (raw palette colors). Approve only `text-foreground/muted-foreground/primary/secondary/destructive/warning/success`.
- Heading levels and the page-container pattern.

---

## Cross-Domain Notes

- **For the routing/state audit:** the global smooth-scroll on every route change (Navigation.tsx:51) is also a UX concern that overlaps with routing.
- **For the a11y audit (if separate):** F-UI-012 (reduced-motion) and F-UI-015 (focus rings on non-Button anchors) are primary handoffs.
- **For the i18n audit (if any):** Site is German except `NotFound.tsx`, the "Since 2022" badge on Home.tsx:113, and a few admin labels. Document a German-first rule with English carve-outs explicit.
- **For the perf audit:** Skeleton adoption (F-UI-009) is the biggest perceived-perf win without touching network.
- **For the architecture audit:** `Events.tsx`, `Goennermitglieder.tsx`, and `Shotcounter.tsx` are 1000+-line files that mix admin and public concerns — they're worth splitting independent of any visual change.

---

## Methodology

- Read `index.css` end-to-end to inventory tokens.
- Listed all files under `client/src/{pages,components}`.
- Grepped for `text-\[#` / `bg-\[#` / `border-\[#` / `style=\{\{` / `dark:` / `framer-motion` / `prefers-reduced-motion` / `Skeleton|isLoading` / `react-hot-toast|useToast` / `<h1|h2|h3 className`.
- Counted raw-palette occurrences with `(text|bg|border)-(green|red|blue|yellow|orange|purple)-` — 88 matches / 17 files.
- Read full source of `Navigation.tsx`, `NotFound.tsx`, `Maintenance.tsx`, `button.tsx`, plus head sections of `Home.tsx`, `Contact.tsx`, `Events.tsx`, `Sponsors.tsx`, `Team.tsx`, `Profile.tsx`, `Harassenlauf.tsx`.
- Did not run the app; visual contrast claims are inferred from the token values and the dark-mode redeclarations in `index.css`.
- No code was modified — audit-only per scope.
