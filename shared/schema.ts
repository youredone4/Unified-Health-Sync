import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique, uniqueIndex, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === MOTHERS (Prenatal) - Aligned with M1 Brgy FHSIS Report ===
export const mothers = pgTable("mothers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"), // purok/sitio
  phone: text("phone"),
  registrationDate: text("registration_date").notNull(),
  gaWeeks: integer("ga_weeks").notNull(), // gestational age at registration
  expectedDeliveryDate: text("expected_delivery_date"), // calculated EDD
  nextPrenatalCheckDate: text("next_prenatal_check_date"), // static for demo
  
  // M1 Report: Prenatal Care tracking
  ancVisits: integer("anc_visits").default(0), // Number of ANC visits completed
  bmiStatus: text("bmi_status"), // normal, low, high (first trimester)
  
  // M1 Report: Tetanus Toxoid (Td) Vaccination
  tt1Date: text("tt1_date"),
  tt2Date: text("tt2_date"),
  tt3Date: text("tt3_date"),
  tt4Date: text("tt4_date"),
  tt5Date: text("tt5_date"),
  
  status: text("status").default("active"), // active, delivered, deceased
  outcome: text("outcome"), // live_birth, stillbirth, miscarriage, maternal_death
  outcomeDate: text("outcome_date"),
  outcomeNotes: text("outcome_notes"),
  
  // M1 Report: Intrapartum/Delivery Care
  deliveryAttendant: text("delivery_attendant"), // physician, nurse, midwife, hilot, none
  deliveryLocation: text("delivery_location"), // hospital, birthing_center, home
  birthWeightKg: text("birth_weight_kg"), // actual birth weight in kg
  birthWeightCategory: text("birth_weight_category"), // normal (>=2.5kg), low (<2.5kg)
  
  // M1 Report: Postpartum/Newborn Care
  breastfedWithin1hr: boolean("breastfed_within_1hr").default(false),
  ironSuppGiven: boolean("iron_supp_given").default(false), // for LBW infants
  
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertMotherSchema = createInsertSchema(mothers).omit({ id: true });
export type Mother = typeof mothers.$inferSelect;
export type InsertMother = z.infer<typeof insertMotherSchema>;

// === CHILDREN (linked to mother) - Aligned with M1 Brgy FHSIS Report ===
export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex"), // male, female - required for M1 report M/F breakdown
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  motherId: integer("mother_id"), // FK to mothers
  nextVisitDate: text("next_visit_date"), // static for demo - includes vaccine + weight
  
  // M1 Report: Birth Information
  birthWeightKg: text("birth_weight_kg"), // actual birth weight
  birthWeightCategory: text("birth_weight_category"), // normal (>=2.5kg), low (<2.5kg)
  
  // M1 Report: Immunization Services (0-12 months & 13-23 months)
  vaccines: jsonb("vaccines").$type<{
    bcg?: string;
    hepB?: string;
    penta1?: string;
    penta2?: string;
    penta3?: string;
    opv1?: string;
    opv2?: string;
    opv3?: string;
    ipv1?: string; // M1 Report: IPV
    ipv2?: string;
    mr1?: string;
    mr2?: string;
    // 13-23 months boosters
    penta4?: string;
    opv4?: string;
  }>().default({}),
  
  // M1 Report: Nutrition
  vitaminA1Date: text("vitamin_a1_date"), // 6-11 months
  vitaminA2Date: text("vitamin_a2_date"), // 12-59 months
  ironSuppComplete: boolean("iron_supp_complete").default(false), // for LBW infants
  breastfedExclusively: boolean("breastfed_exclusively").default(false), // 0-6 months
  
  growth: jsonb("growth").$type<Array<{
    date: string;
    weightKg: number;
    heightCm?: number;
    muac?: number; // mid-upper arm circumference
  }>>().default([]),
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertChildSchema = createInsertSchema(children).omit({ id: true });
export type Child = typeof children.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;

// === SENIORS (with medication details + cross-barangay matching) ===
export const seniors = pgTable("seniors", {
  id: serial("id").primaryKey(),
  seniorUniqueId: text("senior_unique_id"), // For cross-barangay matching
  seniorCitizenId: text("senior_citizen_id"), // Official senior citizen ID if available
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: text("dob"), // Date of birth for matching
  sex: text("sex"), // M or F
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
  civilStatus: text("civil_status"),
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

// === MEDICINE INVENTORY (per-item medicine/other supply tracking) ===
export const medicineInventory = pgTable("medicine_inventory", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  medicineName: text("medicine_name").notNull(),
  strength: text("strength"),
  unit: text("unit"),
  qty: integer("qty").notNull().default(0),
  expirationDate: text("expiration_date"),
  category: text("category"),
  notes: text("notes"),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  lastUpdated: text("last_updated").notNull(),
});

export const insertMedicineInventorySchema = createInsertSchema(medicineInventory).omit({ id: true });
export type MedicineInventoryItem = typeof medicineInventory.$inferSelect;
export type InsertMedicineInventoryItem = z.infer<typeof insertMedicineInventorySchema>;

// === INVENTORY SNAPSHOTS (historical stock trend tracking) ===
export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD (first day of month)
  itemType: text("item_type").notNull(), // 'vaccine' | 'medicine'
  itemKey: text("item_key").notNull(), // 'bcg'|'hepB'|'penta'|'opv'|'mr' or medicine name
  qty: integer("qty").notNull().default(0),
}, (t) => ({
  uniqueSnapshot: uniqueIndex("inventory_snapshots_unique_idx")
    .on(t.barangay, t.snapshotDate, t.itemType, t.itemKey),
}));

export const insertInventorySnapshotSchema = createInsertSchema(inventorySnapshots).omit({ id: true });
export type InventorySnapshot = typeof inventorySnapshots.$inferSelect;
export type InsertInventorySnapshot = z.infer<typeof insertInventorySnapshotSchema>;

// === COLD-CHAIN TEMPERATURE LOGS ===
// DOH NIP/EPI Cold Chain Manual: twice-daily fridge readings (AM + PM),
// 2-8 °C target range. Plus VVM (Vaccine Vial Monitor) check.
// One reading per (barangay, date, period) — uniqueness prevents duplicates.
export const COLD_CHAIN_PERIODS = ["AM", "PM"] as const;
export type ColdChainPeriod = typeof COLD_CHAIN_PERIODS[number];

export const COLD_CHAIN_VVM_STATUSES = ["OK", "ALERT", "DISCARD"] as const;
export type ColdChainVvmStatus = typeof COLD_CHAIN_VVM_STATUSES[number];

export const COLD_CHAIN_MIN_C = 2;
export const COLD_CHAIN_MAX_C = 8;

export const coldChainLogs = pgTable("cold_chain_logs", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  readingDate: text("reading_date").notNull(), // YYYY-MM-DD
  readingPeriod: text("reading_period").$type<ColdChainPeriod>().notNull(),
  tempCelsius: real("temp_celsius").notNull(),
  vvmStatus: text("vvm_status").$type<ColdChainVvmStatus>().notNull().default("OK"),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueReading: uniqueIndex("cold_chain_logs_unique_idx")
    .on(t.barangay, t.readingDate, t.readingPeriod),
}));

export const insertColdChainLogSchema = createInsertSchema(coldChainLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    readingPeriod: z.enum(COLD_CHAIN_PERIODS),
    vvmStatus: z.enum(COLD_CHAIN_VVM_STATUSES),
    tempCelsius: z.number().min(-40).max(50),
  });
