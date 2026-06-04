import { eq, desc, and, gte, lt, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
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
  rolePermissions,
  InsertShotcounterTeam,
  InsertShotcounterAuditLog,
  InsertSponsor,
  InsertEvent,
  InsertPhoto,
  InsertTeamMember,
  InsertFeatureToggle,
  InsertContactSubmission,
  InsertGoennermitglied,
  InsertUserActivityLog,
  InsertRolePermission,
  sdkSession,
  sdkGameLog,
  InsertSdkSession,
  InsertSdkGameLog,
  slideshowPhotos,
  slideshowSettings,
  SlideshowSettings,
  InsertSlideshowPhoto,
  InsertSlideshowSettings,
} from '../drizzle/schema';
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
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
    throw new Error('User openId is required for upsert');
  }

  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot upsert user: database not available');
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = [
      'name',
      'email',
      'loginMethod',
      'profilePictureUrl',
    ] as const;
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
    }
    // Admin assignment happens in server/_core/googleAuth.ts via ADMIN_EMAIL on first sign-in.

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
    console.error('[Database] Failed to upsert user:', error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn('[Database] Cannot get user: database not available');
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result[0] || null;
}

export async function updateUserRole(
  userId: number,
  role: 'admin' | 'maintainer' | 'editor' | 'user' | 'visitor',
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get user data to delete profile picture from storage
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user.length > 0 && user[0].profilePictureKey) {
    const { storageDelete } = await import('./storage');
    await storageDelete(user[0].profilePictureKey);
  }

  await db.delete(users).where(eq(users.id, userId));
}

// ============================================
// SHOTCOUNTER
// ============================================

export async function getShotcounterTeamsByYear(year: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shotcounterTeams)
    .where(
      and(eq(shotcounterTeams.year, year), isNull(shotcounterTeams.deletedAt)),
    )
    .orderBy(desc(shotcounterTeams.score));
}

export async function createShotcounterTeam(team: InsertShotcounterTeam) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(shotcounterTeams).values(team);
  return Number(result[0].insertId);
}

export async function updateShotcounterScore(teamId: number, newScore: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(shotcounterTeams)
    .set({ score: newScore, updatedAt: new Date() })
    .where(eq(shotcounterTeams.id, teamId));
}

export async function deleteShotcounterTeam(teamId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(shotcounterTeams)
    .set({ deletedAt: new Date() })
    .where(eq(shotcounterTeams.id, teamId));
}

export async function resetShotcounterForYear(year: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(shotcounterTeams).where(eq(shotcounterTeams.year, year));
}

export async function resetShotcounterScoresForYear(year: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(shotcounterTeams)
    .set({ score: 0, updatedAt: new Date() })
    .where(eq(shotcounterTeams.year, year));
}

export async function getShotcounterTeamById(teamId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(shotcounterTeams)
    .where(eq(shotcounterTeams.id, teamId))
    .limit(1);
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
  return db
    .select()
    .from(shotcounterAuditLog)
    .where(eq(shotcounterAuditLog.teamId, teamId))
    .orderBy(desc(shotcounterAuditLog.timestamp));
}

export async function getAllAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  const logs = await db
    .select({
      id: shotcounterAuditLog.id,
      teamId: shotcounterAuditLog.teamId,
      teamName: shotcounterTeams.name,
      action: shotcounterAuditLog.action,
      amount: shotcounterAuditLog.amount,
      previousScore: shotcounterAuditLog.previousScore,
      newScore: shotcounterAuditLog.newScore,
      performedBy: shotcounterAuditLog.performedBy,
      performedByName: shotcounterAuditLog.performedByName,
      timestamp: shotcounterAuditLog.timestamp,
      note: shotcounterAuditLog.note,
    })
    .from(shotcounterAuditLog)
    .leftJoin(
      shotcounterTeams,
      eq(shotcounterAuditLog.teamId, shotcounterTeams.id),
    )
    .orderBy(desc(shotcounterAuditLog.timestamp))
    .limit(limit);

  return logs;
}

