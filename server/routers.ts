import { COOKIE_NAME } from '@shared/const';
import { getSessionCookieOptions } from './_core/cookies';
import { systemRouter } from './_core/systemRouter';
import { attendanceRouter } from './attendance_router';
import { publicProcedure, protectedProcedure, router } from './_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as db from './db';
import { nanoid } from 'nanoid';
import { storageDelete } from './storage';
import {
  contactSubmissions,
  harassenlaufRegistrations,
} from '../drizzle/schema';
import {
  hasPermission,
  getUserPermissions,
  clearPermissionCache,
  PERMISSION_KEYS,
} from './permissions';
import type { EventLink } from '@shared/types';

/**
 * Strip secret/internal columns from User rows before sending to the client
 * (A-P1-06 / F-SEC-012). `openId` (Google's `sub` claim) is replaced with an
 * empty string so the wire shape is preserved — the client doesn't currently
 * read it. `email` is intentionally kept because admins need it.
 *
 * The return type is preserved as `T` so existing client code that reads
 * `name`, `email`, `role` etc. continues to type-check.
 */
function toPublicUser<T extends { openId: string }>(user: T): T {
  return { ...user, openId: '' };
}

// ============================================
// ROLE-BASED MIDDLEWARE
// ============================================

/**
 * Admin-only procedure (hardcoded, not dynamic). Canonical, single source of
 * truth — used for admin-infrastructure procedures (users.*, features.*,
 * activityLog.*, permissions.list/toggle, sdk.*, shotcounter.getAuditLog).
 *
 * B-P0-02 / F-BE-002: the previously co-existing `maintainerProcedure` and
 * `editorProcedure` helpers had zero call sites and were removed. New
 * procedures should prefer `requirePermission('<key>')` for content
 * management; this `adminProcedure` is reserved for admin-infrastructure.
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({ ctx });
});

/**
 * Dynamic permission-based middleware
 * Checks permissions from database based on user role
 */
const requirePermission = (permissionKey: string) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await hasPermission(ctx.user.role, permissionKey);

    if (!allowed) {
      // A-P2-03: don't echo the permission key — just FORBIDDEN.
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    }

    return next({ ctx });
  });
};

// ============================================
// ROUTERS
// ============================================

