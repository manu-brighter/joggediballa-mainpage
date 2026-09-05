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
  uniqueIndex,
  date,
  index,
  type AnyMySqlColumn,
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
  // TODO (F-DB-010 / A-P2-04): add .unique() once a one-off
  //   SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1
  // pre-check confirms zero duplicates on the live DB. Deferred from Phase 3c
  // because UNIQUE index creation would fail mid-push if dupes exist.
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ['admin', 'maintainer', 'editor', 'user', 'visitor'])
    .default('visitor')
    .notNull(),
  profilePictureUrl: text('profilePictureUrl'), // Public URL for profile picture
  profilePictureKey: text('profilePictureKey'), // Storage key for profile picture
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
export const shotcounterTeams = mysqlTable(
  'shotcounter_teams',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    score: int('score').default(0).notNull(),
    year: int('year').notNull(), // Jahr für Persistenz
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
    createdBy: int('createdBy').references(() => users.id),
    deletedAt: timestamp('deletedAt'),
  },
  table => ({
    yearDeletedIdx: index('idx_shotcounter_teams_year_deletedAt').on(
      table.year,
      table.deletedAt,
    ),
  }),
);

export type ShotcounterTeam = typeof shotcounterTeams.$inferSelect;
export type InsertShotcounterTeam = typeof shotcounterTeams.$inferInsert;

/**
 * Shotcounter Audit Log - tracks all score changes
 */
export const shotcounterAuditLog = mysqlTable(
  'shotcounter_audit_log',
  {
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
  },
  table => ({
    teamIdx: index('idx_shotcounter_audit_log_teamId').on(table.teamId),
  }),
);

export type ShotcounterAuditLog = typeof shotcounterAuditLog.$inferSelect;
export type InsertShotcounterAuditLog = typeof shotcounterAuditLog.$inferInsert;

/**
 * Sponsors - stores sponsor information with logo and link
 */
export const sponsors = mysqlTable(
  'sponsors',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    logoUrl: text('logoUrl'), // Public URL (optional)
    logoKey: text('logoKey'), // Storage key (optional)
    websiteUrl: text('websiteUrl'),
    displayOrder: int('displayOrder').default(0).notNull(), // Sortierung
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
    createdBy: int('createdBy').references(() => users.id),
  },
  table => ({
    activeOrderIdx: index('idx_sponsors_isActive_displayOrder').on(
      table.isActive,
      table.displayOrder,
    ),
  }),
);

export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = typeof sponsors.$inferInsert;

/**
 * Events - stores club events
 */
export const events = mysqlTable(
  'events',
  {
    id: int('id').autoincrement().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    eventDate: timestamp('eventDate').notNull(),
    location: varchar('location', { length: 255 }),
    eventUrl: text('eventUrl'), // Legacy: kept for migration compatibility
    eventLinks: text('eventLinks'), // JSON array of {url, label} objects
    // Reference to photo used as thumbnail. set null on delete so events
    // outlive their thumbnail photo (cf. F-DB-017 / A-P2-07).
    // Explicit AnyMySqlColumn annotation breaks the circular type between
    // events.thumbnailPhotoId -> photos.id and photos.eventId -> events.id.
    thumbnailPhotoId: int('thumbnailPhotoId').references(
      (): AnyMySqlColumn => photos.id,
      { onDelete: 'set null' },
    ),
    isPublished: boolean('isPublished').default(false).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
    createdBy: int('createdBy').references(() => users.id),
  },
  table => ({
    publishedDateIdx: index('idx_events_isPublished_eventDate').on(
      table.isPublished,
      table.eventDate,
    ),
  }),
);

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Photos - stores event photos with metadata
 */
