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
  latitude: text("latitude"),
  longitude: text("longitude"),
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
  latitude: text("latitude"),
  longitude: text("longitude"),
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
  latitude: text("latitude"),
  longitude: text("longitude"),
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

// === DISEASE CASES (Communicable Disease Surveillance) ===
export const diseaseCases = pgTable("disease_cases", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  phone: text("phone"),
  condition: text("condition").notNull(), // Diarrhea, Chickenpox, ARI, Dengue suspected, Measles suspected
  dateReported: text("date_reported").notNull(),
  status: text("status").default("New"), // New, Monitoring, Referred, Closed
  notes: text("notes"),
  linkedPersonType: text("linked_person_type"), // Mother, Child, Senior, or null
  linkedPersonId: integer("linked_person_id"),
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertDiseaseCaseSchema = createInsertSchema(diseaseCases).omit({ id: true });
export type DiseaseCase = typeof diseaseCases.$inferSelect;
export type InsertDiseaseCase = z.infer<typeof insertDiseaseCaseSchema>;

// === TB PATIENTS (DOTS) ===
export const tbPatients = pgTable("tb_patients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  phone: text("phone"),
  tbType: text("tb_type").default("Pulmonary"), // Pulmonary or Extra-pulmonary
  treatmentPhase: text("treatment_phase").notNull(), // Intensive or Continuation
  treatmentStartDate: text("treatment_start_date").notNull(),
  lastObservedDoseDate: text("last_observed_dose_date"),
  nextDotsVisitDate: text("next_dots_visit_date"),
  missedDosesCount: integer("missed_doses_count").default(0),
  medsRegimenName: text("meds_regimen_name"),
  referralToRHU: boolean("referral_to_rhu").default(false),
  nextSputumCheckDate: text("next_sputum_check_date"),
  outcomeStatus: text("outcome_status").default("Ongoing"), // Ongoing, Completed, Transferred, LTFU
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertTBPatientSchema = createInsertSchema(tbPatients).omit({ id: true });
export type TBPatient = typeof tbPatients.$inferSelect;
export type InsertTBPatient = z.infer<typeof insertTBPatientSchema>;

// === THEME SETTINGS (LGU Branding) ===
export const themeSettings = pgTable("theme_settings", {
  id: serial("id").primaryKey(),
  lguName: text("lgu_name").notNull().default("Placer Municipality"),
  lguSubtitle: text("lgu_subtitle").default("Province of Surigao del Norte"),
  logoUrl: text("logo_url"),
  colorScheme: text("color_scheme").notNull().default("healthcare-green"),
  primaryHue: integer("primary_hue").default(152),
  primarySaturation: integer("primary_saturation").default(60),
  primaryLightness: integer("primary_lightness").default(40),
});

export const insertThemeSettingsSchema = createInsertSchema(themeSettings).omit({ id: true });
export type ThemeSettings = typeof themeSettings.$inferSelect;
export type InsertThemeSettings = z.infer<typeof insertThemeSettingsSchema>;
