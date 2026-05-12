# CLAUDE.md — client/src/

This file provides guidance to Claude Code when working in `client/src/`.

## tRPC Usage

The tRPC client is at `@/lib/trpc` — exports a single `trpc` object:

```typescript
import { trpc } from "@/lib/trpc";

// Query
const { data, isLoading } = trpc.events.list.useQuery();

// Mutation
const mutation = trpc.events.create.useMutation({ onSuccess: () => ... });

// Cache invalidation
const utils = trpc.useUtils();
await utils.events.list.invalidate();
```

Uses `httpBatchStreamLink` (tRPC v11 streaming). Credentials are always sent (`credentials: "include"`). Error handling: errors are logged but do NOT auto-redirect to login — users can browse without auth.

## Auth

Use `useAuth()` from `@/_core/hooks/useAuth`:

```typescript
const { user, isAuthenticated, loading, logout } = useAuth();
```

**Do not** use `useAuth({ redirectOnUnauthenticated: true })` unless the page is intentionally login-gated. Most pages are public.

For permission checks, use `usePermission()` from `@/hooks/usePermissions`:

```typescript
const canEdit = usePermission('edit_events');
```

This fetches from `trpc.permissions.getMyPermissions` and caches for 30s.

## Routing

Uses **Wouter** (not React Router). All routes are in `App.tsx`:

```typescript
import { Route, Switch, useLocation } from 'wouter';

// Navigate programmatically:
const [, navigate] = useLocation();
navigate('/events');
```

All page routes are lazy-loaded via `React.lazy()` and wrapped in a `<Suspense>` boundary with a route fallback. Eagerly loaded: shell (Navigation, Footer, ErrorBoundary, providers, NotFound).

## Beamer Mode

`Shotcounter` page supports a full-screen "Beamer Mode" (projector display). This is controlled via `BeamerModeContext` in `App.tsx`. Access with `useBeamerMode()` from `App.tsx`. Beamer mode hides Navigation and Footer and auto-exits on route change or Escape key.

## Feature Toggles / Maintenance Mode

`trpc.features.get.useQuery({ featureName: "..." })` returns `{ isEnabled: boolean }`. In `App.tsx`, `maintenance_mode` feature flag gates all unauthenticated access. Other feature flags can be added to `featureToggles` table.

## SEO

Render the `<SEO />` component from `@/components/SEO` near the top of the page's JSX:

```tsx
<SEO
  title="Jogge di Balla - Events"
  description="..."
  keywords="..."
  noIndex // optional, for admin / auth-only pages
/>
```

React 19 natively hoists `<title>` and `<meta>` tags to `<head>` and removes them on unmount — no DOM imperatives. Defaults come from `client/index.html`.

## Component Conventions

- UI primitives: shadcn/ui in `@/components/ui/` (do not re-implement — check there first)
- Toast notifications: `import { toast } from "sonner"` (not react-hot-toast, not useToast)
- Icons: Lucide React — `import { Edit, Trash2, ... } from "lucide-react"`
- Tailwind v4 via `@tailwindcss/vite` (no config file, uses CSS `@import "tailwindcss"`)
- Theme: `useTheme()` from `@/contexts/ThemeContext` — dark/light/system

## Design Tokens — three-layer system

All color tokens live in `index.css`:

- **Layer 1 (primitives)** — raw scales: `--teal-50..900`, `--coral-50..900`,
  `--neutral-0..950`, `--twitch-light`, `--twitch-dark`. **Never reference
  these directly in JSX/Tailwind classes** — they are only the source of
  Layer 2 mappings.

- **Layer 2 (semantic)** — shadcn-style intent names mapped to Layer 1.
  Use these in code:

  | Token | When to use |
  | --- | --- |
  | `bg-primary`, `text-primary` | Main brand color (teal). Default CTAs. |
  | `bg-coral`, `text-coral` | Secondary brand accent. Hearts, highlight pills, brand-tinted blobs. |
  | `bg-secondary`, `text-secondary` | **Muted neutral** (shadcn semantic). Secondary buttons, badges. |
  | `bg-accent`, `text-accent` | Subtle hover/highlight backdrop. Used by dropdown / menu / command hover states. |
  | `bg-muted`, `text-muted-foreground` | De-emphasised surfaces, captions, helper text. |
  | `bg-card`, `bg-popover` | Container surfaces. |
  | `bg-destructive` | Errors, failed states, delete buttons. (red) |
  | `bg-warning` | Future-caution states: drafts, expiring memberships, cancellation policies. (yellow) |
  | `bg-pending` | Either (a) in-progress / awaiting-action — provisional members, unpaid invoices — or (b) design-intent attention/emphasis on a non-critical advisory block (e.g. the Harassenlauf "Regeln" panel). The orange reads as "look at me" without escalating to a true caution. (orange) |
  | `bg-success` | Confirmation states. (green) |
  | `bg-brand`, `bg-twitch` | Brand aliases for niche cases (e.g. Twitch overlay). |

- **Layer 3 (Tailwind theme)** — `@theme inline` block at the top of
  `index.css` exposes Layer 2 as Tailwind utility classes (`text-primary`,
  `bg-coral/10`, `border-coral`, etc.).

**Do NOT use raw Tailwind palette colors** (`text-red-500`, `bg-orange-500`,
`text-[#0B93A7]`) — every color must go through Layer 2 so dark mode and
future theme swaps work automatically.

## Path Aliases

| Alias      | Maps to             |
| ---------- | ------------------- |
| `@/`       | `client/src/`       |
| `@shared/` | `shared/`           |
| `@/_core/` | `client/src/_core/` |
