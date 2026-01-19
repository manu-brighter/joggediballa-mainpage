import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role management for Jogge di Balla website.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 255 }), // Custom display name (editable)
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "maintainer", "editor", "user", "visitor"]).default("visitor").notNull(),
  profilePictureUrl: text("profilePictureUrl"), // S3 URL for profile picture
  profilePictureKey: text("profilePictureKey"), // S3 Key for profile picture
  memberSince: timestamp("memberSince"), // Custom member since date (editable)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Shotcounter Teams - stores team names and their scores
 * Persists across years with year field
 */
export const shotcounterTeams = mysqlTable("shotcounter_teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  score: int("score").default(0).notNull(),
  year: int("year").notNull(), // Jahr für Persistenz
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
});

export type ShotcounterTeam = typeof shotcounterTeams.$inferSelect;
export type InsertShotcounterTeam = typeof shotcounterTeams.$inferInsert;

/**
 * Shotcounter Audit Log - tracks all score changes
 */
export const shotcounterAuditLog = mysqlTable("shotcounter_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull().references(() => shotcounterTeams.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(), // "add", "subtract", "reset", "create_team", "delete_team"
  amount: int("amount"), // Betrag der Änderung (null bei create/delete)
  previousScore: int("previousScore"),
  newScore: int("newScore"),
  performedBy: int("performedBy").references(() => users.id),
  performedByName: varchar("performedByName", { length: 255 }), // Fallback wenn User gelöscht
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  note: text("note"), // Optional: zusätzliche Notizen
});

export type ShotcounterAuditLog = typeof shotcounterAuditLog.$inferSelect;
export type InsertShotcounterAuditLog = typeof shotcounterAuditLog.$inferInsert;

/**
 * Sponsors - stores sponsor information with logo and link
 */
export const sponsors = mysqlTable("sponsors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  logoUrl: text("logoUrl"), // S3 URL (optional)
  logoKey: text("logoKey"), // S3 Key (optional)
  websiteUrl: text("websiteUrl"),
  displayOrder: int("displayOrder").default(0).notNull(), // Sortierung
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
});

export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = typeof sponsors.$inferInsert;

/**
 * Events - stores club events
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventDate: timestamp("eventDate").notNull(),
  location: varchar("location", { length: 255 }),
  thumbnailPhotoId: int("thumbnailPhotoId"), // Reference to photo used as thumbnail
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Photos - stores event photos with metadata
 */
export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").references(() => events.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  imageUrl: text("imageUrl").notNull(), // S3 URL - Original high-res image
  imageKey: text("imageKey").notNull(), // S3 Key - Original high-res image
  compressedUrl: text("compressedUrl"), // S3 URL - Compressed version for gallery (~2MB)
  compressedKey: text("compressedKey"), // S3 Key - Compressed version
  thumbnailUrl: text("thumbnailUrl"), // Optional: Event thumbnail (for event card)
  thumbnailKey: text("thumbnailKey"),
  displayOrder: int("displayOrder").default(0).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  uploadedBy: int("uploadedBy").references(() => users.id),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

/**
 * Team Members - stores information about club members
 */
export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 100 }), // Spitzname
  role: varchar("role", { length: 100 }), // z.B. "Vorsitzender", "Kassenwart"
  bio: text("bio"),
  photoUrl: text("photoUrl"), // S3 URL
  photoKey: text("photoKey"), // S3 Key
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Feature Toggles - enables/disables features dynamically
 */
export const featureToggles = mysqlTable("feature_toggles", {
  id: int("id").autoincrement().primaryKey(),
  featureName: varchar("featureName", { length: 100 }).notNull().unique(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy").references(() => users.id),
});

export type FeatureToggle = typeof featureToggles.$inferSelect;
export type InsertFeatureToggle = typeof featureToggles.$inferInsert;

/**
 * Contact Form Submissions - stores contact form messages
 */
export const contactSubmissions = mysqlTable("contact_submissions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  message: text("message").notNull(),
  honeypot: varchar("honeypot", { length: 255 }), // Spam-Schutz
  isRead: boolean("isRead").default(false).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4/IPv6
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = typeof contactSubmissions.$inferInsert;

/**
 * Gönnermitglieder - Sponsor members with membership tracking
 */
export const goennermitglieder = mysqlTable("goennermitglieder", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  street: varchar("street", { length: 255 }).notNull(),
  houseNumber: varchar("houseNumber", { length: 20 }).notNull(),
  zipCode: varchar("zipCode", { length: 10 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  membershipStartDate: timestamp("membershipStartDate").notNull(),
  membershipEndDate: timestamp("membershipEndDate").notNull(), // Default: start + 1 year
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").references(() => users.id),
});

export type Goennermitglied = typeof goennermitglieder.$inferSelect;
export type InsertGoennermitglied = typeof goennermitglieder.$inferInsert;

/**
 * User Activity Log - tracks user logins, role changes, and admin actions
 */
export const userActivityLog = mysqlTable("user_activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  userName: varchar("userName", { length: 255 }), // Fallback wenn User gelöscht
  action: varchar("action", { length: 100 }).notNull(), // "login", "role_change", "admin_action"
  details: text("details"), // JSON oder Text mit Details
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4/IPv6
  userAgent: text("userAgent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type UserActivityLog = typeof userActivityLog.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLog.$inferInsert;
