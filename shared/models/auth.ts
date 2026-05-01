import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, serial, primaryKey, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === ROLE ENUM ===
export const UserRole = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  MHO: "MHO",
  SHA: "SHA",
  TL: "TL",
  // View-only roles. They see the same surface as MGMT but every write
  // endpoint rejects them via requireRole(). Their server-side scope is
  // identical to admins — full LGU visibility, no per-barangay filter.
  MAYOR: "MAYOR",                       // Municipal Mayor — political oversight
  HEALTH_COMMITTEE: "HEALTH_COMMITTEE", // Sangguniang Bayan Committee on Health & Sanitation
} as const;
export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  REJECTED: "REJECTED",
} as const;
export type UserStatusType = typeof UserStatus[keyof typeof UserStatus];

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("TL"), // SYSTEM_ADMIN, MHO, SHA, TL
  status: varchar("status").notNull().default("ACTIVE"), // ACTIVE, DISABLED, PENDING_VERIFICATION, REJECTED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // KYC / Registration fields
  contactNumber: varchar("contact_number"),
  fullName: varchar("full_name"),
  kycIdType: varchar("kyc_id_type"),
  kycIdFileUrl: varchar("kyc_id_file_url"),
  kycSelfieUrl: varchar("kyc_selfie_url"),
  kycNotes: text("kyc_notes"),
  kycReviewedAt: timestamp("kyc_reviewed_at"),
  kycReviewedById: varchar("kyc_reviewed_by_id"),
  // AI face-match results (populated after registration, never used for auto-approval)
  kycFaceMatchStatus: varchar("kyc_face_match_status"), // HIGH_MATCH | POSSIBLE_MATCH | LOW_MATCH | INCONCLUSIVE | FAILED | null(not yet run)
  kycFaceMatchScore: real("kyc_face_match_score"),      // confidence 0.0–1.0 (null if unavailable)
  kycFaceMatchReason: text("kyc_face_match_reason"),    // brief explanation from AI
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// === BARANGAYS TABLE ===
export const barangays = pgTable("barangays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  municipalityId: serial("municipality_id"),
  population: serial("population"),
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertBarangaySchema = createInsertSchema(barangays).omit({ id: true });
export type Barangay = typeof barangays.$inferSelect;
export type InsertBarangay = z.infer<typeof insertBarangaySchema>;

// === USER-BARANGAY ASSIGNMENTS (for TL role scoping) ===
export const userBarangays = pgTable("user_barangays", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  barangayId: serial("barangay_id").notNull().references(() => barangays.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.barangayId] })
]);

export type UserBarangay = typeof userBarangays.$inferSelect;
export type InsertUserBarangay = typeof userBarangays.$inferInsert;

// === BARANGAY SETTINGS (for per-barangay branding overrides) ===
export const barangaySettings = pgTable("barangay_settings", {
  barangayId: serial("barangay_id").primaryKey().references(() => barangays.id, { onDelete: "cascade" }),
  barangayNameOverride: text("barangay_name_override"),
  subtitle: text("subtitle"),
  logoUrl: text("logo_url"),
  themeJson: jsonb("theme_json"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BarangaySettings = typeof barangaySettings.$inferSelect;

// === MUNICIPALITY SETTINGS (for report branding) ===
export const municipalitySettings = pgTable("municipality_settings", {
  id: serial("id").primaryKey(),
  municipalityId: serial("municipality_id").notNull().unique(),
  municipalityName: text("municipality_name"),
  subtitle: text("subtitle"),
  logoUrl: text("logo_url"),
  themeJson: jsonb("theme_json"),
  updatedAt: text("updated_at").notNull(),
});

export type MunicipalitySettings = typeof municipalitySettings.$inferSelect;

// === DIRECT MESSAGES ===
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, readAt: true, createdAt: true });
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;

// === AUDIT LOGS ===
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  userRole: varchar("user_role").notNull(),
  action: varchar("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, VIEW, GENERATE_REPORT, IMPORT, REGISTER, KYC_APPROVE, KYC_REJECT, DISABLE, ENABLE
  entityType: varchar("entity_type").notNull(), // USER, MOTHER, CHILD, SENIOR, INVENTORY, etc.
  entityId: varchar("entity_id"),
  barangayId: serial("barangay_id"),
  barangayName: text("barangay_name"),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
