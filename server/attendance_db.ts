import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { getDb } from './db';
import {
  attendanceSessions,
  attendanceMembers,
  attendanceRecords,
  attendanceSettings,
  type InsertAttendanceSession,
  type InsertAttendanceMember,
  type InsertAttendanceRecord,
  type InsertAttendanceSetting,
} from '../drizzle/schema';

// ============================================
// SESSIONS
// ============================================

export async function listAttendanceSessions(year?: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  let query = db.select().from(attendanceSessions);

  if (year) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    query = query.where(
      and(
        gte(attendanceSessions.date, startDate),
        lte(attendanceSessions.date, endDate),
      ),
    ) as any;
  }

  return query.orderBy(desc(attendanceSessions.date));
}

export async function getAttendanceSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.id, sessionId))
    .limit(1);

  return result[0] || null;
}

export async function createAttendanceSession(
  session: InsertAttendanceSession,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.insert(attendanceSessions).values(session);
  return Number(result[0].insertId);
}

export async function updateAttendanceSession(
  sessionId: number,
  data: Partial<InsertAttendanceSession>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(attendanceSessions)
    .set(data)
    .where(eq(attendanceSessions.id, sessionId));
}

export async function deleteAttendanceSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

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
  if (!db) throw new Error('Database not available');

  let query = db.select().from(attendanceMembers);

  if (activeOnly) {
    query = query.where(eq(attendanceMembers.isActive, true)) as any;
  }

  return query.orderBy(attendanceMembers.displayOrder, attendanceMembers.name);
}

export async function getAttendanceMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db
    .select()
    .from(attendanceMembers)
    .where(eq(attendanceMembers.id, memberId))
    .limit(1);

  return result[0] || null;
}

export async function createAttendanceMember(member: InsertAttendanceMember) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.insert(attendanceMembers).values(member);
  return Number(result[0].insertId);
}

export async function updateAttendanceMember(
  memberId: number,
  data: Partial<InsertAttendanceMember>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(attendanceMembers)
    .set(data)
    .where(eq(attendanceMembers.id, memberId));
}

export async function deleteAttendanceMember(memberId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Soft delete
  await db
    .update(attendanceMembers)
    .set({ isActive: false })
    .where(eq(attendanceMembers.id, memberId));
}

export async function reorderAttendanceMembers(memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P1-06 / F-BE-015: parallelize the per-row updates (mirrors
  // reorderTeamMembers in db.ts). MySQL handles N concurrent UPDATEs fine and
  // this drops a 30-member reorder from 30 sequential RTs to one batched
  // burst.
  await Promise.all(
    memberIds.map((id, i) =>
      db
        .update(attendanceMembers)
        .set({ displayOrder: i })
        .where(eq(attendanceMembers.id, id)),
    ),
  );
}

// ============================================
// RECORDS
// ============================================

export async function listAttendanceRecords(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  return db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId))
    .orderBy(attendanceRecords.memberId);
}

export async function getAttendanceRecord(sessionId: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.memberId, memberId),
      ),
    )
    .limit(1);

  return result[0] || null;
}

export async function upsertAttendanceRecord(record: InsertAttendanceRecord) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

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

export async function bulkUpsertAttendanceRecords(
  sessionId: number,
  records: Array<{
    memberId: number;
    status: 'present' | 'partial' | 'absent';
    notes?: string;
  }>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  if (records.length === 0) return;

  // B-P1-03 / F-BE-005: one INSERT ... ON DUPLICATE KEY UPDATE replaces the
  // previous per-record SELECT-then-INSERT-or-UPDATE loop (which was 2×N
  // round trips). Relies on the `unique_session_member` UNIQUE index on
  // (sessionId, memberId) already declared in drizzle/schema.ts.
  const rows: InsertAttendanceRecord[] = records.map(r => ({
    sessionId,
    memberId: r.memberId,
    status: r.status,
    notes: r.notes,
  }));

  await db
    .insert(attendanceRecords)
    .values(rows)
    .onDuplicateKeyUpdate({
      set: {
        status: sql`VALUES(${attendanceRecords.status})`,
        notes: sql`VALUES(${attendanceRecords.notes})`,
      },
    });
}

