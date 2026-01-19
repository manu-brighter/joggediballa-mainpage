import { eq, desc, and, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  shotcounterTeams,
  shotcounterAuditLog,
  sponsors,
  events,
  photos,
  teamMembers,
  featureToggles,
  contactSubmissions,
  goennermitglieder,
  userActivityLog,
  InsertShotcounterTeam,
  InsertShotcounterAuditLog,
  InsertSponsor,
  InsertEvent,
  InsertPhoto,
  InsertTeamMember,
  InsertFeatureToggle,
  InsertContactSubmission,
  InsertGoennermitglied,
  InsertUserActivityLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// USER MANAGEMENT
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "profilePictureUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "admin" | "maintainer" | "editor" | "user" | "visitor") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
}

// ============================================
// SHOTCOUNTER
// ============================================

export async function getShotcounterTeamsByYear(year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shotcounterTeams)
    .where(eq(shotcounterTeams.year, year))
    .orderBy(desc(shotcounterTeams.score));
}

export async function createShotcounterTeam(team: InsertShotcounterTeam) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shotcounterTeams).values(team);
  return Number(result[0].insertId);
}

export async function updateShotcounterScore(teamId: number, newScore: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shotcounterTeams)
    .set({ score: newScore, updatedAt: new Date() })
    .where(eq(shotcounterTeams.id, teamId));
}

export async function deleteShotcounterTeam(teamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shotcounterTeams).where(eq(shotcounterTeams.id, teamId));
}

export async function resetShotcounterForYear(year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shotcounterTeams).where(eq(shotcounterTeams.year, year));
}

export async function resetShotcounterScoresForYear(year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shotcounterTeams)
    .set({ score: 0, updatedAt: new Date() })
    .where(eq(shotcounterTeams.year, year));
}

export async function getShotcounterTeamById(teamId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shotcounterTeams).where(eq(shotcounterTeams.id, teamId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// SHOTCOUNTER AUDIT LOG
// ============================================

export async function createAuditLog(log: InsertShotcounterAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(shotcounterAuditLog).values(log);
}

export async function getAuditLogsByTeam(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shotcounterAuditLog)
    .where(eq(shotcounterAuditLog.teamId, teamId))
    .orderBy(desc(shotcounterAuditLog.timestamp));
}

export async function getAllAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shotcounterAuditLog)
    .orderBy(desc(shotcounterAuditLog.timestamp))
    .limit(limit);
}

// ============================================
// SPONSORS
// ============================================

export async function getAllSponsors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sponsors)
    .where(eq(sponsors.isActive, true))
    .orderBy(sponsors.displayOrder);
}

export async function createSponsor(sponsor: InsertSponsor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sponsors).values(sponsor);
  return Number(result[0].insertId);
}

export async function updateSponsor(sponsorId: number, data: Partial<InsertSponsor>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sponsors).set(data).where(eq(sponsors.id, sponsorId));
}

export async function deleteSponsor(sponsorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sponsors).set({ isActive: false }).where(eq(sponsors.id, sponsorId));
}

// ============================================
// EVENTS
// ============================================

export async function getAllEvents(publishedOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  const query = publishedOnly 
    ? db.select().from(events).where(eq(events.isPublished, true))
    : db.select().from(events);
  return query.orderBy(desc(events.eventDate));
}

export async function getEventById(eventId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(events).values(event);
  return Number(result[0].insertId);
}

export async function updateEvent(eventId: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events).set(data).where(eq(events.id, eventId));
}

export async function deleteEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(events).where(eq(events.id, eventId));
}

export async function setEventThumbnail(eventId: number, photoId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events).set({ thumbnailPhotoId: photoId }).where(eq(events.id, eventId));
}

// ============================================
// PHOTOS
// ============================================

export async function getPhotosByEvent(eventId: number, publishedOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = publishedOnly 
    ? and(eq(photos.eventId, eventId), eq(photos.isPublished, true))
    : eq(photos.eventId, eventId);
  return db.select().from(photos)
    .where(conditions)
    .orderBy(photos.displayOrder);
}

export async function getAllPhotos(publishedOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  const query = publishedOnly 
    ? db.select().from(photos).where(eq(photos.isPublished, true))
    : db.select().from(photos);
  return query.orderBy(desc(photos.createdAt));
}

export async function createPhoto(photo: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(photos).values(photo);
  return Number(result[0].insertId);
}

export async function deletePhoto(photoId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(photos).where(eq(photos.id, photoId));
}

// ============================================
// TEAM MEMBERS
// ============================================

export async function getAllTeamMembers(activeOnly: boolean = true) {
  const db = await getDb();
  if (!db) return [];
  const query = activeOnly 
    ? db.select().from(teamMembers).where(eq(teamMembers.isActive, true)).orderBy(teamMembers.displayOrder)
    : db.select().from(teamMembers).orderBy(teamMembers.displayOrder);
  return query;
}

export async function createTeamMember(member: InsertTeamMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(teamMembers).values(member);
  return Number(result[0].insertId);
}

