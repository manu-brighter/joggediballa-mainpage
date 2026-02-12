import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { hasPermission } from "./permissions";

// ============================================
// ROLE-BASED MIDDLEWARE
// ============================================

/**
 * Admin-only procedure (hardcoded, not dynamic)
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Admin access required" 
    });
  }
  return next({ ctx });
});

/**
 * Legacy procedures - kept for backwards compatibility
 * Use requirePermission() for new procedures
 */
const maintainerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "maintainer"].includes(ctx.user.role)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Maintainer or Admin access required" 
    });
  }
  return next({ ctx });
});

const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "maintainer", "editor"].includes(ctx.user.role)) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Editor, Maintainer or Admin access required" 
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
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: `Permission '${permissionKey}' required` 
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
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
      return db.getAllUsers();
    }),
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "maintainer", "editor", "user", "visitor"])
      }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        const oldRole = targetUser?.role || "unknown";
        
        await db.updateUserRole(input.userId, input.role);
        
        // Log role change
        await db.createActivityLog({
          userId: input.userId,
          userName: targetUser?.name || "Unknown",
          action: "role_change",
          details: `Role changed from ${oldRole} to ${input.role} by ${ctx.user.name || "Admin"}`,
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
    
    createTeam: requirePermission("edit_shotcounter")
      .input(z.object({
        name: z.string().min(1).max(100),
        year: z.number()
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = await db.createShotcounterTeam({
          name: input.name,
          year: input.year,
          score: 0,
          createdBy: ctx.user.id
        });
        
        await db.createAuditLog({
          teamId: Number(teamId),
          action: "create_team",
          amount: null,
          previousScore: null,
          newScore: 0,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || "Unknown"
        });
        
        return { teamId };
      }),
    
    updateScore: requirePermission("edit_shotcounter")
      .input(z.object({
        teamId: z.number(),
        amount: z.number()
      }))
      .mutation(async ({ input, ctx }) => {
        const team = await db.getShotcounterTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        
        const previousScore = team.score;
        const newScore = previousScore + input.amount;
        
        await db.updateShotcounterScore(input.teamId, newScore);
        await db.createAuditLog({
          teamId: input.teamId,
          action: input.amount > 0 ? "add" : "subtract",
          amount: input.amount,
          previousScore,
          newScore,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || "Unknown"
        });
        
        return { success: true, newScore };
      }),
    
    deleteTeam: requirePermission("edit_shotcounter")
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const team = await db.getShotcounterTeamById(input.teamId);
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        
        await db.createAuditLog({
          teamId: input.teamId,
          action: "delete_team",
          amount: null,
          previousScore: team.score,
          newScore: null,
          performedBy: ctx.user.id,
          performedByName: ctx.user.name || "Unknown"
        });
        
        await db.deleteShotcounterTeam(input.teamId);
        return { success: true };
      }),
    
    resetYear: requirePermission("reset_shotcounter")
      .input(z.object({ year: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.resetShotcounterForYear(input.year);
        return { success: true };
      }),
    
    resetScores: requirePermission("reset_shotcounter")
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
    
    create: requirePermission("manage_sponsors")
      .input(z.object({
        name: z.string().min(1).max(255),
        logoUrl: z.string().url().optional(),
        logoKey: z.string().optional(),
        websiteUrl: z.string().url().optional(),
        displayOrder: z.number().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const sponsorId = await db.createSponsor({
          ...input,
          createdBy: ctx.user.id
        });
        return { sponsorId };
      }),
    
    delete: requirePermission("manage_sponsors")
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
      // Show all events to everyone (published and unpublished)
      return db.getAllEvents(false);
    }),
    
    getById: publicProcedure
      .input(z.object({ eventId: z.number() }))
      .query(async ({ input }) => {
        return db.getEventById(input.eventId);
      }),
    
    create: requirePermission("edit_events")
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        eventDate: z.date(),
        location: z.string().max(255).optional(),
        isPublished: z.boolean().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const eventId = await db.createEvent({
          ...input,
          createdBy: ctx.user.id
        });
        return { eventId };
      }),
    
    update: requirePermission("edit_events")
      .input(z.object({
        eventId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        eventDate: z.date().optional(),
        location: z.string().max(255).optional(),
        isPublished: z.boolean().optional()
      }))
      .mutation(async ({ input }) => {
        const { eventId, ...data } = input;
        await db.updateEvent(eventId, data);
        return { success: true };
      }),
    
    delete: requirePermission("edit_events")
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEvent(input.eventId);
        return { success: true };
      }),

    setThumbnail: requirePermission("edit_events")
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
    
    create: requirePermission("edit_events")
      .input(z.object({
        eventId: z.number().optional(),
        title: z.string().max(255).optional(),
        description: z.string().optional(),
        imageUrl: z.string().url(),
        imageKey: z.string(),
        compressedUrl: z.string().url().optional(),
        compressedKey: z.string().optional(),
        thumbnailUrl: z.string().url().optional(),
        thumbnailKey: z.string().optional(),
        displayOrder: z.number().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const photoId = await db.createPhoto({
          ...input,
          uploadedBy: ctx.user.id
        });
        return { photoId };
      }),
    
    delete: requirePermission("edit_events")
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
    
    create: requirePermission("edit_team")
      .input(z.object({
        name: z.string().min(1).max(255),
        nickname: z.string().max(100).optional(),
        role: z.string().max(100).optional(),
        bio: z.string().optional(),
        photoUrl: z.string().url().optional(),
        photoKey: z.string().optional(),
        compressedPhotoUrl: z.string().url().optional(),
        compressedPhotoKey: z.string().optional(),
        displayOrder: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const memberId = await db.createTeamMember(input);
        return { memberId };
      }),
    
    update: requirePermission("edit_team")
      .input(z.object({
        memberId: z.number(),
        name: z.string().min(1).max(255).optional(),
        nickname: z.string().max(100).optional(),
        role: z.string().max(100).optional(),
        bio: z.string().optional(),
        photoUrl: z.string().url().optional(),
        photoKey: z.string().optional(),
        compressedPhotoUrl: z.string().url().optional(),
        compressedPhotoKey: z.string().optional(),
        displayOrder: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        // Convert empty strings to null for optional fields
        const cleanedData: any = {};
        for (const [key, value] of Object.entries(data)) {
          // Set null for empty strings, otherwise keep the value
          cleanedData[key] = value === "" ? null : value;
        }
        await db.updateTeamMember(memberId, cleanedData);
        return { success: true };
      }),
    
    delete: requirePermission("edit_team")
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTeamMember(input.memberId);
        return { success: true };
      }),
    
    reorder: requirePermission("edit_team")
      .input(z.object({
        memberIds: z.array(z.number())
      }))
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
      .input(z.object({
        featureName: z.string(),
        isEnabled: z.boolean()
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setFeatureToggle(input.featureName, input.isEnabled, ctx.user.id);
        return { success: true };
      }),
    
    create: adminProcedure
      .input(z.object({
        featureName: z.string(),
        description: z.string().optional(),
        isEnabled: z.boolean().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setFeatureToggle(input.featureName, input.isEnabled ?? false, ctx.user.id, input.description);
        return { success: true };
      }),
  }),

  // ============================================
  // CONTACT FORM
  // ============================================
  contact: router({
    send: publicProcedure
      .input(z.object({
        name: z.string().min(1, "Name ist erforderlich").max(100),
        email: z.string().email("Ungültige E-Mail-Adresse").max(320),
        subject: z.string().min(1, "Betreff ist erforderlich").max(200),
        message: z.string().min(10, "Nachricht muss mindestens 10 Zeichen lang sein").max(5000)
      }))
      .mutation(async ({ input }) => {
        const { sendContactFormEmail } = await import("./_core/email");
        const result = await sendContactFormEmail(input);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "E-Mail konnte nicht gesendet werden"
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
    
    create: requirePermission("manage_goennermitglieder")
      .input(z.object({
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
        paymentStatus: z.enum(["paid", "pending"]).default("paid"),
        contributionAmount: z.number().min(1).default(20)
      }))
      .mutation(async ({ input, ctx }) => {
        // Default end date is start date + 1 year
        const endDate = new Date(input.membershipStartDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        const memberId = await db.createGoennermitglied({
          ...input,
          membershipEndDate: endDate,
          paymentPendingSince: input.paymentStatus === "pending" ? new Date() : null,
          createdBy: ctx.user.id
        });
        return { memberId };
      }),
    
    update: requirePermission("manage_goennermitglieder")
      .input(z.object({
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
        contributionAmount: z.number().min(1).optional()
      }))
      .mutation(async ({ input }) => {
        const { memberId, ...data } = input;
        await db.updateGoennermitglied(memberId, data);
        return { success: true };
      }),
    
    extend: requirePermission("manage_goennermitglieder")
      .input(z.object({
        memberId: z.number(),
        years: z.number().min(1).max(10).default(1),
        paymentStatus: z.enum(["paid", "pending"]).default("paid")
      }))
      .mutation(async ({ input }) => {
        const newEndDate = await db.extendGoennermitgliedschaft(input.memberId, input.years);
        // Update payment status
        await db.updateGoennermitglied(input.memberId, {
          paymentStatus: input.paymentStatus,
          paymentPendingSince: input.paymentStatus === "pending" ? new Date() : null
        });
        return { success: true, newEndDate };
      }),
    
    confirmPayment: requirePermission("manage_goennermitglieder")
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ input }) => {
        // Set payment to paid and update start date to now
        await db.updateGoennermitglied(input.memberId, {
          paymentStatus: "paid",
          paymentPendingSince: null,
          membershipStartDate: new Date(),
          isActive: true
        });
        return { success: true };
      }),
    
    delete: requirePermission("manage_goennermitglieder")
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
    getAllUsers: adminProcedure
      .query(async () => {
        const users = await db.getAllUsers();
        return users;
      }),
    
    promoteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "maintainer", "editor", "user", "visitor"])
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    
    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number()
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent deleting yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Du kannst dich nicht selbst löschen" 
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
      .input(z.object({
        profilePictureUrl: z.string().url(),
        profilePictureKey: z.string()
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserProfilePicture(ctx.user.id, input.profilePictureUrl, input.profilePictureKey);
        return { success: true };
      }),
    
    updateProfile: protectedProcedure
      .input(z.object({
        displayName: z.string().max(255).optional(),
        memberSince: z.date().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserProfile(ctx.user.id, input.displayName, input.memberSince);
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
    
    // Get permissions for current user's role
    getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
      // Admin has all permissions
      if (ctx.user.role === "admin") {
        return [
          "edit_events",
          "manage_sponsors",
          "manage_goennermitglieder",
          "edit_shotcounter",
          "reset_shotcounter",
          "edit_team",
        ];
      }
      
      // Visitor has no permissions
      if (ctx.user.role === "visitor") {
        return [];
      }
      
      // Get permissions from database for this role
      const allPermissions = await db.getAllPermissions();
      return allPermissions
        .filter((p) => p.role === ctx.user.role)
        .map((p) => p.permissionKey);
    }),
    
    toggle: adminProcedure
      .input(z.object({
        permissionKey: z.string(),
        role: z.enum(["admin", "maintainer", "editor", "user"]),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        if (input.enabled) {
          return db.addPermission(input.permissionKey, input.role);
        } else {
          return db.removePermission(input.permissionKey, input.role);
        }
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
      .input(z.object({ 
        userId: z.number(),
        limit: z.number().optional() 
      }))
      .query(async ({ input }) => {
        return db.getActivityLogsByUser(input.userId, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
