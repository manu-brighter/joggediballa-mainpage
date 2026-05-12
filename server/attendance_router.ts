import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from './_core/trpc';
import { hasPermission } from './permissions';
import {
  listAttendanceSessions,
  getAttendanceSession,
  createAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
  listAttendanceMembers,
  getAttendanceMember,
  createAttendanceMember,
  updateAttendanceMember,
  deleteAttendanceMember,
  reorderAttendanceMembers,
  listAttendanceRecords,
  bulkUpsertAttendanceRecords,
  getAttendanceSetting,
  upsertAttendanceSetting,
  getAttendanceStatistics,
} from './attendance_db';

/**
 * Local copy of the requirePermission middleware factory. Mirrors the one in
 * routers.ts (no shared import to avoid a circular dependency since
 * routers.ts imports this router). A-P0-05 — every mutation here must check
 * `manage_attendance` rather than relying on bare protectedProcedure.
 */
const requirePermission = (permissionKey: string) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await hasPermission(ctx.user.role, permissionKey);
    if (!allowed) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden' });
    }
    return next({ ctx });
  });

const manageAttendance = requirePermission('manage_attendance');

export const attendanceRouter = router({
  // ============================================
  // SESSIONS
  // ============================================

  listSessions: protectedProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return listAttendanceSessions(input?.year);
    }),

  getSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      return getAttendanceSession(input.sessionId);
    }),

  createSession: manageAttendance
    .input(
      z.object({
        date: z.string(), // ISO date string
        title: z.string().min(1).max(500),
        type: z.enum(['meeting', 'event']),
        notes: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return createAttendanceSession({
        date: new Date(input.date),
        title: input.title,
        type: input.type,
        notes: input.notes,
      });
    }),

  updateSession: manageAttendance
    .input(
      z.object({
        sessionId: z.number(),
        date: z.string().optional(),
        title: z.string().min(1).max(500).optional(),
        type: z.enum(['meeting', 'event']).optional(),
        notes: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { sessionId, ...data } = input;
      const updates: any = { ...data };
      if (data.date) {
        updates.date = new Date(data.date);
      }
      await updateAttendanceSession(sessionId, updates);
    }),

  deleteSession: manageAttendance
    .input(
      z.object({
        sessionId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await deleteAttendanceSession(input.sessionId);
    }),

  // ============================================
  // MEMBERS
  // ============================================

  listMembers: protectedProcedure
    .input(
      z
        .object({
          activeOnly: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return listAttendanceMembers(input?.activeOnly ?? true);
    }),

  getMember: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      return getAttendanceMember(input.memberId);
    }),

  createMember: manageAttendance
    .input(
      z.object({
        name: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      return createAttendanceMember({
        name: input.name,
        isActive: true,
        displayOrder: 0,
      });
    }),

  updateMember: manageAttendance
    .input(
      z.object({
        memberId: z.number(),
        name: z.string().min(1).max(500).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { memberId, ...data } = input;
      await updateAttendanceMember(memberId, data);
    }),

  deleteMember: manageAttendance
    .input(
      z.object({
        memberId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await deleteAttendanceMember(input.memberId);
    }),

  reorderMembers: manageAttendance
    .input(
      z.object({
        memberIds: z.array(z.number()).max(1000),
      }),
    )
    .mutation(async ({ input }) => {
      await reorderAttendanceMembers(input.memberIds);
    }),

  // ============================================
  // RECORDS
  // ============================================

  listRecords: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      }),
    )
    .query(async ({ input }) => {
      return listAttendanceRecords(input.sessionId);
    }),

  saveAttendance: manageAttendance
    .input(
      z.object({
        sessionId: z.number(),
        records: z
          .array(
            z.object({
              memberId: z.number(),
              status: z.enum(['present', 'partial', 'absent']),
              notes: z.string().max(2000).optional(),
            }),
          )
          .max(1000),
      }),
    )
    .mutation(async ({ input }) => {
      await bulkUpsertAttendanceRecords(input.sessionId, input.records);
    }),

  // ============================================
  // SETTINGS
  // ============================================

  getSetting: protectedProcedure
    .input(
      z.object({
        key: z.string().max(100),
      }),
    )
    .query(async ({ input }) => {
      return getAttendanceSetting(input.key);
    }),

  updateEventWeight: manageAttendance
    .input(
      z.object({
        weight: z.number().min(1).max(10),
      }),
    )
    .mutation(async ({ input }) => {
      await upsertAttendanceSetting(
        'event_weight_multiplier',
        input.weight.toString(),
      );
    }),

  // ============================================
  // STATISTICS
  // ============================================

  getStatistics: protectedProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return getAttendanceStatistics(input?.year);
    }),
});