export async function updateTeamMember(memberId: number, data: Partial<InsertTeamMember>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(teamMembers).set(data).where(eq(teamMembers.id, memberId));
}

export async function deleteTeamMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(teamMembers).set({ isActive: false }).where(eq(teamMembers.id, memberId));
}

export async function reorderTeamMembers(memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update displayOrder for each member based on their position in the array
  for (let i = 0; i < memberIds.length; i++) {
    await db.update(teamMembers)
      .set({ displayOrder: i })
      .where(eq(teamMembers.id, memberIds[i]));
  }
}

// ============================================
// FEATURE TOGGLES
// ============================================

export async function getAllFeatureToggles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(featureToggles);
}

export async function getFeatureToggle(featureName: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(featureToggles)
    .where(eq(featureToggles.featureName, featureName))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setFeatureToggle(featureName: string, isEnabled: boolean, updatedBy?: number, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getFeatureToggle(featureName);
  if (existing) {
    await db.update(featureToggles)
      .set({ isEnabled, updatedBy, updatedAt: new Date(), ...(description !== undefined && { description }) })
      .where(eq(featureToggles.featureName, featureName));
  } else {
    await db.insert(featureToggles).values({
      featureName,
      isEnabled,
      updatedBy,
      ...(description !== undefined && { description })
    });
  }
}

// ============================================
// CONTACT SUBMISSIONS
// ============================================

export async function createContactSubmission(submission: InsertContactSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactSubmissions).values(submission);
  return Number(result[0].insertId);
}

export async function getAllContactSubmissions(includeArchived: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  const query = includeArchived 
    ? db.select().from(contactSubmissions)
    : db.select().from(contactSubmissions).where(eq(contactSubmissions.isArchived, false));
  return query.orderBy(desc(contactSubmissions.submittedAt));
}

export async function markContactSubmissionAsRead(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contactSubmissions)
    .set({ isRead: true })
    .where(eq(contactSubmissions.id, submissionId));
}


// ============================================
// GÖNNERMITGLIEDER (Sponsor Members)
// ============================================

export async function getAllGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goennermitglieder)
    .orderBy(goennermitglieder.membershipEndDate);
}

export async function getActiveGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(goennermitglieder)
    .where(and(
      eq(goennermitglieder.isActive, true),
      gte(goennermitglieder.membershipEndDate, now)
    ))
    .orderBy(goennermitglieder.membershipEndDate);
}

export async function getExpiredGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(goennermitglieder)
    .where(and(
      eq(goennermitglieder.isActive, true),
      lt(goennermitglieder.membershipEndDate, now)
    ))
    .orderBy(desc(goennermitglieder.membershipEndDate));
}

export async function createGoennermitglied(member: InsertGoennermitglied) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(goennermitglieder).values(member);
  return Number(result[0].insertId);
}

export async function updateGoennermitglied(memberId: number, data: Partial<InsertGoennermitglied>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(goennermitglieder).set(data).where(eq(goennermitglieder.id, memberId));
}

export async function extendGoennermitgliedschaft(memberId: number, years: number = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const member = await db.select().from(goennermitglieder)
    .where(eq(goennermitglieder.id, memberId))
    .limit(1);
  
  if (member.length === 0) throw new Error("Member not found");
  
  const currentEndDate = new Date(member[0].membershipEndDate);
  const now = new Date();
  
  // If membership is expired, extend from today; otherwise extend from current end date
  const baseDate = currentEndDate < now ? now : currentEndDate;
  const newEndDate = new Date(baseDate);
  newEndDate.setFullYear(newEndDate.getFullYear() + years);
  
  await db.update(goennermitglieder)
    .set({ membershipEndDate: newEndDate })
    .where(eq(goennermitglieder.id, memberId));
  
  return newEndDate;
}

export async function deleteGoennermitglied(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(goennermitglieder).where(eq(goennermitglieder.id, memberId));
}

// ============================================
// USER PROFILE PICTURE
// ============================================

export async function updateUserProfilePicture(userId: number, profilePictureUrl: string, profilePictureKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users)
    .set({ profilePictureUrl, profilePictureKey })
    .where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, displayName?: string, memberSince?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: { displayName?: string | null; memberSince?: Date | null } = {};
  if (displayName !== undefined) {
    updateData.displayName = displayName || null;
  }
  if (memberSince !== undefined) {
    updateData.memberSince = memberSince || null;
  }
  
  if (Object.keys(updateData).length > 0) {
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  }
}

// ============================================
// USER ACTIVITY LOG
// ============================================

export async function createActivityLog(log: InsertUserActivityLog) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create activity log: database not available");
    return;
  }
  try {
    await db.insert(userActivityLog).values(log);
  } catch (error) {
    console.error("[Database] Failed to create activity log:", error);
  }
}

export async function getAllActivityLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select()
    .from(userActivityLog)
    .orderBy(desc(userActivityLog.timestamp))
    .limit(limit);
}

export async function getActivityLogsByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select()
    .from(userActivityLog)
    .where(eq(userActivityLog.userId, userId))
    .orderBy(desc(userActivityLog.timestamp))
    .limit(limit);
}