export type ColdChainLog = typeof coldChainLogs.$inferSelect;
export type InsertColdChainLog = z.infer<typeof insertColdChainLogSchema>;

// === HEALTH STATIONS (Map) ===
// facilityType distinguishes BHS (barangay station, the catchment-level clinic)
// from RHU (the municipal Rural Health Unit a case gets referred up to) and
// HOSPITAL (inpatient-capable referral target). Nullable so pre-type-column
// rows keep working, but the seed backfills it.
export const FACILITY_TYPES = ["BHS", "RHU", "HOSPITAL"] as const;
export type FacilityType = typeof FACILITY_TYPES[number];

export const healthStations = pgTable("health_stations", {
  id: serial("id").primaryKey(),
  facilityName: text("facility_name").notNull(),
  facilityType: text("facility_type").$type<FacilityType>(),
  // Marks facilities the MHO has verified as active TB DOTS providers
  // (NTP + PhilHealth TB-DOTS Package). Drives the "Refer to RHU" picker on
  // the TB DOTS profile so only real DOTS facilities show up.
  hasTbDots: boolean("has_tb_dots").default(false).notNull(),
  barangay: text("barangay").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
});

export const insertHealthStationSchema = createInsertSchema(healthStations)
  .omit({ id: true })
  .extend({
    facilityType: z.enum(FACILITY_TYPES).optional().nullable(),
    hasTbDots: z.boolean().optional(),
  });
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
//
// Default list of disease conditions presented in the "+ New Case" form.
// Categorized by PIDSR tier so the dropdown groups Cat-I (immediate, 24h),
// Cat-II (weekly Friday cutoff), and Endemic conditions distinctly. The
// list is intentionally not exhaustive — new conditions typed in via the
// "Other..." free-text option are persisted on the case row and surface
// in the dropdown for future cases (the form unions in distinct values
// from existing disease_cases at runtime).
//
// Sources: PIDSR Manual of Operations 2nd Ed. (2014), DOH AO 2008-0029
// (notifiable diseases), HARP / DOH AIDS Registry (HIV / AIDS).
export interface DiseaseConditionDef {
  name: string;
  group: "PIDSR_CAT_I" | "PIDSR_CAT_II" | "ENDEMIC" | "OTHER";
}
export const DISEASE_CONDITION_DEFAULTS: readonly DiseaseConditionDef[] = [
  // Category I — immediate / within-24h notification
  { name: "AFP (Acute Flaccid Paralysis)", group: "PIDSR_CAT_I" },
  { name: "Measles / Rubella suspected",   group: "PIDSR_CAT_I" },
  { name: "Neonatal Tetanus",              group: "PIDSR_CAT_I" },
  { name: "Cholera suspected",             group: "PIDSR_CAT_I" },
  { name: "Anthrax",                       group: "PIDSR_CAT_I" },
  { name: "Meningococcal Disease",         group: "PIDSR_CAT_I" },
  { name: "HFMD outbreak",                 group: "PIDSR_CAT_I" },
  { name: "Rabies (human)",                group: "PIDSR_CAT_I" },
  // Category II — weekly Friday cutoff
  { name: "Dengue suspected",              group: "PIDSR_CAT_II" },
  { name: "Leptospirosis suspected",       group: "PIDSR_CAT_II" },
  { name: "Typhoid Fever",                 group: "PIDSR_CAT_II" },
  { name: "ILI (Influenza-like illness)",  group: "PIDSR_CAT_II" },
  { name: "SARI (Severe Acute Respiratory Infection)", group: "PIDSR_CAT_II" },
  { name: "Hepatitis A",                   group: "PIDSR_CAT_II" },
  { name: "Acute Bloody Diarrhea",         group: "PIDSR_CAT_II" },
  { name: "Diarrhea (non-bloody)",         group: "PIDSR_CAT_II" },
  { name: "Pertussis",                     group: "PIDSR_CAT_II" },
  { name: "Diphtheria",                    group: "PIDSR_CAT_II" },
  // Endemic / commonly flagged at primary care
  { name: "ARI / Pneumonia",               group: "ENDEMIC" },
  { name: "Chickenpox / Varicella",        group: "ENDEMIC" },
  { name: "Mumps",                         group: "ENDEMIC" },
  { name: "COVID-19 suspected",            group: "ENDEMIC" },
  { name: "HIV (positive test result)",    group: "ENDEMIC" },
  { name: "AIDS",                          group: "ENDEMIC" },
  { name: "Hepatitis B (chronic)",         group: "ENDEMIC" },
  { name: "Sexually Transmitted Infection (other)", group: "ENDEMIC" },
];

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
  // Which RHU (or other TB-DOTS-verified facility) the patient was referred
  // to. Only meaningful when `referralToRHU` is true; null otherwise.
  referredRhuId: integer("referred_rhu_id").references(() => healthStations.id),
  nextSputumCheckDate: text("next_sputum_check_date"),
  outcomeStatus: text("outcome_status").default("Ongoing"), // Ongoing, Completed, Transferred, LTFU
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const insertTBPatientSchema = createInsertSchema(tbPatients)
  .omit({ id: true })
  .extend({
    referredRhuId: z.number().int().positive().optional().nullable(),
  });
export type TBPatient = typeof tbPatients.$inferSelect;
export type InsertTBPatient = z.infer<typeof insertTBPatientSchema>;

// === TB DOSE LOGS (Directly-Observed Daily Dose) ===
// NTP MoP 6th Ed.: intensive-phase TB patients require directly-observed
// daily dose. One log per (patient, day) — uniqueness prevents duplicates.
export const TB_DOSE_STATUSES = ["TAKEN", "MISSED", "REFUSED", "UNAVAILABLE"] as const;
export type TbDoseStatus = typeof TB_DOSE_STATUSES[number];

export const tbDoseLogs = pgTable("tb_dose_logs", {
  id: serial("id").primaryKey(),
  tbPatientId: integer("tb_patient_id").notNull().references(() => tbPatients.id, { onDelete: "cascade" }),
  doseDate: text("dose_date").notNull(), // YYYY-MM-DD
  observedStatus: text("observed_status").$type<TbDoseStatus>().notNull(),
  observedByUserId: varchar("observed_by_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqueDose: uniqueIndex("tb_dose_logs_unique_idx").on(t.tbPatientId, t.doseDate),
}));

export const insertTbDoseLogSchema = createInsertSchema(tbDoseLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    observedStatus: z.enum(TB_DOSE_STATUSES),
    tbPatientId: z.number().int().positive(),
  });
export type TbDoseLog = typeof tbDoseLogs.$inferSelect;
export type InsertTbDoseLog = z.infer<typeof insertTbDoseLogSchema>;

// === THEME SETTINGS (LGU Branding) ===
export const themeSettings = pgTable("theme_settings", {
  id: serial("id").primaryKey(),
  lguName: text("lgu_name").notNull().default("Placer Municipality"),
  lguSubtitle: text("lgu_subtitle").default("Province of Surigao del Norte"),
  logoUrl: text("logo_url"),
  colorScheme: text("color_scheme").notNull().default("placer-brand"),
  primaryHue: integer("primary_hue").default(142),
  primarySaturation: integer("primary_saturation").default(60),
  primaryLightness: integer("primary_lightness").default(38),
});

export const insertThemeSettingsSchema = createInsertSchema(themeSettings).omit({ id: true });
export type ThemeSettings = typeof themeSettings.$inferSelect;
export type InsertThemeSettings = z.infer<typeof insertThemeSettingsSchema>;

