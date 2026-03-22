import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  disposition: text("disposition").default("Treated"), // Treated, Referred, Admitted
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
  createdAt: text("created_at").notNull(),
});

export const insertDeathEventSchema = createInsertSchema(deathEvents).omit({ id: true });
export type DeathEvent = typeof deathEvents.$inferSelect;
export type InsertDeathEvent = z.infer<typeof insertDeathEventSchema>;

// === NURSE VISITS (Barangay Nurse / Team Leader monitoring visits) ===

// Prenatal / Mother visits
export const prenatalVisits = pgTable("prenatal_visits", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull(),
  visitNumber: integer("visit_number").notNull(),
  visitDate: text("visit_date").notNull(),
  gaWeeks: integer("ga_weeks"),
  weightKg: text("weight_kg"),
  bloodPressure: text("blood_pressure"),
  fundalHeight: text("fundal_height"), // cm
  fetalHeartTone: text("fetal_heart_tone"), // bpm
  riskStatus: text("risk_status"), // low, moderate, high
  notes: text("notes"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});
export const insertPrenatalVisitSchema = createInsertSchema(prenatalVisits).omit({ id: true });
export type PrenatalVisit = typeof prenatalVisits.$inferSelect;
export type InsertPrenatalVisit = z.infer<typeof insertPrenatalVisitSchema>;

// Child monitoring visits
export const childVisits = pgTable("child_visits", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
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
});
export const insertChildVisitSchema = createInsertSchema(childVisits).omit({ id: true });
export type ChildVisit = typeof childVisits.$inferSelect;
export type InsertChildVisit = z.infer<typeof insertChildVisitSchema>;

// Senior care visits
export const seniorVisits = pgTable("senior_visits", {
  id: serial("id").primaryKey(),
  seniorId: integer("senior_id").notNull(),
  visitNumber: integer("visit_number").notNull(),
  visitDate: text("visit_date").notNull(),
  bloodPressure: text("blood_pressure"),
  weightKg: text("weight_kg"),
  medicationPickupNote: text("medication_pickup_note"),
  symptomsRemarks: text("symptoms_remarks"),
  followUpNotes: text("follow_up_notes"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});
export const insertSeniorVisitSchema = createInsertSchema(seniorVisits).omit({ id: true });
export type SeniorVisit = typeof seniorVisits.$inferSelect;
export type InsertSeniorVisit = z.infer<typeof insertSeniorVisitSchema>;

// === AUTH & RBAC (from Replit Auth integration + extensions) ===
// Note: barangays, userBarangays, auditLogs, users, sessions are defined in ./models/auth.ts
export * from "./models/auth";

// === CHAT/CONVERSATIONS (for AI Reporting) ===
export * from "./models/chat";