export const photos = mysqlTable(
  'photos',
  {
    id: int('id').autoincrement().primaryKey(),
    eventId: int('eventId').references(() => events.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    imageUrl: text('imageUrl').notNull(), // Public URL - Original high-res image
    imageKey: text('imageKey').notNull(), // Storage key - Original high-res image
    compressedUrl: text('compressedUrl'), // Public URL - Compressed version for gallery (~2MB)
    compressedKey: text('compressedKey'), // Storage key - Compressed version
    thumbnailUrl: text('thumbnailUrl'), // Optional: Event thumbnail (for event card)
    thumbnailKey: text('thumbnailKey'),
    displayOrder: int('displayOrder').default(0).notNull(),
    isPublished: boolean('isPublished').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    uploadedBy: int('uploadedBy').references(() => users.id),
  },
  table => ({
    eventIdx: index('idx_photos_eventId').on(table.eventId),
  }),
);

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
  photoUrl: text('photoUrl'), // Public URL
  photoKey: text('photoKey'), // Storage key
  compressedPhotoUrl: text('compressedPhotoUrl'), // Public URL for compressed/thumbnail version
  compressedPhotoKey: text('compressedPhotoKey'), // Storage key for compressed version
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
  // Optional link target for toggles that render a configurable button/link
  // (e.g. the temp_button on the homepage + navbar). Supports internal routes
  // ("/foo") and external URLs ("https://…"). Null when the toggle is not a link.
  // ALTER TABLE feature_toggles ADD COLUMN linkUrl VARCHAR(500) NULL, ADD COLUMN linkText VARCHAR(200) NULL;
  linkUrl: varchar('linkUrl', { length: 500 }),
  linkText: varchar('linkText', { length: 200 }),
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
  // ALTER TABLE contact_submissions ADD COLUMN phone VARCHAR(30) NULL AFTER email;
  phone: varchar('phone', { length: 30 }),
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
export const goennermitglieder = mysqlTable(
  'goennermitglieder',
  {
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
    // TODO (F-DB-018 / DB-4): contributionAmount should be DECIMAL(10,2) for
    // money. Deferred from Phase 3c — non-additive type change requires
    // hand-written ALTER on the live DB.
    contributionAmount: int('contributionAmount').default(20).notNull(), // Gönnerbeitrag in CHF
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
    createdBy: int('createdBy').references(() => users.id),
  },
  table => ({
    membershipEndIdx: index('idx_goennermitglieder_membershipEndDate').on(
      table.membershipEndDate,
    ),
  }),
);

export type Goennermitglied = typeof goennermitglieder.$inferSelect;
export type InsertGoennermitglied = typeof goennermitglieder.$inferInsert;

/**
 * User Activity Log - tracks user logins, role changes, and admin actions
 */
export const userActivityLog = mysqlTable(
  'user_activity_log',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('userId').references(() => users.id, { onDelete: 'set null' }),
    userName: varchar('userName', { length: 255 }), // Fallback wenn User gelöscht
    action: varchar('action', { length: 100 }).notNull(), // "login", "role_change", "admin_action"
    details: text('details'), // JSON oder Text mit Details
    ipAddress: varchar('ipAddress', { length: 45 }), // IPv4/IPv6
    userAgent: text('userAgent'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  table => ({
    userIdx: index('idx_user_activity_log_userId').on(table.userId),
    timestampIdx: index('idx_user_activity_log_timestamp').on(table.timestamp),
  }),
);

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
    uniquePermissionRole: unique('uniquePermissionRole').on(
      table.permissionKey,
      table.role,
    ),
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
    sessionId: int('sessionId')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    memberId: int('memberId')
      .notNull()
      .references(() => attendanceMembers.id, { onDelete: 'cascade' }),
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
    uniqueSessionMember: unique('unique_session_member').on(
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
  settingKey: varchar('settingKey', { length: 100 })
    .notNull()
    .unique('settingKey'),
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

/**
 * Live-Diashow — hochgeladene Gäste-Fotos (eigenes Konzept, NICHT `photos`).
 * Nur komprimierte Varianten (kein Original). Ablehnen = Files + Row hart löschen.
 */
export const slideshowPhotos = mysqlTable(
  'slideshow_photos',
  {
    id: int('id').autoincrement().primaryKey(),
    status: mysqlEnum('status', ['pending', 'approved'])
      .default('pending')
      .notNull(),
    displayUrl: text('displayUrl').notNull(), // 2560px-Variante (Bühne)
    displayKey: text('displayKey').notNull(),
    thumbnailUrl: text('thumbnailUrl').notNull(), // 480px-Variante (Grids)
    thumbnailKey: text('thumbnailKey').notNull(),
    width: int('width').notNull(), // Display-Dimensionen (Layout-Engine)
    height: int('height').notNull(),
    bytes: int('bytes').notNull(), // Dateigröße Display-Variant (Speicher-Tracking)
    moderatedBy: int('moderatedBy').references(() => users.id),
    moderatedAt: timestamp('moderatedAt'),
    uploaderIp: varchar('uploaderIp', { length: 45 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    statusCreatedIdx: index('idx_slideshow_photos_status_createdAt').on(
      table.status,
      table.createdAt,
    ),
  }),
);

export type SlideshowPhoto = typeof slideshowPhotos.$inferSelect;
export type InsertSlideshowPhoto = typeof slideshowPhotos.$inferInsert;

/**
 * Live-Diashow — Single-Row Settings/State (id=1, Pattern wie sdkSession).
 */
export const slideshowSettings = mysqlTable('slideshow_settings', {
  id: int('id').autoincrement().primaryKey(),
  eventTitle: varchar('eventTitle', { length: 255 }),
  isVisible: boolean('isVisible').default(false).notNull(), // Master-Schalter Anzeige
  uploadsOpen: boolean('uploadsOpen').default(true).notNull(),
  moderationEnabled: boolean('moderationEnabled').default(true).notNull(),
  showQr: boolean('showQr').default(true).notNull(),
  uploadToken: varchar('uploadToken', { length: 64 }).notNull(), // Geheim-Token
  slideDurationMs: int('slideDurationMs').default(6000).notNull(),
  transition: mysqlEnum('transition', ['fade', 'kenburns'])
    .default('kenburns')
    .notNull(),
  photoVersion: int('photoVersion').default(0).notNull(), // Bump → Client-Refetch
  maxPhotos: int('maxPhotos').default(3000).notNull(), // Disk-Schutz
  uploadRateLimit: int('uploadRateLimit').default(80).notNull(), // Uploads/IP/10min
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  updatedBy: int('updatedBy').references(() => users.id),
});

export type SlideshowSettings = typeof slideshowSettings.$inferSelect;
export type InsertSlideshowSettings = typeof slideshowSettings.$inferInsert;

// ============================================
// KASSENSYSTEM (POS): Event-Bestellsystem
// ============================================

/**
 * Kassensystem, Single-Row Settings/State (id=1, Pattern wie slideshowSettings).
 * `accessToken` gated die Service- und Küchen-Seiten (kein Login nötig, das
 * Personal am Event hat i. d. R. keinen Account, gleiches Konzept wie der
 * Diashow-Upload-Token).
 */
export const kasseSettings = mysqlTable('kasse_settings', {
  id: int('id').autoincrement().primaryKey(),
  accessToken: varchar('accessToken', { length: 64 }).notNull(),
  ordersOpen: boolean('ordersOpen').default(true).notNull(), // Master-Schalter
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  updatedBy: int('updatedBy').references(() => users.id),
});

export type KasseSettings = typeof kasseSettings.$inferSelect;
export type InsertKasseSettings = typeof kasseSettings.$inferInsert;

/**
 * Kassen-Event ("Session"). Höchstens eine Session ist `open`; alle Bestellungen
 * hängen daran, damit die Auswertung pro Event sauber getrennt bleibt.
 */
export const kasseSessions = mysqlTable(
  'kasse_sessions',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    status: mysqlEnum('status', ['open', 'closed']).default('open').notNull(),
    openedAt: timestamp('openedAt').defaultNow().notNull(),
    closedAt: timestamp('closedAt'),
    createdBy: int('createdBy').references(() => users.id),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    statusIdx: index('idx_kasse_sessions_status').on(table.status),
  }),
);

export type KasseSession = typeof kasseSessions.$inferSelect;
export type InsertKasseSession = typeof kasseSessions.$inferInsert;

/**
 * Produkt. Preis in Rappen (Integer), nie Float für Geld.
 * Beim Löschen wird `kasseOrderItems.productId` auf NULL gesetzt; die History
 * lebt von den Snapshot-Spalten der Bestellposition, nicht von dieser Zeile.
 */
export const kasseProducts = mysqlTable(
  'kasse_products',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('category', { length: 50 }), // z. B. "Essen", "Getränke"
    priceRappen: int('priceRappen').notNull(),
    displayOrder: int('displayOrder').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
    createdBy: int('createdBy').references(() => users.id),
  },
  table => ({
    activeSortIdx: index('idx_kasse_products_active_sort').on(
      table.isActive,
      table.displayOrder,
    ),
  }),
);

export type KasseProduct = typeof kasseProducts.$inferSelect;
export type InsertKasseProduct = typeof kasseProducts.$inferInsert;

/**
 * Zusatz/Unterkategorie eines Produkts (z. B. Pommes → Ketchup / Mayo / ohne).
 * `priceDeltaRappen` erlaubt Aufpreise, ist aber normalerweise 0.
 */
export const kasseProductOptions = mysqlTable(
  'kasse_product_options',
  {
    id: int('id').autoincrement().primaryKey(),
    productId: int('productId')
      .notNull()
      .references(() => kasseProducts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    priceDeltaRappen: int('priceDeltaRappen').default(0).notNull(),
    displayOrder: int('displayOrder').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    productIdx: index('idx_kasse_product_options_product').on(table.productId),
  }),
);

export type KasseProductOption = typeof kasseProductOptions.$inferSelect;
export type InsertKasseProductOption = typeof kasseProductOptions.$inferInsert;

/**
 * Tisch. `area` + `number` ergeben den Namen (A1, A2, B1 …); der Name wird
 * denormalisiert gespeichert, weil er auf jeder Bestellung angezeigt wird.
 */
export const kasseTables = mysqlTable(
  'kasse_tables',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 20 }).notNull().unique(),
    area: varchar('area', { length: 10 }), // Gruppierung in der Tischauswahl
    displayOrder: int('displayOrder').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    activeSortIdx: index('idx_kasse_tables_active_sort').on(
      table.isActive,
      table.displayOrder,
    ),
  }),
);

