import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, serial, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === ROLE ENUM ===
export const UserRole = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  MHO: "MHO",
  SHA: "SHA",
  TL: "TL",
} as const;
export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
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
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("TL"), // SYSTEM_ADMIN, MHO, SHA, TL
  status: varchar("status").notNull().default("ACTIVE"), // ACTIVE, DISABLED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// === BARANGAYS TABLE ===
export const barangays = pgTable("barangays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBarangaySchema = createInsertSchema(barangays).omit({ id: true, createdAt: true });
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
  municipalityName: text("municipality_name").notNull(),
  subtitle: text("subtitle"),
  logoUrl: text("logo_url"),
  themeJson: jsonb("theme_json"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MunicipalitySettings = typeof municipalitySettings.$inferSelect;

// === AUDIT LOGS ===
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  userRole: varchar("user_role").notNull(),
  action: varchar("action").notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, VIEW, GENERATE_REPORT, IMPORT
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
