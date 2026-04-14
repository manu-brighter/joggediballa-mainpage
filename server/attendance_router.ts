import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
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

  createSession: protectedProcedure
    .input(
      z.object({
        date: z.string(), // ISO date string
        title: z.string().min(1),
        type: z.enum(['meeting', 'event']),
        notes: z.string().optional(),
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

  updateSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        date: z.string().optional(),
        title: z.string().min(1).optional(),
        type: z.enum(['meeting', 'event']).optional(),
        notes: z.string().optional(),
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

  deleteSession: protectedProcedure
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

  createMember: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return createAttendanceMember({
        name: input.name,
        isActive: true,
        displayOrder: 0,
      });
    }),

  updateMember: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
        name: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { memberId, ...data } = input;
      await updateAttendanceMember(memberId, data);
    }),

  deleteMember: protectedProcedure
    .input(
      z.object({
        memberId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await deleteAttendanceMember(input.memberId);
    }),

  reorderMembers: protectedProcedure
    .input(
      z.object({
        memberIds: z.array(z.number()),
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

  saveAttendance: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        records: z.array(
          z.object({
            memberId: z.number(),
            status: z.enum(['present', 'partial', 'absent']),
            notes: z.string().optional(),
          }),
        ),
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
        key: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return getAttendanceSetting(input.key);
    }),

  updateEventWeight: protectedProcedure
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
