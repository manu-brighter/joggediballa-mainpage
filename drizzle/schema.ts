import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  bigint,
  unique,
  date,
  index,
} from 'drizzle-orm/mysql-core';

/**
 * Core user table backing auth flow.
 * Extended with role management for Jogge di Balla website.
 */
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  displayName: varchar('displayName', { length: 255 }), // Custom display name (editable)
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ['admin', 'maintainer', 'editor', 'user', 'visitor'])
    .default('visitor')
    .notNull(),
  profilePictureUrl: text('profilePictureUrl'), // S3 URL for profile picture
  profilePictureKey: text('profilePictureKey'), // S3 Key for profile picture
  memberSince: timestamp('memberSince'), // Custom member since date (editable)
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Shotcounter Teams - stores team names and their scores
 * Persists across years with year field
 */
export const shotcounterTeams = mysqlTable('shotcounter_teams', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  score: int('score').default(0).notNull(),
  year: int('year').notNull(), // Jahr für Persistenz
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  createdBy: int('createdBy').references(() => users.id),
  deletedAt: timestamp('deletedAt'),
});

export type ShotcounterTeam = typeof shotcounterTeams.$inferSelect;
export type InsertShotcounterTeam = typeof shotcounterTeams.$inferInsert;

/**
 * Shotcounter Audit Log - tracks all score changes
 */
export const shotcounterAuditLog = mysqlTable('shotcounter_audit_log', {
  id: int('id').autoincrement().primaryKey(),
  teamId: int('teamId')
    .notNull()
    .references(() => shotcounterTeams.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(), // "add", "subtract", "reset", "create_team", "delete_team"
  amount: int('amount'), // Betrag der Änderung (null bei create/delete)
  previousScore: int('previousScore'),
  newScore: int('newScore'),
  performedBy: int('performedBy').references(() => users.id),
  performedByName: varchar('performedByName', { length: 255 }), // Fallback wenn User gelöscht
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  note: text('note'), // Optional: zusätzliche Notizen
});

export type ShotcounterAuditLog = typeof shotcounterAuditLog.$inferSelect;
export type InsertShotcounterAuditLog = typeof shotcounterAuditLog.$inferInsert;

/**
 * Sponsors - stores sponsor information with logo and link
 */
export const sponsors = mysqlTable('sponsors', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logoUrl: text('logoUrl'), // S3 URL (optional)
  logoKey: text('logoKey'), // S3 Key (optional)
  websiteUrl: text('websiteUrl'),
  displayOrder: int('displayOrder').default(0).notNull(), // Sortierung
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  createdBy: int('createdBy').references(() => users.id),
});

export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = typeof sponsors.$inferInsert;

/**
 * Events - stores club events
 */
