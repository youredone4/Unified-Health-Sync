import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === MOTHERS (Prenatal) ===
export const mothers = pgTable("mothers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"), // purok/sitio
  phone: text("phone"),
  registrationDate: text("registration_date").notNull(),
  gaWeeks: integer("ga_weeks").notNull(), // gestational age
  nextPrenatalCheckDate: text("next_prenatal_check_date"), // static for demo
  tt1Date: text("tt1_date"),
  tt2Date: text("tt2_date"),
  tt3Date: text("tt3_date"),
  status: text("status").default("active"),
});

export const insertMotherSchema = createInsertSchema(mothers).omit({ id: true });
export type Mother = typeof mothers.$inferSelect;
export type InsertMother = z.infer<typeof insertMotherSchema>;

// === CHILDREN (linked to mother) ===
export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  dob: text("dob").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  motherId: integer("mother_id"), // FK to mothers
  nextVisitDate: text("next_visit_date"), // static for demo - includes vaccine + weight
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

// === SENIORS (with medication details) ===
export const seniors = pgTable("seniors", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  phone: text("phone"),
  lastBP: text("last_bp"),
  lastBPDate: text("last_bp_date"),
  lastMedicationName: text("last_medication_name"),
  lastMedicationDoseMg: integer("last_medication_dose_mg"),
  lastMedicationQuantity: integer("last_medication_quantity"),
  lastMedicationGivenDate: text("last_medication_given_date"),
  nextPickupDate: text("next_pickup_date"), // static for demo
  htnMedsReady: boolean("htn_meds_ready").default(false),
  pickedUp: boolean("picked_up").default(false),
});

export const insertSeniorSchema = createInsertSchema(seniors).omit({ id: true });
export type Senior = typeof seniors.$inferSelect;
export type InsertSenior = z.infer<typeof insertSeniorSchema>;

// === INVENTORY (vaccines + HTN meds per barangay) ===
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  vaccines: jsonb("vaccines").$type<{
    bcgQty: number;
    hepBQty: number;
    pentaQty: number;
    opvQty: number;
    mrQty: number;
  }>().default({ bcgQty: 0, hepBQty: 0, pentaQty: 0, opvQty: 0, mrQty: 0 }),
  htnMeds: jsonb("htn_meds").$type<Array<{
    name: string;
    doseMg: number;
    qty: number;
  }>>().default([]),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  surplusThreshold: integer("surplus_threshold").default(100),
  lastUpdated: text("last_updated").notNull(),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true });
export type InventoryItem = typeof inventory.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;

// === HEALTH STATIONS (Map) ===
export const healthStations = pgTable("health_stations", {
  id: serial("id").primaryKey(),
  facilityName: text("facility_name").notNull(),
  barangay: text("barangay").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
});

export const insertHealthStationSchema = createInsertSchema(healthStations).omit({ id: true });
export type HealthStation = typeof healthStations.$inferSelect;

// === SMS OUTBOX (Demo audit trail) ===
export const smsOutbox = pgTable("sms_outbox", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  recipientPhone: text("recipient_phone"),
  message: text("message").notNull(),
  sentAt: text("sent_at").notNull(),
  status: text("status").default("Queued (Demo)"),
});

export const insertSmsSchema = createInsertSchema(smsOutbox).omit({ id: true });
export type SmsMessage = typeof smsOutbox.$inferSelect;
export type InsertSmsMessage = z.infer<typeof insertSmsSchema>;