// ============================================
// SPONSORS
// ============================================

export async function getAllSponsors() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sponsors)
    .where(eq(sponsors.isActive, true))
    .orderBy(sponsors.displayOrder);
}

export async function createSponsor(sponsor: InsertSponsor) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(sponsors).values(sponsor);
  return Number(result[0].insertId);
}

export async function updateSponsor(
  sponsorId: number,
  data: Partial<InsertSponsor>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05 / F-BE-001: snapshot the old logoKey *before* the update inside a
  // tx, then do the DB write atomically. S3 cleanup happens after commit so a
  // failed DB update doesn't orphan a deleted asset. Storage is fire-and-forget
  // — if the DB commit succeeds but the S3 delete fails, we log and move on
  // rather than throwing (orphaned blobs are recoverable; failed mutations are
  // worse for the caller).
  const oldLogoKeyToDelete = await db.transaction(async tx => {
    let oldKey: string | null = null;
    if (data.logoKey) {
      const oldSponsor = await tx
        .select()
        .from(sponsors)
        .where(eq(sponsors.id, sponsorId))
        .limit(1);
      if (
        oldSponsor.length > 0 &&
        oldSponsor[0].logoKey &&
        oldSponsor[0].logoKey !== data.logoKey
      ) {
        oldKey = oldSponsor[0].logoKey;
      }
    }
    await tx.update(sponsors).set(data).where(eq(sponsors.id, sponsorId));
    return oldKey;
  });

  if (oldLogoKeyToDelete) {
    try {
      const { storageDelete } = await import('./storage');
      await storageDelete(oldLogoKeyToDelete);
    } catch (err) {
      console.error(
        '[Database] Failed to delete old sponsor logo from storage:',
        err,
      );
    }
  }
}

export async function deleteSponsor(sponsorId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get sponsor data to delete logo from storage
  const sponsor = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  if (sponsor.length > 0 && sponsor[0].logoKey) {
    const { storageDelete } = await import('./storage');
    await storageDelete(sponsor[0].logoKey);
  }

  await db
    .update(sponsors)
    .set({ isActive: false })
    .where(eq(sponsors.id, sponsorId));
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
  const result = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEvent(
  event: InsertEvent & { eventLinks?: Array<{ url: string; label: string }> },
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const { eventLinks, ...rest } = event as any;
  const insertData = {
    ...rest,
    eventLinks: eventLinks ? JSON.stringify(eventLinks) : null,
  };
  const result = await db.insert(events).values(insertData);
  return Number(result[0].insertId);
}

export async function updateEvent(
  eventId: number,
  data: Partial<InsertEvent> & {
    eventLinks?: Array<{ url: string; label: string }>;
  },
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const { eventLinks, ...rest } = data as any;
  const updateData: any = { ...rest };
  if (eventLinks !== undefined) {
    updateData.eventLinks = eventLinks ? JSON.stringify(eventLinks) : null;
  }
  await db.update(events).set(updateData).where(eq(events.id, eventId));
}

export async function deleteEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05 / F-BE-001: snapshot photo S3 keys, then delete the event row in
  // a transaction (photos cascade-delete via FK). Only after commit do we
  // touch S3 — that way a failed DB delete doesn't orphan deleted assets.
  // S3 deletes are best-effort: orphaned blobs are recoverable, a failed
  // mutation that throws after partial cleanup is not.
  const keysToDelete = await db.transaction(async tx => {
    const eventPhotos = await tx
      .select()
      .from(photos)
      .where(eq(photos.eventId, eventId));

    await tx.delete(events).where(eq(events.id, eventId));

    const keys: string[] = [];
    for (const photo of eventPhotos) {
      if (photo.imageKey) keys.push(photo.imageKey);
      if (photo.compressedKey) keys.push(photo.compressedKey);
      if (photo.thumbnailKey) keys.push(photo.thumbnailKey);
    }
    return keys;
  });

  if (keysToDelete.length > 0) {
    const { storageDelete } = await import('./storage');
    for (const key of keysToDelete) {
      try {
        await storageDelete(key);
      } catch (err) {
        console.error(
          `[Database] Failed to delete event-photo asset ${key}:`,
          err,
        );
      }
    }
  }
}