// === MORBIDITY/CONSULT (MHO only) ===
export const consults = pgTable("consults", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  age: integer("age").notNull(),
  sex: text("sex").notNull(), // M or F
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  consultDate: text("consult_date").notNull(),
  chiefComplaint: text("chief_complaint").notNull(),
  diagnosis: text("diagnosis").notNull(),
  icdCode: text("icd_code"), // ICD-10 code if applicable
  treatment: text("treatment"),
  disposition: text("disposition").default("Treated"), // Treated, Referred (to specialist/hospital), Other
  referredTo: text("referred_to"), // Facility name if referred
  consultType: text("consult_type").default("General"), // General, Prenatal, Child, Senior
  linkedPersonType: text("linked_person_type"), // Mother, Child, Senior
  linkedPersonId: integer("linked_person_id"),
  notes: text("notes"),
  createdBy: text("created_by"), // User ID who created
  createdAt: text("created_at").notNull(),
  // Vital signs
  bloodPressure: text("blood_pressure"), // e.g. "120/80"
  weightKg: text("weight_kg"), // numeric string, kg
  temperatureC: text("temperature_c"), // numeric string, °C
  pulseRate: text("pulse_rate"), // numeric string, bpm
  heightCm: text("height_cm"), // numeric string, cm
  // Disposition details
  dispositionNotes: text("disposition_notes"), // required when disposition = "Other"
});

export const insertConsultSchema = createInsertSchema(consults).omit({ id: true });
export type Consult = typeof consults.$inferSelect;
export type InsertConsult = z.infer<typeof insertConsultSchema>;

// === M1 TEMPLATE VERSIONS (Template-driven reporting) ===
export const m1TemplateVersions = pgTable("m1_template_versions", {
  id: serial("id").primaryKey(),
  templateName: text("template_name").notNull(), // e.g., "DOH FHSIS M1Brgy"
  versionLabel: text("version_label").notNull(), // e.g., "Placer Example 2025"
  sourceFileName: text("source_file_name"), // Original PDF filename
  sourcePdfHash: text("source_pdf_hash"), // Hash for version tracking
  pageCount: integer("page_count").default(3),
  isActive: boolean("is_active").default(true),
  createdAt: text("created_at").notNull(),
});

export const insertM1TemplateVersionSchema = createInsertSchema(m1TemplateVersions).omit({ id: true });
export type M1TemplateVersion = typeof m1TemplateVersions.$inferSelect;
export type InsertM1TemplateVersion = z.infer<typeof insertM1TemplateVersionSchema>;

// === M1 INDICATOR CATALOG (All rows/fields from M1 PDF template) ===
export const m1IndicatorCatalog = pgTable("m1_indicator_catalog", {
  id: serial("id").primaryKey(),
  templateVersionId: integer("template_version_id").notNull(), // FK to m1_template_versions
  pageNumber: integer("page_number").notNull(), // 1, 2, or 3
  sectionCode: text("section_code").notNull(), // FP, A, B, C, etc.
  rowKey: text("row_key").notNull(), // Unique stable key (e.g., "A-01")
  officialLabel: text("official_label").notNull(), // Exact text from PDF
  dataType: text("data_type").notNull().default("INT"), // INT, DECIMAL, TEXT, BOOLEAN
  unit: text("unit"), // count, percent, etc.
  rowOrder: integer("row_order").notNull(), // Exact row order from PDF
  indentLevel: integer("indent_level").default(0), // 0=main, 1=sub-indicator (a., b., etc.)
  
  // Column group for multi-column DOH format
  columnGroupType: text("column_group_type"), // AGE_GROUP, SEX, RATE, FP_CURRENT, FP_NEW, etc.
  columnSpec: jsonb("column_spec").$type<{
    columns: string[]; // ["10-14", "15-19", "20-49", "TOTAL"] or ["M", "F", "TOTAL", "RATE"]
    hasTotal?: boolean;
    hasRate?: boolean;
  }>(),
  
  // Data source mapping for computed indicators
  dataSourceTable: text("data_source_table"), // mothers, children, seniors, etc.
  dataSourceFilter: jsonb("data_source_filter"), // JSON filter criteria
  
  isComputed: boolean("is_computed").default(false),
  computeSpecJson: jsonb("compute_spec_json"), // Computation specification if isComputed
  isRequired: boolean("is_required").default(true),
  helpText: text("help_text"),
});

export const insertM1IndicatorCatalogSchema = createInsertSchema(m1IndicatorCatalog).omit({ id: true });
export type M1IndicatorCatalog = typeof m1IndicatorCatalog.$inferSelect;
export type InsertM1IndicatorCatalog = z.infer<typeof insertM1IndicatorCatalogSchema>;

