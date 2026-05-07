import { z } from 'zod';
import { publicProcedure, router } from './trpc';

// System-level tRPC procedures. Earlier versions also exposed a `notifyOwner`
// admin mutation that POSTed to the Manus Forge SendNotification endpoint.
// That procedure had no UI consumers and was removed along with
// server/_core/notification.ts.

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, 'timestamp cannot be negative'),
      }),
    )
    .query(() => ({
      ok: true,
    })),
});