export async function setEventThumbnail(eventId: number, photoId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(events)
    .set({ thumbnailPhotoId: photoId })
    .where(eq(events.id, eventId));
}

// ============================================
// PHOTOS
// ============================================

export async function getPhotosByEvent(
  eventId: number,
  publishedOnly: boolean = false,
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = publishedOnly
    ? and(eq(photos.eventId, eventId), eq(photos.isPublished, true))
    : eq(photos.eventId, eventId);
  return db
    .select()
    .from(photos)
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
  if (!db) throw new Error('Database not available');
  const result = await db.insert(photos).values(photo);
  return Number(result[0].insertId);
}

export async function deletePhoto(photoId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get photo data to delete from storage
  const photo = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (photo.length > 0) {
    const { storageDelete } = await import('./storage');
    // Delete original image
    if (photo[0].imageKey) {
      await storageDelete(photo[0].imageKey);
    }
    // Delete compressed version
    if (photo[0].compressedKey) {
      await storageDelete(photo[0].compressedKey);
    }
    // Delete thumbnail
    if (photo[0].thumbnailKey) {
      await storageDelete(photo[0].thumbnailKey);
    }
  }

  await db.delete(photos).where(eq(photos.id, photoId));
}

// ============================================
// TEAM MEMBERS
// ============================================

export async function getAllTeamMembers(activeOnly: boolean = true) {
  const db = await getDb();
  if (!db) return [];
  const query = activeOnly
    ? db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.isActive, true))
        .orderBy(teamMembers.displayOrder)
    : db.select().from(teamMembers).orderBy(teamMembers.displayOrder);
  return query;
}

export async function createTeamMember(member: InsertTeamMember) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(teamMembers).values(member);
  return Number(result[0].insertId);
}

export async function updateTeamMember(
  memberId: number,
  data: Partial<InsertTeamMember>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // If photoKey is being updated, delete the old photos from storage
  if (data.photoKey || data.compressedPhotoKey) {
    const oldMember = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);
    if (oldMember.length > 0) {
      const { storageDelete } = await import('./storage');
      // Delete old original photo if new one is provided
      if (
        data.photoKey &&
        oldMember[0].photoKey &&
        oldMember[0].photoKey !== data.photoKey
      ) {
        await storageDelete(oldMember[0].photoKey);
      }
      // Delete old compressed photo if new one is provided
      if (
        data.compressedPhotoKey &&
        oldMember[0].compressedPhotoKey &&
        oldMember[0].compressedPhotoKey !== data.compressedPhotoKey
      ) {
        await storageDelete(oldMember[0].compressedPhotoKey);
      }
    }
  }

  await db.update(teamMembers).set(data).where(eq(teamMembers.id, memberId));
}

export async function deleteTeamMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get team member data to delete photo from storage
  const member = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, memberId))
    .limit(1);
  if (member.length > 0) {
    const { storageDelete } = await import('./storage');
    // Delete original photo
    if (member[0].photoKey) {
      await storageDelete(member[0].photoKey);
    }
    // Delete compressed photo
    if (member[0].compressedPhotoKey) {
      await storageDelete(member[0].compressedPhotoKey);
    }
  }

  await db
    .update(teamMembers)
    .set({ isActive: false })
    .where(eq(teamMembers.id, memberId));
}