export const appRouter = router({
  system: systemRouter,
  attendance: attendanceRouter,

  // ============================================
  // LIVE-DIASHOW (SLIDESHOW)
  // ============================================
  slideshow: router({
    // ---- Public (Token-validiert) ----
    publicState: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const s = await db.getSlideshowSettings();
        if (input.token !== s.uploadToken) {
          return {
            valid: false as const,
            isVisible: false,
            showQr: false,
            moderationEnabled: true,
            uploadsOpen: false,
            eventTitle: null as string | null,
            slideDurationMs: 6000,
            transition: 'kenburns' as 'fade' | 'kenburns',
            photoVersion: 0,
          };
        }
        // Only the cheap settings row is needed here — no full-table stats
        // scan on this 3s-per-beamer poll (approvedCount is unused by the
        // public pages; the control panel gets counts from getSettings).
        return {
          valid: true as const,
          isVisible: s.isVisible,
          showQr: s.showQr,
          moderationEnabled: s.moderationEnabled,
          uploadsOpen: s.uploadsOpen,
          eventTitle: s.eventTitle,
          slideDurationMs: s.slideDurationMs,
          transition: s.transition,
          photoVersion: s.photoVersion,
        };
      }),
    listApproved: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const s = await db.getSlideshowSettings();
        if (input.token !== s.uploadToken) return [];
        const photos = await db.listApprovedSlideshowPhotos();
        return photos.map(p => ({
          id: p.id,
          displayUrl: p.displayUrl,
          width: p.width,
          height: p.height,
          createdAt: p.createdAt,
        }));
      }),

    // ---- Maintainer+ (requirePermission) ----
    getSettings: requirePermission('manage_slideshow').query(async () => {
      const s = await db.getSlideshowSettings();
      const stats = await db.getSlideshowStats();
      return {
        ...s,
        pendingCount: stats.pending,
        approvedCount: stats.approved,
        totalBytes: stats.totalBytes,
      };
    }),
    // Project to the fields the control panel renders — strip uploaderIp (PII)
    // and the internal storage keys, mirroring the public listApproved.
    listPending: requirePermission('manage_slideshow').query(async () => {
      const rows = await db.listPendingSlideshowPhotos();
      return rows.map(p => ({
        id: p.id,
        status: p.status,
        displayUrl: p.displayUrl,
        thumbnailUrl: p.thumbnailUrl,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
      }));
    }),
    listAll: requirePermission('manage_slideshow').query(async () => {
      const rows = await db.listAllSlideshowPhotos();
      return rows.map(p => ({
        id: p.id,
        status: p.status,
        displayUrl: p.displayUrl,
        thumbnailUrl: p.thumbnailUrl,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
      }));
    }),
    updateSettings: requirePermission('manage_slideshow')
      .input(
        z.object({
          isVisible: z.boolean().optional(),
          uploadsOpen: z.boolean().optional(),
          moderationEnabled: z.boolean().optional(),
          showQr: z.boolean().optional(),
          eventTitle: z.string().max(255).nullable().optional(),
          slideDurationMs: z.number().int().min(2000).max(60000).optional(),
          transition: z.enum(['fade', 'kenburns']).optional(),
          maxPhotos: z.number().int().min(1).max(100000).optional(),
          uploadRateLimit: z.number().int().min(1).max(100000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateSlideshowSettings(input, ctx.user.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_settings',
          details: `Updated: ${Object.keys(input).join(', ')}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    rotateToken: requirePermission('manage_slideshow').mutation(
      async ({ ctx }) => {
        const token = nanoid(16);
        await db.updateSlideshowSettings({ uploadToken: token }, ctx.user.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_rotate_token',
          details: 'Rotated upload token',
          ipAddress: null,
          userAgent: null,
        });
        return { token };
      },
    ),
    approve: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const photo = await db.getSlideshowPhotoById(input.id);
        if (!photo)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Photo not found' });
        await db.approveSlideshowPhoto(input.id, ctx.user.id);
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_approve',
          details: `Approved photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    approveAll: requirePermission('manage_slideshow').mutation(
      async ({ ctx }) => {
        await db.approveAllPendingSlideshowPhotos(ctx.user.id);
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_approve_all',
          details: 'Approved all pending photos',
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      },
    ),
    // Ablehnen (pending) — Files + Row hart löschen, KEIN Version-Bump (nicht sichtbar).
    reject: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const keys = await db.deleteSlideshowPhoto(input.id);
        if (!keys)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Photo not found' });
        await storageDelete(keys.displayKey);
        await storageDelete(keys.thumbnailKey);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_reject',
          details: `Rejected photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    // Aus Album löschen (approved) — Files + Row löschen + Version-Bump.
    deletePhoto: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const keys = await db.deleteSlideshowPhoto(input.id);
        if (!keys)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Photo not found' });
        await storageDelete(keys.displayKey);
        await storageDelete(keys.thumbnailKey);
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_delete',
          details: `Deleted photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    clearAll: requirePermission('manage_slideshow').mutation(async ({ ctx }) => {
      const keys = await db.clearAllSlideshowPhotos();
      // DB rows are deleted first (consistent DB > consistent disk): a crash
      // mid-loop orphans files on disk unrecoverably — acceptable for this
      // admin "reset between events" action. TODO: parallelize storageDelete
      // (Promise.all) if maxPhotos grows large.
      for (const k of keys) {
        await storageDelete(k.displayKey);
        await storageDelete(k.thumbnailKey);
      }
      await db.bumpPhotoVersion();
      await db.createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'slideshow_clear_all',
        details: `Deleted ${keys.length} photos`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true, deleted: keys.length };
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user ? toPublicUser(opts.ctx.user) : null,
    ),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // USER MANAGEMENT (Admin only)
  // ============================================
  users: router({
    list: adminProcedure.query(async () => {
      const all = await db.getAllUsers();
      return all.map(toPublicUser);
    }),
    updateRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(['admin', 'maintainer', 'editor', 'user', 'visitor']),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        const oldRole = targetUser?.role || 'unknown';

        await db.updateUserRole(input.userId, input.role);

        // Log role change
        await db.createActivityLog({
          userId: input.userId,
          userName: targetUser?.name || 'Unknown',
          action: 'role_change',
          details: `Role changed from ${oldRole} to ${input.role} by ${ctx.user.name || 'Admin'}`,
          ipAddress: null,
          userAgent: null,
        });

        return { success: true };
      }),
  }),

  // ============================================
  // SHOTCOUNTER
  // ============================================
  shotcounter: router({
    getTeams: publicProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        return db.getShotcounterTeamsByYear(input.year);
      }),

    createTeam: requirePermission('edit_shotcounter')
      .input(
        z.object({
          name: z.string().min(1).max(100),
          year: z.number(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const teamId = await db.createShotcounterTeam({
          name: input.name,
          year: input.year,
          score: 0,
          createdBy: ctx.user.id,
        });

        await db.createAuditLog({
          teamId: Number(teamId),
          action: 'create_team',
          amount: null,
          previousScore: null,
          newScore: 0,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || 'Unknown',
        });

        return { teamId };
      }),

    updateScore: requirePermission('edit_shotcounter')
      .input(
        z.object({
          teamId: z.number(),
          amount: z.number(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const team = await db.getShotcounterTeamById(input.teamId);
        if (!team)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

        const previousScore = team.score;
        const newScore = previousScore + input.amount;

        await db.updateShotcounterScore(input.teamId, newScore);
        await db.createAuditLog({
          teamId: input.teamId,
          action: input.amount > 0 ? 'add' : 'subtract',
          amount: input.amount,
          previousScore,
          newScore,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || 'Unknown',
        });

        return { success: true, newScore };
      }),

    deleteTeam: requirePermission('edit_shotcounter')
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const team = await db.getShotcounterTeamById(input.teamId);
        if (!team)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

        await db.createAuditLog({
          teamId: input.teamId,
          action: 'delete_team',
          amount: null,
          previousScore: team.score,
          newScore: null,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || 'Unknown',
        });

        await db.deleteShotcounterTeam(input.teamId);
        return { success: true };
      }),

    resetYear: requirePermission('reset_shotcounter')
      .input(z.object({ year: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.resetShotcounterForYear(input.year);
        return { success: true };
      }),

    resetScores: requirePermission('reset_shotcounter')
      .input(z.object({ year: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.resetShotcounterScoresForYear(input.year);
        return { success: true };
      }),

    getAuditLog: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllAuditLogs(input.limit);
      }),
  }),

  // ============================================
  // SPONSORS
  // ============================================
  sponsors: router({
    list: publicProcedure.query(async () => {
      return db.getAllSponsors();
    }),

    create: requirePermission('manage_sponsors')
      .input(
        z.object({
          name: z.string().min(1).max(255),
          logoUrl: z.string().url().optional(),
          logoKey: z.string().optional(),
          websiteUrl: z.string().url().optional(),
          displayOrder: z.number().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const sponsorId = await db.createSponsor({
          ...input,
          createdBy: ctx.user.id,
        });
        return { sponsorId };
      }),

    delete: requirePermission('manage_sponsors')
      .input(z.object({ sponsorId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSponsor(input.sponsorId);
        return { success: true };
      }),
  }),

  // ============================================
  // EVENTS
  // ============================================
  events: router({
    list: publicProcedure.query(async ({ ctx }) => {
      // A-P0-06 / F-SEC-007: only editors+ see unpublished events. Anonymous
      // and `user`/`visitor`-role callers get published-only.
      const role = ctx.user?.role;
      const canSeeDrafts =
        role === 'admin' || role === 'maintainer' || role === 'editor';
      return db.getAllEvents(!canSeeDrafts);
    }),

    getById: publicProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const event = await db.getEventById(input.eventId);
        if (!event) return undefined;

        const role = ctx.user?.role;
        const canSeeDrafts =
          role === 'admin' || role === 'maintainer' || role === 'editor';
        if (!event.isPublished && !canSeeDrafts) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
        }
        return event;
      }),

    create: requirePermission('edit_events')
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          eventDate: z.date(),
          location: z.string().max(255).optional(),
          eventUrl: z.string().url().optional().or(z.literal('')),
          eventLinks: z
            .array(z.object({ url: z.string().url(), label: z.string() }))
            .optional(),
          isPublished: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { eventLinks, ...rest } = input;
        const eventId = await db.createEvent({
          ...rest,
          // eventLinks is JSON-serialized by db.createEvent/updateEvent; cast needed due to Drizzle's text column intersection type
          eventLinks: eventLinks as any,
          createdBy: ctx.user.id,
        });
        return { eventId };
      }),

    update: requirePermission('edit_events')
      .input(
        z.object({
          eventId: z.number(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          eventDate: z.date().optional(),
          location: z.string().max(255).optional(),
          eventUrl: z.string().url().optional().or(z.literal('')),
          eventLinks: z
            .array(z.object({ url: z.string().url(), label: z.string() }))
            .optional(),
          isPublished: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { eventId, eventLinks, ...rest } = input;
        await db.updateEvent(eventId, {
          ...rest,
          eventLinks: eventLinks as any,
        });
        return { success: true };
      }),

    delete: requirePermission('edit_events')
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEvent(input.eventId);
        return { success: true };
      }),

    setThumbnail: requirePermission('edit_events')
      .input(z.object({ eventId: z.number(), photoId: z.number() }))
      .mutation(async ({ input }) => {
        await db.setEventThumbnail(input.eventId, input.photoId);
        return { success: true };
      }),
  }),

  // ============================================
  // PHOTOS
  // ============================================
  photos: router({
    listByEvent: publicProcedure
      .input(z.object({ eventId: z.number() }))
      .query(async ({ input, ctx }) => {
        const isAuthenticated = !!ctx.user;
        return db.getPhotosByEvent(input.eventId, !isAuthenticated);
      }),

    listAll: publicProcedure.query(async ({ ctx }) => {
      const isAuthenticated = !!ctx.user;
      return db.getAllPhotos(!isAuthenticated);
    }),

    create: requirePermission('edit_events')
      .input(
        z.object({
          eventId: z.number().optional(),
          title: z.string().max(255).optional(),
          description: z.string().optional(),
          imageUrl: z.string().url(),
          imageKey: z.string(),
          compressedUrl: z.string().url().optional(),
          compressedKey: z.string().optional(),
          thumbnailUrl: z.string().url().optional(),
          thumbnailKey: z.string().optional(),
          displayOrder: z.number().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const photoId = await db.createPhoto({
          ...input,
          uploadedBy: ctx.user.id,
        });
        return { photoId };
      }),

    delete: requirePermission('edit_events')
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePhoto(input.photoId);
        return { success: true };
      }),
  }),

  // ============================================
  // TEAM MEMBERS
  // ============================================
  team: router({
    list: publicProcedure.query(async () => {
      return db.getAllTeamMembers(true);
    }),

    create: requirePermission('edit_team')
      .input(
        z.object({
          name: z.string().min(1).max(255),
          nickname: z.string().max(100).optional(),
          role: z.string().max(100).optional(),
          bio: z.string().optional(),
          photoUrl: z.string().url().optional(),
          photoKey: z.string().optional(),
          compressedPhotoUrl: z.string().url().optional(),
          compressedPhotoKey: z.string().optional(),
          displayOrder: z.number().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const memberId = await db.createTeamMember(input);
        return { memberId };
      }),

    update: requirePermission('edit_team')
      .input(
        z.object({
          memberId: z.number(),
          name: z.string().min(1).max(255).optional(),
          nickname: z.string().max(100).optional(),
          role: z.string().max(100).optional(),
          bio: z.string().optional(),
          photoUrl: z.string().url().optional(),
          photoKey: z.string().optional(),
          compressedPhotoUrl: z.string().url().optional(),
          compressedPhotoKey: z.string().optional(),
          displayOrder: z.number().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        // Convert empty strings to null for optional fields
        const cleanedData: any = {};
        for (const [key, value] of Object.entries(data)) {
          // Set null for empty strings, otherwise keep the value
          cleanedData[key] = value === '' ? null : value;
        }
        await db.updateTeamMember(memberId, cleanedData);
        return { success: true };
      }),

    delete: requirePermission('edit_team')
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTeamMember(input.memberId);
        return { success: true };
      }),

    reorder: requirePermission('edit_team')
      .input(
        z.object({
          memberIds: z.array(z.number()),
        }),
      )
      .mutation(async ({ input }) => {
        await db.reorderTeamMembers(input.memberIds);
        return { success: true };
      }),
  }),

  // ============================================
  // FEATURE TOGGLES (Admin only)
  // ============================================
  features: router({
    list: publicProcedure.query(async () => {
      return db.getAllFeatureToggles();
    }),

    // Public getter for specific feature toggles (for beamer mode, maintenance mode, etc.)
    get: publicProcedure
      .input(z.object({ featureName: z.string() }))
      .query(async ({ input }) => {
        const toggle = await db.getFeatureToggle(input.featureName);
        return { isEnabled: toggle?.isEnabled ?? false };
      }),

    toggle: adminProcedure
      .input(
        z.object({
          featureName: z.string(),
          isEnabled: z.boolean(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.setFeatureToggle(
          input.featureName,
          input.isEnabled,
          ctx.user.id,
        );
        return { success: true };
      }),

    create: adminProcedure
      .input(
        z.object({
          featureName: z.string(),
          description: z.string().optional(),
          isEnabled: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.setFeatureToggle(
          input.featureName,
          input.isEnabled ?? false,
          ctx.user.id,
          input.description,
        );
        return { success: true };
      }),
  }),

  // ============================================
  // CONTACT FORM
  // ============================================
  // HARASSENLAUF REGISTRATION
  // ============================================
  harassenlauf: router({
    register: publicProcedure
      .input(
        z.object({
          teamName: z.string().min(1, 'Teamname ist erforderlich').max(255),
          memberCount: z.number().int().min(1).max(5),
          captainFirstName: z
            .string()
            .min(1, 'Vorname ist erforderlich')
            .max(100),
          captainLastName: z
            .string()
            .min(1, 'Nachname ist erforderlich')
            .max(100),
          captainPhone: z
            .string()
            .min(1, 'Telefonnummer ist erforderlich')
            .max(50),
          wurstKalb: z.number().int().min(0).max(10),
          wurstKloepfer: z.number().int().min(0).max(10),
          wurstVegi: z.number().int().min(0).max(10),
          additionalInfo: z.string().max(2000).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        // Primary: Save to database
        const database = await db.getDb();
        if (database) {
          await database.insert(harassenlaufRegistrations).values({
            teamName: input.teamName,
            memberCount: input.memberCount,
            captainFirstName: input.captainFirstName,
            captainLastName: input.captainLastName,
            captainPhone: input.captainPhone,
            wurstKalb: input.wurstKalb,
            wurstKloepfer: input.wurstKloepfer,
            wurstVegi: input.wurstVegi,
            additionalInfo: input.additionalInfo || null,
          });
        }

        // Secondary: Send notification email (non-blocking)
        try {
          const { sendHarassenlaufEmail } = await import('./_core/email');
          await sendHarassenlaufEmail(input);
        } catch (emailError) {
          console.error('Harassenlauf notification email failed:', emailError);
          // Don't throw - DB save was successful
        }

        return { success: true };
      }),
  }),

  // ============================================
  contact: router({
    send: publicProcedure
      .input(
        z.object({
          // A-P0-02: reject any value containing CR/LF that could end up in
          // an SMTP header (reply-to / subject). Email module also validates
          // defensively before passing to nodemailer.
          name: z
            .string()
            .min(1, 'Name ist erforderlich')
            .max(100)
            .refine(v => !/[\r\n]/.test(v), 'Ungültige Zeichen'),
          email: z
            .string()
            .email('Ungültige E-Mail-Adresse')
            .max(320)
            .refine(v => !/[\r\n]/.test(v), 'Ungültige Zeichen'),
          subject: z
            .string()
            .min(1, 'Betreff ist erforderlich')
            .max(200)
            .refine(v => !/[\r\n]/.test(v), 'Ungültige Zeichen'),
          message: z
            .string()
            .min(10, 'Nachricht muss mindestens 10 Zeichen lang sein')
            .max(5000),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Save to database
        const database = await db.getDb();
        if (database) {
          await database.insert(contactSubmissions).values({
            name: input.name,
            email: input.email,
            subject: input.subject,
            message: input.message,
            // A-P1-11 / F-SEC-024: with `trust proxy 1` set in _core/index.ts,
            // express resolves the real client IP into req.ip. The legacy
            // X-Forwarded-For fallback would let a client forge any IP.
            ipAddress: ctx.req?.ip ?? null,
            isRead: false,
            isArchived: false,
          });
        }

        // Send email
        const { sendContactFormEmail } = await import('./_core/email');
        const result = await sendContactFormEmail(input);

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'E-Mail konnte nicht gesendet werden',
          });
        }

        return { success: true };
      }),
  }),

  // ============================================
  // GÖNNERMITGLIEDER (Sponsor Members)
  // ============================================
  goennermitglieder: router({
    list: protectedProcedure.query(async () => {
      return db.getAllGoennermitglieder();
    }),

    listActive: protectedProcedure.query(async () => {
      return db.getActiveGoennermitglieder();
    }),

    listExpired: protectedProcedure.query(async () => {
      return db.getExpiredGoennermitglieder();
    }),

    create: requirePermission('manage_goennermitglieder')
      .input(
        z.object({
          firstName: z.string().min(1).max(100),
          lastName: z.string().min(1).max(100),
          street: z.string().min(1).max(255),
          houseNumber: z.string().min(1).max(20),
          zipCode: z.string().min(1).max(10),
          city: z.string().min(1).max(100),
          email: z.string().email().max(320).optional(),
          phone: z.string().max(50).optional(),
          membershipStartDate: z.date(),
          notes: z.string().optional(),
          paymentStatus: z.enum(['paid', 'pending']).default('paid'),
          contributionAmount: z.number().min(1).default(20),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Default end date is start date + 1 year
        const endDate = new Date(input.membershipStartDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        const memberId = await db.createGoennermitglied({
          ...input,
          membershipEndDate: endDate,
          paymentPendingSince:
            input.paymentStatus === 'pending' ? new Date() : null,
          createdBy: ctx.user.id,
        });
        return { memberId };
      }),

    update: requirePermission('manage_goennermitglieder')
      .input(
        z.object({
          memberId: z.number(),
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
          street: z.string().min(1).max(255).optional(),
          houseNumber: z.string().min(1).max(20).optional(),
          zipCode: z.string().min(1).max(10).optional(),
          city: z.string().min(1).max(100).optional(),
          email: z.string().email().max(320).optional(),
          phone: z.string().max(50).optional(),
          notes: z.string().optional(),
          contributionAmount: z.number().min(1).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        await db.updateGoennermitglied(memberId, data);
        return { success: true };
      }),

    extend: requirePermission('manage_goennermitglieder')
      .input(
        z.object({
          memberId: z.number(),
          years: z.number().min(1).max(10).default(1),
          paymentStatus: z.enum(['paid', 'pending']).default('paid'),
        }),
      )
      .mutation(async ({ input }) => {
        const newEndDate = await db.extendGoennermitgliedschaft(
          input.memberId,
          input.years,
        );
        // Update payment status
        await db.updateGoennermitglied(input.memberId, {
          paymentStatus: input.paymentStatus,
          paymentPendingSince:
            input.paymentStatus === 'pending' ? new Date() : null,
        });
        return { success: true, newEndDate };
      }),

    confirmPayment: requirePermission('manage_goennermitglieder')
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        // Set payment to paid and update start date to now
        await db.updateGoennermitglied(input.memberId, {
          paymentStatus: 'paid',
          paymentPendingSince: null,
          membershipStartDate: new Date(),
          isActive: true,
        });
        return { success: true };
      }),

    delete: requirePermission('manage_goennermitglieder')
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGoennermitglied(input.memberId);
        return { success: true };
      }),
  }),

  // ============================================
  // ADMIN - USER MANAGEMENT
  // ============================================
  admin: router({
    deleteUser: adminProcedure
      .input(
        z.object({
          userId: z.number(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        // Prevent deleting yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Du kannst dich nicht selbst löschen',
          });
        }
        await db.deleteUser(input.userId);
        return { success: true };
      }),
  }),

  // ============================================
  // USER PROFILE
  // ============================================
  profile: router({
    updatePicture: protectedProcedure
      .input(
        z.object({
          profilePictureUrl: z.string().url(),
          profilePictureKey: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateUserProfilePicture(
          ctx.user.id,
          input.profilePictureUrl,
          input.profilePictureKey,
        );
        return { success: true };
      }),

    updateProfile: protectedProcedure
      .input(
        z.object({
          displayName: z.string().max(255).optional(),
          memberSince: z.date().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateUserProfile(
          ctx.user.id,
          input.displayName,
          input.memberSince,
        );
        return { success: true };
      }),
  }),

  // ============================================
  // PERMISSIONS (Admin only)
  // ============================================
  permissions: router({
    list: adminProcedure.query(async () => {
      return db.getAllPermissions();
    }),

    // Get permissions for current user's role (cached, invalidated on toggle)
    getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
      return getUserPermissions(ctx.user.role);
    }),

    toggle: adminProcedure
      .input(
        z.object({
          // A-P1-08 / F-SEC-015: validate against the canonical key list at
          // runtime. We use refine() rather than z.enum() to keep the input
          // type as `string` for the existing client call sites that still
          // type it as `string` — the runtime guarantee is identical.
          permissionKey: z
            .string()
            .max(64)
            .refine(
              (v): v is (typeof PERMISSION_KEYS)[number] =>
                (PERMISSION_KEYS as readonly string[]).includes(v),
              { message: 'Unknown permission key' },
            ),
          role: z.enum(['admin', 'maintainer', 'editor', 'user']),
          enabled: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        if (input.enabled) {
          await db.addPermission(input.permissionKey, input.role);
        } else {
          await db.removePermission(input.permissionKey, input.role);
        }
        clearPermissionCache();
        return { success: true };
      }),
  }),

  // ============================================
  // SCHLAG DEN KASSIER (SDK) OVERLAY
  // ============================================
  sdk: router({
    // Public: overlay reads live state (polling)
    getActive: publicProcedure.query(async () => {
      return db.sdkGetActiveSession();
    }),

    getGameLog: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.sdkGetGameLog(input.sessionId);
      }),

    // Admin: create a new session (resets previous)
    createSession: adminProcedure
      .input(
        z.object({
          showTitle: z.string().min(1).max(150).optional(),
          player1Name: z.string().min(1).max(100),
          player2Name: z.string().min(1).max(100),
          totalGames: z.number().int().min(1).max(50),
          currentGameName: z.string().max(255).optional(),
          gameNames: z.array(z.string().max(255)).optional(), // pre-defined game names
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const gameNamesJson =
          input.gameNames && input.gameNames.length > 0
            ? JSON.stringify(input.gameNames)
            : '';
        return db.sdkCreateSession({
          showTitle: input.showTitle ?? 'Schlag den Kassier',
          player1Name: input.player1Name,
          player2Name: input.player2Name,
          totalGames: input.totalGames,
          currentGame: 1,
          currentGameName: input.currentGameName ?? '',
          gameNames: gameNamesJson,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          isActive: true,
          createdBy: ctx.user.id,
        });
      }),

    // Admin: update session settings (names, game name)
    updateSession: adminProcedure
      .input(
        z.object({
          sessionId: z.number(),
          showTitle: z.string().min(1).max(150).optional(),
          player1Name: z.string().min(1).max(100).optional(),
          player2Name: z.string().min(1).max(100).optional(),
          currentGameName: z.string().max(255).optional(),
          totalGames: z.number().int().min(1).max(50).optional(),
          currentGame: z.number().int().min(1).optional(),
          gameNames: z.array(z.string().max(255)).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { sessionId, gameNames, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (gameNames !== undefined) {
          data.gameNames =
            gameNames.length > 0 ? JSON.stringify(gameNames) : '';
        }
        return db.sdkUpdateSession(
          sessionId,
          data as Parameters<typeof db.sdkUpdateSession>[1],
        );
      }),

    // Admin: award points for current game to a player
    awardPoint: adminProcedure
      .input(
        z.object({
          sessionId: z.number(),
          winnerId: z.union([z.literal(1), z.literal(2)]),
        }),
      )
      .mutation(async ({ input }) => {
        return db.sdkAwardPoint(input.sessionId, input.winnerId);
      }),

    // Admin: undo last game (remove last log entry and recalculate)
    undoLastGame: adminProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const log = await db.sdkGetGameLog(input.sessionId);
        if (log.length === 0) throw new Error('No games to undo');
        const last = log[log.length - 1];
        // Recalculate scores from remaining log
        const remaining = log.slice(0, -1);
        let p1 = 0,
          p2 = 0;
        for (const entry of remaining) {
          if (entry.winnerId === 1) p1 += entry.pointsAwarded;
          else p2 += entry.pointsAwarded;
        }
        // Restore pre-defined game name for the undone game number (if configured)
        const session = await db.sdkGetSession(input.sessionId);
        let restoredGameName = '';
        if (session?.gameNames) {
          try {
            const names: string[] = JSON.parse(session.gameNames);
            restoredGameName = names[last.gameNumber - 1] ?? '';
          } catch {
            /* ignore */
          }
        }
        await db.sdkDeleteGameLogEntry(last.id);
        return db.sdkUpdateSession(input.sessionId, {
          player1Score: p1,
          player2Score: p2,
          currentGame: last.gameNumber,
          currentGameName: restoredGameName,
          winnerId: null,
        });
      }),

    // Admin: reset session scores (keep config)
    resetSession: adminProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.sdkDeleteSessionGameLog(input.sessionId);
        // Restore first pre-defined game name if configured
        const session = await db.sdkGetSession(input.sessionId);
        let firstGameName = '';
        if (session?.gameNames) {
          try {
            const names: string[] = JSON.parse(session.gameNames);
            firstGameName = names[0] ?? '';
          } catch {
            /* ignore */
          }
        }
        return db.sdkUpdateSession(input.sessionId, {
          player1Score: 0,
          player2Score: 0,
          currentGame: 1,
          currentGameName: firstGameName,
          winnerId: null,
        });
      }),
  }),

  // ============================================
  // ACTIVITY LOG (Admin only)
  // ============================================
  activityLog: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAllActivityLogs(input.limit);
      }),

    getByUser: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          limit: z.number().optional(),
        }),
      )
      .query(async ({ input }) => {
        return db.getActivityLogsByUser(input.userId, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