// ============================================
// SETTINGS
// ============================================

export async function getAttendanceSetting(key: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db
    .select()
    .from(attendanceSettings)
    .where(eq(attendanceSettings.settingKey, key))
    .limit(1);

  return result[0] || null;
}

export async function upsertAttendanceSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

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
  if (!db) throw new Error('Database not available');

  // Get event weight multiplier. settingValue is a free-form text column and
  // schema changes here are often applied straight to MySQL, so the row can
  // hold something updateEventWeight would never write. Every rate below runs
  // through this factor — a NaN or 0 would silently render the whole page at
  // 0%, so fall back instead. Number() rather than parseFloat() on purpose:
  // parseFloat('2,5') returns 2 and would quietly apply the wrong weight.
  const weightSetting = await getAttendanceSetting('event_weight_multiplier');
  const parsedWeight = weightSetting ? Number(weightSetting.settingValue) : NaN;
  const eventWeight =
    Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 2.0;

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
        : sql`1=1`,
    );

  // Total session weight — identical for every member (each is evaluated
  // against every session), so it doubles as the denominator of the weighted
  // attendance rate below.
  const weightedTotalSessions = sessions.reduce(
    (sum, session) => sum + (session.type === 'event' ? eventWeight : 1.0),
    0,
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
      const weight = session.type === 'event' ? eventWeight : 1.0;

      totalSessions++;

      if (record) {
        if (record.status === 'present') {
          presentCount++;
        } else if (record.status === 'partial') {
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

    // Weighted attendance rate — the counterpart of weightedAbsences, so the
    // number shown to users and the ranking below agree by construction. An
    // event absence costs eventWeight times what a meeting absence costs.
    const weightedAttendanceRate =
      weightedTotalSessions > 0
        ? ((weightedTotalSessions - weightedAbsences) / weightedTotalSessions) *
          100
        : 0;

    return {
      memberId: member.id,
      memberName: member.name,
      totalSessions,
      presentCount,
      partialCount,
      absentCount,
      weightedAttendanceRate,
      weightedAbsences,
    };
  });

  // Sort by weighted absences (worst first)
  memberStats.sort((a, b) => b.weightedAbsences - a.weightedAbsences);

  // Session statistics
  const meetingCount = sessions.filter(s => s.type === 'meeting').length;
  const eventCount = sessions.filter(s => s.type === 'event').length;

  // Average weighted attendance rate
  const avgWeightedAttendanceRate =
    memberStats.length > 0
      ? memberStats.reduce((sum, m) => sum + m.weightedAttendanceRate, 0) /
        memberStats.length
      : 0;

  // Each card derives from its own metric rather than from the two ends of one
  // sort: "Beste Anwesenheit" ranks on the attendance rate, "Meiste Fehlzeiten"
  // on weighted absences. Each card currently lands on the same member it would
  // have under the old shared sort — the total session weight is identical for
  // everyone, so the two metrics are strictly anti-correlated — but that stops
  // holding the moment members are scored over
  // different session sets (e.g. a join date), and then each card still answers
  // the question its title asks.
  const bestMember =
    memberStats.length > 0
      ? memberStats.reduce((best, m) =>
          m.weightedAttendanceRate > best.weightedAttendanceRate ? m : best,
        )
      : null;
  const worstMember =
    memberStats.length > 0
      ? memberStats.reduce((worst, m) =>
          m.weightedAbsences > worst.weightedAbsences ? m : worst,
        )
      : null;

  return {
    memberStats,
    totalSessions: sessions.length,
    meetingCount,
    eventCount,
    avgWeightedAttendanceRate,
    bestMember,
    worstMember,
    eventWeight,
  };
}