export async function reorderTeamMembers(memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Run all updates in parallel instead of sequentially
  await Promise.all(
    memberIds.map((id, i) =>
      db
        .update(teamMembers)
        .set({ displayOrder: i })
        .where(eq(teamMembers.id, id)),
    ),
  );
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
  const result = await db
    .select()
    .from(featureToggles)
    .where(eq(featureToggles.featureName, featureName))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setFeatureToggle(
  featureName: string,
  isEnabled: boolean,
  updatedBy?: number,
  description?: string,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const existing = await getFeatureToggle(featureName);
  if (existing) {
    await db
      .update(featureToggles)
      .set({
        isEnabled,
        updatedBy,
        updatedAt: new Date(),
        ...(description !== undefined && { description }),
      })
      .where(eq(featureToggles.featureName, featureName));
  } else {
    await db.insert(featureToggles).values({
      featureName,
      isEnabled,
      updatedBy,
      ...(description !== undefined && { description }),
    });
  }
}

// ============================================
// CONTACT SUBMISSIONS
// ============================================

export async function createContactSubmission(
  submission: InsertContactSubmission,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(contactSubmissions).values(submission);
  return Number(result[0].insertId);
}

export async function getAllContactSubmissions(
  includeArchived: boolean = false,
) {
  const db = await getDb();
  if (!db) return [];
  const query = includeArchived
    ? db.select().from(contactSubmissions)
    : db
        .select()
        .from(contactSubmissions)
        .where(eq(contactSubmissions.isArchived, false));
  return query.orderBy(desc(contactSubmissions.submittedAt));
}

export async function markContactSubmissionAsRead(submissionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(contactSubmissions)
    .set({ isRead: true })
    .where(eq(contactSubmissions.id, submissionId));
}

// ============================================
// GÖNNERMITGLIEDER (Sponsor Members)
// ============================================

export async function getAllGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(goennermitglieder)
    .orderBy(goennermitglieder.membershipEndDate);
}

export async function getActiveGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(goennermitglieder)
    .where(
      and(
        eq(goennermitglieder.isActive, true),
        gte(goennermitglieder.membershipEndDate, now),
      ),
    )
    .orderBy(goennermitglieder.membershipEndDate);
}

export async function getExpiredGoennermitglieder() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(goennermitglieder)
    .where(
      and(
        eq(goennermitglieder.isActive, true),
        lt(goennermitglieder.membershipEndDate, now),
      ),
    )
    .orderBy(desc(goennermitglieder.membershipEndDate));
}

export async function createGoennermitglied(member: InsertGoennermitglied) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(goennermitglieder).values(member);
  return Number(result[0].insertId);
}

export async function updateGoennermitglied(
  memberId: number,
  data: Partial<InsertGoennermitglied>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(goennermitglieder)
    .set(data)
    .where(eq(goennermitglieder.id, memberId));
}

export async function extendGoennermitgliedschaft(
  memberId: number,
  years: number = 1,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const member = await db
    .select()
    .from(goennermitglieder)
    .where(eq(goennermitglieder.id, memberId))
    .limit(1);

  if (member.length === 0) throw new Error('Member not found');

  const currentEndDate = new Date(member[0].membershipEndDate);
  const now = new Date();

  // If membership is expired, extend from today; otherwise extend from current end date
  const baseDate = currentEndDate < now ? now : currentEndDate;
  const newEndDate = new Date(baseDate);
  newEndDate.setFullYear(newEndDate.getFullYear() + years);

  await db
    .update(goennermitglieder)
    .set({ membershipEndDate: newEndDate })
    .where(eq(goennermitglieder.id, memberId));

  return newEndDate;
}

export async function deleteGoennermitglied(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(goennermitglieder).where(eq(goennermitglieder.id, memberId));
}

// ============================================
// USER PROFILE PICTURE
// ============================================

export async function updateUserProfilePicture(
  userId: number,
  profilePictureUrl: string,
  profilePictureKey: string,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Delete old profile picture from storage
  const oldUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (
    oldUser.length > 0 &&
    oldUser[0].profilePictureKey &&
    oldUser[0].profilePictureKey !== profilePictureKey
  ) {
    const { storageDelete } = await import('./storage');
    await storageDelete(oldUser[0].profilePictureKey);
  }

  await db
    .update(users)
    .set({ profilePictureUrl, profilePictureKey })
    .where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: number,
  displayName?: string,
  memberSince?: Date,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const updateData: { displayName?: string | null; memberSince?: Date | null } =
    {};
  if (displayName !== undefined) {
    updateData.displayName = displayName || null;
  }
  if (memberSince !== undefined) {
    updateData.memberSince = memberSince || null;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }
}