// === M1 REPORT INSTANCES (Per barangay/month reports) ===
export const m1ReportInstances = pgTable("m1_report_instances", {
  id: serial("id").primaryKey(),
  templateVersionId: integer("template_version_id").notNull(),
  scopeType: text("scope_type").notNull().default("BARANGAY"), // BARANGAY or MUNICIPALITY
  barangayId: integer("barangay_id"), // nullable when municipality
  barangayName: text("barangay_name"), // denormalized for easy access
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  status: text("status").notNull().default("DRAFT"), // DRAFT, READY_FOR_REVIEW, SUBMITTED_LOCKED
  createdByUserId: text("created_by_user_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertM1ReportInstanceSchema = createInsertSchema(m1ReportInstances).omit({ id: true });
export type M1ReportInstance = typeof m1ReportInstances.$inferSelect;
export type InsertM1ReportInstance = z.infer<typeof insertM1ReportInstanceSchema>;

// === M1 REPORT HEADER (Header fields for each report) ===
export const m1ReportHeader = pgTable("m1_report_header", {
  id: serial("id").primaryKey(),
  reportInstanceId: integer("report_instance_id").notNull(), // FK
  headerJson: jsonb("header_json").$type<{
    barangayName?: string;
    municipalityCity?: string;
    province?: string;
    projectedPopulation?: number;
    bhsName?: string;
    bhwName?: string;
    midwifeName?: string;
  }>().default({}),
});

export const insertM1ReportHeaderSchema = createInsertSchema(m1ReportHeader).omit({ id: true });
export type M1ReportHeader = typeof m1ReportHeader.$inferSelect;
export type InsertM1ReportHeader = z.infer<typeof insertM1ReportHeaderSchema>;

// === M1 INDICATOR VALUES (Values for each indicator in a report) ===
export const m1IndicatorValues = pgTable("m1_indicator_values", {
  id: serial("id").primaryKey(),
  reportInstanceId: integer("report_instance_id").notNull(), // FK
  rowKey: text("row_key").notNull(), // FK to catalog rowKey
  columnKey: text("column_key"), // For multi-column: "10-14", "15-19", "20-49", "TOTAL", "M", "F", "RATE"
  valueNumber: integer("value_number"), // nullable - for INT/DECIMAL
  valueDecimal: text("value_decimal"), // for rates and percentages
  valueText: text("value_text"), // nullable - for TEXT
  valueSource: text("value_source").notNull().default("ENCODED"), // COMPUTED, ENCODED, IMPORTED
  computedAt: text("computed_at"), // timestamp when computed
  locked: boolean("locked").default(false),
  createdByUserId: text("created_by_user_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertM1IndicatorValueSchema = createInsertSchema(m1IndicatorValues).omit({ id: true });
export type M1IndicatorValue = typeof m1IndicatorValues.$inferSelect;
export type InsertM1IndicatorValue = z.infer<typeof insertM1IndicatorValueSchema>;

// Note: municipalitySettings and barangaySettings are defined in ./models/auth.ts

// === SENIOR MED CLAIMS (Cross-barangay verification) ===
export const seniorMedClaims = pgTable("senior_med_claims", {
  id: serial("id").primaryKey(),
  seniorId: integer("senior_id").notNull(), // FK to seniors
  seniorUniqueId: text("senior_unique_id"), // For cross-barangay matching
  claimedAt: text("claimed_at").notNull(), // datetime
  claimedBarangayId: integer("claimed_barangay_id").notNull(),
  claimedBarangayName: text("claimed_barangay_name"), // denormalized
  claimedFacilityId: integer("claimed_facility_id"),
  medicationName: text("medication_name").notNull(),
  dose: text("dose"),
  quantity: integer("quantity").notNull(),
  cycleDays: integer("cycle_days").default(30),
  nextEligibleAt: text("next_eligible_at").notNull(), // datetime
  claimedByUserId: text("claimed_by_user_id"),
  createdAt: text("created_at").notNull(),
});

export const insertSeniorMedClaimSchema = createInsertSchema(seniorMedClaims).omit({ id: true });
export type SeniorMedClaim = typeof seniorMedClaims.$inferSelect;
export type InsertSeniorMedClaim = z.infer<typeof insertSeniorMedClaimSchema>;

// === DEATH EVENTS (Mortality tracking) ===
// Extended with M1 Section H indicators (Phase 6): maternal-death cause
// classification, residency, and age-in-days (for neonatal/perinatal).
// Existing rows keep working — new fields are nullable.
export const MATERNAL_DEATH_CAUSES = ["DIRECT", "INDIRECT"] as const;
export type MaternalDeathCause = typeof MATERNAL_DEATH_CAUSES[number];
export const DEATH_RESIDENCIES = ["RESIDENT", "NON_RESIDENT"] as const;
export type DeathResidency = typeof DEATH_RESIDENCIES[number];

export const deathEvents = pgTable("death_events", {
  id: serial("id").primaryKey(),
  deceasedName: text("deceased_name").notNull(),
  age: integer("age"),
  sex: text("sex"), // M or F
  barangay: text("barangay").notNull(),
  dateOfDeath: text("date_of_death").notNull(),
  causeOfDeath: text("cause_of_death"),
  icdCode: text("icd_code"),
  placeOfDeath: text("place_of_death"), // hospital, home, other
  linkedPersonType: text("linked_person_type"), // Mother, Child, Senior
  linkedPersonId: integer("linked_person_id"),
  reportedBy: text("reported_by"),
  notes: text("notes"),
  // M1 Section H additions (Phase 6)
  ageDays: integer("age_days"),     // for neonatal (≤28d) and early-neonatal (≤6d)
  maternalDeathCause: text("maternal_death_cause").$type<MaternalDeathCause>(),
  residency: text("residency").$type<DeathResidency>(),
  isFetalDeath: boolean("is_fetal_death").default(false),
  isLiveBornEarlyNeonatal: boolean("is_live_born_early_neonatal").default(false),
  createdAt: text("created_at").notNull(),
});

export const insertDeathEventSchema = createInsertSchema(deathEvents).omit({ id: true });
export type DeathEvent = typeof deathEvents.$inferSelect;
export type InsertDeathEvent = z.infer<typeof insertDeathEventSchema>;

// === NURSE VISITS (Barangay Nurse / Team Leader monitoring visits) ===

// Prenatal / Mother visits
export const prenatalVisits = pgTable("prenatal_visits", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull().references(() => mothers.id, { onDelete: "cascade" }),
  visitNumber: integer("visit_number").notNull(),
  visitDate: text("visit_date").notNull(),
  gaWeeks: integer("ga_weeks"),
  weightKg: text("weight_kg"),
  bloodPressure: text("blood_pressure"),
  fundalHeight: text("fundal_height"), // cm
  fetalHeartTone: text("fetal_heart_tone"), // bpm
  riskStatus: text("risk_status"), // low, moderate, high
  notes: text("notes"),
  nextScheduledVisit: text("next_scheduled_visit"), // nurse-entered next appointment date
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  uniqMotherVisit: unique("prenatal_visits_mother_id_visit_number_unique").on(t.motherId, t.visitNumber),
}));
export const insertPrenatalVisitSchema = createInsertSchema(prenatalVisits).omit({ id: true });
export type PrenatalVisit = typeof prenatalVisits.$inferSelect;
export type InsertPrenatalVisit = z.infer<typeof insertPrenatalVisitSchema>;

// Postpartum (PNC) visits — DOH MNCHN AO 2008-0029 mandates checkpoints at
// 24h, 72h, 7d and 6w post-delivery. Captures the M1 Section C indicators
// (PNC completion + breastfeeding + iron supp + FP counseling) flagged in
// docs/m1-data-source-audit.md.
export const POSTPARTUM_CHECKPOINTS = ["24H", "72H", "7D", "6W", "OTHER"] as const;
export type PostpartumCheckpoint = typeof POSTPARTUM_CHECKPOINTS[number];

export const postpartumVisits = pgTable("postpartum_visits", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull().references(() => mothers.id, { onDelete: "cascade" }),
  visitDate: text("visit_date").notNull(), // YYYY-MM-DD
  visitType: text("visit_type").$type<PostpartumCheckpoint>().notNull(),
  bpSystolic: integer("bp_systolic"),
  bpDiastolic: integer("bp_diastolic"),
  breastfeedingExclusive: boolean("breastfeeding_exclusive"),
  ironSuppGiven: boolean("iron_supp_given"),
  fpCounselingGiven: boolean("fp_counseling_given"),
  // TRANS-IN: mother started PNC at another LGU and transferred in. Drives
  // C-01b-b and C-01c-b. Defaults to false for backwards-compat with rows
  // logged before this column existed.
  transInFromLgu: boolean("trans_in_from_lgu").default(false),
  // TRANS-OUT (with Movement of Verification) before completing 4 PNC.
  // Drives C-01c-c. transOutDate is the date the mother left the catchment.
  transOutWithMov: boolean("trans_out_with_mov").default(false),
  transOutDate: text("trans_out_date"),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPostpartumVisitSchema = createInsertSchema(postpartumVisits)
  .omit({ id: true, createdAt: true })
  .extend({
    visitType: z.enum(POSTPARTUM_CHECKPOINTS),
    bpSystolic: z.number().int().min(40).max(260).optional().nullable(),
    bpDiastolic: z.number().int().min(20).max(180).optional().nullable(),
  });
export type PostpartumVisit = typeof postpartumVisits.$inferSelect;
export type InsertPostpartumVisit = z.infer<typeof insertPostpartumVisitSchema>;

// === PRENATAL SCREENINGS — DOH MNCHN AO 2008-0029 (page 19 extras) ===
// Per-pregnancy screening + supplementation log. Feeds Section A-05..A-13.
export const prenatalScreenings = pgTable("prenatal_screenings", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull().references(() => mothers.id, { onDelete: "cascade" }),
  screeningDate: text("screening_date").notNull(),
  hepBScreened: boolean("hep_b_screened").default(false),
  hepBPositive: boolean("hep_b_positive"),
  anemiaScreened: boolean("anemia_screened").default(false),
  hgbLevelGdl: real("hgb_level_g_dl"),
  gdmScreened: boolean("gdm_screened").default(false),
  gdmPositive: boolean("gdm_positive"),
  ironFolicComplete: boolean("iron_folic_complete").default(false),
  mmsGiven: boolean("mms_given").default(false),
  calciumGiven: boolean("calcium_given").default(false),
  dewormingGiven: boolean("deworming_given").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPrenatalScreeningSchema = createInsertSchema(prenatalScreenings)
  .omit({ id: true, createdAt: true })
  .extend({
    hgbLevelGdl: z.number().min(0).max(25).optional().nullable(),
  });
export type PrenatalScreening = typeof prenatalScreenings.$inferSelect;
export type InsertPrenatalScreening = z.infer<typeof insertPrenatalScreeningSchema>;

// === BIRTH ATTENDANCE RECORDS — captures delivery type for M1 B-04 ===
// One record per delivery event. mother.deliveryAttendant covers B-03's
// "skilled attendant" breakdown directly; this table adds the delivery-type
// breakdown (vaginal/cesarean × full-term/pre-term) the existing schema
// doesn't capture.
export const DELIVERY_TYPES = ["VAGINAL", "CESAREAN", "FETAL_DEATH", "ABORTION"] as const;
export type DeliveryType = typeof DELIVERY_TYPES[number];

export const DELIVERY_TERMS = ["FULL_TERM", "PRE_TERM"] as const;
export type DeliveryTerm = typeof DELIVERY_TERMS[number];

export const birthAttendanceRecords = pgTable("birth_attendance_records", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull().references(() => mothers.id, { onDelete: "cascade" }),
  deliveryDate: text("delivery_date").notNull(),
  deliveryType: text("delivery_type").$type<DeliveryType>().notNull(),
  deliveryTerm: text("delivery_term").$type<DeliveryTerm>(),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBirthAttendanceRecordSchema = createInsertSchema(birthAttendanceRecords)
  .omit({ id: true, createdAt: true })
  .extend({
    deliveryType: z.enum(DELIVERY_TYPES),
    deliveryTerm: z.enum(DELIVERY_TERMS).optional().nullable(),
  });
export type BirthAttendanceRecord = typeof birthAttendanceRecords.$inferSelect;
export type InsertBirthAttendanceRecord = z.infer<typeof insertBirthAttendanceRecordSchema>;

// === SICK CHILD VISITS — feeds M1 Section F ===
// IMCI sick-consult log. children.vitaminA1Date / vitaminA2Date already
// captures routine Vit-A; this table captures the *sick-visit* Vit-A
// (per F-01/F-02) and acute-diarrhea cases (F-03).
export const sickChildVisits = pgTable("sick_child_visits", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  visitDate: text("visit_date").notNull(),
  vitaminAGiven: boolean("vitamin_a_given").default(false),
  hasAcuteDiarrhea: boolean("has_acute_diarrhea").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSickChildVisitSchema = createInsertSchema(sickChildVisits).omit({ id: true, createdAt: true });
export type SickChildVisit = typeof sickChildVisits.$inferSelect;
export type InsertSickChildVisit = z.infer<typeof insertSickChildVisitSchema>;

// === SCHOOL IMMUNIZATIONS — feeds M1 Section D4 ===
// HPV (9-yo female) and Grade-1 Td. School-aged learners are typically
// not in the `children` table, so this is a standalone roster.
export const SCHOOL_VACCINES = ["HPV", "Td"] as const;
export type SchoolVaccine = typeof SCHOOL_VACCINES[number];

export const schoolImmunizations = pgTable("school_immunizations", {
  id: serial("id").primaryKey(),
  learnerName: text("learner_name").notNull(),
  barangay: text("barangay").notNull(),
  schoolName: text("school_name"),
  gradeLevel: integer("grade_level"),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(), // 'M' | 'F'
  vaccine: text("vaccine").$type<SchoolVaccine>().notNull(),
  doseNumber: integer("dose_number").notNull(),
  vaccinationDate: text("vaccination_date").notNull(),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolImmunizationSchema = createInsertSchema(schoolImmunizations)
  .omit({ id: true, createdAt: true })
  .extend({
    vaccine: z.enum(SCHOOL_VACCINES),
    doseNumber: z.number().int().min(1).max(3),
    sex: z.enum(["M", "F"]),
  });
export type SchoolImmunization = typeof schoolImmunizations.$inferSelect;
export type InsertSchoolImmunization = z.infer<typeof insertSchoolImmunizationSchema>;

// === ORAL HEALTH VISITS — feeds M1 Section ORAL ===
// First-visit roster (per DOH Oral Health Program). Age bands:
// 0-11m, 1-4y, 5-9y, 10-19y, 20-59y, 60+. Pregnant women tracked
// separately for ORAL-06.
export const oralHealthVisits = pgTable("oral_health_visits", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(), // 'M' | 'F'
  visitDate: text("visit_date").notNull(),
  isFirstVisit: boolean("is_first_visit").default(true),
  facilityBased: boolean("facility_based").default(true),
  isPregnant: boolean("is_pregnant").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOralHealthVisitSchema = createInsertSchema(oralHealthVisits)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]) });
export type OralHealthVisit = typeof oralHealthVisits.$inferSelect;
export type InsertOralHealthVisit = z.infer<typeof insertOralHealthVisitSchema>;

// ===========================================================================
// PHASE 4 — NCD & Lifestyle (PhilPEN, CV, Vision, Cervical, Mental health)
// ===========================================================================

// === PHILPEN RISK ASSESSMENTS — Section G1 ===
export const BMI_CATEGORIES = ["UNDERWEIGHT", "NORMAL", "OVERWEIGHT", "OBESE"] as const;
export type BmiCategory = typeof BMI_CATEGORIES[number];

export const philpenAssessments = pgTable("philpen_assessments", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(), // 'M' | 'F'
  assessmentDate: text("assessment_date").notNull(),
  smokingHistory: boolean("smoking_history").default(false),
  bingeDrinker: boolean("binge_drinker").default(false),
  insufficientActivity: boolean("insufficient_activity").default(false),
  unhealthyDiet: boolean("unhealthy_diet").default(false),
  bmiCategory: text("bmi_category").$type<BmiCategory>(),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPhilpenAssessmentSchema = createInsertSchema(philpenAssessments)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]), bmiCategory: z.enum(BMI_CATEGORIES).optional().nullable() });
export type PhilpenAssessment = typeof philpenAssessments.$inferSelect;
export type InsertPhilpenAssessment = z.infer<typeof insertPhilpenAssessmentSchema>;

// === NCD SCREENINGS — Sections G2 (HTN) + G3 reserved (DM) ===
export const NCD_CONDITIONS = ["HTN", "DM"] as const;
export type NcdCondition = typeof NCD_CONDITIONS[number];
export const NCD_MEDS_SOURCES = ["FACILITY", "OUT_OF_POCKET"] as const;
export type NcdMedsSource = typeof NCD_MEDS_SOURCES[number];

export const ncdScreenings = pgTable("ncd_screenings", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  screenDate: text("screen_date").notNull(),
  condition: text("condition").$type<NcdCondition>().notNull(),
  diagnosed: boolean("diagnosed").default(false),
  medsProvided: boolean("meds_provided").default(false),
  medsSource: text("meds_source").$type<NcdMedsSource>(),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertNcdScreeningSchema = createInsertSchema(ncdScreenings)
  .omit({ id: true, createdAt: true })
  .extend({
    sex: z.enum(["M", "F"]),
    condition: z.enum(NCD_CONDITIONS),
    medsSource: z.enum(NCD_MEDS_SOURCES).optional().nullable(),
  });
export type NcdScreening = typeof ncdScreenings.$inferSelect;
export type InsertNcdScreening = z.infer<typeof insertNcdScreeningSchema>;

// === VISION SCREENINGS — Section G4 (Blindness Prevention) ===
export const visionScreenings = pgTable("vision_screenings", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  screenDate: text("screen_date").notNull(),
  eyeDiseaseFound: boolean("eye_disease_found").default(false),
  referredToEyeCare: boolean("referred_to_eye_care").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertVisionScreeningSchema = createInsertSchema(visionScreenings)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]) });
export type VisionScreening = typeof visionScreenings.$inferSelect;
export type InsertVisionScreening = z.infer<typeof insertVisionScreeningSchema>;

// === CERVICAL CANCER SCREENINGS — Section G6 ===
export const CERVICAL_SCREEN_METHODS = ["VIA", "PAP_SMEAR", "HPV_TEST"] as const;
export type CervicalScreenMethod = typeof CERVICAL_SCREEN_METHODS[number];
export const CARE_OUTCOMES = ["TREATED", "REFERRED"] as const;
export type CareOutcome = typeof CARE_OUTCOMES[number];

export const cervicalCancerScreenings = pgTable("cervical_cancer_screenings", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  screenDate: text("screen_date").notNull(),
  screenMethod: text("screen_method").$type<CervicalScreenMethod>(),
  suspicious: boolean("suspicious").default(false),
  linkedToCare: boolean("linked_to_care").default(false),
  linkedOutcome: text("linked_outcome").$type<CareOutcome>(),
  precancerous: boolean("precancerous").default(false),
  precancerousOutcome: text("precancerous_outcome").$type<CareOutcome>(),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCervicalCancerScreeningSchema = createInsertSchema(cervicalCancerScreenings)
  .omit({ id: true, createdAt: true })
  .extend({
    screenMethod: z.enum(CERVICAL_SCREEN_METHODS).optional().nullable(),
    linkedOutcome: z.enum(CARE_OUTCOMES).optional().nullable(),
    precancerousOutcome: z.enum(CARE_OUTCOMES).optional().nullable(),
  });
export type CervicalCancerScreening = typeof cervicalCancerScreenings.$inferSelect;
export type InsertCervicalCancerScreening = z.infer<typeof insertCervicalCancerScreeningSchema>;

// === MENTAL HEALTH SCREENINGS — Section G8 (mhGAP) ===
export const mentalHealthScreenings = pgTable("mental_health_screenings", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  screenDate: text("screen_date").notNull(),
  tool: text("tool").default("mhGAP"),
  positive: boolean("positive").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMentalHealthScreeningSchema = createInsertSchema(mentalHealthScreenings)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]) });
