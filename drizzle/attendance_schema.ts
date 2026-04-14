import {
  mysqlTable,
  int,
  varchar,
  text,
  mysqlEnum,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';

/**
 * Attendance Sessions - stores meetings and events
 */
export const attendanceSessions = mysqlTable(
  'attendance_sessions',
  {
    id: int('id').autoincrement().primaryKey(),
    date: date('date').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    type: mysqlEnum('type', ['meeting', 'event']).notNull().default('meeting'),
    notes: text('notes'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    dateIdx: index('idx_date').on(table.date),
    typeIdx: index('idx_type').on(table.type),
  }),
);

export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type InsertAttendanceSession = typeof attendanceSessions.$inferInsert;

/**
 * Attendance Members - separate from team_members for flexibility
 */
export const attendanceMembers = mysqlTable(
  'attendance_members',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    displayOrder: int('displayOrder').default(0).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    activeIdx: index('idx_active').on(table.isActive),
    orderIdx: index('idx_order').on(table.displayOrder),
  }),
);

export type AttendanceMember = typeof attendanceMembers.$inferSelect;
export type InsertAttendanceMember = typeof attendanceMembers.$inferInsert;

/**
 * Attendance Records - tracks attendance per session and member
 */
export const attendanceRecords = mysqlTable(
  'attendance_records',
  {
    id: int('id').autoincrement().primaryKey(),
    sessionId: int('sessionId').notNull(),
    memberId: int('memberId').notNull(),
    status: mysqlEnum('status', ['present', 'partial', 'absent'])
      .notNull()
      .default('absent'),
    notes: text('notes'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    sessionIdx: index('idx_session').on(table.sessionId),
    memberIdx: index('idx_member').on(table.memberId),
    statusIdx: index('idx_status').on(table.status),
    uniqueSessionMember: uniqueIndex('unique_session_member').on(
      table.sessionId,
      table.memberId,
    ),
  }),
);

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;

/**
 * Attendance Settings - stores configuration like event weight multiplier
 */
export const attendanceSettings = mysqlTable('attendance_settings', {
  id: int('id').autoincrement().primaryKey(),
  settingKey: varchar('settingKey', { length: 100 }).notNull().unique(),
  settingValue: text('settingValue').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type AttendanceSetting = typeof attendanceSettings.$inferSelect;
export type InsertAttendanceSetting = typeof attendanceSettings.$inferInsert;