// ============================================
// USER ACTIVITY LOG
// ============================================

export async function createActivityLog(log: InsertUserActivityLog) {
  const db = await getDb();
  if (!db) {
    console.warn(
      '[Database] Cannot create activity log: database not available',
    );
    return;
  }
  try {
    await db.insert(userActivityLog).values(log);
  } catch (error) {
    console.error('[Database] Failed to create activity log:', error);
  }
}

export async function getAllActivityLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(userActivityLog)
    .orderBy(desc(userActivityLog.timestamp))
    .limit(limit);
}

export async function getActivityLogsByUser(
  userId: number,
  limit: number = 50,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(userActivityLog)
    .where(eq(userActivityLog.userId, userId))
    .orderBy(desc(userActivityLog.timestamp))
    .limit(limit);
}

// ============================================
// ROLE PERMISSIONS
// ============================================

export async function getAllPermissions() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(rolePermissions);
}

export async function addPermission(
  permissionKey: string,
  role: 'admin' | 'maintainer' | 'editor' | 'user',
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.insert(rolePermissions).values({
      permissionKey,
      role,
    });
    return { success: true };
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'Permission already exists' };
    }
    throw error;
  }
}

export async function removePermission(
  permissionKey: string,
  role: 'admin' | 'maintainer' | 'editor' | 'user',
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .delete(rolePermissions)
    .where(
      and(
        eq(rolePermissions.permissionKey, permissionKey),
        eq(rolePermissions.role, role),
      ),
    );
  return { success: true };
}

export async function initializeDefaultPermissions() {
  const db = await getDb();
  if (!db) {
    console.warn(
      '[Database] Cannot initialize permissions: database not available',
    );
    return;
  }

  // Check if permissions already exist
  const existing = await db.select().from(rolePermissions).limit(1);
  if (existing.length > 0) {
    console.log('[Database] Permissions already initialized');
    return;
  }

  // Default permissions based on current PERMISSIONS array in Dashboard
  const defaultPermissions = [
    { permissionKey: 'edit_events', roles: ['admin', 'maintainer', 'editor'] },
    { permissionKey: 'manage_sponsors', roles: ['admin', 'maintainer'] },
    {
      permissionKey: 'manage_goennermitglieder',
      roles: ['admin', 'maintainer'],
    },
    {
      permissionKey: 'edit_shotcounter',
      roles: ['admin', 'maintainer', 'editor'],
    },
    { permissionKey: 'reset_shotcounter', roles: ['admin'] },
    { permissionKey: 'edit_team', roles: ['admin', 'maintainer'] },
    // A-P0-05: attendance mutations require manage_attendance.
    { permissionKey: 'manage_attendance', roles: ['admin', 'maintainer'] },
    { permissionKey: 'manage_slideshow', roles: ['admin', 'maintainer'] },
  ];

  try {
    for (const perm of defaultPermissions) {
      for (const role of perm.roles) {
        await db.insert(rolePermissions).values({
          permissionKey: perm.permissionKey,
          role: role as 'admin' | 'maintainer' | 'editor' | 'user',
        });
      }
    }
    console.log('[Database] Default permissions initialized successfully');
  } catch (error) {
    console.error(
      '[Database] Failed to initialize default permissions:',
      error,
    );
  }
}

// ============================================
// SCHLAG DEN KASSIER (SDK) OVERLAY
// ============================================