export type MentalHealthScreening = typeof mentalHealthScreenings.$inferSelect;
export type InsertMentalHealthScreening = z.infer<typeof insertMentalHealthScreeningSchema>;

// ===========================================================================
// PHASE 5 — Disease surveillance (filariasis, rabies, schisto, STH, leprosy)
// ===========================================================================

export const FIL_RESULTS = ["POSITIVE", "NEGATIVE"] as const;
export const FIL_MANIFESTATIONS = ["LYMPHEDEMA", "HYDROCELE", "NONE"] as const;
export const filariasisRecords = pgTable("filariasis_records", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  examDate: text("exam_date").notNull(),
  result: text("result").$type<typeof FIL_RESULTS[number]>(),
  manifestation: text("manifestation").$type<typeof FIL_MANIFESTATIONS[number]>().default("NONE"),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertFilariasisRecordSchema = createInsertSchema(filariasisRecords)
  .omit({ id: true, createdAt: true })
  .extend({
    sex: z.enum(["M", "F"]),
    result: z.enum(FIL_RESULTS).optional().nullable(),
    manifestation: z.enum(FIL_MANIFESTATIONS).optional().nullable(),
  });
export type FilariasisRecord = typeof filariasisRecords.$inferSelect;
export type InsertFilariasisRecord = z.infer<typeof insertFilariasisRecordSchema>;

export const RABIES_CATEGORIES = ["I", "II", "III"] as const;
export const RABIES_CENTERS = ["ABTC", "NON_ABTC"] as const;
export const rabiesExposures = pgTable("rabies_exposures", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  exposureDate: text("exposure_date").notNull(),
  category: text("category").$type<typeof RABIES_CATEGORIES[number]>().notNull(),
  treatmentCenter: text("treatment_center").$type<typeof RABIES_CENTERS[number]>(),
  completeDoses: boolean("complete_doses").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRabiesExposureSchema = createInsertSchema(rabiesExposures)
  .omit({ id: true, createdAt: true })
  .extend({
    sex: z.enum(["M", "F"]),
    category: z.enum(RABIES_CATEGORIES),
    treatmentCenter: z.enum(RABIES_CENTERS).optional().nullable(),
  });
export type RabiesExposure = typeof rabiesExposures.$inferSelect;
export type InsertRabiesExposure = z.infer<typeof insertRabiesExposureSchema>;

export const schistosomiasisRecords = pgTable("schistosomiasis_records", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  seenDate: text("seen_date").notNull(),
  suspected: boolean("suspected").default(false),
  treated: boolean("treated").default(false),
  confirmed: boolean("confirmed").default(false),
  complicated: boolean("complicated").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSchistosomiasisRecordSchema = createInsertSchema(schistosomiasisRecords)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]) });