export const events = mysqlTable('events', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  eventDate: timestamp('eventDate').notNull(),
  location: varchar('location', { length: 255 }),
  eventUrl: text('eventUrl'), // Legacy: kept for migration compatibility
  eventLinks: text('eventLinks'), // JSON array of {url, label} objects
  thumbnailPhotoId: int('thumbnailPhotoId'), // Reference to photo used as thumbnail
  isPublished: boolean('isPublished').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  createdBy: int('createdBy').references(() => users.id),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Photos - stores event photos with metadata
 */
export const photos = mysqlTable('photos', {
  id: int('id').autoincrement().primaryKey(),
  eventId: int('eventId').references(() => events.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  imageUrl: text('imageUrl').notNull(), // S3 URL - Original high-res image
  imageKey: text('imageKey').notNull(), // S3 Key - Original high-res image
  compressedUrl: text('compressedUrl'), // S3 URL - Compressed version for gallery (~2MB)
  compressedKey: text('compressedKey'), // S3 Key - Compressed version
  thumbnailUrl: text('thumbnailUrl'), // Optional: Event thumbnail (for event card)
  thumbnailKey: text('thumbnailKey'),
  displayOrder: int('displayOrder').default(0).notNull(),
  isPublished: boolean('isPublished').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  uploadedBy: int('uploadedBy').references(() => users.id),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

/**
 * Team Members - stores information about club members
 */
export const teamMembers = mysqlTable('team_members', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 100 }), // Spitzname
  role: varchar('role', { length: 100 }), // z.B. "Vorsitzender", "Kassenwart"
  bio: text('bio'),
  photoUrl: text('photoUrl'), // S3 URL
  photoKey: text('photoKey'), // S3 Key
  compressedPhotoUrl: text('compressedPhotoUrl'), // S3 URL for compressed/thumbnail version
  compressedPhotoKey: text('compressedPhotoKey'), // S3 Key for compressed version
  displayOrder: int('displayOrder').default(0).notNull(),
  isActive: boolean('isActive').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Feature Toggles - enables/disables features dynamically
 */
export const featureToggles = mysqlTable('feature_toggles', {
  id: int('id').autoincrement().primaryKey(),
  featureName: varchar('featureName', { length: 100 }).notNull().unique(),
  isEnabled: boolean('isEnabled').default(false).notNull(),
  description: text('description'),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  updatedBy: int('updatedBy').references(() => users.id),
});

export type FeatureToggle = typeof featureToggles.$inferSelect;
export type InsertFeatureToggle = typeof featureToggles.$inferInsert;

/**
 * Contact Form Submissions - stores contact form messages
 */
export const contactSubmissions = mysqlTable('contact_submissions', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  message: text('message').notNull(),
  honeypot: varchar('honeypot', { length: 255 }), // Spam-Schutz
  isRead: boolean('isRead').default(false).notNull(),
  isArchived: boolean('isArchived').default(false).notNull(),
  submittedAt: timestamp('submittedAt').defaultNow().notNull(),
  ipAddress: varchar('ipAddress', { length: 45 }), // IPv4/IPv6
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

/**
 * Gönnermitglieder - Sponsor members with membership tracking
 */
export const goennermitglieder = mysqlTable('goennermitglieder', {
  id: int('id').autoincrement().primaryKey(),
  firstName: varchar('firstName', { length: 100 }).notNull(),
  lastName: varchar('lastName', { length: 100 }).notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  houseNumber: varchar('houseNumber', { length: 20 }).notNull(),
  zipCode: varchar('zipCode', { length: 10 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 50 }),
  membershipStartDate: timestamp('membershipStartDate').notNull(),
  membershipEndDate: timestamp('membershipEndDate').notNull(), // Default: start + 1 year
  notes: text('notes'),
  isActive: boolean('isActive').default(true).notNull(),
  paymentStatus: mysqlEnum('paymentStatus', ['paid', 'pending'])
    .default('paid')
    .notNull(), // Zahlungsstatus
  paymentPendingSince: timestamp('paymentPendingSince'), // Datum wenn Zahlung noch aussteht
  contributionAmount: int('contributionAmount').default(20).notNull(), // Gönnerbeitrag in CHF
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  createdBy: int('createdBy').references(() => users.id),
});

export type Goennermitglied = typeof goennermitglieder.$inferSelect;
export type InsertGoennermitglied = typeof goennermitglieder.$inferInsert;

/**
 * User Activity Log - tracks user logins, role changes, and admin actions
 */
export const userActivityLog = mysqlTable('user_activity_log', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').references(() => users.id, { onDelete: 'set null' }),
  userName: varchar('userName', { length: 255 }), // Fallback wenn User gelöscht
  action: varchar('action', { length: 100 }).notNull(), // "login", "role_change", "admin_action"
  details: text('details'), // JSON oder Text mit Details
  ipAddress: varchar('ipAddress', { length: 45 }), // IPv4/IPv6
  userAgent: text('userAgent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export type UserActivityLog = typeof userActivityLog.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLog.$inferInsert;

/**
 * Role Permissions - defines which roles have which permissions
 */
export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    id: int('id').autoincrement().primaryKey(),
    permissionKey: varchar('permissionKey', { length: 100 }).notNull(), // e.g. "edit_events"
    role: mysqlEnum('role', [
      'admin',
      'maintainer',
      'editor',
      'user',
    ]).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    // Unique constraint: each permission-role combination can only exist once
    uniquePermissionRole: unique().on(table.permissionKey, table.role),
  }),
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ============================================
// ATTENDANCE SYSTEM
// ============================================

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
    uniqueSessionMember: unique().on(table.sessionId, table.memberId),
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

/**
 * Harassenlauf Registrations - stores team registrations for the Harassenlauf event
 */
export const harassenlaufRegistrations = mysqlTable(
  'harassenlauf_registrations',
  {
    id: int('id').autoincrement().primaryKey(),
    teamName: varchar('teamName', { length: 255 }).notNull(),
    memberCount: int('memberCount').notNull(),
    captainFirstName: varchar('captainFirstName', { length: 100 }).notNull(),
    captainLastName: varchar('captainLastName', { length: 100 }).notNull(),
    captainPhone: varchar('captainPhone', { length: 50 }).notNull(),
    wurstKalb: int('wurstKalb').default(0).notNull(),
    wurstKloepfer: int('wurstKloepfer').default(0).notNull(),
    wurstVegi: int('wurstVegi').default(0).notNull(),
    additionalInfo: text('additionalInfo'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  },
);

export type HarassenlaufRegistration =
  typeof harassenlaufRegistrations.$inferSelect;
export type InsertHarassenlaufRegistration =
  typeof harassenlaufRegistrations.$inferInsert;

// ============================================
// SCHLAG DEN KASSIER (SDK) OVERLAY
// ============================================
/**
 * SDK Session - one active session at a time for the overlay
 * Stores all configuration and live state for the current game
 */
export const sdkSession = mysqlTable('sdk_session', {
  id: int('id').autoincrement().primaryKey(),
  // Show title (e.g. "Schlag den Kassier", "Schlag den Präsi")
  showTitle: varchar('showTitle', { length: 150 })
    .notNull()
    .default('Schlag den Kassier'),
  // Player names
  player1Name: varchar('player1Name', { length: 100 })
    .notNull()
    .default('Kassier'),
  player2Name: varchar('player2Name', { length: 100 })
    .notNull()
    .default('Kandidat'),
  // Game configuration
  totalGames: int('totalGames').notNull().default(10),
  currentGame: int('currentGame').notNull().default(1),
  currentGameName: varchar('currentGameName', { length: 255 }).default(''),
  // Pre-defined game names as JSON array, e.g. ["Dart","Quiz","Torwandschießen"]
  gameNames: text('gameNames').default(''),
  // Scores
  player1Score: int('player1Score').notNull().default(0),
  player2Score: int('player2Score').notNull().default(0),
  // State
  isActive: boolean('isActive').notNull().default(true),
  winnerId: int('winnerId'), // 1 = player1, 2 = player2, null = ongoing
  // Metadata
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  createdBy: int('createdBy').references(() => users.id),
});
export type SdkSession = typeof sdkSession.$inferSelect;
export type InsertSdkSession = typeof sdkSession.$inferInsert;

/**
 * SDK Game Log - tracks each game result
 */
export const sdkGameLog = mysqlTable('sdk_game_log', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: int('sessionId')
    .notNull()
    .references(() => sdkSession.id, { onDelete: 'cascade' }),
  gameNumber: int('gameNumber').notNull(),
  gameName: varchar('gameName', { length: 255 }).default(''),
  pointsAwarded: int('pointsAwarded').notNull(), // = gameNumber
  winnerId: int('winnerId').notNull(), // 1 = player1, 2 = player2
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type SdkGameLog = typeof sdkGameLog.$inferSelect;
export type InsertSdkGameLog = typeof sdkGameLog.$inferInsert;