export type KasseTable = typeof kasseTables.$inferSelect;
export type InsertKasseTable = typeof kasseTables.$inferInsert;

/**
 * Bestellung. Statusfluss: pending → ready → delivered (oder cancelled).
 * `tableName` und die Positions-Snapshots machen die History unabhängig davon,
 * ob Produkte/Tische später umbenannt oder gelöscht werden.
 */
export const kasseOrders = mysqlTable(
  'kasse_orders',
  {
    id: int('id').autoincrement().primaryKey(),
    sessionId: int('sessionId')
      .notNull()
      .references(() => kasseSessions.id, { onDelete: 'cascade' }),
    tableId: int('tableId').references(() => kasseTables.id),
    tableName: varchar('tableName', { length: 20 }).notNull(),
    status: mysqlEnum('status', ['pending', 'ready', 'delivered', 'cancelled'])
      .default('pending')
      .notNull(),
    totalRappen: int('totalRappen').notNull(),
    note: varchar('note', { length: 255 }),
    waiterName: varchar('waiterName', { length: 60 }), // Gerätename des Service
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    readyAt: timestamp('readyAt'),
    deliveredAt: timestamp('deliveredAt'),
    cancelledAt: timestamp('cancelledAt'),
  },
  table => ({
    sessionStatusIdx: index('idx_kasse_orders_session_status').on(
      table.sessionId,
      table.status,
      table.createdAt,
    ),
  }),
);