export type SchistosomiasisRecord = typeof schistosomiasisRecords.$inferSelect;
export type InsertSchistosomiasisRecord = z.infer<typeof insertSchistosomiasisRecordSchema>;

export const STH_RESIDENCIES = ["RESIDENT", "NON_RESIDENT"] as const;
export const sthRecords = pgTable("sth_records", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  screenDate: text("screen_date").notNull(),
  confirmed: boolean("confirmed").default(false),
  residency: text("residency").$type<typeof STH_RESIDENCIES[number]>().default("RESIDENT"),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSthRecordSchema = createInsertSchema(sthRecords)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]), residency: z.enum(STH_RESIDENCIES).optional().nullable() });
export type SthRecord = typeof sthRecords.$inferSelect;
export type InsertSthRecord = z.infer<typeof insertSthRecordSchema>;

export const leprosyRecords = pgTable("leprosy_records", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  barangay: text("barangay").notNull(),
  dob: text("dob").notNull(),
  sex: text("sex").notNull(),
  registeredDate: text("registered_date").notNull(),
  newCase: boolean("new_case").default(false),
  confirmed: boolean("confirmed").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLeprosyRecordSchema = createInsertSchema(leprosyRecords)
  .omit({ id: true, createdAt: true })
  .extend({ sex: z.enum(["M", "F"]) });
export type LeprosyRecord = typeof leprosyRecords.$inferSelect;
export type InsertLeprosyRecord = z.infer<typeof insertLeprosyRecordSchema>;

// ===========================================================================
// PHASE 7 — Water & Sanitation (Section W; PDF "G1. Water")
// ===========================================================================
export const WATER_LEVELS = ["I", "II", "III"] as const;
export type WaterLevel = typeof WATER_LEVELS[number];

export const householdWaterRecords = pgTable("household_water_records", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  surveyDate: text("survey_date").notNull(),
  householdId: text("household_id"), // optional external key
  householdHead: text("household_head"),
  waterLevel: text("water_level").$type<WaterLevel>(),
  safelyManaged: boolean("safely_managed").default(false),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertHouseholdWaterRecordSchema = createInsertSchema(householdWaterRecords)
  .omit({ id: true, createdAt: true })
  .extend({ waterLevel: z.enum(WATER_LEVELS).optional().nullable() });
export type HouseholdWaterRecord = typeof householdWaterRecords.$inferSelect;
export type InsertHouseholdWaterRecord = z.infer<typeof insertHouseholdWaterRecordSchema>;

// === HRH WORKFORCE MODULE — DOH HHRDB / NHWSS aligned ===
// Roster of health workers under the LGU's responsibility for DOH
// Human Resources for Health Information System (HRH-IS / NHWSS)
// quarterly reporting, plus PhilHealth Konsulta accreditation HRH
// attachments. Underpinned by RA 11223 §22-§25 (Health Workforce).
export const HRH_PROFESSIONS = [
  "NURSE", "MIDWIFE", "PHYSICIAN", "DENTIST", "MEDTECH",
  "NUTRITIONIST", "SANITATION_INSPECTOR", "BHW_VOLUNTEER", "OTHER",
] as const;
export type HrhProfession = typeof HRH_PROFESSIONS[number];

export const HRH_EMPLOYMENT_STATUSES = [
  "REGULAR", "CONTRACTUAL", "JOB_ORDER", "CONTRACT_OF_SERVICE",
  "NDP", "DTTB", "RHMPP", "RHMP", "MTDP", "VOLUNTEER", "OTHER",
] as const;
export type HrhEmploymentStatus = typeof HRH_EMPLOYMENT_STATUSES[number];

export const workforceMembers = pgTable("workforce_members", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  profession: text("profession").$type<HrhProfession>().notNull(),
  prcLicenseNumber: text("prc_license_number"),
  prcLicenseExpiry: text("prc_license_expiry"),     // YYYY-MM-DD; drives expiry alerts
  barangay: text("barangay"),                        // primary assignment, null = RHU
  facilityType: text("facility_type"),               // 'BHS' | 'RHU' | 'HOSPITAL'
  employmentStatus: text("employment_status").$type<HrhEmploymentStatus>().notNull(),
  dateHired: text("date_hired"),
  dateSeparated: text("date_separated"),
  separationReason: text("separation_reason"),
  contactNumber: text("contact_number"),
  email: text("email"),
  // Optional link to the platform user account (if they log in to this app).
  userId: varchar("user_id"),
  notes: text("notes"),
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWorkforceMemberSchema = createInsertSchema(workforceMembers)
  .omit({ id: true, createdAt: true })
  .extend({
    profession: z.enum(HRH_PROFESSIONS),
    employmentStatus: z.enum(HRH_EMPLOYMENT_STATUSES),
  });
export type WorkforceMember = typeof workforceMembers.$inferSelect;
export type InsertWorkforceMember = z.infer<typeof insertWorkforceMemberSchema>;

export const HRH_CREDENTIAL_TYPES = [
  "BEmONC", "BLS", "ACLS", "IMCI", "FP_CBT", "mhGAP",
  "PhilCAT_TB", "BLS_NEONATAL", "OTHER",
] as const;
export type HrhCredentialType = typeof HRH_CREDENTIAL_TYPES[number];

export const workforceCredentials = pgTable("workforce_credentials", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => workforceMembers.id, { onDelete: "cascade" }),
  credentialType: text("credential_type").$type<HrhCredentialType>().notNull(),
  dateObtained: text("date_obtained").notNull(),
  expiryDate: text("expiry_date"),
  provider: text("provider"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWorkforceCredentialSchema = createInsertSchema(workforceCredentials)
  .omit({ id: true, createdAt: true })
  .extend({ credentialType: z.enum(HRH_CREDENTIAL_TYPES) });
export type WorkforceCredential = typeof workforceCredentials.$inferSelect;
export type InsertWorkforceCredential = z.infer<typeof insertWorkforceCredentialSchema>;

// === PIDSR WEEKLY ATTESTATIONS — RA 11332 + PIDSR MoP 2nd Ed. ===
// Cat-I diseases (AFP, measles, NT, rabies, cholera, anthrax, meningo,
// HFMD outbreaks) require zero-reports each week even when no cases
// occurred. Cat-II is a line list (already covered by disease_cases),
// but the *submission attestation* is what marks the week as filed.
export const PIDSR_ZERO_REPORT_DISEASES = [
  "AFP", "MEASLES", "NEONATAL_TETANUS", "RABIES_HUMAN", "CHOLERA",
  "ANTHRAX", "MENINGOCOCCAL", "HFMD_OUTBREAK",
] as const;
export type PidsrZeroReportDisease = typeof PIDSR_ZERO_REPORT_DISEASES[number];

export const pidsrSubmissions = pgTable("pidsr_submissions", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  weekStartDate: text("week_start_date").notNull(), // Monday YYYY-MM-DD
  weekEndDate: text("week_end_date").notNull(),     // Friday YYYY-MM-DD (cutoff)
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  submittedByUserId: varchar("submitted_by_user_id"),
  cat2CaseCount: integer("cat2_case_count").default(0),
  // Cat-I diseases that the DSO is attesting "zero cases this week".
  // Stored as a JSON array of PidsrZeroReportDisease values; absent
  // means the DSO did NOT confirm zero — i.e. potential gap.
  zeroReportDiseases: jsonb("zero_report_diseases").$type<PidsrZeroReportDisease[]>(),
  notes: text("notes"),
}, (t) => ({
  uniqueWeek: uniqueIndex("pidsr_submissions_unique_idx")
    .on(t.barangay, t.weekEndDate),
}));

export const insertPidsrSubmissionSchema = createInsertSchema(pidsrSubmissions)
  .omit({ id: true, submittedAt: true })
  .extend({
    zeroReportDiseases: z.array(z.enum(PIDSR_ZERO_REPORT_DISEASES)).optional(),
  });
export type PidsrSubmission = typeof pidsrSubmissions.$inferSelect;
export type InsertPidsrSubmission = z.infer<typeof insertPidsrSubmissionSchema>;

// Child monitoring visits
export const childVisits = pgTable("child_visits", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  visitNumber: integer("visit_number").notNull(),
  visitDate: text("visit_date").notNull(),
  weightKg: text("weight_kg"),
  heightCm: text("height_cm"),
  muac: text("muac"), // mid-upper arm circumference in cm
  nutritionNotes: text("nutrition_notes"),
  immunizationNotes: text("immunization_notes"),
  monitoringNotes: text("monitoring_notes"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  uniqChildVisit: unique("child_visits_child_id_visit_number_unique").on(t.childId, t.visitNumber),
}));
export const insertChildVisitSchema = createInsertSchema(childVisits).omit({ id: true });
export type ChildVisit = typeof childVisits.$inferSelect;
export type InsertChildVisit = z.infer<typeof insertChildVisitSchema>;

// Senior care visits
export const seniorVisits = pgTable("senior_visits", {
  id: serial("id").primaryKey(),
  seniorId: integer("senior_id").notNull().references(() => seniors.id, { onDelete: "cascade" }),
  visitNumber: integer("visit_number").notNull(),
  visitDate: text("visit_date").notNull(),
  bloodPressure: text("blood_pressure"),
  weightKg: text("weight_kg"),
  medicationPickupNote: text("medication_pickup_note"),
  symptomsRemarks: text("symptoms_remarks"),
  followUpNotes: text("follow_up_notes"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  uniqSeniorVisit: unique("senior_visits_senior_id_visit_number_unique").on(t.seniorId, t.visitNumber),
}));
export const insertSeniorVisitSchema = createInsertSchema(seniorVisits).omit({ id: true });
export type SeniorVisit = typeof seniorVisits.$inferSelect;
export type InsertSeniorVisit = z.infer<typeof insertSeniorVisitSchema>;

// === NUTRITION FOLLOW-UPS (PIMAM / OPT-Plus register for under-5 underweight) ===
// DOH AO 2015-0055 (PIMAM), NNC OPT-Plus Operations Manual 2022.

export const NUTRITION_CLASSIFICATIONS = [
  "SAM_COMPLICATED",        // WHZ < -3 OR MUAC < 11.5 + danger signs
  "SAM_UNCOMPLICATED",      // WHZ < -3 OR MUAC < 11.5, appetite OK
  "MAM",                    // WHZ -3 to -2 OR MUAC 11.5 to <12.5
  "SEVERELY_UNDERWEIGHT",   // WAZ < -3
  "UNDERWEIGHT",            // WAZ < -2
  "NORMAL_RECOVERED",       // WHZ >= -2 for 2 consecutive visits
  "DEFAULTER",              // 2 consecutive missed visits
] as const;
export type NutritionClassification = typeof NUTRITION_CLASSIFICATIONS[number];

export const NUTRITION_ACTIONS = [
  // Clinical referral
  "REFER_RHU",
  "REFER_HOSPITAL_SAM",
  // Supplementation / treatment
  "ENROLL_OTC",
  "ENROLL_SFP",
  "PROVIDE_RUTF",
  "PROVIDE_RUSF",
  "VITAMIN_A",
  "DEWORMING",
  "MNP_SUPPLEMENT",
  "IRON_SUPPLEMENT",
  // Counselling
  "IYCF_COUNSELLING",
  "BREASTFEEDING_SUPPORT",
  "NUTRITION_COUNSELLING",
  "WASH_COUNSELLING",
  // Monitoring
  "GROWTH_MONITORING",
  "HOME_VISIT_MUAC",
  "IMMUNIZATION_CATCHUP",
  // Social protection
  "PANTAWID_4PS_REFERRAL",
  "PHILHEALTH_ENROLLMENT",
] as const;
export type NutritionAction = typeof NUTRITION_ACTIONS[number];

// PIMAM register exit codes
export const NUTRITION_OUTCOMES = [
  "CURED",
  "DEFAULTED",
  "NON_RESPONDER",
  "DIED",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "MEDICAL_TRANSFER",
] as const;
export type NutritionOutcome = typeof NUTRITION_OUTCOMES[number];

export const nutritionFollowUps = pgTable("nutrition_followups", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  barangay: text("barangay").notNull(),                     // denormalized for barangay-scoped queries
  followUpDate: text("follow_up_date").notNull(),           // YYYY-MM-DD
  classification: text("classification").notNull(),         // NutritionClassification
  weightKg: text("weight_kg"),
  heightCm: text("height_cm"),
  muacCm: text("muac_cm"),                                  // mid-upper arm circumference
  actions: jsonb("actions").$type<NutritionAction[]>().notNull().default([]),
  nextStep: text("next_step"),                              // free-text plan
  nextFollowUpDate: text("next_follow_up_date"),            // YYYY-MM-DD (protocol-suggested)
  outcome: text("outcome"),                                 // NutritionOutcome — null until case closed
  notes: text("notes"),
  recordedBy: text("recorded_by"),                          // user id / name
  createdAt: text("created_at").notNull(),
  // Which RHU the child was referred to. Only meaningful when the REFER_RHU
  // action is present; nullable otherwise.
  referredRhuId: integer("referred_rhu_id").references(() => healthStations.id),
});

export const insertNutritionFollowUpSchema = createInsertSchema(nutritionFollowUps)
  .omit({ id: true })
  .extend({
    classification: z.enum(NUTRITION_CLASSIFICATIONS),
    actions: z.array(z.enum(NUTRITION_ACTIONS)).default([]),
    outcome: z.enum(NUTRITION_OUTCOMES).optional().nullable(),
    referredRhuId: z.number().int().positive().optional().nullable(),
  });
export type NutritionFollowUp = typeof nutritionFollowUps.$inferSelect;
export type InsertNutritionFollowUp = z.infer<typeof insertNutritionFollowUpSchema>;

// === FP SERVICE RECORDS (Family Planning enrollment tracking) ===
export const FP_METHODS = ["BTL", "NSV", "CONDOM", "PILLS_POP", "PILLS_COC", "DMPA", "IMPLANT", "IUD_INTERVAL", "IUD_PP", "LAM", "BBT", "CMM", "STM", "SDM", "OTHERS"] as const;
export type FpMethod = typeof FP_METHODS[number];
export const FP_STATUSES = ["CURRENT_USER", "NEW_ACCEPTOR", "DROPOUT"] as const;
export type FpStatus = typeof FP_STATUSES[number];

// Maps fp_method to M1 row_key
export const FP_METHOD_ROW_KEY: Record<FpMethod, string | null> = {
  BTL: "FP-01",
  NSV: "FP-02",
  CONDOM: "FP-03",
  PILLS_POP: "FP-04a",
  PILLS_COC: "FP-04b",
  DMPA: "FP-05",
  IMPLANT: "FP-06",
  IUD_INTERVAL: "FP-07a",
  IUD_PP: "FP-07b",
  LAM: "FP-08",
  BBT: "FP-09",
  CMM: "FP-10",
  STM: "FP-11",
  SDM: "FP-12",
  OTHERS: null,
};

export const fpServiceRecords = pgTable("fp_service_records", {
  id: serial("id").primaryKey(),
  barangay: text("barangay").notNull(),
  patientName: text("patient_name").notNull(),
  linkedPersonType: text("linked_person_type"), // "MOTHER" | "GENERAL"
  linkedPersonId: integer("linked_person_id"),   // FK to mothers.id if MOTHER
  dob: text("dob"),                               // used to auto-calculate age group
  fpMethod: text("fp_method").notNull(),          // one of FP_METHODS
  fpStatus: text("fp_status").notNull(),          // one of FP_STATUSES
  dateStarted: text("date_started").notNull(),
  dateStopped: text("date_stopped"),
  reportingMonth: text("reporting_month"),        // YYYY-MM, e.g. "2025-12" for M1 scoping
  notes: text("notes"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});

export const insertFpServiceRecordSchema = createInsertSchema(fpServiceRecords)
  .omit({ id: true })
  .extend({
    fpMethod: z.enum(FP_METHODS),
    fpStatus: z.enum(FP_STATUSES),
  });
export type FpServiceRecord = typeof fpServiceRecords.$inferSelect;
export type InsertFpServiceRecord = z.infer<typeof insertFpServiceRecordSchema>;

// === GLOBAL CHAT MESSAGES (Internal shared chat room for all staff) ===
export const globalChatMessages = pgTable("global_chat_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGlobalChatMessageSchema = createInsertSchema(globalChatMessages).omit({ id: true, createdAt: true });
export type GlobalChatMessage = typeof globalChatMessages.$inferSelect;
export type InsertGlobalChatMessage = z.infer<typeof insertGlobalChatMessageSchema>;

// === AUTH & RBAC (from Replit Auth integration + extensions) ===
// Note: barangays, userBarangays, auditLogs, users, sessions are defined in ./models/auth.ts
export * from "./models/auth";

// === CHAT/CONVERSATIONS (for AI Reporting) ===
export * from "./models/chat";