export async function sdkGetActiveSession() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(sdkSession)
    .where(eq(sdkSession.isActive, true))
    .orderBy(desc(sdkSession.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function sdkGetSession(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(sdkSession)
    .where(eq(sdkSession.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function sdkCreateSession(
  data: Omit<InsertSdkSession, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Auto-set currentGameName from first entry in gameNames if not already set
  let initialGameName = data.currentGameName ?? '';
  if (!initialGameName && data.gameNames) {
    try {
      const names: string[] = JSON.parse(data.gameNames);
      initialGameName = names[0] ?? '';
    } catch {
      /* ignore */
    }
  }

  // B-P0-05 / B-P1-07: deactivate-then-insert in a single transaction so a
  // failure between the two leaves no inconsistent "all sessions inactive"
  // state. Also adds the previously missing `WHERE isActive = true` so
  // historical rows aren't pointlessly rewritten on every new session.
  const newId = await db.transaction(async tx => {
    await tx
      .update(sdkSession)
      .set({ isActive: false })
      .where(eq(sdkSession.isActive, true));

    const result = await tx
      .insert(sdkSession)
      .values({ ...data, isActive: true, currentGameName: initialGameName });
    return (result as any)[0]?.insertId ?? (result as any).insertId;
  });

  return sdkGetSession(newId);
}

export async function sdkUpdateSession(
  id: number,
  data: Partial<InsertSdkSession>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(sdkSession).set(data).where(eq(sdkSession.id, id));
  return sdkGetSession(id);
}

export async function sdkAwardPoint(sessionId: number, winnerId: 1 | 2) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const session = await sdkGetSession(sessionId);
  if (!session) throw new Error('Session not found');
  if (!session.isActive) throw new Error('Session is not active');
  if (session.winnerId !== null) throw new Error('Sieger ist bereits festgestellt');

  const gameNumber = session.currentGame;
  const points = gameNumber; // game N awards N points

  // Update scores and advance game
  const newPlayer1Score = session.player1Score + (winnerId === 1 ? points : 0);
  const newPlayer2Score = session.player2Score + (winnerId === 2 ? points : 0);
  const nextGame = gameNumber + 1;
  const isLastGame = gameNumber >= session.totalGames;

  // Calculate max remaining points (sum from nextGame to totalGames)
  const remainingGames = session.totalGames - gameNumber; // games after this one
  const maxRemaining =
    remainingGames > 0
      ? Array.from(
          { length: remainingGames },
          (_, i) => gameNumber + 1 + i,
        ).reduce((a, b) => a + b, 0)
      : 0;

  // Check if winner is already decided
  let newWinnerId: number | null = null;
  if (isLastGame) {
    // Last game played — determine winner
    newWinnerId =
      newPlayer1Score > newPlayer2Score
        ? 1
        : newPlayer1Score < newPlayer2Score
          ? 2
          : null;
  } else {
    // Check if any player can no longer be caught
    if (newPlayer1Score > newPlayer2Score + maxRemaining) newWinnerId = 1;
    else if (newPlayer2Score > newPlayer1Score + maxRemaining) newWinnerId = 2;
  }

  // Auto-set next game name from pre-defined list if available
  let nextGameName = '';
  if (!isLastGame && session.gameNames) {
    try {
      const names: string[] = JSON.parse(session.gameNames);
      const nextIndex = nextGame - 1; // 0-based
      nextGameName = names[nextIndex] ?? '';
    } catch {
      /* ignore parse errors */
    }
  }

  // B-P0-05 / F-BE-001: wrap the audit-log insert + session update in one
  // transaction so we never have a game log row without the matching score
  // bump (or vice versa).
  await db.transaction(async tx => {
    await tx.insert(sdkGameLog).values({
      sessionId,
      gameNumber,
      gameName: session.currentGameName ?? '',
      pointsAwarded: points,
      winnerId,
    } as InsertSdkGameLog);

    await tx
      .update(sdkSession)
      .set({
        player1Score: newPlayer1Score,
        player2Score: newPlayer2Score,
        currentGame: isLastGame ? gameNumber : nextGame,
        winnerId: newWinnerId,
        isActive: true, // keep active for display
        currentGameName: nextGameName,
      })
      .where(eq(sdkSession.id, sessionId));
  });

  return sdkGetSession(sessionId);
}

export async function sdkGetGameLog(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sdkGameLog)
    .where(eq(sdkGameLog.sessionId, sessionId))
    .orderBy(sdkGameLog.gameNumber);
}

export async function sdkDeleteGameLogEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(sdkGameLog).where(eq(sdkGameLog.id, id));
}

export async function sdkDeleteSessionGameLog(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(sdkGameLog).where(eq(sdkGameLog.sessionId, sessionId));
}

// ============================================
// LIVE-DIASHOW (SLIDESHOW)
// ============================================

/** Single-Row Settings; legt die Row mit frischem Token an, falls sie fehlt. */
export async function getSlideshowSettings(): Promise<SlideshowSettings> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db
    .select()
    .from(slideshowSettings)
    .where(eq(slideshowSettings.id, 1))
    .limit(1);
  if (existing.length > 0) return existing[0];
  // Single-row table (id=1). Idempotent create — concurrent first-hits collide
  // on the primary key instead of inserting duplicate settings rows.
  await db
    .insert(slideshowSettings)
    .values({ id: 1, uploadToken: nanoid(16) })
    .onDuplicateKeyUpdate({ set: { id: 1 } });
  const created = await db
    .select()
    .from(slideshowSettings)
    .where(eq(slideshowSettings.id, 1))
    .limit(1);
  return created[0];
}

export async function updateSlideshowSettings(
  patch: Partial<InsertSlideshowSettings>,
  updatedBy: number | null,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const settings = await getSlideshowSettings();
  await db
    .update(slideshowSettings)
    .set({ ...patch, updatedBy })
    .where(eq(slideshowSettings.id, settings.id));
}

export async function bumpPhotoVersion(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const settings = await getSlideshowSettings();
  await db
    .update(slideshowSettings)
    .set({ photoVersion: settings.photoVersion + 1 })
    .where(eq(slideshowSettings.id, settings.id));
}

export async function createSlideshowPhoto(
  data: InsertSlideshowPhoto,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(slideshowPhotos).values(data);
  return Number(result[0].insertId);
}

export async function listApprovedSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.status, 'approved'))
    .orderBy(slideshowPhotos.createdAt);
}

