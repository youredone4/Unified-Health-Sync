
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === MOTHERS (Prenatal) ===
export const mothers = pgTable("mothers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  gaWeeks: integer("ga_weeks").notNull(),
  phone: text("phone"),
  tt1Date: text("tt1_date"), // ISO date string or null
  tt2Date: text("tt2_date"),
  tt3Date: text("tt3_date"),
  registrationDate: text("registration_date").notNull(),
  status: text("status").default("active"), // active, delivered
});

export const insertMotherSchema = createInsertSchema(mothers).omit({ id: true });
export type Mother = typeof mothers.$inferSelect;
export type InsertMother = z.infer<typeof insertMotherSchema>;

// === CHILDREN (Vaccination) ===
export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(), // ISO date string
  vaccines: jsonb("vaccines").$type<{
    bcg?: string;
    hepB?: string;
    penta1?: string;
    penta2?: string;
    penta3?: string;
    opv1?: string;
    opv2?: string;
    opv3?: string;
    mr1?: string;
  }>().default({}),
  growth: jsonb("growth").$type<Array<{
    date: string;
    weightKg: number;
  }>>().default([]),
});

export const insertChildSchema = createInsertSchema(children).omit({ id: true });
export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;

// === SENIORS (Care) ===
export const seniors = pgTable("seniors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  phone: text("phone"),
  lastBP: text("last_bp"),
  lastBPDate: text("last_bp_date"),
  htnMedsReady: boolean("htn_meds_ready").default(false),
  medsReadyDate: text("meds_ready_date"),
  pickedUp: boolean("picked_up").default(false),
});

export const insertSeniorSchema = createInsertSchema(seniors).omit({ id: true });
export type Senior = typeof seniors.$inferSelect;
export type InsertSenior = z.infer<typeof insertSeniorSchema>;

// === INVENTORY ===
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  barangay: text("barangay").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull(), // "Available", "Low Stock", "Out of Stock"
  lastUpdated: text("last_updated").notNull(),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export type InventoryItem = typeof inventory.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;

// === HEALTH STATIONS (Map) ===
export const healthStations = pgTable("health_stations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  latitude: text("latitude").notNull(), // Using text to avoid float precision issues in simple demo
  longitude: text("longitude").notNull(),
});

export const insertHealthStationSchema = createInsertSchema(healthStations).omit({ id: true });
export type HealthStation = typeof healthStations.$inferSelect;