export type KasseOrder = typeof kasseOrders.$inferSelect;
export type InsertKasseOrder = typeof kasseOrders.$inferInsert;

/**
 * Bestellposition. Preise sind Snapshots zum Bestellzeitpunkt (siehe oben);
 * `lineTotalRappen` = quantity * unitPriceRappen.
 *
 * Die gewählten Zusätze hängen in `kasseOrderItemOptions`. Eine Position kann
 * mehrere haben (Senf *und* Mayo), darum eine eigene Tabelle statt einer
 * optionId-Spalte.
 */
export const kasseOrderItems = mysqlTable(
  'kasse_order_items',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('orderId')
      .notNull()
      .references(() => kasseOrders.id, { onDelete: 'cascade' }),
    productId: int('productId').references(() => kasseProducts.id),
    productName: varchar('productName', { length: 100 }).notNull(),
    // Snapshot wie `productName`: Küche und Bar filtern ihre Ansicht über die
    // Kategorie. Käme sie per Join aus `kasse_products`, verschwände eine
    // Position aus der Ansicht, sobald jemand das Produkt umkategorisiert oder
    // löscht — mitten am Event, bei einer bereits laufenden Bestellung.
    //
    // Der Backfill gehört zwingend zum ALTER: ohne ihn stehen alle
    // Bestandszeilen auf NULL und zählen als Kategorie „Weiteres“.
    //
    // ALTER TABLE kasse_order_items ADD COLUMN productCategory VARCHAR(50) NULL AFTER productName;
    // UPDATE kasse_order_items i JOIN kasse_products p ON p.id = i.productId
    //   SET i.productCategory = p.category WHERE i.productCategory IS NULL;
    productCategory: varchar('productCategory', { length: 50 }),
    quantity: int('quantity').notNull(),
    unitPriceRappen: int('unitPriceRappen').notNull(), // inkl. Options-Aufpreis
    lineTotalRappen: int('lineTotalRappen').notNull(),
  },
  table => ({
    orderIdx: index('idx_kasse_order_items_order').on(table.orderId),
  }),
);

export type KasseOrderItem = typeof kasseOrderItems.$inferSelect;
export type InsertKasseOrderItem = typeof kasseOrderItems.$inferInsert;

/**
 * Gewählter Zusatz einer Bestellposition. Mehrere pro Position möglich.
 * `optionName` und `priceDeltaRappen` sind wieder Snapshots, damit die
 * Auswertung stimmt, wenn ein Zusatz später umbenannt, umgepreist oder
 * gelöscht wird. Deshalb ist `optionId` nullable und nur die Herkunft.
 */
export const kasseOrderItemOptions = mysqlTable(
  'kasse_order_item_options',
  {
    id: int('id').autoincrement().primaryKey(),
    orderItemId: int('orderItemId')
      .notNull()
      .references(() => kasseOrderItems.id, { onDelete: 'cascade' }),
    optionId: int('optionId').references(() => kasseProductOptions.id),
    optionName: varchar('optionName', { length: 100 }).notNull(),
    priceDeltaRappen: int('priceDeltaRappen').default(0).notNull(),
  },
  table => ({
    itemIdx: index('idx_kasse_order_item_options_item').on(table.orderItemId),
  }),
);

export type KasseOrderItemOption = typeof kasseOrderItemOptions.$inferSelect;
export type InsertKasseOrderItemOption =
  typeof kasseOrderItemOptions.$inferInsert;
