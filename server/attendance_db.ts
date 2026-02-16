import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import { 
  attendanceSessions, 
  attendanceMembers, 
  attendanceRecords,
  attendanceSettings,
  type InsertAttendanceSession,
  type InsertAttendanceMember,
  type InsertAttendanceRecord,
  type InsertAttendanceSetting
} from "../drizzle/schema";

// ============================================
// SESSIONS
// ============================================

export async function listAttendanceSessions(year?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select().from(attendanceSessions);
  
  if (year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    query = query.where(
      and(
        gte(attendanceSessions.date, startDate),
        lte(attendanceSessions.date, endDate)
      )
    ) as any;
  }
  
  return query.orderBy(desc(attendanceSessions.date));
}

export async function getAttendanceSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, sessionId))
    .limit(1);
  
  return result[0] || null;
}

export async function createAttendanceSession(session: InsertAttendanceSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(attendanceSessions).values(session);
  return Number(result[0].insertId);
}

export async function updateAttendanceSession(sessionId: number, data: Partial<InsertAttendanceSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(attendanceSessions)
    .set(data)
    .where(eq(attendanceSessions.id, sessionId));
}

export async function deleteAttendanceSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Records will be deleted automatically due to CASCADE
  await db
    .delete(attendanceSessions)
    .where(eq(attendanceSessions.id, sessionId));
}

// ============================================
// MEMBERS
// ============================================

export async function listAttendanceMembers(activeOnly = true) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select().from(attendanceMembers);
  
  if (activeOnly) {
    query = query.where(eq(attendanceMembers.isActive, true)) as any;
  }
  
  return query.orderBy(attendanceMembers.displayOrder, attendanceMembers.name);
}

export async function getAttendanceMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(attendanceMembers)
    .where(eq(attendanceMembers.id, memberId))
    .limit(1);
  
  return result[0] || null;
}

export async function createAttendanceMember(member: InsertAttendanceMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(attendanceMembers).values(member);
  return Number(result[0].insertId);
}

export async function updateAttendanceMember(memberId: number, data: Partial<InsertAttendanceMember>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(attendanceMembers)
    .set(data)
    .where(eq(attendanceMembers.id, memberId));
}

export async function deleteAttendanceMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Soft delete
  await db
    .update(attendanceMembers)
    .set({ isActive: false })
    .where(eq(attendanceMembers.id, memberId));
}

export async function reorderAttendanceMembers(memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (let i = 0; i < memberIds.length; i++) {
    await db
      .update(attendanceMembers)
      .set({ displayOrder: i })
      .where(eq(attendanceMembers.id, memberIds[i]));
  }
}

// ============================================
// RECORDS
// ============================================

export async function listAttendanceRecords(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId))
    .orderBy(attendanceRecords.memberId);
}

export async function getAttendanceRecord(sessionId: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.memberId, memberId)
      )
    )
    .limit(1);
  
  return result[0] || null;
}

export async function upsertAttendanceRecord(record: InsertAttendanceRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if record exists
  const existing = await getAttendanceRecord(record.sessionId, record.memberId);
  
  if (existing) {
    // Update existing record
    await db
      .update(attendanceRecords)
      .set({
        status: record.status,
        notes: record.notes,
      })
      .where(eq(attendanceRecords.id, existing.id));
    return existing.id;
  } else {
    // Insert new record
    const result = await db.insert(attendanceRecords).values(record);
    return Number(result[0].insertId);
  }
}

export async function bulkUpsertAttendanceRecords(sessionId: number, records: Array<{ memberId: number; status: "present" | "partial" | "absent"; notes?: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const record of records) {
    await upsertAttendanceRecord({
      sessionId,
      memberId: record.memberId,
      status: record.status,
      notes: record.notes,
    });
  }
}

// ============================================
// SETTINGS
// ============================================

export async function getAttendanceSetting(key: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(attendanceSettings)
    .where(eq(attendanceSettings.settingKey, key))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertAttendanceSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getAttendanceSetting(key);
  
  if (existing) {
    await db
      .update(attendanceSettings)
      .set({ settingValue: value })
      .where(eq(attendanceSettings.settingKey, key));
  } else {
    await db.insert(attendanceSettings).values({
      settingKey: key,
      settingValue: value,
    });
  }
}

// ============================================
// STATISTICS
// ============================================

export async function getAttendanceStatistics(year?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get event weight multiplier
  const weightSetting = await getAttendanceSetting("event_weight_multiplier");
  const eventWeight = weightSetting ? parseFloat(weightSetting.settingValue) : 2.0;
  
  // Get all sessions
  const sessions = await listAttendanceSessions(year);
  
  // Get all members
  const members = await listAttendanceMembers(true);
  
  // Get all records
  const allRecords = await db
    .select()
    .from(attendanceRecords)
    .where(
      year 
        ? sql`${attendanceRecords.sessionId} IN (SELECT id FROM attendance_sessions WHERE YEAR(date) = ${year})`
        : sql`1=1`
    );
  
  // Calculate statistics per member
  const memberStats = members.map(member => {
    const memberRecords = allRecords.filter(r => r.memberId === member.id);
    
    let totalSessions = 0;
    let presentCount = 0;
    let partialCount = 0;
    let absentCount = 0;
    let weightedAbsences = 0;
    
    sessions.forEach(session => {
      const record = memberRecords.find(r => r.sessionId === session.id);
      const weight = session.type === "event" ? eventWeight : 1.0;
      
      totalSessions++;
      
      if (record) {
        if (record.status === "present") {
          presentCount++;
        } else if (record.status === "partial") {
          partialCount++;
          weightedAbsences += 0.5 * weight; // Partial counts as half absence
        } else {
          absentCount++;
          weightedAbsences += weight;
        }
      } else {
        // No record = absent
        absentCount++;
        weightedAbsences += weight;
      }
    });
    
    const attendanceRate = totalSessions > 0 
      ? ((presentCount + partialCount * 0.5) / totalSessions) * 100 
      : 0;
    
    return {
      memberId: member.id,
      memberName: member.name,
      totalSessions,
      presentCount,
      partialCount,
      absentCount,
      attendanceRate,
      weightedAbsences,
    };
  });
  
  // Sort by weighted absences (worst first)
  memberStats.sort((a, b) => b.weightedAbsences - a.weightedAbsences);
  
  // Session statistics
  const meetingCount = sessions.filter(s => s.type === "meeting").length;
  const eventCount = sessions.filter(s => s.type === "event").length;
  
  // Average attendance rate
  const avgAttendanceRate = memberStats.length > 0
    ? memberStats.reduce((sum, m) => sum + m.attendanceRate, 0) / memberStats.length
    : 0;
  
  // Best and worst attendance
  const bestMember = memberStats.length > 0 ? memberStats[memberStats.length - 1] : null;
  const worstMember = memberStats.length > 0 ? memberStats[0] : null;
  
  return {
    memberStats,
    totalSessions: sessions.length,
    meetingCount,
    eventCount,
    avgAttendanceRate,
    bestMember,
    worstMember,
    eventWeight,
  };
}