export async function listPendingSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.status, 'pending'))
    .orderBy(slideshowPhotos.createdAt);
}

export async function listAllSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .orderBy(desc(slideshowPhotos.createdAt));
}

export async function getSlideshowPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.id, id))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function approveSlideshowPhoto(
  id: number,
  moderatedBy: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(slideshowPhotos)
    .set({ status: 'approved', moderatedBy, moderatedAt: new Date() })
    .where(eq(slideshowPhotos.id, id));
}

export async function approveAllPendingSlideshowPhotos(
  moderatedBy: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(slideshowPhotos)
    .set({ status: 'approved', moderatedBy, moderatedAt: new Date() })
    .where(eq(slideshowPhotos.status, 'pending'));
}

/** Löscht Row, gibt die Storage-Keys zum Unlink zurück. */
export async function deleteSlideshowPhoto(
  id: number,
): Promise<{ displayKey: string; thumbnailKey: string } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const photo = await getSlideshowPhotoById(id);
  if (!photo) return undefined;
  await db.delete(slideshowPhotos).where(eq(slideshowPhotos.id, id));
  return { displayKey: photo.displayKey, thumbnailKey: photo.thumbnailKey };
}

/** Löscht alle Rows, gibt alle Storage-Keys zum Unlink zurück. */
export async function clearAllSlideshowPhotos(): Promise<
  Array<{ displayKey: string; thumbnailKey: string }>
> {
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select({
      displayKey: slideshowPhotos.displayKey,
      thumbnailKey: slideshowPhotos.thumbnailKey,
    })
    .from(slideshowPhotos);
  await db.delete(slideshowPhotos);
  return all;
}

export async function getSlideshowStats(): Promise<{
  pending: number;
  approved: number;
  totalBytes: number;
}> {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, totalBytes: 0 };
  const rows = await db
    .select({ status: slideshowPhotos.status, bytes: slideshowPhotos.bytes })
    .from(slideshowPhotos);
  let pending = 0;
  let approved = 0;
  let totalBytes = 0;
  for (const r of rows) {
    if (r.status === 'approved') approved++;
    else pending++;
    totalBytes += r.bytes;
  }
  return { pending, approved, totalBytes };
}
