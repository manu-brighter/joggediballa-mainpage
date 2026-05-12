import { publicProcedure, router } from './trpc';

// System-level tRPC procedures (liveness, etc.).

export const systemRouter = router({
  // B-P1-08 / F-BE-025: parameterless liveness probe. Uptime / k8s probes
  // cannot supply an input on a tRPC query, so the previous `timestamp`
  // argument made this useless. We keep the procedure as a public query
  // returning a small status payload.
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    time: new Date().toISOString(),
  })),
});
