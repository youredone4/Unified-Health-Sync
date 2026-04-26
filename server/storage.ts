import { db } from "./db";
import { 
  mothers, children, seniors, inventory, medicineInventory, inventorySnapshots, coldChainLogs, tbDoseLogs, healthStations, smsOutbox, diseaseCases, tbPatients, themeSettings,
  barangays, users, userBarangays, municipalitySettings, UserRole, consults, seniorMedClaims,
  m1TemplateVersions, m1IndicatorCatalog, m1ReportInstances, m1ReportHeader, m1IndicatorValues, barangaySettings,
  directMessages,
  prenatalVisits, childVisits, seniorVisits, postpartumVisits, prenatalScreenings, birthAttendanceRecords,
  sickChildVisits, schoolImmunizations, oralHealthVisits,
  philpenAssessments, ncdScreenings, visionScreenings, cervicalCancerScreenings, mentalHealthScreenings,
  filariasisRecords, rabiesExposures, schistosomiasisRecords, sthRecords, leprosyRecords,
  deathEvents, pidsrSubmissions, workforceMembers, workforceCredentials, householdWaterRecords,
  nutritionFollowUps,
  fpServiceRecords, FP_METHOD_ROW_KEY,
  globalChatMessages,
  type Mother, type InsertMother,
  type Child, type InsertChild,
  type Senior, type InsertSenior,
  type InventoryItem,
  type MedicineInventoryItem, type InsertMedicineInventoryItem,
  type InventorySnapshot, type InsertInventorySnapshot,
  type ColdChainLog, type InsertColdChainLog,
  type TbDoseLog, type InsertTbDoseLog,
  type PostpartumVisit, type InsertPostpartumVisit,
  type PrenatalScreening, type InsertPrenatalScreening,
  type BirthAttendanceRecord, type InsertBirthAttendanceRecord,
  type SickChildVisit, type InsertSickChildVisit,
  type SchoolImmunization, type InsertSchoolImmunization,
  type OralHealthVisit, type InsertOralHealthVisit,
  type PhilpenAssessment, type InsertPhilpenAssessment,
  type NcdScreening, type InsertNcdScreening,
  type VisionScreening, type InsertVisionScreening,
  type CervicalCancerScreening, type InsertCervicalCancerScreening,
  type MentalHealthScreening, type InsertMentalHealthScreening,
  type FilariasisRecord, type InsertFilariasisRecord,
  type RabiesExposure, type InsertRabiesExposure,
  type SchistosomiasisRecord, type InsertSchistosomiasisRecord,
  type SthRecord, type InsertSthRecord,
  type LeprosyRecord, type InsertLeprosyRecord,
  type DeathEvent, type InsertDeathEvent,
  type PidsrSubmission, type InsertPidsrSubmission,
  type WorkforceMember, type InsertWorkforceMember,
  type WorkforceCredential, type InsertWorkforceCredential,
  type HouseholdWaterRecord, type InsertHouseholdWaterRecord,
  type HealthStation,
  type SmsMessage, type InsertSmsMessage,
  type DiseaseCase, type InsertDiseaseCase,
  type TBPatient, type InsertTBPatient,
  type ThemeSettings, type InsertThemeSettings,
  type Consult, type InsertConsult,
  type Barangay, type User,
  type M1TemplateVersion, type M1IndicatorCatalog, type InsertM1IndicatorCatalog, type M1ReportInstance, type M1IndicatorValue,
  type MunicipalitySettings, type BarangaySettings,
  type SeniorMedClaim, type InsertSeniorMedClaim,
  type DirectMessage,
  type PrenatalVisit, type InsertPrenatalVisit,
  type ChildVisit, type InsertChildVisit,
  type SeniorVisit, type InsertSeniorVisit,
  type NutritionFollowUp, type InsertNutritionFollowUp,
  type FpServiceRecord, type InsertFpServiceRecord,
  type GlobalChatMessage,
} from "@shared/schema";
import { eq, and, inArray, desc, isNull, gte, sql, or, lt, ne, ilike } from "drizzle-orm";

export interface IStorage {
  getMothers(): Promise<Mother[]>;
  getMother(id: number): Promise<Mother | undefined>;
  createMother(mother: InsertMother): Promise<Mother>;
  updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother>;
  deleteMother(id: number): Promise<boolean>;
  
  getChildren(): Promise<Child[]>;
  getChild(id: number): Promise<Child | undefined>;
  createChild(child: InsertChild): Promise<Child>;
  updateChild(id: number, updates: Partial<InsertChild>): Promise<Child>;
  deleteChild(id: number): Promise<boolean>;

  getSeniors(): Promise<Senior[]>;
  getSenior(id: number): Promise<Senior | undefined>;
  createSenior(senior: InsertSenior): Promise<Senior>;
  updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior>;
  deleteSenior(id: number): Promise<boolean>;
  bulkImportSeniors(rows: InsertSenior[], replace: boolean): Promise<number>;

  getInventory(): Promise<InventoryItem[]>;
  getMedicineInventory(): Promise<MedicineInventoryItem[]>;
  getMedicineInventoryById(id: number): Promise<MedicineInventoryItem | undefined>;
  createMedicineInventory(item: InsertMedicineInventoryItem): Promise<MedicineInventoryItem>;
  updateMedicineInventory(id: number, updates: Partial<InsertMedicineInventoryItem>): Promise<MedicineInventoryItem>;
  getInventorySnapshots(params: { barangay?: string; itemType: string; itemKey: string }): Promise<InventorySnapshot[]>;
  bulkInsertInventorySnapshots(rows: InsertInventorySnapshot[]): Promise<number>;

  // Cold-chain temperature log (DOH NIP/EPI Cold Chain Manual)
  getColdChainLogs(params: { barangay?: string; fromDate?: string; toDate?: string }): Promise<ColdChainLog[]>;
  getColdChainTodayStatus(barangay: string, date: string): Promise<{ am: ColdChainLog | null; pm: ColdChainLog | null }>;
  createColdChainLog(log: InsertColdChainLog): Promise<ColdChainLog>;

  // TB DOTS daily dose log (NTP MoP 6th Ed.)
  getTbDoseLogs(params: { tbPatientId?: number; fromDate?: string; toDate?: string }): Promise<TbDoseLog[]>;
  getTbDoseTodaySummary(barangay: string, date: string): Promise<{
    expected: TBPatient[];
    logsByPatient: Record<number, TbDoseLog>;
  }>;
  createTbDoseLog(log: InsertTbDoseLog): Promise<TbDoseLog>;

  // Postpartum (PNC) visits — DOH MNCHN AO 2008-0029
  getPostpartumVisits(motherId: number): Promise<PostpartumVisit[]>;
  getPostpartumDueToday(barangay: string, today: string): Promise<{
    mother: Mother;
    visits: PostpartumVisit[];
    dueCheckpoints: string[];
  }[]>;
  createPostpartumVisit(visit: InsertPostpartumVisit): Promise<PostpartumVisit>;

  // Prenatal screenings (M1 Section A page-19 extras)
  getPrenatalScreenings(motherId: number): Promise<PrenatalScreening[]>;
  createPrenatalScreening(screening: InsertPrenatalScreening): Promise<PrenatalScreening>;

  // Birth-attendance records (M1 B-04 delivery type breakdown)
  getBirthAttendanceRecords(motherId: number): Promise<BirthAttendanceRecord[]>;
  createBirthAttendanceRecord(record: InsertBirthAttendanceRecord): Promise<BirthAttendanceRecord>;

  // Sick child visits (M1 Section F — IMCI)
  getSickChildVisits(childId: number): Promise<SickChildVisit[]>;
  createSickChildVisit(visit: InsertSickChildVisit): Promise<SickChildVisit>;

  // School immunizations (M1 Section D4 — HPV / Td)
  getSchoolImmunizations(params: { barangay?: string; vaccine?: string }): Promise<SchoolImmunization[]>;
  createSchoolImmunization(record: InsertSchoolImmunization): Promise<SchoolImmunization>;

  // Oral health visits (M1 Section ORAL)
  getOralHealthVisits(params: { barangay?: string }): Promise<OralHealthVisit[]>;
  createOralHealthVisit(record: InsertOralHealthVisit): Promise<OralHealthVisit>;

  // Phase 6 — Mortality registry (death_events extensions)
  getDeathEvents(params: { barangay?: string }): Promise<DeathEvent[]>;
  createDeathEvent(r: InsertDeathEvent): Promise<DeathEvent>;

  // PIDSR weekly submission attestations
  getPidsrSubmissions(params: { barangay?: string; fromDate?: string }): Promise<PidsrSubmission[]>;
  getPidsrSubmissionForWeek(barangay: string, weekEndDate: string): Promise<PidsrSubmission | null>;
  createPidsrSubmission(r: InsertPidsrSubmission): Promise<PidsrSubmission>;

  // HRH workforce module (NHWSS / RA 11223 §22-§25)
  getWorkforceMembers(params: { barangay?: string; activeOnly?: boolean }): Promise<WorkforceMember[]>;
  getWorkforceMember(id: number): Promise<WorkforceMember | null>;
  createWorkforceMember(r: InsertWorkforceMember): Promise<WorkforceMember>;
  updateWorkforceMember(id: number, updates: Partial<InsertWorkforceMember>): Promise<WorkforceMember>;
  getWorkforceCredentials(memberId: number): Promise<WorkforceCredential[]>;
  createWorkforceCredential(r: InsertWorkforceCredential): Promise<WorkforceCredential>;

  // Phase 7 — Water & Sanitation
  getHouseholdWaterRecords(params: { barangay?: string }): Promise<HouseholdWaterRecord[]>;
  createHouseholdWaterRecord(r: InsertHouseholdWaterRecord): Promise<HouseholdWaterRecord>;

  // Phase 5 — Disease surveillance
  getFilariasisRecords(params: { barangay?: string }): Promise<FilariasisRecord[]>;
  createFilariasisRecord(r: InsertFilariasisRecord): Promise<FilariasisRecord>;
  getRabiesExposures(params: { barangay?: string }): Promise<RabiesExposure[]>;
  createRabiesExposure(r: InsertRabiesExposure): Promise<RabiesExposure>;
  getSchistosomiasisRecords(params: { barangay?: string }): Promise<SchistosomiasisRecord[]>;
  createSchistosomiasisRecord(r: InsertSchistosomiasisRecord): Promise<SchistosomiasisRecord>;
  getSthRecords(params: { barangay?: string }): Promise<SthRecord[]>;
  createSthRecord(r: InsertSthRecord): Promise<SthRecord>;
  getLeprosyRecords(params: { barangay?: string }): Promise<LeprosyRecord[]>;
  createLeprosyRecord(r: InsertLeprosyRecord): Promise<LeprosyRecord>;

  // Phase 4 — NCD & Lifestyle screenings
  getPhilpenAssessments(params: { barangay?: string }): Promise<PhilpenAssessment[]>;
  createPhilpenAssessment(record: InsertPhilpenAssessment): Promise<PhilpenAssessment>;
  getNcdScreenings(params: { barangay?: string; condition?: string }): Promise<NcdScreening[]>;
  createNcdScreening(record: InsertNcdScreening): Promise<NcdScreening>;
  getVisionScreenings(params: { barangay?: string }): Promise<VisionScreening[]>;
  createVisionScreening(record: InsertVisionScreening): Promise<VisionScreening>;
  getCervicalCancerScreenings(params: { barangay?: string }): Promise<CervicalCancerScreening[]>;
  createCervicalCancerScreening(record: InsertCervicalCancerScreening): Promise<CervicalCancerScreening>;
  getMentalHealthScreenings(params: { barangay?: string }): Promise<MentalHealthScreening[]>;
  createMentalHealthScreening(record: InsertMentalHealthScreening): Promise<MentalHealthScreening>;

  getHealthStations(filter?: { facilityType?: string; hasTbDots?: boolean }): Promise<HealthStation[]>;

  getSmsMessages(): Promise<SmsMessage[]>;
  sendSms(sms: InsertSmsMessage): Promise<SmsMessage>;

  getDiseaseCases(): Promise<DiseaseCase[]>;
  getDiseaseCase(id: number): Promise<DiseaseCase | undefined>;
  createDiseaseCase(data: InsertDiseaseCase): Promise<DiseaseCase>;
  updateDiseaseCase(id: number, updates: Partial<InsertDiseaseCase>): Promise<DiseaseCase>;
  deleteDiseaseCase(id: number): Promise<void>;
  bulkImportDiseaseCases(rows: Array<{ barangay: string; disease_name: string; cases: number; reporting_date: string }>, replace: boolean): Promise<number>;

  getTBPatients(): Promise<TBPatient[]>;
  getTBPatient(id: number): Promise<TBPatient | undefined>;
  createTBPatient(data: InsertTBPatient): Promise<TBPatient>;
  updateTBPatient(id: number, updates: Partial<InsertTBPatient>): Promise<TBPatient>;
  deleteTBPatient(id: number): Promise<void>;

  getThemeSettings(): Promise<ThemeSettings | undefined>;
  updateThemeSettings(updates: Partial<InsertThemeSettings>): Promise<ThemeSettings>;

  getConsults(): Promise<Consult[]>;
  getConsult(id: number): Promise<Consult | undefined>;
  getConsultsByPatient(name: string, barangay: string): Promise<Consult[]>;
  getConsultsByProfile(type: string, profileId: number): Promise<Consult[]>;
  createConsult(consult: InsertConsult): Promise<Consult>;
  updateConsult(id: number, updates: Partial<InsertConsult>): Promise<Consult>;

  // M1 Template System
  getM1TemplateVersions(): Promise<M1TemplateVersion[]>;
  getM1IndicatorCatalog(templateVersionId: number): Promise<M1IndicatorCatalog[]>;
  getBarangays(): Promise<Barangay[]>;
  getM1ReportInstances(filters: { barangayId?: number; month?: number; year?: number }): Promise<M1ReportInstance[]>;
  getM1ReportInstance(id: number): Promise<{ instance: M1ReportInstance; values: M1IndicatorValue[] } | undefined>;
  createM1ReportInstance(data: any): Promise<M1ReportInstance>;
  updateM1IndicatorValues(reportId: number, values: any[]): Promise<M1IndicatorValue[]>;
  updateM1ReportStatus(id: number, status: string): Promise<M1ReportInstance>;
  getMunicipalitySettings(): Promise<MunicipalitySettings | undefined>;
  getBarangaySettings(barangayId: number): Promise<BarangaySettings | undefined>;
  computeM1Values(reportId: number): Promise<{ computed: number; skipped: number }>;
  getConsolidatedM1Values(
    month: number,
    year: number,
    options?: { onlySubmitted?: boolean },
  ): Promise<{ values: M1IndicatorValue[]; sourceReportCount: number; submittedCount: number }>;

  // Senior Medication Claims (Cross-barangay verification)
  getSeniorMedClaims(seniorId?: number): Promise<SeniorMedClaim[]>;
  checkSeniorEligibility(seniorUniqueId: string): Promise<{ eligible: boolean; reason?: string; lastClaim?: SeniorMedClaim }>;
  createSeniorMedClaim(claim: InsertSeniorMedClaim): Promise<SeniorMedClaim>;

  // Direct Messages
  getDMConversations(userId: string): Promise<Array<{
    userId: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
    isSentByMe: boolean;
  }>>;
  getDMMessages(currentUserId: string, otherUserId: string): Promise<DirectMessage[]>;
  sendDMMessage(senderId: string, receiverId: string, content: string): Promise<DirectMessage>;
  markDMThreadRead(currentUserId: string, otherUserId: string): Promise<void>;
  markDMMessageRead(messageId: number, currentUserId: string): Promise<void>;
  getDMMessageSender(messageId: number): Promise<string | null>;
  getDMUnreadCount(userId: string): Promise<number>;
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;

  // Nurse Visits
  getPrenatalVisits(motherId: number): Promise<PrenatalVisit[]>;
  createPrenatalVisit(visit: InsertPrenatalVisit): Promise<PrenatalVisit>;
  getChildVisits(childId: number): Promise<ChildVisit[]>;
  createChildVisit(visit: InsertChildVisit): Promise<ChildVisit>;
  getSeniorVisits(seniorId: number): Promise<SeniorVisit[]>;
  createSeniorVisit(visit: InsertSeniorVisit): Promise<SeniorVisit>;

  // Nutrition Follow-Ups (PIMAM / OPT-Plus register)
  getNutritionFollowUps(filters?: { childId?: number; barangay?: string; barangays?: string[] }): Promise<NutritionFollowUp[]>;
  createNutritionFollowUp(record: InsertNutritionFollowUp): Promise<NutritionFollowUp>;
  updateNutritionFollowUp(id: number, updates: Partial<InsertNutritionFollowUp>): Promise<NutritionFollowUp | undefined>;
  getLatestFollowUpsByChildIds(childIds: number[]): Promise<Record<number, NutritionFollowUp>>;

  // FP Service Records
  getFpServiceRecords(filters?: { barangay?: string; barangays?: string[]; month?: string }): Promise<FpServiceRecord[]>;
  getFpServiceRecord(id: number): Promise<FpServiceRecord | undefined>;
  createFpServiceRecord(record: InsertFpServiceRecord): Promise<FpServiceRecord>;
  updateFpServiceRecord(id: number, updates: Partial<InsertFpServiceRecord>): Promise<FpServiceRecord>;
  deleteFpServiceRecord(id: number): Promise<boolean>;

  // General Chat (global shared room)
  getGlobalChatMessages(): Promise<GlobalChatMessage[]>;
  sendGlobalChatMessage(senderId: string, senderName: string, senderRole: string, content: string): Promise<GlobalChatMessage>;

  seedData(): Promise<void>;
}

/**
 * Maps a raw row from `SELECT * FROM disease_cases` (snake_case keys)
 * into the camelCase shape that drizzle-orm normally returns. Used by
 * the raw-SQL fallback in createDiseaseCase / updateDiseaseCase when
 * we bypass drizzle to guarantee additional_conditions persistence.
 */
function rawDiseaseCaseToCamel(row: any): DiseaseCase {
  return {
    id: row.id,
    patientName: row.patient_name,
    age: row.age,
    barangay: row.barangay,
    addressLine: row.address_line,
    phone: row.phone,
    condition: row.condition,
    additionalConditions: row.additional_conditions ?? [],
    dateReported: row.date_reported,
    status: row.status,
    notes: row.notes,
    linkedPersonType: row.linked_person_type,
    linkedPersonId: row.linked_person_id,
    latitude: row.latitude,
    longitude: row.longitude,
  } as DiseaseCase;
}

export class DatabaseStorage implements IStorage {
  async getMothers(): Promise<Mother[]> {
    return await db.select().from(mothers);
  }

  async getMother(id: number): Promise<Mother | undefined> {
    const [mother] = await db.select().from(mothers).where(eq(mothers.id, id));
    return mother;
  }

  async createMother(mother: InsertMother): Promise<Mother> {
    const [created] = await db.insert(mothers).values(mother).returning();
    return created;
  }

  async updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother> {
    const [updated] = await db.update(mothers)
      .set(updates)
      .where(eq(mothers.id, id))
      .returning();
    return updated;
  }

  async deleteMother(id: number): Promise<boolean> {
    const result = await db.delete(mothers).where(eq(mothers.id, id));
    return true;
  }

  async getChildren(): Promise<Child[]> {
    return await db.select().from(children);
  }

  async getChild(id: number): Promise<Child | undefined> {
    const [child] = await db.select().from(children).where(eq(children.id, id));
    return child;
  }

  async createChild(child: InsertChild): Promise<Child> {
    const [created] = await db.insert(children).values(child as any).returning();
    return created;
  }

  async updateChild(id: number, updates: Partial<InsertChild>): Promise<Child> {
    const [updated] = await db.update(children)
      .set(updates as any)
      .where(eq(children.id, id))
      .returning();
    return updated;
  }

  async deleteChild(id: number): Promise<boolean> {
    await db.delete(children).where(eq(children.id, id));
    return true;
  }

  async getSeniors(): Promise<Senior[]> {
    return await db.select().from(seniors);
  }

  async getSenior(id: number): Promise<Senior | undefined> {
    const [senior] = await db.select().from(seniors).where(eq(seniors.id, id));
    return senior;
  }

  async createSenior(senior: InsertSenior): Promise<Senior> {
    const [created] = await db.insert(seniors).values(senior).returning();
    return created;
  }

  async updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior> {
    const [updated] = await db.update(seniors)
      .set(updates)
      .where(eq(seniors.id, id))
      .returning();
    return updated;
  }

  async deleteSenior(id: number): Promise<boolean> {
    await db.delete(seniors).where(eq(seniors.id, id));
    return true;
  }

  async bulkImportSeniors(rows: InsertSenior[], replace: boolean): Promise<number> {
    if (replace) {
      await db.delete(seniors);
    }
    if (rows.length === 0) return 0;
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await db.insert(seniors).values(chunk).onConflictDoNothing();
      inserted += chunk.length;
    }
    return inserted;
  }

  async getInventory(): Promise<InventoryItem[]> {
    return await db.select().from(inventory);
  }

  async getMedicineInventory(): Promise<MedicineInventoryItem[]> {
    return await db.select().from(medicineInventory).orderBy(desc(medicineInventory.lastUpdated));
  }

  async getMedicineInventoryById(id: number): Promise<MedicineInventoryItem | undefined> {
    const [item] = await db.select().from(medicineInventory).where(eq(medicineInventory.id, id));
    return item;
  }

  async createMedicineInventory(item: InsertMedicineInventoryItem): Promise<MedicineInventoryItem> {
    const [created] = await db.insert(medicineInventory).values(item).returning();
    return created;
  }

  async updateMedicineInventory(id: number, updates: Partial<InsertMedicineInventoryItem>): Promise<MedicineInventoryItem> {
    const [updated] = await db.update(medicineInventory)
      .set(updates)
      .where(eq(medicineInventory.id, id))
      .returning();
    return updated;
  }

  async getInventorySnapshots(params: { barangay?: string; itemType: string; itemKey: string }): Promise<InventorySnapshot[]> {
    const conditions = [
      eq(inventorySnapshots.itemType, params.itemType),
      eq(inventorySnapshots.itemKey, params.itemKey),
    ];
    if (params.barangay) {
      conditions.push(eq(inventorySnapshots.barangay, params.barangay));
    }
    return await db
      .select()
      .from(inventorySnapshots)
      .where(and(...conditions))
      .orderBy(inventorySnapshots.snapshotDate);
  }

  async bulkInsertInventorySnapshots(rows: InsertInventorySnapshot[]): Promise<number> {
    if (rows.length === 0) return 0;
    const chunkSize = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await db.insert(inventorySnapshots).values(rows.slice(i, i + chunkSize));
      total += Math.min(chunkSize, rows.length - i);
    }
    return total;
  }

  async getColdChainLogs(params: { barangay?: string; fromDate?: string; toDate?: string }): Promise<ColdChainLog[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(coldChainLogs.barangay, params.barangay));
    if (params.fromDate) conditions.push(gte(coldChainLogs.readingDate, params.fromDate));
    if (params.toDate) conditions.push(lt(coldChainLogs.readingDate, params.toDate));
    return await db
      .select()
      .from(coldChainLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(coldChainLogs.readingDate), desc(coldChainLogs.readingPeriod));
  }

  async getColdChainTodayStatus(barangay: string, date: string): Promise<{ am: ColdChainLog | null; pm: ColdChainLog | null }> {
    const rows = await db
      .select()
      .from(coldChainLogs)
      .where(and(eq(coldChainLogs.barangay, barangay), eq(coldChainLogs.readingDate, date)));
    return {
      am: rows.find(r => r.readingPeriod === "AM") ?? null,
      pm: rows.find(r => r.readingPeriod === "PM") ?? null,
    };
  }

  async createColdChainLog(log: InsertColdChainLog): Promise<ColdChainLog> {
    const [created] = await db.insert(coldChainLogs).values(log).returning();
    return created;
  }

  async getTbDoseLogs(params: { tbPatientId?: number; fromDate?: string; toDate?: string }): Promise<TbDoseLog[]> {
    const conditions = [];
    if (params.tbPatientId !== undefined) conditions.push(eq(tbDoseLogs.tbPatientId, params.tbPatientId));
    if (params.fromDate) conditions.push(gte(tbDoseLogs.doseDate, params.fromDate));
    if (params.toDate) conditions.push(lt(tbDoseLogs.doseDate, params.toDate));
    return await db
      .select()
      .from(tbDoseLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tbDoseLogs.doseDate));
  }

  async getTbDoseTodaySummary(barangay: string, date: string): Promise<{
    expected: TBPatient[];
    logsByPatient: Record<number, TbDoseLog>;
  }> {
    const expected = await db
      .select()
      .from(tbPatients)
      .where(and(
        eq(tbPatients.barangay, barangay),
        eq(tbPatients.treatmentPhase, "Intensive"),
        eq(tbPatients.outcomeStatus, "Ongoing"),
      ));
    if (expected.length === 0) return { expected: [], logsByPatient: {} };
    const ids = expected.map(p => p.id);
    const logs = await db
      .select()
      .from(tbDoseLogs)
      .where(and(inArray(tbDoseLogs.tbPatientId, ids), eq(tbDoseLogs.doseDate, date)));
    const logsByPatient: Record<number, TbDoseLog> = {};
    for (const l of logs) logsByPatient[l.tbPatientId] = l;
    return { expected, logsByPatient };
  }

  async createTbDoseLog(log: InsertTbDoseLog): Promise<TbDoseLog> {
    const [created] = await db.insert(tbDoseLogs).values(log).returning();
    return created;
  }

  async getPostpartumVisits(motherId: number): Promise<PostpartumVisit[]> {
    return await db
      .select()
      .from(postpartumVisits)
      .where(eq(postpartumVisits.motherId, motherId))
      .orderBy(desc(postpartumVisits.visitDate));
  }

  async getPostpartumDueToday(barangay: string, today: string): Promise<{
    mother: Mother;
    visits: PostpartumVisit[];
    dueCheckpoints: string[];
  }[]> {
    // Mothers in this barangay who delivered in the last ~6 weeks (42 days
    // window, padded by 7 to catch the 6W checkpoint and any near-misses).
    const lookbackDays = 49;
    const minOutcomeDate = new Date(today);
    minOutcomeDate.setDate(minOutcomeDate.getDate() - lookbackDays);
    const minOutcomeStr = minOutcomeDate.toISOString().slice(0, 10);

    const candidates = await db
      .select()
      .from(mothers)
      .where(and(
        eq(mothers.barangay, barangay),
        eq(mothers.outcome, "live_birth"),
        gte(mothers.outcomeDate, minOutcomeStr),
      ));
    if (candidates.length === 0) return [];

    const ids = candidates.map(m => m.id);
    const visits = await db
      .select()
      .from(postpartumVisits)
      .where(inArray(postpartumVisits.motherId, ids));

    const visitsByMother: Record<number, PostpartumVisit[]> = {};
    for (const v of visits) {
      (visitsByMother[v.motherId] ||= []).push(v);
    }

    const todayDate = new Date(today);
    const checkpoints: { type: string; daysAfter: number }[] = [
      { type: "24H", daysAfter: 1 },
      { type: "72H", daysAfter: 3 },
      { type: "7D", daysAfter: 7 },
      { type: "6W", daysAfter: 42 },
    ];

    const results: { mother: Mother; visits: PostpartumVisit[]; dueCheckpoints: string[] }[] = [];
    for (const mother of candidates) {
      if (!mother.outcomeDate) continue;
      const outcomeDate = new Date(mother.outcomeDate);
      const ms = todayDate.getTime() - outcomeDate.getTime();
      const daysSince = Math.floor(ms / 86400000);
      const motherVisits = visitsByMother[mother.id] || [];
      const loggedTypes = new Set(motherVisits.map(v => v.visitType));
      const dueCheckpoints: string[] = [];
      for (const cp of checkpoints) {
        const inWindow = daysSince >= cp.daysAfter - 1 && daysSince <= cp.daysAfter + 1;
        if (inWindow && !loggedTypes.has(cp.type as any)) {
          dueCheckpoints.push(cp.type);
        }
      }
      if (dueCheckpoints.length > 0) {
        results.push({ mother, visits: motherVisits, dueCheckpoints });
      }
    }
    return results;
  }

  async createPostpartumVisit(visit: InsertPostpartumVisit): Promise<PostpartumVisit> {
    const [created] = await db.insert(postpartumVisits).values(visit).returning();
    return created;
  }

  async getPrenatalScreenings(motherId: number): Promise<PrenatalScreening[]> {
    return await db
      .select()
      .from(prenatalScreenings)
      .where(eq(prenatalScreenings.motherId, motherId))
      .orderBy(desc(prenatalScreenings.screeningDate));
  }

  async createPrenatalScreening(screening: InsertPrenatalScreening): Promise<PrenatalScreening> {
    const [created] = await db.insert(prenatalScreenings).values(screening).returning();
    return created;
  }

  async getBirthAttendanceRecords(motherId: number): Promise<BirthAttendanceRecord[]> {
    return await db
      .select()
      .from(birthAttendanceRecords)
      .where(eq(birthAttendanceRecords.motherId, motherId))
      .orderBy(desc(birthAttendanceRecords.deliveryDate));
  }

  async createBirthAttendanceRecord(record: InsertBirthAttendanceRecord): Promise<BirthAttendanceRecord> {
    const [created] = await db.insert(birthAttendanceRecords).values(record).returning();
    return created;
  }

  async getSickChildVisits(childId: number): Promise<SickChildVisit[]> {
    return await db
      .select()
      .from(sickChildVisits)
      .where(eq(sickChildVisits.childId, childId))
      .orderBy(desc(sickChildVisits.visitDate));
  }

  async createSickChildVisit(visit: InsertSickChildVisit): Promise<SickChildVisit> {
    const [created] = await db.insert(sickChildVisits).values(visit).returning();
    return created;
  }

  async getSchoolImmunizations(params: { barangay?: string; vaccine?: string }): Promise<SchoolImmunization[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(schoolImmunizations.barangay, params.barangay));
    if (params.vaccine) conditions.push(eq(schoolImmunizations.vaccine, params.vaccine as any));
    return await db
      .select()
      .from(schoolImmunizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schoolImmunizations.vaccinationDate));
  }

  async createSchoolImmunization(record: InsertSchoolImmunization): Promise<SchoolImmunization> {
    const [created] = await db.insert(schoolImmunizations).values(record).returning();
    return created;
  }

  async getOralHealthVisits(params: { barangay?: string }): Promise<OralHealthVisit[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(oralHealthVisits.barangay, params.barangay));
    return await db
      .select()
      .from(oralHealthVisits)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(oralHealthVisits.visitDate));
  }

  async createOralHealthVisit(record: InsertOralHealthVisit): Promise<OralHealthVisit> {
    const [created] = await db.insert(oralHealthVisits).values(record).returning();
    return created;
  }

  // ── Phase 4 NCD screenings ─────────────────────────────────────────
  async getPhilpenAssessments(params: { barangay?: string }): Promise<PhilpenAssessment[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(philpenAssessments.barangay, params.barangay));
    return await db.select().from(philpenAssessments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(philpenAssessments.assessmentDate));
  }
  async createPhilpenAssessment(record: InsertPhilpenAssessment): Promise<PhilpenAssessment> {
    const [created] = await db.insert(philpenAssessments).values(record).returning();
    return created;
  }
  async getNcdScreenings(params: { barangay?: string; condition?: string }): Promise<NcdScreening[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(ncdScreenings.barangay, params.barangay));
    if (params.condition) conditions.push(eq(ncdScreenings.condition, params.condition as any));
    return await db.select().from(ncdScreenings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ncdScreenings.screenDate));
  }
  async createNcdScreening(record: InsertNcdScreening): Promise<NcdScreening> {
    const [created] = await db.insert(ncdScreenings).values(record).returning();
    return created;
  }
  async getVisionScreenings(params: { barangay?: string }): Promise<VisionScreening[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(visionScreenings.barangay, params.barangay));
    return await db.select().from(visionScreenings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(visionScreenings.screenDate));
  }
  async createVisionScreening(record: InsertVisionScreening): Promise<VisionScreening> {
    const [created] = await db.insert(visionScreenings).values(record).returning();
    return created;
  }
  async getCervicalCancerScreenings(params: { barangay?: string }): Promise<CervicalCancerScreening[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(cervicalCancerScreenings.barangay, params.barangay));
    return await db.select().from(cervicalCancerScreenings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cervicalCancerScreenings.screenDate));
  }
  async createCervicalCancerScreening(record: InsertCervicalCancerScreening): Promise<CervicalCancerScreening> {
    const [created] = await db.insert(cervicalCancerScreenings).values(record).returning();
    return created;
  }
  async getMentalHealthScreenings(params: { barangay?: string }): Promise<MentalHealthScreening[]> {
    const conditions = [];
    if (params.barangay) conditions.push(eq(mentalHealthScreenings.barangay, params.barangay));
    return await db.select().from(mentalHealthScreenings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mentalHealthScreenings.screenDate));
  }
  async createMentalHealthScreening(record: InsertMentalHealthScreening): Promise<MentalHealthScreening> {
    const [created] = await db.insert(mentalHealthScreenings).values(record).returning();
    return created;
  }

  // ── Phase 6 Mortality registry ─────────────────────────────────────
  async getDeathEvents(params: { barangay?: string }): Promise<DeathEvent[]> {
    const conds = params.barangay ? [eq(deathEvents.barangay, params.barangay)] : [];
    return await db.select().from(deathEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(deathEvents.dateOfDeath));
  }
  async createDeathEvent(r: InsertDeathEvent): Promise<DeathEvent> {
    const [c] = await db.insert(deathEvents).values(r).returning();
    return c;
  }

  // ── PIDSR weekly submissions ───────────────────────────────────────
  async getPidsrSubmissions(params: { barangay?: string; fromDate?: string }): Promise<PidsrSubmission[]> {
    const conds = [];
    if (params.barangay) conds.push(eq(pidsrSubmissions.barangay, params.barangay));
    if (params.fromDate) conds.push(gte(pidsrSubmissions.weekEndDate, params.fromDate));
    return await db.select().from(pidsrSubmissions)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(pidsrSubmissions.weekEndDate));
  }
  async getPidsrSubmissionForWeek(barangay: string, weekEndDate: string): Promise<PidsrSubmission | null> {
    const rows = await db.select().from(pidsrSubmissions)
      .where(and(eq(pidsrSubmissions.barangay, barangay), eq(pidsrSubmissions.weekEndDate, weekEndDate)))
      .limit(1);
    return rows[0] ?? null;
  }
  async createPidsrSubmission(r: InsertPidsrSubmission): Promise<PidsrSubmission> {
    const [c] = await db.insert(pidsrSubmissions).values(r).returning();
    return c;
  }

  // ── HRH workforce module ───────────────────────────────────────────
  async getWorkforceMembers(params: { barangay?: string; activeOnly?: boolean }): Promise<WorkforceMember[]> {
    const conds: any[] = [];
    if (params.barangay) conds.push(eq(workforceMembers.barangay, params.barangay));
    if (params.activeOnly) conds.push(isNull(workforceMembers.dateSeparated));
    return await db.select().from(workforceMembers)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(workforceMembers.createdAt));
  }
  async getWorkforceMember(id: number): Promise<WorkforceMember | null> {
    const [m] = await db.select().from(workforceMembers).where(eq(workforceMembers.id, id)).limit(1);
    return m ?? null;
  }
  async createWorkforceMember(r: InsertWorkforceMember): Promise<WorkforceMember> {
    const [c] = await db.insert(workforceMembers).values(r).returning();
    return c;
  }
  async updateWorkforceMember(id: number, updates: Partial<InsertWorkforceMember>): Promise<WorkforceMember> {
    const [u] = await db.update(workforceMembers).set(updates).where(eq(workforceMembers.id, id)).returning();
    return u;
  }
  async getWorkforceCredentials(memberId: number): Promise<WorkforceCredential[]> {
    return await db.select().from(workforceCredentials)
      .where(eq(workforceCredentials.memberId, memberId))
      .orderBy(desc(workforceCredentials.dateObtained));
  }
  async createWorkforceCredential(r: InsertWorkforceCredential): Promise<WorkforceCredential> {
    const [c] = await db.insert(workforceCredentials).values(r).returning();
    return c;
  }

  // ── Phase 7 Water & Sanitation ──────────────────────────────────────
  async getHouseholdWaterRecords(params: { barangay?: string }): Promise<HouseholdWaterRecord[]> {
    const conds = params.barangay ? [eq(householdWaterRecords.barangay, params.barangay)] : [];
    return await db.select().from(householdWaterRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(householdWaterRecords.surveyDate));
  }
  async createHouseholdWaterRecord(r: InsertHouseholdWaterRecord): Promise<HouseholdWaterRecord> {
    const [c] = await db.insert(householdWaterRecords).values(r).returning();
    return c;
  }

  // ── Phase 5 Disease surveillance ────────────────────────────────────
  async getFilariasisRecords(params: { barangay?: string }): Promise<FilariasisRecord[]> {
    const conds = params.barangay ? [eq(filariasisRecords.barangay, params.barangay)] : [];
    return await db.select().from(filariasisRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(filariasisRecords.examDate));
  }
  async createFilariasisRecord(r: InsertFilariasisRecord): Promise<FilariasisRecord> {
    const [c] = await db.insert(filariasisRecords).values(r).returning();
    return c;
  }
  async getRabiesExposures(params: { barangay?: string }): Promise<RabiesExposure[]> {
    const conds = params.barangay ? [eq(rabiesExposures.barangay, params.barangay)] : [];
    return await db.select().from(rabiesExposures).where(conds.length ? and(...conds) : undefined).orderBy(desc(rabiesExposures.exposureDate));
  }
  async createRabiesExposure(r: InsertRabiesExposure): Promise<RabiesExposure> {
    const [c] = await db.insert(rabiesExposures).values(r).returning();
    return c;
  }
  async getSchistosomiasisRecords(params: { barangay?: string }): Promise<SchistosomiasisRecord[]> {
    const conds = params.barangay ? [eq(schistosomiasisRecords.barangay, params.barangay)] : [];
    return await db.select().from(schistosomiasisRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(schistosomiasisRecords.seenDate));
  }
  async createSchistosomiasisRecord(r: InsertSchistosomiasisRecord): Promise<SchistosomiasisRecord> {
    const [c] = await db.insert(schistosomiasisRecords).values(r).returning();
    return c;
  }
  async getSthRecords(params: { barangay?: string }): Promise<SthRecord[]> {
    const conds = params.barangay ? [eq(sthRecords.barangay, params.barangay)] : [];
    return await db.select().from(sthRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(sthRecords.screenDate));
  }
  async createSthRecord(r: InsertSthRecord): Promise<SthRecord> {
    const [c] = await db.insert(sthRecords).values(r).returning();
    return c;
  }
  async getLeprosyRecords(params: { barangay?: string }): Promise<LeprosyRecord[]> {
    const conds = params.barangay ? [eq(leprosyRecords.barangay, params.barangay)] : [];
    return await db.select().from(leprosyRecords).where(conds.length ? and(...conds) : undefined).orderBy(desc(leprosyRecords.registeredDate));
  }
  async createLeprosyRecord(r: InsertLeprosyRecord): Promise<LeprosyRecord> {
    const [c] = await db.insert(leprosyRecords).values(r).returning();
    return c;
  }

  async getHealthStations(filter?: { facilityType?: string; hasTbDots?: boolean }): Promise<HealthStation[]> {
    const conditions = [];
    if (filter?.facilityType) conditions.push(eq(healthStations.facilityType, filter.facilityType as any));
    if (filter?.hasTbDots !== undefined) conditions.push(eq(healthStations.hasTbDots, filter.hasTbDots));
    if (conditions.length === 0) return await db.select().from(healthStations);
    return await db.select().from(healthStations).where(and(...conditions));
  }

  async getSmsMessages(): Promise<SmsMessage[]> {
    return await db.select().from(smsOutbox);
  }

  async sendSms(sms: InsertSmsMessage): Promise<SmsMessage> {
    const [created] = await db.insert(smsOutbox).values(sms).returning();
    return created;
  }

  async getDiseaseCases(): Promise<DiseaseCase[]> {
    return await db.select().from(diseaseCases);
  }

  async getDiseaseCase(id: number): Promise<DiseaseCase | undefined> {
    const [diseaseCase] = await db.select().from(diseaseCases).where(eq(diseaseCases.id, id));
    return diseaseCase;
  }

  async createDiseaseCase(data: InsertDiseaseCase): Promise<DiseaseCase> {
    const [created] = await db.insert(diseaseCases).values(data).returning();
    // Belt-and-suspenders: if drizzle-zod / drizzle-orm dropped the
    // additionalConditions field somewhere upstream, write it via raw
    // SQL after the insert lands. Idempotent — sets to whatever the
    // input contains (empty array when absent).
    const extras = (data as any).additionalConditions;
    if (Array.isArray(extras)) {
      const out = await db.execute(sql`
        UPDATE disease_cases
        SET additional_conditions = ${JSON.stringify(extras)}::jsonb
        WHERE id = ${created.id}
        RETURNING *
      `);
      const row = ((out as any).rows ?? (out as any))?.[0];
      if (row) return rawDiseaseCaseToCamel(row);
    }
    return created;
  }

  async updateDiseaseCase(id: number, updates: Partial<InsertDiseaseCase>): Promise<DiseaseCase> {
    // Belt-and-suspenders: drizzle's auto schema introspection has
    // been losing additionalConditions on this column on some
    // deployments despite the TS schema declaring it. Writing the
    // column via raw SQL after the drizzle UPDATE guarantees the
    // value lands and is returned. The drizzle UPDATE handles every
    // other field the normal way.
    const setObj: any = { ...updates };
    delete (setObj as any).additionalConditions;
    let updated: any;
    if (Object.keys(setObj).length > 0) {
      const [r] = await db.update(diseaseCases)
        .set(setObj)
        .where(eq(diseaseCases.id, id))
        .returning();
      updated = r;
    }
    // Always overwrite additional_conditions when present in the input.
    const extras = (updates as any).additionalConditions;
    if (Array.isArray(extras)) {
      const out = await db.execute(sql`
        UPDATE disease_cases
        SET additional_conditions = ${JSON.stringify(extras)}::jsonb
        WHERE id = ${id}
        RETURNING *
      `);
      const row = ((out as any).rows ?? (out as any))?.[0];
      if (row) return rawDiseaseCaseToCamel(row);
    }
    if (updated) return updated;
    // Fallback when the caller passed neither a regular field nor
    // additionalConditions — return the row as-is.
    const [existing] = await db.select().from(diseaseCases).where(eq(diseaseCases.id, id));
    return existing;
  }

  async deleteDiseaseCase(id: number): Promise<void> {
    await db.delete(diseaseCases).where(eq(diseaseCases.id, id));
  }

  async bulkImportDiseaseCases(rows: Array<{ barangay: string; disease_name: string; cases: number; reporting_date: string }>, replace: boolean): Promise<number> {
    if (replace) {
      await db.delete(diseaseCases).where(sql`notes LIKE '%[[bulk-import]]%'`);
    }
    const records: InsertDiseaseCase[] = [];
    for (const row of rows) {
      const count = Math.max(0, Math.round(row.cases));
      for (let i = 0; i < count; i++) {
        records.push({
          patientName: "Imported Patient",
          age: 0,
          barangay: row.barangay,
          condition: row.disease_name,
          dateReported: row.reporting_date,
          status: "New",
          notes: `[[bulk-import]] Aggregate: ${row.cases} case(s) reported`,
        });
      }
    }
    if (records.length > 0) {
      await db.insert(diseaseCases).values(records);
    }
    return records.length;
  }

  async getTBPatients(): Promise<TBPatient[]> {
    return await db.select().from(tbPatients);
  }

  async getTBPatient(id: number): Promise<TBPatient | undefined> {
    const [patient] = await db.select().from(tbPatients).where(eq(tbPatients.id, id));
    return patient;
  }

  async createTBPatient(data: InsertTBPatient): Promise<TBPatient> {
    const [created] = await db.insert(tbPatients).values(data).returning();
    return created;
  }

  async updateTBPatient(id: number, updates: Partial<InsertTBPatient>): Promise<TBPatient> {
    const [updated] = await db.update(tbPatients)
      .set(updates)
      .where(eq(tbPatients.id, id))
      .returning();
    return updated;
  }

  async deleteTBPatient(id: number): Promise<void> {
    await db.delete(tbPatients).where(eq(tbPatients.id, id));
  }

  async getThemeSettings(): Promise<ThemeSettings | undefined> {
    const [settings] = await db.select().from(themeSettings);
    return settings;
  }

  async updateThemeSettings(updates: Partial<InsertThemeSettings>): Promise<ThemeSettings> {
    const existing = await this.getThemeSettings();
    if (existing) {
      const [updated] = await db.update(themeSettings)
        .set(updates)
        .where(eq(themeSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(themeSettings)
        .values(updates as InsertThemeSettings)
        .returning();
      return created;
    }
  }

  async getConsults(): Promise<Consult[]> {
    return await db.select().from(consults).orderBy(desc(consults.consultDate));
  }

  async getConsult(id: number): Promise<Consult | undefined> {
    const [consult] = await db.select().from(consults).where(eq(consults.id, id));
    return consult;
  }

  async getConsultsByPatient(name: string, barangay: string): Promise<Consult[]> {
    return await db.select().from(consults)
      .where(and(ilike(consults.patientName, name), eq(consults.barangay, barangay)))
      .orderBy(desc(consults.consultDate));
  }

  async getConsultsByProfile(type: string, profileId: number): Promise<Consult[]> {
    return await db.select().from(consults)
      .where(and(eq(consults.linkedPersonType, type), eq(consults.linkedPersonId, profileId)))
      .orderBy(desc(consults.consultDate));
  }

  async createConsult(consult: InsertConsult): Promise<Consult> {
    const [created] = await db.insert(consults).values(consult).returning();
    return created;
  }

  async updateConsult(id: number, updates: Partial<InsertConsult>): Promise<Consult> {
    const [updated] = await db.update(consults)
      .set(updates)
      .where(eq(consults.id, id))
      .returning();
    return updated;
  }

  // M1 Template System Methods
  async getM1TemplateVersions(): Promise<M1TemplateVersion[]> {
    return await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true));
  }

  async getM1IndicatorCatalog(templateVersionId: number): Promise<M1IndicatorCatalog[]> {
    return await db.select().from(m1IndicatorCatalog)
      .where(eq(m1IndicatorCatalog.templateVersionId, templateVersionId))
      .orderBy(m1IndicatorCatalog.pageNumber, m1IndicatorCatalog.rowOrder);
  }

  async getBarangays(): Promise<Barangay[]> {
    return await db.select().from(barangays);
  }

  async getM1ReportInstances(filters: { barangayId?: number; month?: number; year?: number }): Promise<M1ReportInstance[]> {
    let query = db.select().from(m1ReportInstances);
    const conditions = [];
    if (filters.barangayId) conditions.push(eq(m1ReportInstances.barangayId, filters.barangayId));
    if (filters.month) conditions.push(eq(m1ReportInstances.month, filters.month));
    if (filters.year) conditions.push(eq(m1ReportInstances.year, filters.year));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getM1ReportInstance(id: number): Promise<{ instance: M1ReportInstance; values: M1IndicatorValue[] } | undefined> {
    const [instance] = await db.select().from(m1ReportInstances).where(eq(m1ReportInstances.id, id));
    if (!instance) return undefined;
    
    const values = await db.select().from(m1IndicatorValues).where(eq(m1IndicatorValues.reportInstanceId, id));
    return { instance, values };
  }

  async createM1ReportInstance(data: any): Promise<M1ReportInstance> {
    const now = new Date().toISOString();
    const [created] = await db.insert(m1ReportInstances).values({
      templateVersionId: data.templateVersionId,
      scopeType: data.scopeType || "BARANGAY",
      barangayId: data.barangayId,
      barangayName: data.barangayName,
      month: data.month,
      year: data.year,
      status: "DRAFT",
      createdByUserId: data.createdByUserId,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return created;
  }

  async updateM1IndicatorValues(reportId: number, values: any[]): Promise<M1IndicatorValue[]> {
    const now = new Date().toISOString();
    const results: M1IndicatorValue[] = [];
    
    for (const v of values) {
      const columnKey = v.columnKey || null;
      const conditions = [
        eq(m1IndicatorValues.reportInstanceId, reportId),
        eq(m1IndicatorValues.rowKey, v.rowKey),
      ];
      if (columnKey) {
        conditions.push(eq(m1IndicatorValues.columnKey, columnKey));
      } else {
        conditions.push(isNull(m1IndicatorValues.columnKey));
      }
      const [existing] = await db.select().from(m1IndicatorValues)
        .where(and(...conditions));
      
      if (existing) {
        const [updated] = await db.update(m1IndicatorValues)
          .set({
            valueNumber: v.valueNumber,
            valueText: v.valueText,
            valueSource: v.valueSource || "ENCODED",
            updatedAt: now,
          })
          .where(eq(m1IndicatorValues.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(m1IndicatorValues).values({
          reportInstanceId: reportId,
          rowKey: v.rowKey,
          columnKey: v.columnKey || null,
          valueNumber: v.valueNumber,
          valueText: v.valueText,
          valueSource: v.valueSource || "ENCODED",
          createdAt: now,
          updatedAt: now,
        }).returning();
        results.push(created);
      }
    }
    
    // Update report instance timestamp
    await db.update(m1ReportInstances)
      .set({ updatedAt: now })
      .where(eq(m1ReportInstances.id, reportId));
    
    return results;
  }

  async updateM1ReportStatus(id: number, status: string): Promise<M1ReportInstance> {
    const now = new Date().toISOString();
    const [updated] = await db.update(m1ReportInstances)
      .set({ status, updatedAt: now })
      .where(eq(m1ReportInstances.id, id))
      .returning();
    if (!updated) throw new Error(`Report ${id} not found`);
    return updated;
  }

  async computeM1Values(reportId: number): Promise<{ computed: number; skipped: number }> {
    const [instance] = await db.select().from(m1ReportInstances).where(eq(m1ReportInstances.id, reportId));
    if (!instance) throw new Error("Report not found");

    const { month, year, barangayName } = instance;
    const monthLike = `${year}-${String(month).padStart(2, "0")}%`;

    // Collect ENCODED keys to protect from overwrite
    const existing = await db.select().from(m1IndicatorValues)
      .where(eq(m1IndicatorValues.reportInstanceId, reportId));
    const encodedKeys = new Set(
      existing.filter(v => v.valueSource === "ENCODED")
        .map(v => v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey)
    );

    const computedRaw: Array<{ rowKey: string; columnKey: string | null; valueNumber: number }> = [];

    const add = (rowKey: string, columnKey: string | null, val: number) => {
      const k = columnKey ? `${rowKey}:${columnKey}` : rowKey;
      if (!encodedKeys.has(k)) computedRaw.push({ rowKey, columnKey, valueNumber: val });
    };

    const countQ = async (table: any, conds: any[]): Promise<number> => {
      const where = conds.length === 1 ? conds[0] : and(...(conds as [any, ...any[]]));
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
      return r?.n ?? 0;
    };

    // === MOTHERS ===
    const mBase = barangayName ? [eq(mothers.barangay, barangayName)] : [];

    // Deliveries this month
    const mDelivered = [...mBase, sql`outcome_date LIKE ${monthLike}`];
    add("B-01", "VALUE", await countQ(mothers, mDelivered));
    add("B-02", "10-14", await countQ(mothers, [...mDelivered, sql`age BETWEEN 10 AND 14`]));
    add("B-02", "15-19", await countQ(mothers, [...mDelivered, sql`age BETWEEN 15 AND 19`]));
    add("B-02", "20-49", await countQ(mothers, [...mDelivered, sql`age BETWEEN 20 AND 49`]));
    add("B-02", "TOTAL",  await countQ(mothers, mDelivered));
    add("B-02a", "VALUE", await countQ(mothers, [...mDelivered, sql`birth_weight_category = 'normal'`]));
    add("B-02b", "VALUE", await countQ(mothers, [...mDelivered, sql`birth_weight_category = 'low'`]));
    add("E-01",  "TOTAL", await countQ(mothers, [...mDelivered, sql`breastfed_within_1hr = true`]));
    add("H-01",  "TOTAL", await countQ(mothers, [...mDelivered, sql`outcome = 'live_birth'`]));
    add("H-02",  "TOTAL", await countQ(mothers, [...mDelivered, sql`outcome = 'stillbirth'`]));

    // ANC 4+ visits (deliveries with 4+ ANC this month)
    const mAnc4 = [...mDelivered, sql`anc_visits >= 4`];
    add("A-01a", "10-14", await countQ(mothers, [...mAnc4, sql`age BETWEEN 10 AND 14`]));
    add("A-01a", "15-19", await countQ(mothers, [...mAnc4, sql`age BETWEEN 15 AND 19`]));
    add("A-01a", "20-49", await countQ(mothers, [...mAnc4, sql`age BETWEEN 20 AND 49`]));
    add("A-01a", "TOTAL",  await countQ(mothers, mAnc4));

    // ANC 8+ visits (deliveries with 8+ ANC this month)
    const mAnc8 = [...mDelivered, sql`anc_visits >= 8`];
    add("A-01b", "10-14", await countQ(mothers, [...mAnc8, sql`age BETWEEN 10 AND 14`]));
    add("A-01b", "15-19", await countQ(mothers, [...mAnc8, sql`age BETWEEN 15 AND 19`]));
    add("A-01b", "20-49", await countQ(mothers, [...mAnc8, sql`age BETWEEN 20 AND 49`]));
    add("A-01b", "TOTAL",  await countQ(mothers, mAnc8));

    // Td2+ protected (delivered with at least 2 TT doses on record)
    const tt2Plus = sql`(
      (CASE WHEN tt1_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN tt2_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN tt3_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN tt4_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN tt5_date IS NOT NULL THEN 1 ELSE 0 END)
    ) >= 2`;
    const mTT = [...mDelivered, tt2Plus];
    add("A-03", "10-14", await countQ(mothers, [...mTT, sql`age BETWEEN 10 AND 14`]));
    add("A-03", "15-19", await countQ(mothers, [...mTT, sql`age BETWEEN 15 AND 19`]));
    add("A-03", "20-49", await countQ(mothers, [...mTT, sql`age BETWEEN 20 AND 49`]));
    add("A-03", "TOTAL", await countQ(mothers, mTT));

    // Facility-based delivery (hospital or birthing center)
    const mFac = [...mDelivered, sql`delivery_location IN ('hospital', 'birthing_center')`];
    add("A-04", "10-14", await countQ(mothers, [...mFac, sql`age BETWEEN 10 AND 14`]));
    add("A-04", "15-19", await countQ(mothers, [...mFac, sql`age BETWEEN 15 AND 19`]));
    add("A-04", "20-49", await countQ(mothers, [...mFac, sql`age BETWEEN 20 AND 49`]));
    add("A-04", "TOTAL", await countQ(mothers, mFac));

    // BMI status (mothers registered this month)
    const mReg = [...mBase, sql`registration_date LIKE ${monthLike}`];
    for (const [rk, bmiVal] of [["A-02a", "normal"], ["A-02b", "low"], ["A-02c", "high"]]) {
      const bmiCond = [...mReg, sql`bmi_status = ${bmiVal}`];
      add(rk, "10-14", await countQ(mothers, [...bmiCond, sql`age BETWEEN 10 AND 14`]));
      add(rk, "15-19", await countQ(mothers, [...bmiCond, sql`age BETWEEN 15 AND 19`]));
      add(rk, "20-49", await countQ(mothers, [...bmiCond, sql`age BETWEEN 20 AND 49`]));
      add(rk, "TOTAL",  await countQ(mothers, bmiCond));
    }

    // === CHILDREN ===
    const cBase = barangayName ? [eq(children.barangay, barangayName)] : [];

    const addVax = async (rowKey: string, jsonKey: string) => {
      const cond = [...cBase, sql`vaccines->>${jsonKey} LIKE ${monthLike}`];
      add(rowKey, "M",     await countQ(children, [...cond, sql`sex = 'male'`]));
      add(rowKey, "F",     await countQ(children, [...cond, sql`sex = 'female'`]));
      add(rowKey, "TOTAL", await countQ(children, cond));
    };

    await addVax("D1-02", "bcg");
    await addVax("D2-01", "penta1");
    await addVax("D2-02", "penta2");
    await addVax("D2-03", "penta3");
    await addVax("D2-04", "opv1");
    await addVax("D2-05", "opv2");
    await addVax("D2-06", "opv3");

    // === SENIORS ===
    const sBase = barangayName ? [eq(seniors.barangay, barangayName)] : [];

    // Medication given this month
    const sMed = [...sBase, sql`last_medication_given_date LIKE ${monthLike}`];
    add("G2-04", "M",     await countQ(seniors, [...sMed, sql`sex = 'M'`]));
    add("G2-04", "F",     await countQ(seniors, [...sMed, sql`sex = 'F'`]));
    add("G2-04", "TOTAL", await countQ(seniors, sMed));

    // BP recorded this month
    const sBP = [...sBase, sql`last_bp_date LIKE ${monthLike}`];
    add("G2-03", "TOTAL", await countQ(seniors, sBP));

    // === DISEASE REGISTRY ===
    const dcBase = barangayName ? [eq(diseaseCases.barangay, barangayName)] : [];
    const dcPeriod = [...dcBase, sql`date_reported LIKE ${monthLike}`];

    // Map M1 row keys to disease condition ILIKE patterns. A case row's
    // primary condition lives in `condition`; co-conditions are in the
    // jsonb array additional_conditions. We match either column so a
    // case carrying "HIV + Dengue" still counts under I-01 (Dengue)
    // even though Dengue is on the additional_conditions array.
    const diseaseMappings: Array<[string, string]> = [
      ["I-01", "Dengue"],
      ["I-03", "Measles"],
      ["I-04", "AFP"],
      ["I-05", "NNT"],
      ["I-06", "Rabies"],
      ["I-08", "Leprosy"],
    ];
    for (const [rowKey, condKeyword] of diseaseMappings) {
      const pattern = "%" + condKeyword + "%";
      const cond = [
        ...dcPeriod,
        sql`(condition ILIKE ${pattern} OR additional_conditions::text ILIKE ${pattern})`,
      ];
      add(rowKey, "TOTAL", await countQ(diseaseCases, cond));
    }

    // I-07: TB Cases — from tbPatients table (treatment_start_date in period)
    const tbBase = barangayName ? [eq(tbPatients.barangay, barangayName)] : [];
    add("I-07", "TOTAL", await countQ(tbPatients, [...tbBase, sql`treatment_start_date LIKE ${monthLike}`]));

    // === FAMILY PLANNING ===
    // Aggregate fp_service_records for this barangay+reporting_month by method × status × age group.
    // Status maps: CURRENT_USER → CU_*, NEW_ACCEPTOR → NA_*. DROPOUT excluded from M1 counts.
    const fpReportingMonth = `${year}-${String(month).padStart(2, "0")}`;
    const fpConds = [eq(fpServiceRecords.reportingMonth, fpReportingMonth)];
    if (barangayName) fpConds.push(eq(fpServiceRecords.barangay, barangayName));
    const fpRows = await db
      .select({
        fpMethod: fpServiceRecords.fpMethod,
        fpStatus: fpServiceRecords.fpStatus,
        dob: fpServiceRecords.dob,
      })
      .from(fpServiceRecords)
      .where(and(...fpConds));

    // Age is calculated as of the last day of the reporting month.
    const endOfMonth = new Date(Date.UTC(year, month, 0));
    const fpTally: Record<string, number> = {};
    for (const r of fpRows) {
      if (!r.dob) continue;
      const dob = new Date(r.dob);
      if (isNaN(dob.getTime())) continue;
      let ageYrs = endOfMonth.getUTCFullYear() - dob.getUTCFullYear();
      const mDiff = endOfMonth.getUTCMonth() - dob.getUTCMonth();
      if (mDiff < 0 || (mDiff === 0 && endOfMonth.getUTCDate() < dob.getUTCDate())) ageYrs--;
      let bucket: "10-14" | "15-19" | "20-49" | null = null;
      if (ageYrs >= 10 && ageYrs <= 14) bucket = "10-14";
      else if (ageYrs >= 15 && ageYrs <= 19) bucket = "15-19";
      else if (ageYrs >= 20 && ageYrs <= 49) bucket = "20-49";
      if (!bucket) continue;
      const rowKey = (FP_METHOD_ROW_KEY as Record<string, string | null>)[r.fpMethod];
      if (!rowKey) continue;
      const prefix = r.fpStatus === "CURRENT_USER" ? "CU" : r.fpStatus === "NEW_ACCEPTOR" ? "NA" : null;
      if (!prefix) continue;
      const bucketKey = `${rowKey}|${prefix}_${bucket}`;
      const totalKey = `${rowKey}|${prefix}_TOTAL`;
      fpTally[bucketKey] = (fpTally[bucketKey] ?? 0) + 1;
      fpTally[totalKey] = (fpTally[totalKey] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(fpTally)) {
      const [rowKey, columnKey] = k.split("|");
      add(rowKey, columnKey, v);
    }

    // === SECTION C — POSTPARTUM (PNC follow-ups) ===
    // C-01a: distinct mothers whose 2nd PNC visit fell in this report month
    // C-01b: distinct mothers whose 4th PNC visit fell in this report month,
    //        broken down by age (10-14, 15-19, 20-49, TOTAL)
    // TRANS IN/OUT sub-rows (C-01b-b, C-01c-*) are not auto-computed yet —
    // they require trans_in/trans_out flags on postpartum_visits.
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const inReportMonth = (date: string) => date.startsWith(monthPrefix);

    const pncWhere = barangayName ? eq(mothers.barangay, barangayName) : undefined;
    const pncRows = await db
      .select({
        motherId: postpartumVisits.motherId,
        visitDate: postpartumVisits.visitDate,
        transIn: postpartumVisits.transInFromLgu,
        transOut: postpartumVisits.transOutWithMov,
        transOutDate: postpartumVisits.transOutDate,
        age: mothers.age,
      })
      .from(postpartumVisits)
      .innerJoin(mothers, eq(postpartumVisits.motherId, mothers.id))
      .where(pncWhere)
      .orderBy(postpartumVisits.motherId, postpartumVisits.visitDate);

    interface PncMotherSummary {
      dates: string[];
      age: number;
      transIn: boolean;
      transOut: boolean;
      transOutDate: string | null;
    }
    const visitsByMother: Record<number, PncMotherSummary> = {};
    for (const r of pncRows) {
      if (!visitsByMother[r.motherId]) {
        visitsByMother[r.motherId] = {
          dates: [],
          age: r.age,
          transIn: false,
          transOut: false,
          transOutDate: null,
        };
      }
      const m = visitsByMother[r.motherId];
      m.dates.push(r.visitDate);
      if (r.transIn) m.transIn = true;
      if (r.transOut) {
        m.transOut = true;
        m.transOutDate = r.transOutDate;
      }
    }

    const ageBucket = (age: number): "10-14" | "15-19" | "20-49" | null => {
      if (age >= 10 && age <= 14) return "10-14";
      if (age >= 15 && age <= 19) return "15-19";
      if (age >= 20 && age <= 49) return "20-49";
      return null;
    };

    let c01a = 0;
    const c01b: Record<string, number> = { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 };
    let c01ba = 0; // 1st-4th on schedule (not TRANS-IN)
    let c01bb = 0; // ≥4 PNC, TRANS-IN
    let c01ca = 0; // tracked during pregnancy (new, not TRANS-IN, has any visit)
    let c01cb = 0; // TRANS-IN
    let c01cc = 0; // TRANS-OUT before completing 4 PNC
    const c01c: Record<string, number> = { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 };

    for (const m of Object.values(visitsByMother)) {
      const completed4 = m.dates.length >= 4 && inReportMonth(m.dates[3]);
      const completed2 = m.dates.length >= 2 && inReportMonth(m.dates[1]);
      const bucket = ageBucket(m.age);

      if (completed2) c01a++;
      if (completed4 && bucket) {
        c01b[bucket]++;
        c01b.TOTAL++;
        if (m.transIn) c01bb++;
        else c01ba++;
      }

      // C-01c family — tracked during pregnancy this month
      const tracked = m.dates.some(d => inReportMonth(d));
      if (tracked) {
        if (m.transIn) c01cb++;
        else c01ca++;
      }
      if (m.transOut && m.transOutDate && inReportMonth(m.transOutDate) && !completed4) {
        c01cc++;
      }
      // C-01c (AGE_GROUP) = (a + b - c) — emit at the per-mother level so we
      // can bucket by age. A mother contributes 1 to the bucket if she's
      // counted in (ca | cb) and not in cc.
      const inA = tracked && !m.transIn;
      const inB = tracked && m.transIn;
      const inC = m.transOut && m.transOutDate && inReportMonth(m.transOutDate) && !completed4;
      if ((inA || inB) && !inC && bucket) {
        c01c[bucket]++;
        c01c.TOTAL++;
      }
    }

    add("C-01a", "VALUE", c01a);
    add("C-01b", "10-14", c01b["10-14"]);
    add("C-01b", "15-19", c01b["15-19"]);
    add("C-01b", "20-49", c01b["20-49"]);
    add("C-01b", "TOTAL", c01b.TOTAL);
    add("C-01b-a", "VALUE", c01ba);
    add("C-01b-b", "VALUE", c01bb);
    add("C-01c", "10-14", c01c["10-14"]);
    add("C-01c", "15-19", c01c["15-19"]);
    add("C-01c", "20-49", c01c["20-49"]);
    add("C-01c", "TOTAL", c01c.TOTAL);
    add("C-01c-a", "VALUE", c01ca);
    add("C-01c-b", "VALUE", c01cb);
    add("C-01c-c", "VALUE", c01cc);

    // === SECTION B — Skilled attendant + delivery type breakdown ===
    // B-03: deliveries this month attended by physician/nurse/midwife
    const mB03 = [...mDelivered, sql`delivery_attendant IN ('physician', 'nurse', 'midwife')`];
    add("B-03", "10-14", await countQ(mothers, [...mB03, sql`age BETWEEN 10 AND 14`]));
    add("B-03", "15-19", await countQ(mothers, [...mB03, sql`age BETWEEN 15 AND 19`]));
    add("B-03", "20-49", await countQ(mothers, [...mB03, sql`age BETWEEN 20 AND 49`]));
    add("B-03", "TOTAL", await countQ(mothers, mB03));
    add("B-03a", "VALUE", await countQ(mothers, [...mDelivered, sql`delivery_attendant = 'physician'`]));
    add("B-03b", "VALUE", await countQ(mothers, [...mDelivered, sql`delivery_attendant = 'nurse'`]));
    add("B-03c", "VALUE", await countQ(mothers, [...mDelivered, sql`delivery_attendant = 'midwife'`]));

    // B-04 family: delivery type breakdown from birth_attendance_records
    const baRows = await db
      .select({
        deliveryType: birthAttendanceRecords.deliveryType,
        deliveryTerm: birthAttendanceRecords.deliveryTerm,
        deliveryDate: birthAttendanceRecords.deliveryDate,
        age: mothers.age,
      })
      .from(birthAttendanceRecords)
      .innerJoin(mothers, eq(birthAttendanceRecords.motherId, mothers.id))
      .where(and(
        barangayName ? eq(mothers.barangay, barangayName) : undefined,
        sql`delivery_date LIKE ${monthLike}`,
      ));

    const b04 = {
      total: { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 } as Record<string, number>,
      a:     { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 } as Record<string, number>,
      b:     { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 } as Record<string, number>,
      c:     { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 } as Record<string, number>,
      d:     { "10-14": 0, "15-19": 0, "20-49": 0, TOTAL: 0 } as Record<string, number>,
    };
    for (const r of baRows) {
      const bucket = ageBucket(r.age);
      if (!bucket) continue;
      const incr = (key: keyof typeof b04) => {
        b04[key][bucket]++;
        b04[key].TOTAL++;
      };
      incr("total");
      if (r.deliveryType === "VAGINAL" && r.deliveryTerm === "FULL_TERM") incr("a");
      else if (r.deliveryType === "VAGINAL" && r.deliveryTerm === "PRE_TERM") incr("b");
      else if (r.deliveryType === "CESAREAN" && r.deliveryTerm === "FULL_TERM") incr("c");
      else if (r.deliveryType === "CESAREAN" && r.deliveryTerm === "PRE_TERM") incr("d");
    }
    for (const col of ["10-14", "15-19", "20-49", "TOTAL"]) {
      add("B-04", col, b04.total[col]);
      add("B-04a", col, b04.a[col]);
      add("B-04b", col, b04.b[col]);
      add("B-04c", col, b04.c[col]);
      add("B-04d", col, b04.d[col]);
    }

    // === SECTION A — Prenatal screenings (page-19 extras) ===
    const psRows = await db
      .select({
        motherId: prenatalScreenings.motherId,
        screeningDate: prenatalScreenings.screeningDate,
        hepBScreened: prenatalScreenings.hepBScreened,
        hepBPositive: prenatalScreenings.hepBPositive,
        anemiaScreened: prenatalScreenings.anemiaScreened,
        hgbLevelGdl: prenatalScreenings.hgbLevelGdl,
        gdmScreened: prenatalScreenings.gdmScreened,
        ironFolicComplete: prenatalScreenings.ironFolicComplete,
        mmsGiven: prenatalScreenings.mmsGiven,
        calciumGiven: prenatalScreenings.calciumGiven,
        dewormingGiven: prenatalScreenings.dewormingGiven,
        age: mothers.age,
      })
      .from(prenatalScreenings)
      .innerJoin(mothers, eq(prenatalScreenings.motherId, mothers.id))
      .where(and(
        barangayName ? eq(mothers.barangay, barangayName) : undefined,
        sql`screening_date LIKE ${monthLike}`,
      ));

    type PsRow = typeof psRows[number];
    const emitPs = (rowKey: string, predicate: (r: PsRow) => boolean) => {
      const matched = new Set<number>();
      const buckets: Record<string, Set<number>> = {
        "10-14": new Set(), "15-19": new Set(), "20-49": new Set(),
      };
      for (const r of psRows) {
        if (!predicate(r)) continue;
        matched.add(r.motherId);
        const b = ageBucket(r.age);
        if (b) buckets[b].add(r.motherId);
      }
      add(rowKey, "10-14", buckets["10-14"].size);
      add(rowKey, "15-19", buckets["15-19"].size);
      add(rowKey, "20-49", buckets["20-49"].size);
      add(rowKey, "TOTAL", matched.size);
    };

    emitPs("A-05", r => !!r.hepBScreened);
    emitPs("A-06", r => r.hepBPositive === true);
    emitPs("A-07", r => !!r.anemiaScreened);
    emitPs("A-08", r => r.hgbLevelGdl !== null && (r.hgbLevelGdl as number) < 11);
    emitPs("A-09", r => !!r.gdmScreened);
    emitPs("A-10", r => !!r.ironFolicComplete);
    emitPs("A-11", r => !!r.mmsGiven);
    emitPs("A-12", r => !!r.calciumGiven);
    emitPs("A-13", r => !!r.dewormingGiven);

    // === SECTION E — Nutrition (extras beyond E-01 already computed) ===
    // E-02: LBW infants given complete iron supplementation (born this month)
    const cBirthThisMonth = [...cBase, sql`dob LIKE ${monthLike}`];
    const cE02 = [...cBirthThisMonth, sql`birth_weight_category = 'low'`, sql`iron_supp_complete = true`];
    add("E-02", "M",     await countQ(children, [...cE02, sql`sex = 'male'`]));
    add("E-02", "F",     await countQ(children, [...cE02, sql`sex = 'female'`]));
    add("E-02", "TOTAL", await countQ(children, cE02));

    // E-03a: 6-11 mos given Vit-A this month
    const ageInMonthsExpr = sql`EXTRACT(MONTH FROM AGE(NOW(), dob::date))::int + 12 * EXTRACT(YEAR FROM AGE(NOW(), dob::date))::int`;
    const cE03a = [...cBase, sql`vitamin_a1_date LIKE ${monthLike}`, sql`${ageInMonthsExpr} BETWEEN 6 AND 11`];
    add("E-03a", "M",     await countQ(children, [...cE03a, sql`sex = 'male'`]));
    add("E-03a", "F",     await countQ(children, [...cE03a, sql`sex = 'female'`]));
    add("E-03a", "TOTAL", await countQ(children, cE03a));

    // E-03b: 12-59 mos completed 2nd dose Vit-A this month
    const cE03b = [...cBase, sql`vitamin_a2_date LIKE ${monthLike}`, sql`${ageInMonthsExpr} BETWEEN 12 AND 59`];
    add("E-03b", "M",     await countQ(children, [...cE03b, sql`sex = 'male'`]));
    add("E-03b", "F",     await countQ(children, [...cE03b, sql`sex = 'female'`]));
    add("E-03b", "TOTAL", await countQ(children, cE03b));

    // E-06 family — children 0-59 mos seen this month with classification
    // Source: nutrition_followups joined to children (for sex + age window).
    // E-06 (TOTAL seen), E-06a (MAM), E-06b (SAM)
    const nfRows = await db.execute(sql`
      SELECT c.id AS child_id,
             c.sex AS sex,
             c.dob AS dob,
             nf.classification AS classification,
             nf.actions AS actions,
             nf.outcome AS outcome,
             nf.follow_up_date AS follow_up_date
      FROM nutrition_followups nf
      INNER JOIN children c ON c.id = nf.child_id
      WHERE nf.follow_up_date LIKE ${monthLike}
        ${barangayName ? sql`AND c.barangay = ${barangayName}` : sql``}
    `);
    const nfList = (nfRows as any).rows ?? (nfRows as any) ?? [];
    const e06 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e06a = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e06b = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e07 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e07a = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e07b = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e07c = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const e08 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    for (const r of nfList) {
      const sx = (r.sex as string) === "female" ? "F" : "M";
      const cid = Number(r.child_id);
      e06[sx as "M" | "F"].add(cid); e06.TOTAL.add(cid);
      const cls = String(r.classification || "");
      const actions = Array.isArray(r.actions) ? r.actions : [];
      const outcome = String(r.outcome || "");
      if (cls === "MAM") {
        e06a[sx as "M" | "F"].add(cid); e06a.TOTAL.add(cid);
      } else if (cls === "SAM_COMPLICATED" || cls === "SAM_UNCOMPLICATED") {
        e06b[sx as "M" | "F"].add(cid); e06b.TOTAL.add(cid);
      }
      if (actions.includes("ENROLL_SFP")) {
        e07[sx as "M" | "F"].add(cid); e07.TOTAL.add(cid);
        if (outcome === "CURED") { e07a[sx as "M" | "F"].add(cid); e07a.TOTAL.add(cid); }
        else if (outcome === "NON_RESPONDER") { e07b[sx as "M" | "F"].add(cid); e07b.TOTAL.add(cid); }
        else if (outcome === "DEFAULTED") { e07c[sx as "M" | "F"].add(cid); e07c.TOTAL.add(cid); }
      }
      if (actions.includes("ENROLL_OTC")) {
        e08[sx as "M" | "F"].add(cid); e08.TOTAL.add(cid);
      }
    }
    for (const [rk, group] of [
      ["E-06", e06], ["E-06a", e06a], ["E-06b", e06b],
      ["E-07", e07], ["E-07a", e07a], ["E-07b", e07b], ["E-07c", e07c],
      ["E-08", e08],
    ] as const) {
      add(rk, "M", group.M.size);
      add(rk, "F", group.F.size);
      add(rk, "TOTAL", group.TOTAL.size);
    }

    // === SECTION F — Sick Children (IMCI) ===
    const scvRows = await db
      .select({
        childId: sickChildVisits.childId,
        visitDate: sickChildVisits.visitDate,
        vitaminAGiven: sickChildVisits.vitaminAGiven,
        hasAcuteDiarrhea: sickChildVisits.hasAcuteDiarrhea,
        sex: children.sex,
        dob: children.dob,
      })
      .from(sickChildVisits)
      .innerJoin(children, eq(sickChildVisits.childId, children.id))
      .where(and(
        barangayName ? eq(children.barangay, barangayName) : undefined,
        sql`${sickChildVisits.visitDate} LIKE ${monthLike}`,
      ));

    const ageMosAt = (dob: string, ref: string): number => {
      const d = new Date(dob);
      const r = new Date(ref);
      if (isNaN(d.getTime()) || isNaN(r.getTime())) return -1;
      return (r.getFullYear() - d.getFullYear()) * 12 + (r.getMonth() - d.getMonth());
    };

    const f01 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const f01a = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const f02 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const f02a = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };
    const f03 = { M: new Set<number>(), F: new Set<number>(), TOTAL: new Set<number>() };

    for (const r of scvRows) {
      const sx = (r.sex || "").toLowerCase() === "female" ? "F" : "M";
      const ageMos = ageMosAt(r.dob, r.visitDate);
      const in611 = ageMos >= 6 && ageMos <= 11;
      const in1259 = ageMos >= 12 && ageMos <= 59;
      const in059 = ageMos >= 0 && ageMos <= 59;
      const cid = r.childId;
      if (in611) {
        f01a[sx as "M" | "F"].add(cid); f01a.TOTAL.add(cid);
        if (r.vitaminAGiven) { f01[sx as "M" | "F"].add(cid); f01.TOTAL.add(cid); }
      }
      if (in1259) {
        f02a[sx as "M" | "F"].add(cid); f02a.TOTAL.add(cid);
        if (r.vitaminAGiven) { f02[sx as "M" | "F"].add(cid); f02.TOTAL.add(cid); }
      }
      if (in059 && r.hasAcuteDiarrhea) {
        f03[sx as "M" | "F"].add(cid); f03.TOTAL.add(cid);
      }
    }
    for (const [rk, group] of [
      ["F-01", f01], ["F-01a", f01a],
      ["F-02", f02], ["F-02a", f02a],
      ["F-03", f03],
    ] as const) {
      add(rk, "M", group.M.size);
      add(rk, "F", group.F.size);
      add(rk, "TOTAL", group.TOTAL.size);
    }

    // === SECTION D4 — School-based immunization ===
    const siRows = await db
      .select()
      .from(schoolImmunizations)
      .where(and(
        barangayName ? eq(schoolImmunizations.barangay, barangayName) : undefined,
        sql`${schoolImmunizations.vaccinationDate} LIKE ${monthLike}`,
      ));
    let d401 = 0, d402 = 0, d403 = 0;
    for (const r of siRows) {
      const dob = new Date(r.dob);
      const ref = new Date(r.vaccinationDate);
      const ageYrs = isNaN(dob.getTime()) || isNaN(ref.getTime())
        ? -1
        : Math.floor((ref.getTime() - dob.getTime()) / (365.25 * 86400000));
      if (r.vaccine === "HPV" && r.sex === "F" && ageYrs === 9 && r.doseNumber === 1) d401++;
      else if (r.vaccine === "HPV" && r.sex === "F" && ageYrs === 9 && r.doseNumber === 2) d402++;
      else if (r.vaccine === "Td" && r.gradeLevel === 1) d403++;
    }
    add("D4-01", "F",     d401);
    add("D4-01", "TOTAL", d401);
    add("D4-02", "F",     d402);
    add("D4-02", "TOTAL", d402);
    // D4-03 is mixed-sex, just emit TOTAL for now
    add("D4-03", "TOTAL", d403);

    // === SECTION ORAL — First-visit dental care ===
    const ohRows = await db
      .select()
      .from(oralHealthVisits)
      .where(and(
        barangayName ? eq(oralHealthVisits.barangay, barangayName) : undefined,
        sql`${oralHealthVisits.visitDate} LIKE ${monthLike}`,
        eq(oralHealthVisits.isFirstVisit, true),
      ));

    const ohBands = {
      "ORAL-00": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
      "ORAL-01": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
      "ORAL-02": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
      "ORAL-03": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
      "ORAL-04": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
      "ORAL-05": { M: 0, F: 0, TOTAL: 0 } as Record<string, number>,
    };
    const ohSubFac: Record<string, number> = {};
    const ohSubNon: Record<string, number> = {};
    let oral06 = 0;
    let oral06a = 0;
    let oral06b = 0;
    const setSub = (band: string, facility: boolean, sx: "M" | "F") => {
      const baseKey = `${band}|${sx}`;
      const totalKey = `${band}|TOTAL`;
      if (facility) {
        ohSubFac[`${band}a|${sx}`] = (ohSubFac[`${band}a|${sx}`] ?? 0) + 1;
        ohSubFac[`${band}a|TOTAL`] = (ohSubFac[`${band}a|TOTAL`] ?? 0) + 1;
      } else {
        ohSubNon[`${band}b|${sx}`] = (ohSubNon[`${band}b|${sx}`] ?? 0) + 1;
        ohSubNon[`${band}b|TOTAL`] = (ohSubNon[`${band}b|TOTAL`] ?? 0) + 1;
      }
      void baseKey; void totalKey;
    };

    for (const r of ohRows) {
      const dob = new Date(r.dob);
      const ref = new Date(r.visitDate);
      if (isNaN(dob.getTime()) || isNaN(ref.getTime())) continue;
      const ageMos = (ref.getFullYear() - dob.getFullYear()) * 12 + (ref.getMonth() - dob.getMonth());
      const ageYrs = Math.floor(ageMos / 12);
      const sx = r.sex === "F" ? "F" : "M";
      let band: keyof typeof ohBands | null = null;
      if (ageMos >= 0 && ageMos <= 11) band = "ORAL-00";
      else if (ageYrs >= 1 && ageYrs <= 4) band = "ORAL-01";
      else if (ageYrs >= 5 && ageYrs <= 9) band = "ORAL-02";
      else if (ageYrs >= 10 && ageYrs <= 19) band = "ORAL-03";
      else if (ageYrs >= 20 && ageYrs <= 59) band = "ORAL-04";
      else if (ageYrs >= 60) band = "ORAL-05";
      if (band) {
        ohBands[band][sx]++;
        ohBands[band].TOTAL++;
        if (band !== "ORAL-00") setSub(band, !!r.facilityBased, sx);
      }
      if (r.isPregnant) {
        oral06++;
        if (r.facilityBased) oral06a++;
        else oral06b++;
      }
    }
    for (const [rk, group] of Object.entries(ohBands)) {
      add(rk, "M", group.M);
      add(rk, "F", group.F);
      add(rk, "TOTAL", group.TOTAL);
    }
    for (const [k, v] of Object.entries(ohSubFac)) {
      const [rowKey, columnKey] = k.split("|");
      add(rowKey, columnKey, v);
    }
    for (const [k, v] of Object.entries(ohSubNon)) {
      const [rowKey, columnKey] = k.split("|");
      add(rowKey, columnKey, v);
    }
    add("ORAL-06", "TOTAL", oral06);
    add("ORAL-06a", "TOTAL", oral06a);
    add("ORAL-06b", "TOTAL", oral06b);

    // === SECTION G1 — PhilPEN Risk Assessment (adults 20-59) ===
    const ppRows = await db.select().from(philpenAssessments).where(and(
      barangayName ? eq(philpenAssessments.barangay, barangayName) : undefined,
      sql`${philpenAssessments.assessmentDate} LIKE ${monthLike}`,
    ));
    const calcAgeYrs = (dob: string, ref: string): number => {
      const d = new Date(dob), r = new Date(ref);
      if (isNaN(d.getTime()) || isNaN(r.getTime())) return -1;
      let y = r.getFullYear() - d.getFullYear();
      const md = r.getMonth() - d.getMonth();
      if (md < 0 || (md === 0 && r.getDate() < d.getDate())) y--;
      return y;
    };
    const g1 = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1a = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1b = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1c = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1d = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1e = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    const g1f = { M: 0, F: 0, TOTAL: 0 } as Record<string, number>;
    for (const r of ppRows) {
      const age = calcAgeYrs(r.dob, r.assessmentDate);
      if (age < 20 || age > 59) continue;
      const sx = r.sex === "F" ? "F" : "M";
      const incr = (g: Record<string, number>) => { g[sx]++; g.TOTAL++; };
      incr(g1);
      if (r.smokingHistory) incr(g1a);
      if (r.bingeDrinker) incr(g1b);
      if (r.insufficientActivity) incr(g1c);
      if (r.unhealthyDiet) incr(g1d);
      if (r.bmiCategory === "OVERWEIGHT") incr(g1e);
      if (r.bmiCategory === "OBESE") incr(g1f);
    }
    for (const [rk, g] of [["G1-01", g1], ["G1-01a", g1a], ["G1-01b", g1b], ["G1-01c", g1c], ["G1-01d", g1d], ["G1-01e", g1e], ["G1-01f", g1f]] as const) {
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === SECTION G2 — Cardiovascular (HTN screenings via ncd_screenings) ===
    const ncdRows = await db.select().from(ncdScreenings).where(and(
      barangayName ? eq(ncdScreenings.barangay, barangayName) : undefined,
      sql`${ncdScreenings.screenDate} LIKE ${monthLike}`,
      eq(ncdScreenings.condition, "HTN"),
    ));
    const g201 = { M: 0, F: 0, TOTAL: 0 };
    const g202 = { M: 0, F: 0, TOTAL: 0 };
    const g202a = { M: 0, F: 0, TOTAL: 0 };
    const g202b = { M: 0, F: 0, TOTAL: 0 };
    const g204a = { M: 0, F: 0, TOTAL: 0 };
    const g204b = { M: 0, F: 0, TOTAL: 0 };
    for (const r of ncdRows) {
      const age = calcAgeYrs(r.dob, r.screenDate);
      const sx = r.sex === "F" ? "F" : "M";
      const incr = (g: Record<string, number>) => { g[sx]++; g.TOTAL++; };
      if (age >= 20 && age <= 59) {
        if (r.diagnosed) incr(g201);
        if (r.medsProvided) {
          incr(g202);
          if (r.medsSource === "FACILITY") incr(g202a);
          else if (r.medsSource === "OUT_OF_POCKET") incr(g202b);
        }
      } else if (age >= 60) {
        if (r.medsProvided) {
          if (r.medsSource === "FACILITY") incr(g204a);
          else if (r.medsSource === "OUT_OF_POCKET") incr(g204b);
        }
      }
    }
    for (const [rk, g] of [["G2-01", g201], ["G2-02", g202], ["G2-02a", g202a], ["G2-02b", g202b], ["G2-04a", g204a], ["G2-04b", g204b]] as const) {
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === SECTION G4 — Vision Screening (60+) ===
    const visRows = await db.select().from(visionScreenings).where(and(
      barangayName ? eq(visionScreenings.barangay, barangayName) : undefined,
      sql`${visionScreenings.screenDate} LIKE ${monthLike}`,
    ));
    const g401 = { M: 0, F: 0, TOTAL: 0 };
    const g402 = { M: 0, F: 0, TOTAL: 0 };
    const g403 = { M: 0, F: 0, TOTAL: 0 };
    for (const r of visRows) {
      const age = calcAgeYrs(r.dob, r.screenDate);
      if (age < 60) continue;
      const sx = r.sex === "F" ? "F" : "M";
      const incr = (g: Record<string, number>) => { g[sx]++; g.TOTAL++; };
      incr(g401);
      if (r.eyeDiseaseFound) incr(g402);
      if (r.referredToEyeCare) incr(g403);
    }
    for (const [rk, g] of [["G4-01", g401], ["G4-02", g402], ["G4-03", g403]] as const) {
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === SECTION G6 — Cervical Cancer Screening (women 30-65) ===
    const ccRows = await db.select().from(cervicalCancerScreenings).where(and(
      barangayName ? eq(cervicalCancerScreenings.barangay, barangayName) : undefined,
      sql`${cervicalCancerScreenings.screenDate} LIKE ${monthLike}`,
    ));
    let g601 = 0, g602 = 0, g603 = 0, g603a = 0, g603b = 0, g604 = 0, g605 = 0, g605a = 0, g605b = 0;
    for (const r of ccRows) {
      const age = calcAgeYrs(r.dob, r.screenDate);
      if (age < 30 || age > 65) continue;
      g601++;
      if (r.suspicious) {
        g602++;
        if (r.linkedToCare) {
          g603++;
          if (r.linkedOutcome === "TREATED") g603a++;
          else if (r.linkedOutcome === "REFERRED") g603b++;
        }
      }
      if (r.precancerous) {
        g604++;
        if (r.linkedToCare) {
          g605++;
          if (r.precancerousOutcome === "TREATED") g605a++;
          else if (r.precancerousOutcome === "REFERRED") g605b++;
        }
      }
    }
    add("G6-01", "F", g601); add("G6-01", "TOTAL", g601);
    add("G6-02", "F", g602); add("G6-02", "TOTAL", g602);
    add("G6-03", "F", g603); add("G6-03", "TOTAL", g603);
    add("G6-03a", "F", g603a); add("G6-03a", "TOTAL", g603a);
    add("G6-03b", "F", g603b); add("G6-03b", "TOTAL", g603b);
    add("G6-04", "F", g604); add("G6-04", "TOTAL", g604);
    add("G6-05", "F", g605); add("G6-05", "TOTAL", g605);
    add("G6-05a", "F", g605a); add("G6-05a", "TOTAL", g605a);
    add("G6-05b", "F", g605b); add("G6-05b", "TOTAL", g605b);

    // === SECTION G8 — Mental Health (mhGAP) ===
    const mhRows = await db.select().from(mentalHealthScreenings).where(and(
      barangayName ? eq(mentalHealthScreenings.barangay, barangayName) : undefined,
      sql`${mentalHealthScreenings.screenDate} LIKE ${monthLike}`,
    ));
    add("G8-01", "TOTAL", mhRows.length);

    // === DIS-FIL (Filariasis) ===
    const filRows = await db.select().from(filariasisRecords).where(and(
      barangayName ? eq(filariasisRecords.barangay, barangayName) : undefined,
      sql`${filariasisRecords.examDate} LIKE ${monthLike}`,
    ));
    const filByKey = (predicate: (r: typeof filRows[number]) => boolean) => {
      const g = { M: 0, F: 0, TOTAL: 0 };
      for (const r of filRows) {
        if (!predicate(r)) continue;
        const sx = r.sex === "F" ? "F" : "M";
        g[sx as "M" | "F"]++;
        g.TOTAL++;
      }
      return g;
    };
    const fil01 = filByKey(() => true);
    const fil02 = filByKey(r => r.result === "POSITIVE");
    const fil03 = filByKey(r => r.manifestation === "LYMPHEDEMA");
    const fil04 = filByKey(r => r.manifestation === "HYDROCELE");
    for (const [rk, g] of [["DIS-FIL-01", fil01], ["DIS-FIL-02", fil02], ["DIS-FIL-03", fil03], ["DIS-FIL-04", fil04]] as const) {
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === DIS-RAB (Rabies) ===
    const rabRows = await db.select().from(rabiesExposures).where(and(
      barangayName ? eq(rabiesExposures.barangay, barangayName) : undefined,
      sql`${rabiesExposures.exposureDate} LIKE ${monthLike}`,
    ));
    const rabByCat = (cat: "I" | "II" | "III") => filByKey.bind(null);
    void rabByCat;
    const rabAggregate = (predicate: (r: typeof rabRows[number]) => boolean) => {
      const g = { M: 0, F: 0, TOTAL: 0 };
      for (const r of rabRows) {
        if (!predicate(r)) continue;
        const sx = r.sex === "F" ? "F" : "M";
        g[sx as "M" | "F"]++;
        g.TOTAL++;
      }
      return g;
    };
    const rab01 = rabAggregate(r => r.category === "I");
    const rab02 = rabAggregate(r => r.category === "II");
    const rab03 = rabAggregate(r => r.category === "III");
    const rab04 = rabAggregate(() => true);
    const rab05 = rabAggregate(r => r.category === "II" && !!r.completeDoses);
    const rab01a = rabRows.filter(r => r.category === "I" && r.treatmentCenter === "ABTC").length;
    const rab01b = rabRows.filter(r => r.category === "I" && r.treatmentCenter === "NON_ABTC").length;
    const rab02a = rabRows.filter(r => r.category === "II" && r.treatmentCenter === "ABTC").length;
    const rab02b = rabRows.filter(r => r.category === "II" && r.treatmentCenter === "NON_ABTC").length;
    const rab03a = rabRows.filter(r => r.category === "III" && r.treatmentCenter === "ABTC").length;
    const rab03b = rabRows.filter(r => r.category === "III" && r.treatmentCenter === "NON_ABTC").length;
    for (const [rk, g] of [["DIS-RAB-01", rab01], ["DIS-RAB-02", rab02], ["DIS-RAB-03", rab03], ["DIS-RAB-04", rab04], ["DIS-RAB-05", rab05]] as const) {
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }
    add("DIS-RAB-01a", "VALUE", rab01a);
    add("DIS-RAB-01b", "VALUE", rab01b);
    add("DIS-RAB-02a", "VALUE", rab02a);
    add("DIS-RAB-02b", "VALUE", rab02b);
    add("DIS-RAB-03a", "VALUE", rab03a);
    add("DIS-RAB-03b", "VALUE", rab03b);

    // === DIS-SCH (Schistosomiasis) ===
    const schRows = await db.select().from(schistosomiasisRecords).where(and(
      barangayName ? eq(schistosomiasisRecords.barangay, barangayName) : undefined,
      sql`${schistosomiasisRecords.seenDate} LIKE ${monthLike}`,
    ));
    const schAgg = (predicate: (r: typeof schRows[number]) => boolean) => {
      const g = { M: 0, F: 0, TOTAL: 0 };
      for (const r of schRows) {
        if (!predicate(r)) continue;
        const sx = r.sex === "F" ? "F" : "M";
        g[sx as "M" | "F"]++;
        g.TOTAL++;
      }
      return g;
    };
    for (const [rk, p] of [
      ["DIS-SCH-01", () => true],
      ["DIS-SCH-02", (r: any) => r.suspected],
      ["DIS-SCH-03", (r: any) => r.treated],
      ["DIS-SCH-04", (r: any) => r.confirmed],
      ["DIS-SCH-04a", (r: any) => r.confirmed && r.complicated],
      ["DIS-SCH-04b", (r: any) => r.confirmed && !r.complicated],
    ] as const) {
      const g = schAgg(p as any);
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === DIS-STH (Soil-Transmitted Helminth) ===
    const sthRows2 = await db.select().from(sthRecords).where(and(
      barangayName ? eq(sthRecords.barangay, barangayName) : undefined,
      sql`${sthRecords.screenDate} LIKE ${monthLike}`,
    ));
    const sthAgg = (predicate: (r: typeof sthRows2[number]) => boolean) => {
      const g = { M: 0, F: 0, TOTAL: 0 };
      for (const r of sthRows2) {
        if (!predicate(r)) continue;
        const sx = r.sex === "F" ? "F" : "M";
        g[sx as "M" | "F"]++;
        g.TOTAL++;
      }
      return g;
    };
    for (const [rk, p] of [
      ["DIS-STH-01", () => true],
      ["DIS-STH-02", (r: any) => r.confirmed],
      ["DIS-STH-02a", (r: any) => r.confirmed && r.residency === "RESIDENT"],
      ["DIS-STH-02b", (r: any) => r.confirmed && r.residency === "NON_RESIDENT"],
    ] as const) {
      const g = sthAgg(p as any);
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === DIS-LEP (Leprosy) ===
    const lepRows = await db.select().from(leprosyRecords).where(and(
      barangayName ? eq(leprosyRecords.barangay, barangayName) : undefined,
      sql`${leprosyRecords.registeredDate} LIKE ${monthLike}`,
    ));
    const lepAgg = (predicate: (r: typeof lepRows[number]) => boolean) => {
      const g = { M: 0, F: 0, TOTAL: 0 };
      for (const r of lepRows) {
        if (!predicate(r)) continue;
        const sx = r.sex === "F" ? "F" : "M";
        g[sx as "M" | "F"]++;
        g.TOTAL++;
      }
      return g;
    };
    for (const [rk, p] of [
      ["DIS-LEP-01", () => true],
      ["DIS-LEP-02", (r: any) => r.newCase],
      ["DIS-LEP-03", (r: any) => r.confirmed],
    ] as const) {
      const g = lepAgg(p as any);
      add(rk, "M", g.M); add(rk, "F", g.F); add(rk, "TOTAL", g.TOTAL);
    }

    // === SECTION H — Mortality / Natality (death_events extensions) ===
    const deRows = await db.select().from(deathEvents).where(and(
      barangayName ? eq(deathEvents.barangay, barangayName) : undefined,
      sql`${deathEvents.dateOfDeath} LIKE ${monthLike}`,
    ));
    let h03M = 0, h03F = 0;
    let h03aTotal = 0, h03aR = 0, h03aNR = 0;
    let h03bTotal = 0, h03bR = 0, h03bNR = 0;
    let h04 = 0, h05 = 0, h06 = 0, h07 = 0, h07b = 0, h08 = 0;
    for (const r of deRows) {
      h08++;
      const ageDays = r.ageDays ?? null;
      const ageYrs = r.age ?? null;
      const ageMos = ageDays !== null ? Math.floor(ageDays / 30) : (ageYrs !== null ? ageYrs * 12 : null);

      // Maternal deaths (women 15-49, has maternal_death_cause set)
      const isMaternal = r.maternalDeathCause === "DIRECT" || r.maternalDeathCause === "INDIRECT";
      if (isMaternal) {
        if (r.sex === "F") h03F++;
        else h03M++;
        if (r.maternalDeathCause === "DIRECT") {
          h03aTotal++;
          if (r.residency === "RESIDENT") h03aR++;
          else if (r.residency === "NON_RESIDENT") h03aNR++;
        } else if (r.maternalDeathCause === "INDIRECT") {
          h03bTotal++;
          if (r.residency === "RESIDENT") h03bR++;
          else if (r.residency === "NON_RESIDENT") h03bNR++;
        }
      }

      // Age-band mortality
      if (ageMos !== null && ageMos < 60) h04++;
      if (ageMos !== null && ageMos < 12) h05++;
      if (ageDays !== null && ageDays <= 28) h06++;
      // Perinatal: fetal death + early neonatal (≤6 days)
      if (r.isFetalDeath) h07++;
      else if (r.isLiveBornEarlyNeonatal && ageDays !== null && ageDays <= 6) {
        h07++;
        h07b++;
      }
    }
    add("H-03", "M", h03M); add("H-03", "F", h03F); add("H-03", "TOTAL", h03M + h03F);
    add("H-03a", "M", 0); add("H-03a", "F", h03aTotal); add("H-03a", "TOTAL", h03aTotal);
    add("H-03a-R", "VALUE", h03aR);
    add("H-03a-NR", "VALUE", h03aNR);
    add("H-03b", "M", 0); add("H-03b", "F", h03bTotal); add("H-03b", "TOTAL", h03bTotal);
    add("H-03b-R", "VALUE", h03bR);
    add("H-03b-NR", "VALUE", h03bNR);
    add("H-04", "VALUE", h04);
    add("H-05", "VALUE", h05);
    add("H-06", "VALUE", h06);
    add("H-07", "TOTAL", h07);
    add("H-07b", "VALUE", h07b);
    add("H-08", "VALUE", h08);

    // === SECTION W — Water & Sanitation ===
    // Cumulative latest survey state (not month-bound) — counts unique
    // households by their most recent record.
    const hwAll = await db.select().from(householdWaterRecords).where(
      barangayName ? eq(householdWaterRecords.barangay, barangayName) : undefined,
    ).orderBy(desc(householdWaterRecords.surveyDate));
    const seenHh = new Set<string>();
    let wL1 = 0, wL2 = 0, wL3 = 0, wSafely = 0;
    for (const r of hwAll) {
      const key = r.householdId || `${r.householdHead || ""}|${r.barangay}`;
      if (!key) continue;
      if (seenHh.has(key)) continue;
      seenHh.add(key);
      if (r.waterLevel === "I") wL1++;
      else if (r.waterLevel === "II") wL2++;
      else if (r.waterLevel === "III") wL3++;
      if (r.safelyManaged) wSafely++;
    }
    add("W-01", "VALUE", wL1 + wL2 + wL3);
    add("W-01a", "VALUE", wL1);
    add("W-01b", "VALUE", wL2);
    add("W-01c", "VALUE", wL3);
    add("W-02", "VALUE", wSafely);

    // Save all computed values (ENCODED already excluded via `add`)
    if (computedRaw.length > 0) {
      await this.updateM1IndicatorValues(reportId, computedRaw.map(v => ({
        rowKey: v.rowKey,
        columnKey: v.columnKey,
        valueNumber: v.valueNumber,
        valueSource: "COMPUTED",
      })));
    }

    return {
      computed: computedRaw.length,
      skipped: existing.filter(v => v.valueSource === "ENCODED").length,
    };
  }

  async getConsolidatedM1Values(
    month: number,
    year: number,
    options: { onlySubmitted?: boolean } = {},
  ): Promise<{ values: M1IndicatorValue[]; sourceReportCount: number; submittedCount: number }> {
    // Match the same scoping as the Barangay Overview panel (GET /api/m1/reports):
    // filter by month + year only. Any extra scope filter (scope_type or
    // barangayId IS NOT NULL) can silently exclude legacy rows where those
    // columns were never populated, which was the bug behind the empty grid.
    const conditions = [
      eq(m1ReportInstances.month, month),
      eq(m1ReportInstances.year, year),
    ];
    if (options.onlySubmitted) {
      conditions.push(eq(m1ReportInstances.status, "SUBMITTED_LOCKED"));
    }

    const instances = await db
      .select()
      .from(m1ReportInstances)
      .where(and(...conditions));

    console.log(
      `[getConsolidatedM1Values] month=${month} year=${year} onlySubmitted=${options.onlySubmitted ?? false} → ${instances.length} instance(s)`,
    );
    if (instances.length > 0) {
      console.log(
        "[getConsolidatedM1Values] instances:",
        instances.map(i => ({ id: i.id, brgy: i.barangayName, brgyId: i.barangayId, scope: i.scopeType, status: i.status })),
      );
    }

    const submittedCount = instances.filter(i => i.status === "SUBMITTED_LOCKED").length;

    if (instances.length === 0) {
      return { values: [], sourceReportCount: 0, submittedCount: 0 };
    }

    const instanceIds = instances.map(i => i.id);
    const rows = await db
      .select({
        rowKey: m1IndicatorValues.rowKey,
        columnKey: m1IndicatorValues.columnKey,
        sumValue: sql<number>`SUM(COALESCE(${m1IndicatorValues.valueNumber}, 0))::int`,
      })
      .from(m1IndicatorValues)
      .where(inArray(m1IndicatorValues.reportInstanceId, instanceIds))
      .groupBy(m1IndicatorValues.rowKey, m1IndicatorValues.columnKey);

    const now = new Date().toISOString();
    const values: M1IndicatorValue[] = rows.map((r, idx) => ({
      id: -(idx + 1),
      reportInstanceId: -1,
      rowKey: r.rowKey,
      columnKey: r.columnKey,
      valueNumber: r.sumValue ?? 0,
      valueDecimal: null,
      valueText: null,
      valueSource: "CONSOLIDATED",
      computedAt: now,
      locked: false,
      createdByUserId: null,
      createdAt: now,
      updatedAt: now,
    }));

    return {
      values,
      sourceReportCount: instances.length,
      submittedCount,
    };
  }

  async getMunicipalitySettings(): Promise<MunicipalitySettings | undefined> {
    const [settings] = await db.select().from(municipalitySettings);
    return settings;
  }

  async getBarangaySettings(barangayId: number): Promise<BarangaySettings | undefined> {
    const [settings] = await db.select().from(barangaySettings).where(eq(barangaySettings.barangayId, barangayId));
    return settings;
  }

  // Senior Medication Claims (Cross-barangay verification)
  async getSeniorMedClaims(seniorId?: number): Promise<SeniorMedClaim[]> {
    if (seniorId) {
      return await db.select().from(seniorMedClaims).where(eq(seniorMedClaims.seniorId, seniorId)).orderBy(desc(seniorMedClaims.claimedAt));
    }
    return await db.select().from(seniorMedClaims).orderBy(desc(seniorMedClaims.claimedAt));
  }

  async checkSeniorEligibility(seniorUniqueId: string): Promise<{ eligible: boolean; reason?: string; lastClaim?: SeniorMedClaim }> {
    const now = new Date().toISOString();
    
    // Find recent claims by this senior (using unique ID for cross-barangay matching)
    const recentClaims = await db
      .select()
      .from(seniorMedClaims)
      .where(
        and(
          eq(seniorMedClaims.seniorUniqueId, seniorUniqueId),
          gte(seniorMedClaims.nextEligibleAt, now)
        )
      )
      .orderBy(desc(seniorMedClaims.claimedAt))
      .limit(1);

    if (recentClaims.length > 0) {
      const lastClaim = recentClaims[0];
      return {
        eligible: false,
        reason: `Already claimed at ${lastClaim.claimedBarangayName} on ${new Date(lastClaim.claimedAt).toLocaleDateString()}. Next eligible: ${new Date(lastClaim.nextEligibleAt).toLocaleDateString()}`,
        lastClaim,
      };
    }

    return { eligible: true };
  }

  async createSeniorMedClaim(claim: InsertSeniorMedClaim): Promise<SeniorMedClaim> {
    const [created] = await db.insert(seniorMedClaims).values(claim).returning();
    return created;
  }

  // === DIRECT MESSAGES ===
  async getDMConversations(userId: string): Promise<Array<{
    userId: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
    isSentByMe: boolean;
  }>> {
    // Get all unique conversation partners
    const sentRows = await db
      .select({ otherId: directMessages.receiverId })
      .from(directMessages)
      .where(eq(directMessages.senderId, userId));
    const receivedRows = await db
      .select({ otherId: directMessages.senderId })
      .from(directMessages)
      .where(eq(directMessages.receiverId, userId));

    const partnerIds = [...new Set([...sentRows.map(r => r.otherId), ...receivedRows.map(r => r.otherId)])];
    if (partnerIds.length === 0) return [];

    const partnerUsers = await db.select().from(users).where(inArray(users.id, partnerIds));

    const conversations = await Promise.all(partnerUsers.map(async (partner) => {
      const [lastMsg] = await db.select()
        .from(directMessages)
        .where(or(
          and(eq(directMessages.senderId, userId), eq(directMessages.receiverId, partner.id)),
          and(eq(directMessages.senderId, partner.id), eq(directMessages.receiverId, userId))
        ))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);

      const unreadRows = await db.select({ id: directMessages.id })
        .from(directMessages)
        .where(and(
          eq(directMessages.senderId, partner.id),
          eq(directMessages.receiverId, userId),
          isNull(directMessages.readAt)
        ));

      return {
        userId: partner.id,
        username: partner.username,
        firstName: partner.firstName ?? null,
        lastName: partner.lastName ?? null,
        lastMessage: lastMsg?.content ?? '',
        lastMessageAt: lastMsg?.createdAt ?? new Date(0),
        unreadCount: unreadRows.length,
        isSentByMe: lastMsg?.senderId === userId,
      };
    }));

    return conversations.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getDMMessages(currentUserId: string, otherUserId: string): Promise<DirectMessage[]> {
    return db.select()
      .from(directMessages)
      .where(or(
        and(eq(directMessages.senderId, currentUserId), eq(directMessages.receiverId, otherUserId)),
        and(eq(directMessages.senderId, otherUserId), eq(directMessages.receiverId, currentUserId))
      ))
      .orderBy(directMessages.createdAt);
  }

  async sendDMMessage(senderId: string, receiverId: string, content: string): Promise<DirectMessage> {
    const [created] = await db.insert(directMessages).values({ senderId, receiverId, content }).returning();
    return created;
  }

  async markDMThreadRead(currentUserId: string, otherUserId: string): Promise<void> {
    await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(directMessages.senderId, otherUserId),
        eq(directMessages.receiverId, currentUserId),
        isNull(directMessages.readAt)
      ));
  }

  async markDMMessageRead(messageId: number, currentUserId: string): Promise<void> {
    // Only mark the message read if the current user is the receiver
    const [msg] = await db.select()
      .from(directMessages)
      .where(and(eq(directMessages.id, messageId), eq(directMessages.receiverId, currentUserId)))
      .limit(1);
    if (msg && !msg.readAt) {
      await db.update(directMessages)
        .set({ readAt: new Date() })
        .where(eq(directMessages.id, messageId));
    }
  }

  async getDMMessageSender(messageId: number): Promise<string | null> {
    const [msg] = await db.select({ senderId: directMessages.senderId })
      .from(directMessages)
      .where(eq(directMessages.id, messageId))
      .limit(1);
    return msg?.senderId ?? null;
  }

  async getDMUnreadCount(userId: string): Promise<number> {
    const rows = await db.select({ id: directMessages.id })
      .from(directMessages)
      .where(and(
        eq(directMessages.receiverId, userId),
        isNull(directMessages.readAt)
      ));
    return rows.length;
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const q = `%${query.toLowerCase()}%`;
    return db.select()
      .from(users)
      .where(and(
        ne(users.id, excludeUserId),
        or(
          sql`lower(${users.username}) like ${q}`,
          sql`lower(${users.firstName}) like ${q}`,
          sql`lower(${users.lastName}) like ${q}`
        )
      ))
      .limit(10);
  }

  /**
   * Idempotent insert of M1 Section C (Postpartum Care) catalog rows for the
   * active template version. Source of truth is docs/m1-data-source-audit.md.
   * Computed rows (C-01a, C-01b) are flagged isComputed=true so the report
   * page renders them as auto-filled. The TRANS-IN/OUT sub-rows stay encode-
   * only until postpartum_visits gains those flags.
   */
  private async seedM1SectionCRows(): Promise<void> {
    const [activeTpl] = await db
      .select()
      .from(m1TemplateVersions)
      .where(eq(m1TemplateVersions.isActive, true))
      .limit(1);
    if (!activeTpl) return; // template not seeded yet — nothing to do

    const ageGroupSpec = { columns: ["10-14", "15-19", "20-49", "TOTAL"], hasTotal: true };
    const singleSpec = { columns: ["VALUE"] };

    const rows: InsertM1IndicatorCatalog[] = [
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01a",
        officialLabel: "Postpartum women together with their newborn who completed at least 2 PNC",
        dataType: "INT", rowOrder: 200, indentLevel: 0,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: true, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01b",
        officialLabel: "Total women who delivered and completed at least 4 PNC = (a + b)",
        dataType: "INT", rowOrder: 210, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01b-a",
        officialLabel: "Women who delivered and provided 1st to 4th PNC on schedule",
        dataType: "INT", rowOrder: 211, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: false, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01b-b",
        officialLabel: "Women who delivered and completed at least 4 PNC TRANS IN from other LGUs",
        dataType: "INT", rowOrder: 212, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: false, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01c",
        officialLabel: "Total women who delivered and were tracked during pregnancy = (a + b) - c",
        dataType: "INT", rowOrder: 220, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: false, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01c-a",
        officialLabel: "Women who delivered and who were tracked during pregnancy (new)",
        dataType: "INT", rowOrder: 221, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: false, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01c-b",
        officialLabel: "TRANS IN from other LGUs",
        dataType: "INT", rowOrder: 222, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: false, isRequired: true,
      },
      {
        templateVersionId: activeTpl.id, pageNumber: 2, sectionCode: "C",
        rowKey: "C-01c-c",
        officialLabel: "TRANS OUT (with MOV) before completing 4 PNC",
        dataType: "INT", rowOrder: 223, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: false, isRequired: true,
      },
    ];

    for (const row of rows) {
      const existing = await db
        .select({ id: m1IndicatorCatalog.id })
        .from(m1IndicatorCatalog)
        .where(and(
          eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId),
          eq(m1IndicatorCatalog.rowKey, row.rowKey),
        ))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(m1IndicatorCatalog).values(row);
      }
    }
  }

  /**
   * Idempotent insert of M1 Section A page-19 extras (A-05..A-13) and
   * Section B skilled-attendant + delivery-type breakdown (B-03 family,
   * B-04 family). All flagged isComputed=true since computeM1Values now
   * fills them from prenatal_screenings, mothers, and birth_attendance_records.
   */
  private async seedM1MaternalRows(): Promise<void> {
    const [activeTpl] = await db
      .select()
      .from(m1TemplateVersions)
      .where(eq(m1TemplateVersions.isActive, true))
      .limit(1);
    if (!activeTpl) return;

    const ageGroupSpec = { columns: ["10-14", "15-19", "20-49", "TOTAL"], hasTotal: true };
    const singleSpec = { columns: ["VALUE"] };
    const tplId = activeTpl.id;

    const rows: InsertM1IndicatorCatalog[] = [
      // === SECTION A — Prenatal screenings (page 19) ===
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-05", officialLabel: "Pregnant women screened for Hepatitis B",
        dataType: "INT", rowOrder: 105, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-06", officialLabel: "Pregnant women tested positive for Hepatitis B",
        dataType: "INT", rowOrder: 106, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-07", officialLabel: "Pregnant women screened for anemia",
        dataType: "INT", rowOrder: 107, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-08", officialLabel: "Pregnant women identified as anemic",
        dataType: "INT", rowOrder: 108, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-09", officialLabel: "Pregnant women screened for Gestational Diabetes Mellitus (GDM)",
        dataType: "INT", rowOrder: 109, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-10", officialLabel: "Pregnant women given complete iron / folic acid supplementation",
        dataType: "INT", rowOrder: 110, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-11", officialLabel: "Pregnant women given Multiple Micronutrient Supplementation (MMS)",
        dataType: "INT", rowOrder: 111, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-12", officialLabel: "Pregnant women given calcium supplementation",
        dataType: "INT", rowOrder: 112, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 1, sectionCode: "A",
        rowKey: "A-13", officialLabel: "Pregnant women dewormed",
        dataType: "INT", rowOrder: 113, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },

      // === SECTION B — Skilled attendant + delivery type ===
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-03", officialLabel: "No. of deliveries attended by skilled health professionals",
        dataType: "INT", rowOrder: 130, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-03a", officialLabel: "Physicians",
        dataType: "INT", rowOrder: 131, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-03b", officialLabel: "Nurses",
        dataType: "INT", rowOrder: 132, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-03c", officialLabel: "Midwives",
        dataType: "INT", rowOrder: 133, indentLevel: 1,
        columnGroupType: "SINGLE", columnSpec: singleSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-04", officialLabel: "Total Deliveries by Type",
        dataType: "INT", rowOrder: 140, indentLevel: 0,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-04a", officialLabel: "Vaginal, full-term",
        dataType: "INT", rowOrder: 141, indentLevel: 1,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-04b", officialLabel: "Vaginal, pre-term",
        dataType: "INT", rowOrder: 142, indentLevel: 1,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-04c", officialLabel: "Cesarean, full-term",
        dataType: "INT", rowOrder: 143, indentLevel: 1,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 2, sectionCode: "B",
        rowKey: "B-04d", officialLabel: "Cesarean, pre-term",
        dataType: "INT", rowOrder: 144, indentLevel: 1,
        columnGroupType: "AGE_GROUP", columnSpec: ageGroupSpec,
        isComputed: true, isRequired: true },
    ];

    for (const row of rows) {
      const existing = await db
        .select({ id: m1IndicatorCatalog.id })
        .from(m1IndicatorCatalog)
        .where(and(
          eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId),
          eq(m1IndicatorCatalog.rowKey, row.rowKey),
        ))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(m1IndicatorCatalog).values(row);
      }
    }
  }

  /**
   * Phase 2 catalog rows — Section E (Nutrition extras), Section F (Sick
   * Children / IMCI), Section D4 (School-Based Immunization). All flagged
   * isComputed=true since computeM1Values fills them from children,
   * nutrition_followups, sick_child_visits, and school_immunizations.
   */
  private async seedM1ChildHealthRows(): Promise<void> {
    const [activeTpl] = await db
      .select()
      .from(m1TemplateVersions)
      .where(eq(m1TemplateVersions.isActive, true))
      .limit(1);
    if (!activeTpl) return;

    const sexRateSpec = { columns: ["M", "F", "TOTAL"], hasTotal: true };
    const tplId = activeTpl.id;

    const mk = (
      rowKey: string, label: string, section: string, page: number, order: number,
      indent: number = 0,
    ): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId,
      pageNumber: page,
      sectionCode: section,
      rowKey,
      officialLabel: label,
      dataType: "INT",
      rowOrder: order,
      indentLevel: indent,
      columnGroupType: "SEX_RATE",
      columnSpec: sexRateSpec,
      isComputed: true,
      isRequired: true,
    });

    const rows: InsertM1IndicatorCatalog[] = [
      mk("E-02", "Infants born with low birth weight (LBW) given complete iron supplements", "E", 2, 302),
      mk("E-03a", "Infants 6–11 mos given 1 dose of Vitamin A supplementation", "E", 2, 303),
      mk("E-03b", "Children 12–59 mos who completed 2 doses of Vitamin A supplementation", "E", 2, 304),
      mk("E-06", "Children 0–59 mos seen during the reporting period at health facilities", "E", 2, 306),
      mk("E-06a", "Identified MAM Children", "E", 2, 307, 1),
      mk("E-06b", "Identified SAM Children", "E", 2, 308, 1),
      mk("E-07", "MAM enrolled to SFP", "E", 2, 309),
      mk("E-07a", "Cured", "E", 2, 310, 1),
      mk("E-07b", "Non-cured", "E", 2, 311, 1),
      mk("E-07c", "Defaulted", "E", 2, 312, 1),
      mk("E-08", "SAM identified — referred / enrolled in OTC", "E", 2, 313),
      mk("F-01", "Sick infants 6–11 mos given Vitamin A (aside from routine)", "F", 2, 401),
      mk("F-01a", "Sick infants 6–11 mos seen", "F", 2, 402, 1),
      mk("F-02", "Sick infants 12–59 mos given Vitamin A (aside from routine)", "F", 2, 403),
      mk("F-02a", "Sick infants 12–59 mos seen", "F", 2, 404, 1),
      mk("F-03", "Acute diarrhea cases 0–59 mos seen", "F", 2, 405),
      mk("D4-01", "HPV 1st dose (9 yo female only)", "D4", 2, 281),
      mk("D4-02", "HPV 2nd dose (9 yo female only)", "D4", 2, 282),
      mk("D4-03", "Grade 1 learners given Td", "D4", 2, 283),
    ];

    for (const row of rows) {
      const existing = await db
        .select({ id: m1IndicatorCatalog.id })
        .from(m1IndicatorCatalog)
        .where(and(
          eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId),
          eq(m1IndicatorCatalog.rowKey, row.rowKey),
        ))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(m1IndicatorCatalog).values(row);
      }
    }
  }

  /**
   * Phase 3 catalog rows — Section ORAL (first dental visit by age band).
   */
  private async seedM1OralHealthRows(): Promise<void> {
    const [activeTpl] = await db
      .select()
      .from(m1TemplateVersions)
      .where(eq(m1TemplateVersions.isActive, true))
      .limit(1);
    if (!activeTpl) return;

    const sexRateSpec = { columns: ["M", "F", "TOTAL"], hasTotal: true };
    const ageGroupSpec = { columns: ["10-14", "15-19", "20-49", "TOTAL"], hasTotal: true };
    const tplId = activeTpl.id;

    const mk = (
      rowKey: string, label: string, order: number,
      indent: number = 0, columnGroupType: "SEX_RATE" | "AGE_GROUP" = "SEX_RATE",
    ): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId,
      pageNumber: 2,
      sectionCode: "ORAL",
      rowKey,
      officialLabel: label,
      dataType: "INT",
      rowOrder: order,
      indentLevel: indent,
      columnGroupType,
      columnSpec: columnGroupType === "AGE_GROUP" ? ageGroupSpec : sexRateSpec,
      isComputed: true,
      isRequired: true,
    });

    const rows: InsertM1IndicatorCatalog[] = [
      mk("ORAL-00", "Infants 0–11 mos who had their first dental visit", 500),
      mk("ORAL-01", "Children 1–4 yo who had 1st dental visit", 510),
      mk("ORAL-01a", "Facility-based", 511, 1),
      mk("ORAL-01b", "Non-facility-based", 512, 1),
      mk("ORAL-02", "Children 5–9 yo who had 1st dental visit", 520),
      mk("ORAL-02a", "Facility-based", 521, 1),
      mk("ORAL-02b", "Non-facility-based", 522, 1),
      mk("ORAL-03", "Adolescents 10–19 yo who had 1st dental visit", 530),
      mk("ORAL-03a", "Facility-based", 531, 1),
      mk("ORAL-03b", "Non-facility-based", 532, 1),
      mk("ORAL-04", "Adults 20–59 yo who had 1st dental visit", 540),
      mk("ORAL-04a", "Facility-based", 541, 1),
      mk("ORAL-04b", "Non-facility-based", 542, 1),
      mk("ORAL-05", "Senior Citizens 60+ yo who had 1st dental visit", 550),
      mk("ORAL-05a", "Facility-based", 551, 1),
      mk("ORAL-05b", "Non-facility-based", 552, 1),
      mk("ORAL-06", "Pregnant Women who had 1st dental visit", 560, 0, "AGE_GROUP"),
      mk("ORAL-06a", "Facility-based", 561, 1, "AGE_GROUP"),
      mk("ORAL-06b", "Non-facility-based", 562, 1, "AGE_GROUP"),
    ];

    for (const row of rows) {
      const existing = await db
        .select({ id: m1IndicatorCatalog.id })
        .from(m1IndicatorCatalog)
        .where(and(
          eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId),
          eq(m1IndicatorCatalog.rowKey, row.rowKey),
        ))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(m1IndicatorCatalog).values(row);
      }
    }
  }

  /** Phase 4 catalog rows — G1 (PhilPEN), G2 (CV), G4 (Vision), G6 (Cervical), G8 (Mental health). */
  private async seedM1NcdRows(): Promise<void> {
    const [activeTpl] = await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true)).limit(1);
    if (!activeTpl) return;
    const sexRateSpec = { columns: ["M", "F", "TOTAL"], hasTotal: true };
    const tplId = activeTpl.id;

    const mk = (
      rowKey: string, label: string, section: string, order: number, indent: number = 0,
    ): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId, pageNumber: 3, sectionCode: section, rowKey,
      officialLabel: label, dataType: "INT", rowOrder: order, indentLevel: indent,
      columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true,
    });

    const rows: InsertM1IndicatorCatalog[] = [
      mk("G1-01", "Adults 20–59 yo risk assessed using PhilPEN", "G1", 600),
      mk("G1-01a", "With history of smoking", "G1", 601, 1),
      mk("G1-01b", "Binge Drinker", "G1", 602, 1),
      mk("G1-01c", "Insufficient physical activities", "G1", 603, 1),
      mk("G1-01d", "Consumed unhealthy diet", "G1", 604, 1),
      mk("G1-01e", "Overweight", "G1", 605, 1),
      mk("G1-01f", "Obese", "G1", 606, 1),
      mk("G2-01", "Adults 20–59 yo identified as hypertensive using PhilPEN", "G2", 620),
      mk("G2-02", "Hypertensives 20–59 yo provided with antihypertensive medications", "G2", 621),
      mk("G2-02a", "Provided by facility (100%)", "G2", 622, 1),
      mk("G2-02b", "Out of pocket", "G2", 623, 1),
      mk("G2-04a", "Provided by facility (100%) — 60+ HTN", "G2", 625, 1),
      mk("G2-04b", "Out of pocket — 60+ HTN", "G2", 626, 1),
      mk("G4-01", "Senior citizens 60+ screened for visual acuity", "G4", 640),
      mk("G4-02", "Senior citizens 60+ screened and identified with eye disease(s)", "G4", 641),
      mk("G4-03", "Senior citizens identified with eye disease(s) and referred", "G4", 642),
      mk("G6-01", "Women 30–65 yo screened/assessed for cervical cancer", "G6", 660),
      mk("G6-02", "Women 30–65 yo found suspicious for cervical cancer", "G6", 661),
      mk("G6-03", "Women 30–65 yo found suspicious and linked to care", "G6", 662),
      mk("G6-03a", "Treated", "G6", 663, 1),
      mk("G6-03b", "Referred", "G6", 664, 1),
      mk("G6-04", "Women 30–65 yo found positive for precancerous lesions", "G6", 665),
      mk("G6-05", "Precancerous + linked to care", "G6", 666),
      mk("G6-05a", "Treated", "G6", 667, 1),
      mk("G6-05b", "Referred", "G6", 668, 1),
      mk("G8-01", "Individuals with mental health concern screened using mhGAP", "G8", 680),
    ];
    for (const row of rows) {
      const existing = await db.select({ id: m1IndicatorCatalog.id }).from(m1IndicatorCatalog)
        .where(and(eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId), eq(m1IndicatorCatalog.rowKey, row.rowKey)))
        .limit(1);
      if (existing.length === 0) await db.insert(m1IndicatorCatalog).values(row);
    }
  }

  /** Phase 5 catalog rows — DIS-FIL, DIS-RAB, DIS-SCH, DIS-STH, DIS-LEP. */
  private async seedM1DiseaseRows(): Promise<void> {
    const [activeTpl] = await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true)).limit(1);
    if (!activeTpl) return;
    const sexRateSpec = { columns: ["M", "F", "TOTAL"], hasTotal: true };
    const singleSpec = { columns: ["VALUE"] };
    const tplId = activeTpl.id;

    const sr = (rowKey: string, label: string, section: string, order: number, indent: number = 0): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId, pageNumber: 3, sectionCode: section, rowKey,
      officialLabel: label, dataType: "INT", rowOrder: order, indentLevel: indent,
      columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true,
    });
    const sg = (rowKey: string, label: string, section: string, order: number, indent: number = 1): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId, pageNumber: 3, sectionCode: section, rowKey,
      officialLabel: label, dataType: "INT", rowOrder: order, indentLevel: indent,
      columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true,
    });

    const rows: InsertM1IndicatorCatalog[] = [
      sr("DIS-FIL-01", "Individuals examined for lymphatic filariasis", "DIS-FIL", 700),
      sr("DIS-FIL-02", "Individuals examined and found POSITIVE", "DIS-FIL", 701),
      sr("DIS-FIL-03", "Individuals with lymphedema / elephantiasis", "DIS-FIL", 702),
      sr("DIS-FIL-04", "Individuals with hydrocele", "DIS-FIL", 703),
      sr("DIS-RAB-01", "Rabies exposure — Category I", "DIS-RAB", 720),
      sg("DIS-RAB-01a", "ABTC/ABC", "DIS-RAB", 721),
      sg("DIS-RAB-01b", "Non-ABTC/ABC", "DIS-RAB", 722),
      sr("DIS-RAB-02", "Rabies exposure — Category II", "DIS-RAB", 723),
      sg("DIS-RAB-02a", "ABTC/ABC", "DIS-RAB", 724),
      sg("DIS-RAB-02b", "Non-ABTC/ABC", "DIS-RAB", 725),
      sr("DIS-RAB-03", "Rabies exposure — Category III", "DIS-RAB", 726),
      sg("DIS-RAB-03a", "ABTC/ABC", "DIS-RAB", 727),
      sg("DIS-RAB-03b", "Non-ABTC/ABC", "DIS-RAB", 728),
      sr("DIS-RAB-04", "Total rabies exposure (all categories)", "DIS-RAB", 729),
      sr("DIS-RAB-05", "Category II with complete anti-rabies doses", "DIS-RAB", 730),
      sr("DIS-SCH-01", "Schistosomiasis — patients seen", "DIS-SCH", 740),
      sr("DIS-SCH-02", "Suspected cases seen", "DIS-SCH", 741),
      sr("DIS-SCH-03", "Suspected cases treated", "DIS-SCH", 742),
      sr("DIS-SCH-04", "Confirmed cases", "DIS-SCH", 743),
      sr("DIS-SCH-04a", "Complicated cases", "DIS-SCH", 744, 1),
      sr("DIS-SCH-04b", "Non-complicated cases", "DIS-SCH", 745, 1),
      sr("DIS-STH-01", "Individuals screened for STH", "DIS-STH", 760),
      sr("DIS-STH-02", "Individuals confirmed for STH", "DIS-STH", 761),
      sr("DIS-STH-02a", "Resident", "DIS-STH", 762, 1),
      sr("DIS-STH-02b", "Non-resident", "DIS-STH", 763, 1),
      sr("DIS-LEP-01", "Leprosy old & new cases registered", "DIS-LEP", 780),
      sr("DIS-LEP-02", "Newly detected cases", "DIS-LEP", 781),
      sr("DIS-LEP-03", "Confirmed leprosy cases", "DIS-LEP", 782),
    ];
    for (const row of rows) {
      const existing = await db.select({ id: m1IndicatorCatalog.id }).from(m1IndicatorCatalog)
        .where(and(eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId), eq(m1IndicatorCatalog.rowKey, row.rowKey)))
        .limit(1);
      if (existing.length === 0) await db.insert(m1IndicatorCatalog).values(row);
    }
  }

  /** Phase 6 catalog rows — Section H (Mortality / Natality). */
  private async seedM1MortalityRows(): Promise<void> {
    const [activeTpl] = await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true)).limit(1);
    if (!activeTpl) return;
    const sexRateSpec = { columns: ["M", "F", "TOTAL"], hasTotal: true };
    const singleSpec = { columns: ["VALUE"] };
    const tplId = activeTpl.id;

    const rows: InsertM1IndicatorCatalog[] = [
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03", officialLabel: "Total Maternal Deaths", dataType: "INT", rowOrder: 800, indentLevel: 0, columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03a", officialLabel: "Direct Cause Maternal Death", dataType: "INT", rowOrder: 801, indentLevel: 1, columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03a-R", officialLabel: "Resident", dataType: "INT", rowOrder: 802, indentLevel: 2, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03a-NR", officialLabel: "Non-Resident", dataType: "INT", rowOrder: 803, indentLevel: 2, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03b", officialLabel: "Indirect Cause Maternal Death", dataType: "INT", rowOrder: 804, indentLevel: 1, columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03b-R", officialLabel: "Resident", dataType: "INT", rowOrder: 805, indentLevel: 2, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-03b-NR", officialLabel: "Non-Resident", dataType: "INT", rowOrder: 806, indentLevel: 2, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-04", officialLabel: "Under-Five Mortality (0–59 mos)", dataType: "INT", rowOrder: 810, indentLevel: 0, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-05", officialLabel: "Infant Mortality (0–11 mos & 29 days)", dataType: "INT", rowOrder: 811, indentLevel: 0, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-06", officialLabel: "Neonatal Mortality (0–28 days)", dataType: "INT", rowOrder: 812, indentLevel: 0, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-07", officialLabel: "Total Perinatal Mortality", dataType: "INT", rowOrder: 813, indentLevel: 0, columnGroupType: "SEX_RATE", columnSpec: sexRateSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-07b", officialLabel: "Early Neonatal Death (0–6 days)", dataType: "INT", rowOrder: 814, indentLevel: 1, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
      { templateVersionId: tplId, pageNumber: 3, sectionCode: "H", rowKey: "H-08", officialLabel: "Total Deaths (all causes / age groups)", dataType: "INT", rowOrder: 820, indentLevel: 0, columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true },
    ];
    for (const row of rows) {
      const existing = await db.select({ id: m1IndicatorCatalog.id }).from(m1IndicatorCatalog)
        .where(and(eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId), eq(m1IndicatorCatalog.rowKey, row.rowKey)))
        .limit(1);
      if (existing.length === 0) await db.insert(m1IndicatorCatalog).values(row);
    }
  }

  /** Phase 7 catalog rows — Section W (Water & Sanitation). */
  private async seedM1WaterRows(): Promise<void> {
    const [activeTpl] = await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true)).limit(1);
    if (!activeTpl) return;
    const singleSpec = { columns: ["VALUE"] };
    const tplId = activeTpl.id;
    const mk = (rowKey: string, label: string, order: number, indent: number = 0): InsertM1IndicatorCatalog => ({
      templateVersionId: tplId, pageNumber: 3, sectionCode: "W", rowKey, officialLabel: label,
      dataType: "INT", rowOrder: order, indentLevel: indent,
      columnGroupType: "SINGLE", columnSpec: singleSpec, isComputed: true, isRequired: true,
    });
    const rows: InsertM1IndicatorCatalog[] = [
      mk("W-01", "Households with access to improved water supply — Total", 900),
      mk("W-01a", "HH with Level I", 901, 1),
      mk("W-01b", "HH with Level II", 902, 1),
      mk("W-01c", "HH with Level III", 903, 1),
      mk("W-02", "HH using safely managed drinking water service", 910),
    ];
    for (const row of rows) {
      const existing = await db.select({ id: m1IndicatorCatalog.id }).from(m1IndicatorCatalog)
        .where(and(eq(m1IndicatorCatalog.templateVersionId, row.templateVersionId), eq(m1IndicatorCatalog.rowKey, row.rowKey)))
        .limit(1);
      if (existing.length === 0) await db.insert(m1IndicatorCatalog).values(row);
    }
  }

  async seedData(): Promise<void> {
    // Auto-migrate: add columns introduced after the initial deployment.
    // Every statement is fully idempotent (IF NOT EXISTS / IF EXISTS) so it is
    // safe to re-run on every startup — it becomes a no-op once applied.
    await db.execute(sql`
      ALTER TABLE health_stations
        ADD COLUMN IF NOT EXISTS facility_type TEXT,
        ADD COLUMN IF NOT EXISTS has_tb_dots   BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // Co-conditions on a disease case (e.g. HIV + TB co-infection
    // recorded on the same case row). Aggregators unfold per condition.
    await db.execute(sql`
      ALTER TABLE disease_cases
        ADD COLUMN IF NOT EXISTS additional_conditions JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    // Phase 6 Mortality (FHSIS Section H): age-band + maternal-cause
    // + perinatal flags on death_events. Each idempotent.
    await db.execute(sql`
      ALTER TABLE death_events
        ADD COLUMN IF NOT EXISTS age_days INTEGER,
        ADD COLUMN IF NOT EXISTS maternal_death_cause TEXT,
        ADD COLUMN IF NOT EXISTS residency TEXT,
        ADD COLUMN IF NOT EXISTS is_fetal_death BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_live_born_early_neonatal BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // Theme migration: switch deployments still on the original
    // placer-brand (green) defaults to the HealthSync teal/blue palette.
    // Only updates rows that haven't been customized — manual theme
    // tweaks via the Settings UI are preserved (we match on the exact
    // factory tuple of placer-brand + 142/60/38).
    await db.execute(sql`
      UPDATE theme_settings
         SET color_scheme       = 'healthsync',
             primary_hue        = 172,
             primary_saturation = 53,
             primary_lightness  = 49
       WHERE color_scheme       = 'placer-brand'
         AND primary_hue        = 142
         AND primary_saturation = 60
         AND primary_lightness  = 38
    `);

    // HRH workforce module (Admin/MGMT) — DOH HHRDB / NHWSS aligned.
    // CREATE … IF NOT EXISTS so deployments that haven't db:push'd
    // since PR #66 still get the tables on next boot.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workforce_members (
        id                    SERIAL PRIMARY KEY,
        full_name             TEXT NOT NULL,
        profession            TEXT NOT NULL,
        prc_license_number    TEXT,
        prc_license_expiry    TEXT,
        barangay              TEXT,
        facility_type         TEXT,
        employment_status     TEXT NOT NULL,
        date_hired            TEXT,
        date_separated        TEXT,
        separation_reason     TEXT,
        contact_number        TEXT,
        email                 TEXT,
        user_id               VARCHAR,
        notes                 TEXT,
        recorded_by_user_id   VARCHAR,
        created_at            TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workforce_credentials (
        id                  SERIAL PRIMARY KEY,
        member_id           INTEGER NOT NULL REFERENCES workforce_members(id) ON DELETE CASCADE,
        credential_type     TEXT NOT NULL,
        date_obtained       TEXT NOT NULL,
        expiry_date         TEXT,
        provider            TEXT,
        notes               TEXT,
        created_at          TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE tb_patients
        ADD COLUMN IF NOT EXISTS referred_rhu_id INTEGER REFERENCES health_stations(id)
    `);
    await db.execute(sql`
      ALTER TABLE nutrition_followups
        ADD COLUMN IF NOT EXISTS referred_rhu_id INTEGER REFERENCES health_stations(id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_snapshots (
        id            SERIAL PRIMARY KEY,
        barangay      TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        item_type     TEXT NOT NULL,
        item_key      TEXT NOT NULL,
        qty           INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS inventory_snapshots_unique_idx
        ON inventory_snapshots (barangay, snapshot_date, item_type, item_key)
    `);

    // PIDSR weekly attestations (RA 11332). Schema was defined in
    // shared/schema.ts but no CREATE TABLE migration ever shipped, so
    // older deployments don't have the table — the Phase 3 scheduler's
    // pidsr-friday-cutoff job blew up with "relation does not exist."
    // Idempotent CREATE so existing data (if any) is preserved.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pidsr_submissions (
        id                    SERIAL PRIMARY KEY,
        barangay              TEXT NOT NULL,
        week_start_date       TEXT NOT NULL,
        week_end_date         TEXT NOT NULL,
        submitted_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        submitted_by_user_id  VARCHAR,
        cat2_case_count       INTEGER DEFAULT 0,
        zero_report_diseases  JSONB,
        notes                 TEXT
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS pidsr_submissions_unique_idx
        ON pidsr_submissions (barangay, week_end_date)
    `);

    // Phase 2 — unified referral records. Replaces ad-hoc TB referralToRHU
    // and postpartum trans-in/out flags with a queryable lifecycle table.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_records (
        id                  SERIAL PRIMARY KEY,
        source_facility     TEXT NOT NULL,
        source_user_id      VARCHAR,
        source_barangay     TEXT,
        target_facility     TEXT NOT NULL,
        target_user_id      VARCHAR,
        patient_id          INTEGER NOT NULL,
        patient_type        TEXT NOT NULL,
        patient_name        TEXT NOT NULL,
        reason              TEXT NOT NULL,
        notes               TEXT,
        status              TEXT NOT NULL DEFAULT 'PENDING',
        created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
        received_at         TIMESTAMP,
        completed_at        TIMESTAMP,
        received_notes      TEXT,
        completion_outcome  TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS referral_records_status_idx
        ON referral_records (status, created_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS referral_records_target_idx
        ON referral_records (target_facility, status)
    `);

    // Phase 5 — MDR / PDR death-review lifecycle. Auto-created when a
    // qualifying death_events row is inserted. 30-day DOH deadline lives
    // in due_date; the scheduler reads it for overdue / 7-day-warning alerts.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS death_reviews (
        id                      SERIAL PRIMARY KEY,
        death_event_id          INTEGER NOT NULL,
        review_type             TEXT NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'PENDING_NOTIFY',
        due_date                TEXT NOT NULL,
        notified_at             TIMESTAMP,
        review_scheduled_at     TIMESTAMP,
        reviewed_at             TIMESTAMP,
        closed_at               TIMESTAMP,
        committee_members       JSONB,
        findings                TEXT,
        recommendations         TEXT,
        barangay_name           TEXT,
        created_at              TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS death_reviews_event_idx
        ON death_reviews (death_event_id, review_type)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS death_reviews_status_due_idx
        ON death_reviews (status, due_date)
    `);

    // Idempotent backfill: every health_stations row needs a facilityType now
    // that REFER_RHU records the referred facility. Runs on every startup but
    // becomes a no-op once every row has a type.
    await db.execute(sql`
      UPDATE health_stations
      SET facility_type = CASE
        WHEN facility_name ILIKE '%rural health unit%' THEN 'RHU'
        WHEN facility_name ILIKE '%hospital%'          THEN 'HOSPITAL'
        ELSE 'BHS'
      END
      WHERE facility_type IS NULL
    `);
    // Placer's municipal RHU is a confirmed NTP TB DOTS facility; mark it so
    // the TB DOTS referral picker has at least one verified option on pre-
    // existing databases. Idempotent.
    await db.execute(sql`
      UPDATE health_stations
      SET has_tb_dots = TRUE
      WHERE facility_type = 'RHU'
        AND facility_name ILIKE '%central%poblacion%rural health unit%'
        AND has_tb_dots = FALSE
    `);
    // Backfill legacy TB referrals that were recorded before the picker
    // existed: patients with referral_to_rhu=true but referred_rhu_id=null.
    // Safe only when the municipality has exactly one verified TB DOTS RHU —
    // then there's no ambiguity about where the operator sent them. Idempotent.
    await db.execute(sql`
      UPDATE tb_patients
      SET referred_rhu_id = (SELECT id FROM health_stations
                             WHERE facility_type = 'RHU' AND has_tb_dots = TRUE)
      WHERE referral_to_rhu = TRUE
        AND referred_rhu_id IS NULL
        AND (SELECT COUNT(*) FROM health_stations
             WHERE facility_type = 'RHU' AND has_tb_dots = TRUE) = 1
    `);
    // One-shot (idempotent) backfill: mirror the newest nurse-visit BP reading
    // onto seniors.last_bp / last_bp_date. Heals records whose visits were
    // created before the POST handler started keeping the two in sync. The
    // IS DISTINCT FROM guard makes it a no-op once applied.
    await db.execute(sql`
      UPDATE seniors s
      SET last_bp = v.bp, last_bp_date = v.visit_date
      FROM (
        SELECT DISTINCT ON (senior_id)
          senior_id, blood_pressure AS bp, visit_date
        FROM senior_visits
        WHERE blood_pressure IS NOT NULL AND blood_pressure <> ''
        ORDER BY senior_id, visit_date DESC
      ) v
      WHERE s.id = v.senior_id
        AND (s.last_bp_date IS NULL OR v.visit_date >= s.last_bp_date)
        AND (s.last_bp IS DISTINCT FROM v.bp
             OR s.last_bp_date IS DISTINCT FROM v.visit_date)
    `);

    // Auto-migrate the active theme from the old "healthcare-green" default to
    // Placer's Green/Gold/Blue brand. Only touches rows still on the exact
    // prior default HSL — a user who explicitly picked any other scheme (or
    // tuned the sliders) keeps their pick.
    await db.execute(sql`
      UPDATE theme_settings
      SET color_scheme = 'placer-brand',
          primary_hue = 142,
          primary_saturation = 60,
          primary_lightness = 38
      WHERE color_scheme = 'healthcare-green'
        AND primary_hue = 152
        AND primary_saturation = 60
        AND primary_lightness = 40
    `);

    // M1 catalog rows for Phase 1 (Maternal expansion) and Phase 2 (Child
    // health extras). Idempotent: insert one row per (template_version_id,
    // row_key) only if not already present.
    // Source of truth is docs/m1-data-source-audit.md.
    await this.seedM1SectionCRows();
    await this.seedM1MaternalRows();
    await this.seedM1ChildHealthRows();
    await this.seedM1OralHealthRows();
    await this.seedM1NcdRows();
    await this.seedM1DiseaseRows();
    await this.seedM1MortalityRows();
    await this.seedM1WaterRows();

    // Demo data for the MGMT-consolidated operational pages. Runs every
    // boot — each table inside is itself idempotent (skips when non-empty),
    // and we deliberately call it BEFORE the existingMothers early-return
    // because seedMgmtConsolidatedDemo doesn't depend on the patient seed.
    // Putting it after that return meant it only ran on the very first
    // boot of a fresh database and got skipped on every subsequent run.
    await this.seedMgmtConsolidatedDemo();

    const existingMothers = await this.getMothers();
    if (existingMothers.length > 0) return;

    console.log("Seeding database with comprehensive demo data...");

    // BARANGAYS - Seed the barangays table first
    const barangayNames = [
      "Amoslog",
      "Anislagan",
      "Bad-as",
      "Boyongan",
      "Bugas-bugas",
      "Central (Poblacion)",
      "Ellaperal (Nonok)",
      "Ipil (Poblacion)",
      "Lakandula",
      "Mabini",
      "Macalaya",
      "Magsaysay (Poblacion)",
      "Magupange",
      "Pananay-an",
      "Panhutongan",
      "San Isidro",
      "Sani-sani",
      "Santa Cruz",
      "Suyoc",
      "Tagbongabong"
    ];
    const existingBarangays = await db.select().from(barangays);
    if (existingBarangays.length === 0) {
      await db.insert(barangays).values(barangayNames.map(name => ({ name })));
      console.log("Seeded barangays table");
    }

    // MUNICIPALITY SETTINGS - Seed default municipality settings
    const existingMuniSettings = await db.select().from(municipalitySettings);
    if (existingMuniSettings.length === 0) {
      await db.insert(municipalitySettings).values({
        municipalityId: 1,
        municipalityName: "Placer Municipality",
        subtitle: "Province of Surigao del Norte",
        logoUrl: null,
        updatedAt: new Date().toISOString(),
      });
      console.log("Seeded municipality settings");
    }

    // MOTHERS - with detailed profile fields
    const mothersData = await db.insert(mothers).values([
      { 
        firstName: "Maria", lastName: "Santos", age: 28,
        barangay: "Bugas-bugas", addressLine: "Purok 3, Sitio Mabuhay",
        phone: "09171234567", registrationDate: "2024-10-15", gaWeeks: 24,
        nextPrenatalCheckDate: "2025-12-28",
        tt1Date: "2024-11-01", tt2Date: null, tt3Date: null
      },
      { 
        firstName: "Elena", lastName: "Cruz", age: 32,
        barangay: "San Isidro", addressLine: "Purok 1",
        phone: "09181234567", registrationDate: "2024-08-20", gaWeeks: 32,
        nextPrenatalCheckDate: "2025-12-24",
        tt1Date: "2024-09-01", tt2Date: "2024-10-01", tt3Date: null
      },
      { 
        firstName: "Juana", lastName: "Dela Paz", age: 22,
        barangay: "Central (Poblacion)", addressLine: "Purok 5, Centro",
        phone: "09191234567", registrationDate: "2024-12-01", gaWeeks: 12,
        nextPrenatalCheckDate: "2025-12-20", // Overdue
        tt1Date: null, tt2Date: null, tt3Date: null
      },
      { 
        firstName: "Sarah", lastName: "Geronimo", age: 26,
        barangay: "Mabini", addressLine: "Sitio Riverside",
        phone: "09201234567", registrationDate: "2024-10-01", gaWeeks: 28,
        nextPrenatalCheckDate: "2025-12-30",
        tt1Date: "2024-10-15", tt2Date: null, tt3Date: null // TT2 overdue
      },
      { 
        firstName: "Luz", lastName: "Villareal", age: 30,
        barangay: "Lakandula", addressLine: "Purok 2",
        phone: "09211234567", registrationDate: "2024-07-15", gaWeeks: 36,
        nextPrenatalCheckDate: "2025-12-26",
        tt1Date: "2024-08-01", tt2Date: "2024-09-01", tt3Date: null
      },
    ]).returning();

    // CHILDREN - linked to mothers
    await db.insert(children).values([
      { 
        name: "Baby Boy Santos", 
        barangay: "Bugas-bugas", addressLine: "Purok 3, Sitio Mabuhay",
        dob: "2025-10-22", // 2 months old
        motherId: mothersData[0].id,
        nextVisitDate: "2025-12-28",
        vaccines: { bcg: "2025-10-23", hepB: "2025-10-23" },
        growth: [{ date: "2025-10-23", weightKg: 3.2 }, { date: "2025-11-22", weightKg: 4.5 }]
      },
      { 
        name: "Baby Girl Cruz", 
        barangay: "San Isidro", addressLine: "Purok 1",
        dob: "2025-09-22", // 3 months old
        motherId: mothersData[1].id,
        nextVisitDate: "2025-12-24",
        vaccines: { bcg: "2025-09-23", hepB: "2025-09-23", penta1: "2025-11-22", opv1: "2025-11-22" },
        growth: [{ date: "2025-09-23", weightKg: 3.0 }, { date: "2025-10-22", weightKg: 4.2 }, { date: "2025-11-22", weightKg: 5.0 }]
      },
      { 
        name: "John Dela Cruz Jr", 
        barangay: "Central (Poblacion)", addressLine: "Purok 5, Centro",
        dob: "2025-01-15", // ~11 months
        motherId: null,
        nextVisitDate: "2025-12-20", // Overdue visit
        vaccines: { bcg: "2025-01-16", hepB: "2025-01-16", penta1: "2025-03-15", opv1: "2025-03-15", penta2: "2025-05-15", opv2: "2025-05-15", penta3: "2025-07-15", opv3: "2025-07-15" },
        growth: [{ date: "2025-09-15", weightKg: 6.8 }] // Missing recent growth - underweight risk
      },
      { 
        name: "Maria Angela Reyes", 
        barangay: "Mabini", addressLine: "Sitio Riverside",
        dob: "2025-06-01", // ~7 months
        motherId: null,
        nextVisitDate: "2025-12-29",
        vaccines: { bcg: "2025-06-02", hepB: "2025-06-02", penta1: "2025-08-01", opv1: "2025-08-01", penta2: "2025-10-01", opv2: "2025-10-01" },
        growth: [{ date: "2025-10-01", weightKg: 5.5 }, { date: "2025-11-01", weightKg: 6.2 }]
      },
    ]);

    // SENIORS - with medication details
    await db.insert(seniors).values([
      { 
        firstName: "Pedro", lastName: "Garcia", age: 72,
        barangay: "Bugas-bugas", addressLine: "Purok 1",
        phone: "09170000001",
        lastBP: "140/90", lastBPDate: "2025-12-01",
        lastMedicationName: "Amlodipine", lastMedicationDoseMg: 5, lastMedicationQuantity: 30,
        lastMedicationGivenDate: "2025-11-20",
        nextPickupDate: "2025-12-20", // Today - due
        htnMedsReady: true, pickedUp: false
      },
      { 
        firstName: "Rosa", lastName: "Mendoza", age: 68,
        barangay: "San Isidro", addressLine: "Purok 2",
        phone: "09170000002",
        lastBP: "120/80", lastBPDate: "2025-12-15",
        lastMedicationName: "Losartan", lastMedicationDoseMg: 50, lastMedicationQuantity: 30,
        lastMedicationGivenDate: "2025-12-15",
        nextPickupDate: "2026-01-15",
        htnMedsReady: false, pickedUp: true
      },
      { 
        firstName: "Ricardo", lastName: "Bautista", age: 75,
        barangay: "Central (Poblacion)", addressLine: "Centro",
        phone: "09170000003",
        lastBP: "150/95", lastBPDate: "2025-11-20",
        lastMedicationName: "Amlodipine", lastMedicationDoseMg: 10, lastMedicationQuantity: 30,
        lastMedicationGivenDate: "2025-11-10",
        nextPickupDate: "2025-12-10", // Overdue
        htnMedsReady: true, pickedUp: false
      },
      { 
        firstName: "Carmen", lastName: "Villanueva", age: 70,
        barangay: "Lakandula", addressLine: "Purok 3",
        phone: "09170000004",
        lastBP: "135/85", lastBPDate: "2025-12-18",
        lastMedicationName: "Metoprolol", lastMedicationDoseMg: 25, lastMedicationQuantity: 30,
        lastMedicationGivenDate: "2025-12-01",
        nextPickupDate: "2025-12-25",
        htnMedsReady: true, pickedUp: false
      },
    ]);

    // INVENTORY - per barangay with vaccines and HTN meds
    await db.insert(inventory).values([
      { 
        barangay: "Bugas-bugas",
        vaccines: { bcgQty: 25, hepBQty: 30, pentaQty: 8, opvQty: 20, mrQty: 15 },
        htnMeds: [
          { name: "Amlodipine", doseMg: 5, qty: 120 },
          { name: "Losartan", doseMg: 50, qty: 60 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-20"
      },
      { 
        barangay: "San Isidro",
        vaccines: { bcgQty: 0, hepBQty: 5, pentaQty: 0, opvQty: 12, mrQty: 8 },
        htnMeds: [
          { name: "Losartan", doseMg: 50, qty: 0 },
          { name: "Amlodipine", doseMg: 10, qty: 30 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-18"
      },
      { 
        barangay: "Central (Poblacion)",
        vaccines: { bcgQty: 50, hepBQty: 45, pentaQty: 40, opvQty: 35, mrQty: 30 },
        htnMeds: [
          { name: "Amlodipine", doseMg: 5, qty: 200 },
          { name: "Amlodipine", doseMg: 10, qty: 150 },
          { name: "Losartan", doseMg: 50, qty: 180 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-21"
      },
      { 
        barangay: "Mabini",
        vaccines: { bcgQty: 18, hepBQty: 22, pentaQty: 15, opvQty: 20, mrQty: 12 },
        htnMeds: [
          { name: "Metoprolol", doseMg: 25, qty: 45 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-19"
      },
      { 
        barangay: "Lakandula",
        vaccines: { bcgQty: 12, hepBQty: 15, pentaQty: 10, opvQty: 8, mrQty: 5 },
        htnMeds: [
          { name: "Amlodipine", doseMg: 5, qty: 25 },
          { name: "Metoprolol", doseMg: 25, qty: 8 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-20"
      },
    ]);

    // HEALTH STATIONS — `hasTbDots` flags facilities the MHO has confirmed as
    // active NTP TB DOTS providers. Placer has one municipal RHU (Central /
    // Poblacion), which is the verified TB DOTS facility for the municipality.
    await db.insert(healthStations).values([
      { facilityName: "Bugas-bugas Barangay Health Station", facilityType: "BHS", hasTbDots: false, barangay: "Bugas-bugas", latitude: "9.6450", longitude: "125.6520" },
      { facilityName: "San Isidro Barangay Health Station", facilityType: "BHS", hasTbDots: false, barangay: "San Isidro", latitude: "9.6520", longitude: "125.6680" },
      { facilityName: "Central (Poblacion) Rural Health Unit", facilityType: "RHU", hasTbDots: true, barangay: "Central (Poblacion)", latitude: "9.6600", longitude: "125.6850" },
      { facilityName: "Mabini Barangay Health Station", facilityType: "BHS", hasTbDots: false, barangay: "Mabini", latitude: "9.6380", longitude: "125.6400" },
      { facilityName: "Lakandula Barangay Health Station", facilityType: "BHS", hasTbDots: false, barangay: "Lakandula", latitude: "9.6700", longitude: "125.6950" },
    ]);

    // DISEASE CASES - Communicable Disease Surveillance
    await db.insert(diseaseCases).values([
      {
        patientName: "Juan Dela Cruz",
        age: 5, barangay: "Bugas-bugas", addressLine: "Purok 2",
        phone: "09171111111",
        condition: "Chickenpox",
        dateReported: "2025-12-18",
        status: "New",
        notes: "Multiple lesions observed",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Ana Reyes",
        age: 3, barangay: "Bugas-bugas", addressLine: "Purok 3",
        phone: "09172222222",
        condition: "Chickenpox",
        dateReported: "2025-12-19",
        status: "Monitoring",
        notes: "Contact of index case",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Carlo Santos",
        age: 6, barangay: "Bugas-bugas", addressLine: "Purok 2",
        phone: "09173333333",
        condition: "Chickenpox",
        dateReported: "2025-12-20",
        status: "New",
        notes: "School outbreak contact",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Baby Girl Cruz",
        age: 0, barangay: "San Isidro", addressLine: "Purok 1",
        phone: "09181234567",
        condition: "Diarrhea",
        dateReported: "2025-12-15",
        status: "Monitoring",
        notes: "ORS provided, monitoring hydration",
        linkedPersonType: "Child", linkedPersonId: 2
      },
      {
        patientName: "Pedro Aquino",
        age: 45, barangay: "Central (Poblacion)", addressLine: "Centro",
        phone: "09184444444",
        condition: "Dengue suspected",
        dateReported: "2025-12-10",
        status: "Referred",
        notes: "Referred to RHU for confirmatory test",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Maria Lourdes",
        age: 28, barangay: "Mabini", addressLine: "Sitio Riverside",
        phone: "09185555555",
        condition: "ARI",
        dateReported: "2025-12-21",
        status: "New",
        notes: "Cough and cold symptoms",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Jose Rizal Jr",
        age: 2, barangay: "Lakandula", addressLine: "Purok 1",
        phone: null,
        condition: "Measles suspected",
        dateReported: "2025-12-08",
        status: "New",
        notes: "Rash and fever, needs follow-up",
        linkedPersonType: null, linkedPersonId: null
      },
    ]);

    // TB PATIENTS - DOTS Program
    await db.insert(tbPatients).values([
      {
        firstName: "Antonio", lastName: "Fernandez", age: 52,
        barangay: "Bugas-bugas", addressLine: "Purok 4",
        phone: "09176666666",
        tbType: "Pulmonary",
        treatmentPhase: "Intensive",
        treatmentStartDate: "2025-11-01",
        lastObservedDoseDate: "2025-12-20",
        nextDotsVisitDate: "2025-12-21",
        missedDosesCount: 1,
        medsRegimenName: "Fixed-dose combination (2HRZE)",
        referralToRHU: false,
        nextSputumCheckDate: "2025-12-28",
        outcomeStatus: "Ongoing"
      },
      {
        firstName: "Belen", lastName: "Magsaysay", age: 38,
        barangay: "San Isidro", addressLine: "Purok 2",
        phone: "09177777777",
        tbType: "Pulmonary",
        treatmentPhase: "Continuation",
        treatmentStartDate: "2025-08-15",
        lastObservedDoseDate: "2025-12-18",
        nextDotsVisitDate: "2025-12-25",
        missedDosesCount: 0,
        medsRegimenName: "Fixed-dose combination (4HR)",
        referralToRHU: false,
        nextSputumCheckDate: "2026-01-15",
        outcomeStatus: "Ongoing"
      },
      {
        firstName: "Crisanto", lastName: "Reyes", age: 65,
        barangay: "Central (Poblacion)", addressLine: "Centro",
        phone: "09178888888",
        tbType: "Pulmonary",
        treatmentPhase: "Intensive",
        treatmentStartDate: "2025-10-15",
        lastObservedDoseDate: "2025-12-15",
        nextDotsVisitDate: "2025-12-16",
        missedDosesCount: 5,
        medsRegimenName: "Fixed-dose combination (2HRZE)",
        referralToRHU: true,
        nextSputumCheckDate: "2025-12-20",
        outcomeStatus: "Ongoing"
      },
      {
        firstName: "Dolores", lastName: "Cruz", age: 44,
        barangay: "Mabini", addressLine: "Sitio Hilltop",
        phone: "09179999999",
        tbType: "Extra-pulmonary",
        treatmentPhase: "Intensive",
        treatmentStartDate: "2025-11-20",
        lastObservedDoseDate: "2025-12-21",
        nextDotsVisitDate: "2025-12-22",
        missedDosesCount: 0,
        medsRegimenName: "Fixed-dose combination (2HRZE)",
        referralToRHU: false,
        nextSputumCheckDate: null,
        outcomeStatus: "Ongoing"
      },
      {
        firstName: "Eduardo", lastName: "Villanueva", age: 58,
        barangay: "Lakandula", addressLine: "Purok 3",
        phone: "09170001111",
        tbType: "Pulmonary",
        treatmentPhase: "Continuation",
        treatmentStartDate: "2025-06-01",
        lastObservedDoseDate: "2025-12-10",
        nextDotsVisitDate: "2025-12-17",
        missedDosesCount: 3,
        medsRegimenName: "Fixed-dose combination (4HR)",
        referralToRHU: false,
        nextSputumCheckDate: "2025-12-22",
        outcomeStatus: "Ongoing"
      },
    ]);

    // THEME SETTINGS - Default LGU branding (HealthSync teal+blue palette).
    // The lguName / lguSubtitle still reflect the LGU; they're surfaced
    // inside the app post-login. Login page uses the HealthSync brand
    // verbatim (see landing.tsx).
    await db.insert(themeSettings).values([
      {
        lguName: "Placer Municipality",
        lguSubtitle: "Province of Surigao del Norte",
        logoUrl: null,
        colorScheme: "healthsync",
        primaryHue: 172,
        primarySaturation: 53,
        primaryLightness: 49,
      }
    ]);

    console.log("Database seeded successfully!");
  }

  /**
   * Demo data for MGMT-consolidated views (mortality, household water, oral
   * health visits, school immunizations). Each table gets 2 rows in each of
   * 6 representative barangays — enough to populate the read-only consolidated
   * registry pages an admin / MHO / SHA sees.
   *
   * Idempotent per-table: if a table already has any rows, the seed for that
   * table is skipped. Safe to re-run on every boot.
   */
  async seedMgmtConsolidatedDemo(): Promise<void> {
    const seedBarangays = ["Amoslog", "Anislagan", "Bayboy", "Central (Poblacion)", "Mabini", "Pananay-an"];
    const today = new Date();
    const isoOffset = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    };

    // 1) Mortality
    const existingDeaths = await db.execute(sql`SELECT COUNT(*)::int AS n FROM death_events`);
    const deathCount = Number(((existingDeaths as any).rows ?? existingDeaths)[0]?.n ?? 0);
    if (deathCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          deceasedName: `Deceased Resident ${i + 1}A`, sex: i % 2 === 0 ? "M" : "F",
          age: 60 + i * 3, ageDays: null, dateOfDeath: isoOffset(20 + i * 3),
          causeOfDeath: i % 2 === 0 ? "Hypertension" : "Pneumonia",
          barangay: b, residency: "RESIDENT", isFetalDeath: false, isLiveBornEarlyNeonatal: false,
          createdAt: new Date().toISOString(),
        });
        rows.push({
          deceasedName: `Deceased Resident ${i + 1}B`, sex: i % 2 === 0 ? "F" : "M",
          age: i === 0 ? 0 : 50 + i, ageDays: i === 0 ? 5 : null, dateOfDeath: isoOffset(45 + i * 4),
          causeOfDeath: i === 0 ? "Sepsis (neonatal)" : "Cerebrovascular accident",
          barangay: b, residency: "RESIDENT",
          isFetalDeath: false, isLiveBornEarlyNeonatal: i === 0,
          createdAt: new Date().toISOString(),
        });
      });
      await db.insert(deathEvents).values(rows);
      console.log(`[seed] death_events: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 2) Household water
    const existingWater = await db.execute(sql`SELECT COUNT(*)::int AS n FROM household_water_records`);
    const waterCount = Number(((existingWater as any).rows ?? existingWater)[0]?.n ?? 0);
    if (waterCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          barangay: b, surveyDate: isoOffset(15 + i * 2),
          householdId: `HH-${b.slice(0, 4).toUpperCase()}-001`,
          householdHead: `Household Head ${i + 1}`,
          waterLevel: i < 2 ? "III" : i < 4 ? "II" : "I",
          safelyManaged: i < 3, notes: null,
        });
        rows.push({
          barangay: b, surveyDate: isoOffset(35 + i * 3),
          householdId: `HH-${b.slice(0, 4).toUpperCase()}-002`,
          householdHead: `Household Head ${i + 1}-B`,
          waterLevel: i < 3 ? "II" : "I",
          safelyManaged: i < 2, notes: null,
        });
      });
      await db.insert(householdWaterRecords).values(rows);
      console.log(`[seed] household_water_records: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 3) Oral health visits
    const existingOral = await db.execute(sql`SELECT COUNT(*)::int AS n FROM oral_health_visits`);
    const oralCount = Number(((existingOral as any).rows ?? existingOral)[0]?.n ?? 0);
    if (oralCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Patient ${i + 1}A`, barangay: b,
          dob: `${1990 + i}-${String((i % 12) + 1).padStart(2, "0")}-15`,
          sex: i % 2 === 0 ? "M" : "F",
          visitDate: isoOffset(10 + i * 2),
          isFirstVisit: true, facilityBased: true, isPregnant: false,
        });
        rows.push({
          patientName: `Patient ${i + 1}B`, barangay: b,
          dob: `${1985 + i}-${String(((i + 3) % 12) + 1).padStart(2, "0")}-22`,
          sex: i % 2 === 0 ? "F" : "M",
          visitDate: isoOffset(25 + i * 3),
          isFirstVisit: i % 2 === 0, facilityBased: i < 4, isPregnant: i === 0,
        });
      });
      await db.insert(oralHealthVisits).values(rows);
      console.log(`[seed] oral_health_visits: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 4) School immunizations (HPV / Td)
    const existingSchool = await db.execute(sql`SELECT COUNT(*)::int AS n FROM school_immunizations`);
    const schoolCount = Number(((existingSchool as any).rows ?? existingSchool)[0]?.n ?? 0);
    if (schoolCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          learnerName: `Learner ${i + 1}A`, barangay: b,
          schoolName: `${b} Elementary School`,
          gradeLevel: 1, dob: `2018-${String((i % 12) + 1).padStart(2, "0")}-08`,
          sex: i % 2 === 0 ? "F" : "M",
          vaccine: "Td", doseNumber: 1,
          vaccinationDate: isoOffset(30 + i * 2),
        });
        rows.push({
          learnerName: `Learner ${i + 1}B`, barangay: b,
          schoolName: `${b} Elementary School`,
          gradeLevel: 4, dob: `2015-${String(((i + 5) % 12) + 1).padStart(2, "0")}-12`,
          sex: "F",
          vaccine: "HPV", doseNumber: 1,
          vaccinationDate: isoOffset(40 + i * 3),
        });
      });
      await db.insert(schoolImmunizations).values(rows);
      console.log(`[seed] school_immunizations: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 5) Cold-chain logs (vaccine refrigerator AM/PM readings)
    const existingCc = await db.execute(sql`SELECT COUNT(*)::int AS n FROM cold_chain_logs`);
    const ccCount = Number(((existingCc as any).rows ?? existingCc)[0]?.n ?? 0);
    if (ccCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        // AM + PM reading on a recent date — temp drift slightly across barangays.
        const date = isoOffset(2 + i);
        rows.push({
          barangay: b, readingDate: date, readingPeriod: "AM",
          tempCelsius: 2.6 + (i % 3) * 0.4, vvmStatus: "OK", notes: null,
        });
        rows.push({
          barangay: b, readingDate: date, readingPeriod: "PM",
          tempCelsius: 4.1 + (i % 3) * 0.3, vvmStatus: i === 5 ? "STAGE_2" : "OK",
          notes: i === 5 ? "VVM stage 2 noted on Penta Vial #4" : null,
        });
      });
      await db.insert(coldChainLogs).values(rows);
      console.log(`[seed] cold_chain_logs: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 6) PhilPEN risk assessments (G1)
    const existingPp = await db.execute(sql`SELECT COUNT(*)::int AS n FROM philpen_assessments`);
    const ppCount = Number(((existingPp as any).rows ?? existingPp)[0]?.n ?? 0);
    if (ppCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Adult ${i + 1}A`, barangay: b,
          dob: `${1975 + i}-04-15`, sex: i % 2 === 0 ? "M" : "F",
          assessmentDate: isoOffset(8 + i * 2),
          smokingHistory: i < 3, bingeDrinker: i < 2,
          insufficientActivity: i < 4, unhealthyDiet: i < 4,
          bmiCategory: i < 2 ? "OBESE" : i < 4 ? "OVERWEIGHT" : "NORMAL",
          notes: null,
        });
        rows.push({
          patientName: `Adult ${i + 1}B`, barangay: b,
          dob: `${1968 + i}-09-22`, sex: i % 2 === 0 ? "F" : "M",
          assessmentDate: isoOffset(22 + i * 3),
          smokingHistory: false, bingeDrinker: false,
          insufficientActivity: i % 2 === 0, unhealthyDiet: i % 2 === 0,
          bmiCategory: i < 3 ? "NORMAL" : "OVERWEIGHT", notes: null,
        });
      });
      await db.insert(philpenAssessments).values(rows);
      console.log(`[seed] philpen_assessments: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 7) NCD screenings (G2 — HTN/DM)
    const existingNcd = await db.execute(sql`SELECT COUNT(*)::int AS n FROM ncd_screenings`);
    const ncdCount = Number(((existingNcd as any).rows ?? existingNcd)[0]?.n ?? 0);
    if (ncdCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Adult ${i + 1}A`, barangay: b,
          dob: `${1975 + i}-04-15`, sex: i % 2 === 0 ? "M" : "F",
          screenDate: isoOffset(9 + i * 2), condition: "HTN",
          diagnosed: i < 3, medsProvided: i < 3,
          medsSource: i < 3 ? "FACILITY" : null, notes: null,
        });
        rows.push({
          patientName: `Adult ${i + 1}C`, barangay: b,
          dob: `${1972 + i}-12-03`, sex: i % 2 === 0 ? "F" : "M",
          screenDate: isoOffset(28 + i * 2), condition: "DM",
          diagnosed: i < 2, medsProvided: i < 2,
          medsSource: i === 0 ? "FACILITY" : i === 1 ? "OUT_OF_POCKET" : null, notes: null,
        });
      });
      await db.insert(ncdScreenings).values(rows);
      console.log(`[seed] ncd_screenings: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 8) Vision screenings (G4 — 60+)
    const existingVision = await db.execute(sql`SELECT COUNT(*)::int AS n FROM vision_screenings`);
    const visionCount = Number(((existingVision as any).rows ?? existingVision)[0]?.n ?? 0);
    if (visionCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Senior ${i + 1}A`, barangay: b,
          dob: `${1955 + i}-06-12`, sex: i % 2 === 0 ? "M" : "F",
          screenDate: isoOffset(11 + i * 2),
          eyeDiseaseFound: i % 3 === 0, referredToEyeCare: i % 3 === 0, notes: null,
        });
        rows.push({
          patientName: `Senior ${i + 1}B`, barangay: b,
          dob: `${1950 + i}-11-30`, sex: i % 2 === 0 ? "F" : "M",
          screenDate: isoOffset(33 + i * 2),
          eyeDiseaseFound: i === 1, referredToEyeCare: i === 1, notes: null,
        });
      });
      await db.insert(visionScreenings).values(rows);
      console.log(`[seed] vision_screenings: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 9) Cervical cancer screenings (G6 — women 30-65)
    const existingCx = await db.execute(sql`SELECT COUNT(*)::int AS n FROM cervical_cancer_screenings`);
    const cxCount = Number(((existingCx as any).rows ?? existingCx)[0]?.n ?? 0);
    if (cxCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Woman ${i + 1}A`, barangay: b,
          dob: `${1980 + i}-02-18`, screenDate: isoOffset(14 + i * 2),
          screenMethod: "VIA",
          suspicious: i === 1, linkedToCare: i === 1,
          linkedOutcome: i === 1 ? "REFERRED" : null,
          precancerous: i === 2, precancerousOutcome: i === 2 ? "TREATED" : null,
          notes: null,
        });
        rows.push({
          patientName: `Woman ${i + 1}B`, barangay: b,
          dob: `${1975 + i}-08-05`, screenDate: isoOffset(36 + i * 2),
          screenMethod: i % 2 === 0 ? "PAP_SMEAR" : "HPV_TEST",
          suspicious: false, linkedToCare: false, linkedOutcome: null,
          precancerous: false, precancerousOutcome: null, notes: null,
        });
      });
      await db.insert(cervicalCancerScreenings).values(rows);
      console.log(`[seed] cervical_cancer_screenings: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 10) Mental health screenings (G8 — mhGAP)
    const existingMh = await db.execute(sql`SELECT COUNT(*)::int AS n FROM mental_health_screenings`);
    const mhCount = Number(((existingMh as any).rows ?? existingMh)[0]?.n ?? 0);
    if (mhCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Adult ${i + 1}D`, barangay: b,
          dob: `${1985 + i}-05-21`, sex: i % 2 === 0 ? "M" : "F",
          screenDate: isoOffset(13 + i * 2), tool: "mhGAP",
          positive: i === 0 || i === 4, notes: null,
        });
        rows.push({
          patientName: `Adult ${i + 1}E`, barangay: b,
          dob: `${1990 + i}-01-09`, sex: i % 2 === 0 ? "F" : "M",
          screenDate: isoOffset(38 + i * 2), tool: "mhGAP",
          positive: false, notes: null,
        });
      });
      await db.insert(mentalHealthScreenings).values(rows);
      console.log(`[seed] mental_health_screenings: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 11) Filariasis surveillance
    const existingFil = await db.execute(sql`SELECT COUNT(*)::int AS n FROM filariasis_records`);
    const filCount = Number(((existingFil as any).rows ?? existingFil)[0]?.n ?? 0);
    if (filCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Resident ${i + 1}A`, barangay: b,
          dob: `${1970 + i}-07-12`, sex: i % 2 === 0 ? "M" : "F",
          examDate: isoOffset(18 + i * 2),
          result: i === 2 ? "POSITIVE" : "NEGATIVE",
          manifestation: i === 2 ? "LYMPHEDEMA" : "NONE", notes: null,
        });
      });
      await db.insert(filariasisRecords).values(rows);
      console.log(`[seed] filariasis_records: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 12) Rabies exposures
    const existingRab = await db.execute(sql`SELECT COUNT(*)::int AS n FROM rabies_exposures`);
    const rabCount = Number(((existingRab as any).rows ?? existingRab)[0]?.n ?? 0);
    if (rabCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Resident ${i + 1}B`, barangay: b,
          dob: `${2000 + i}-03-18`, sex: i % 2 === 0 ? "M" : "F",
          exposureDate: isoOffset(6 + i),
          category: i < 2 ? "II" : i < 4 ? "III" : "I",
          treatmentCenter: i < 4 ? "ABTC" : "NON_ABTC",
          completeDoses: i < 3, notes: i === 3 ? "Stray dog bite, RHU referral" : null,
        });
      });
      await db.insert(rabiesExposures).values(rows);
      console.log(`[seed] rabies_exposures: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 13) Schistosomiasis surveillance
    const existingSchisto = await db.execute(sql`SELECT COUNT(*)::int AS n FROM schistosomiasis_records`);
    const schistoCount = Number(((existingSchisto as any).rows ?? existingSchisto)[0]?.n ?? 0);
    if (schistoCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Resident ${i + 1}C`, barangay: b,
          dob: `${1995 + i}-10-04`, sex: i % 2 === 0 ? "M" : "F",
          seenDate: isoOffset(20 + i * 2),
          suspected: i < 3, treated: i < 2,
          confirmed: i === 0, complicated: false, notes: null,
        });
      });
      await db.insert(schistosomiasisRecords).values(rows);
      console.log(`[seed] schistosomiasis_records: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 14) STH (Soil-Transmitted Helminthiasis) — schoolchild deworming
    const existingSth = await db.execute(sql`SELECT COUNT(*)::int AS n FROM sth_records`);
    const sthCount = Number(((existingSth as any).rows ?? existingSth)[0]?.n ?? 0);
    if (sthCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Schoolchild ${i + 1}A`, barangay: b,
          dob: `${2014 + (i % 4)}-06-15`, sex: i % 2 === 0 ? "M" : "F",
          screenDate: isoOffset(24 + i * 2),
          confirmed: i === 1, residency: "RESIDENT", notes: null,
        });
      });
      await db.insert(sthRecords).values(rows);
      console.log(`[seed] sth_records: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }

    // 15) Leprosy registry
    const existingLep = await db.execute(sql`SELECT COUNT(*)::int AS n FROM leprosy_records`);
    const lepCount = Number(((existingLep as any).rows ?? existingLep)[0]?.n ?? 0);
    if (lepCount === 0) {
      const rows: any[] = [];
      seedBarangays.forEach((b, i) => {
        rows.push({
          patientName: `Resident ${i + 1}D`, barangay: b,
          dob: `${1965 + i}-04-29`, sex: i % 2 === 0 ? "M" : "F",
          registeredDate: isoOffset(60 + i * 5),
          newCase: i < 2, confirmed: i < 3, notes: null,
        });
      });
      await db.insert(leprosyRecords).values(rows);
      console.log(`[seed] leprosy_records: inserted ${rows.length} demo rows across ${seedBarangays.length} barangays`);
    }
  }

  // Seed historical M1 report data for all barangays from 2020 to 2025
  async seedHistoricalM1Data(): Promise<{ reportsCreated: number; valuesCreated: number }> {
    console.log("Seeding historical M1 data for all barangays (2020-2025)...");
    
    const allBarangays = await this.getBarangays();
    const templates = await this.getM1TemplateVersions();
    const activeTemplate = templates.find(t => t.isActive) || templates[0];
    
    if (!activeTemplate) {
      throw new Error("No M1 template found");
    }
    
    let reportsCreated = 0;
    let valuesCreated = 0;
    
    // Key health indicators with realistic data patterns
    const healthIndicators = [
      // Prenatal indicators
      { rowKey: "A-01a", columns: ["10-14", "15-19", "20-49", "TOTAL"], category: "prenatal" },
      { rowKey: "A-01b", columns: ["10-14", "15-19", "20-49", "TOTAL"], category: "prenatal" },
      { rowKey: "A-02a", columns: ["10-14", "15-19", "20-49", "TOTAL"], category: "prenatal" },
      { rowKey: "A-03", columns: ["10-14", "15-19", "20-49", "TOTAL"], category: "prenatal" },
      { rowKey: "A-04", columns: ["10-14", "15-19", "20-49", "TOTAL"], category: "prenatal" },
      // Immunization indicators
      { rowKey: "D2-01", columns: ["M", "F", "TOTAL"], category: "immunization" },
      { rowKey: "D2-02", columns: ["M", "F", "TOTAL"], category: "immunization" },
      { rowKey: "D2-03", columns: ["M", "F", "TOTAL"], category: "immunization" },
      { rowKey: "D2-04", columns: ["M", "F", "TOTAL"], category: "immunization" },
      { rowKey: "D2-05", columns: ["M", "F", "TOTAL"], category: "immunization" },
      // Nutrition indicators
      { rowKey: "E-01", columns: ["M", "F", "TOTAL"], category: "nutrition" },
      { rowKey: "E-02", columns: ["M", "F", "TOTAL"], category: "nutrition" },
      { rowKey: "E-03", columns: ["M", "F", "TOTAL"], category: "nutrition" },
      // NCD / Hypertension
      { rowKey: "G1-01", columns: ["M", "F", "TOTAL"], category: "ncd" },
      { rowKey: "G1-02", columns: ["M", "F", "TOTAL"], category: "ncd" },
      { rowKey: "G2-01", columns: ["M", "F", "TOTAL"], category: "ncd" },
      { rowKey: "G2-02", columns: ["M", "F", "TOTAL"], category: "ncd" },
      // Disease Surveillance
      { rowKey: "I-01", columns: ["M", "F", "TOTAL"], category: "disease" },
      { rowKey: "I-02", columns: ["M", "F", "TOTAL"], category: "disease" },
      { rowKey: "I-03", columns: ["M", "F", "TOTAL"], category: "disease" },
    ];
    
    // Generate data for each year and month
    for (const barangay of allBarangays) {
      // Base values vary by barangay size (some bigger, some smaller)
      const barangayFactor = 0.5 + Math.random() * 1.5; // 0.5 to 2.0
      
      for (let year = 2020; year <= 2025; year++) {
        // Yearly trend factor (gradual improvement over time)
        const yearFactor = 1 + (year - 2020) * 0.08; // 8% improvement per year
        
        const maxMonth = year === 2025 ? 12 : 12; // All months for historical
        for (let month = 1; month <= maxMonth; month++) {
          // Check if report exists
          const existingReports = await this.getM1ReportInstances({ 
            barangayId: barangay.id, 
            month, 
            year 
          });
          
          if (existingReports.length > 0) continue; // Skip if exists
          
          // Seasonal factor (more cases in rainy/flu season)
          const seasonalFactor = month >= 6 && month <= 10 ? 1.2 : 1.0;
          
          // Create report instance
          const report = await this.createM1ReportInstance({
            templateVersionId: activeTemplate.id,
            scopeType: "BARANGAY",
            barangayId: barangay.id,
            barangayName: barangay.name,
            month,
            year,
            createdByUserId: null,
          });
          reportsCreated++;
          
          // Generate indicator values
          const values: any[] = [];
          
          for (const indicator of healthIndicators) {
            // Base value depends on category
            let baseValue = 0;
            switch (indicator.category) {
              case "prenatal":
                baseValue = Math.round(3 + Math.random() * 8); // 3-11 per age group
                break;
              case "immunization":
                baseValue = Math.round(5 + Math.random() * 15); // 5-20 per sex
                break;
              case "nutrition":
                baseValue = Math.round(8 + Math.random() * 20); // 8-28
                break;
              case "ncd":
                baseValue = Math.round(10 + Math.random() * 30); // 10-40
                break;
              case "disease":
                baseValue = Math.round(2 + Math.random() * 10); // 2-12
                break;
            }
            
            // Apply all factors
            const adjustedBase = Math.round(baseValue * barangayFactor * yearFactor * seasonalFactor);
            
            for (const col of indicator.columns) {
              let value = adjustedBase;
              
              // For TOTAL column, sum the others
              if (col === "TOTAL") {
                // Already calculated as part of the loop
                value = Math.round(adjustedBase * 2.5); // Approximate total
              } else if (col === "10-14") {
                value = Math.round(adjustedBase * 0.2); // Smaller age group
              } else if (col === "15-19") {
                value = Math.round(adjustedBase * 0.35);
              } else if (col === "20-49") {
                value = Math.round(adjustedBase * 0.45);
              } else if (col === "M" || col === "F") {
                value = Math.round(adjustedBase * (0.4 + Math.random() * 0.2)); // ~40-60%
              }
              
              values.push({
                rowKey: indicator.rowKey,
                columnKey: col,
                valueNumber: Math.max(0, value),
                valueSource: "IMPORTED"
              });
              valuesCreated++;
            }
          }
          
          // Save all values for this report
          await this.updateM1IndicatorValues(report.id, values);
        }
      }
    }
    
    console.log(`Historical M1 data seeded: ${reportsCreated} reports, ${valuesCreated} indicator values`);
    return { reportsCreated, valuesCreated };
  }

  // === NURSE VISITS ===

  async getPrenatalVisits(motherId: number): Promise<PrenatalVisit[]> {
    return await db.select().from(prenatalVisits)
      .where(eq(prenatalVisits.motherId, motherId))
      .orderBy(desc(prenatalVisits.visitNumber));
  }

  async createPrenatalVisit(visit: InsertPrenatalVisit): Promise<PrenatalVisit> {
    const [created] = await db.insert(prenatalVisits).values(visit).returning();
    return created;
  }

  async getChildVisits(childId: number): Promise<ChildVisit[]> {
    return await db.select().from(childVisits)
      .where(eq(childVisits.childId, childId))
      .orderBy(desc(childVisits.visitNumber));
  }

  async createChildVisit(visit: InsertChildVisit): Promise<ChildVisit> {
    const [created] = await db.insert(childVisits).values(visit).returning();
    return created;
  }

  async getSeniorVisits(seniorId: number): Promise<SeniorVisit[]> {
    return await db.select().from(seniorVisits)
      .where(eq(seniorVisits.seniorId, seniorId))
      .orderBy(desc(seniorVisits.visitNumber));
  }

  async createSeniorVisit(visit: InsertSeniorVisit): Promise<SeniorVisit> {
    const [created] = await db.insert(seniorVisits).values(visit).returning();
    return created;
  }

  // === NUTRITION FOLLOW-UPS ===
  async getNutritionFollowUps(filters?: { childId?: number; barangay?: string; barangays?: string[] }): Promise<NutritionFollowUp[]> {
    // TL with zero assigned barangays → empty result (least-privilege)
    if (filters?.barangays !== undefined && filters.barangays.length === 0) return [];
    const conditions = [];
    if (filters?.childId) conditions.push(eq(nutritionFollowUps.childId, filters.childId));
    if (filters?.barangay) conditions.push(eq(nutritionFollowUps.barangay, filters.barangay));
    if (filters?.barangays && filters.barangays.length > 0) {
      conditions.push(inArray(nutritionFollowUps.barangay, filters.barangays));
    }
    // `id DESC` breaks ties when multiple follow-ups share a followUpDate —
    // without it the newest same-day entry isn't reliably first, which makes
    // the history card show the wrong "latest" row.
    const q = db.select().from(nutritionFollowUps)
      .orderBy(desc(nutritionFollowUps.followUpDate), desc(nutritionFollowUps.id));
    const rows = conditions.length > 0 ? await q.where(and(...conditions)) : await q;
    return rows;
  }

  async createNutritionFollowUp(record: InsertNutritionFollowUp): Promise<NutritionFollowUp> {
    const [created] = await db.insert(nutritionFollowUps).values(record as any).returning();
    return created;
  }

  async updateNutritionFollowUp(id: number, updates: Partial<InsertNutritionFollowUp>): Promise<NutritionFollowUp | undefined> {
    const [updated] = await db
      .update(nutritionFollowUps)
      .set(updates as any)
      .where(eq(nutritionFollowUps.id, id))
      .returning();
    return updated;
  }

  // Returns map: childId → most-recent follow-up. Used by the worklist to show
  // the latest classification + date chip on each row without N+1 queries.
  async getLatestFollowUpsByChildIds(childIds: number[]): Promise<Record<number, NutritionFollowUp>> {
    if (childIds.length === 0) return {};
    // `id DESC` tiebreaker: when a child has multiple follow-ups on the same
    // followUpDate, Postgres's natural order would otherwise leave the first-
    // inserted row ahead of the newer one, making the worklist chip stick on
    // the old classification after a same-day save.
    const rows = await db
      .select()
      .from(nutritionFollowUps)
      .where(inArray(nutritionFollowUps.childId, childIds))
      .orderBy(desc(nutritionFollowUps.followUpDate), desc(nutritionFollowUps.id));
    const out: Record<number, NutritionFollowUp> = {};
    for (const r of rows) {
      if (!out[r.childId]) out[r.childId] = r;  // desc order ⇒ first seen is latest
    }
    return out;
  }

  // === FP SERVICE RECORDS ===
  async getFpServiceRecords(filters?: { barangay?: string; barangays?: string[]; month?: string }): Promise<FpServiceRecord[]> {
    // TL with no assigned barangays gets empty result (least-privilege)
    if (filters?.barangays !== undefined && filters.barangays.length === 0) return [];
    const conditions = [];
    if (filters?.barangay) conditions.push(eq(fpServiceRecords.barangay, filters.barangay));
    if (filters?.barangays && filters.barangays.length > 0) conditions.push(inArray(fpServiceRecords.barangay, filters.barangays));
    if (filters?.month) conditions.push(eq(fpServiceRecords.reportingMonth, filters.month));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(fpServiceRecords)
      .where(whereClause)
      .orderBy(desc(fpServiceRecords.createdAt));
  }

  async getFpServiceRecord(id: number): Promise<FpServiceRecord | undefined> {
    const [record] = await db.select().from(fpServiceRecords).where(eq(fpServiceRecords.id, id));
    return record;
  }

  async createFpServiceRecord(record: InsertFpServiceRecord): Promise<FpServiceRecord> {
    const [created] = await db.insert(fpServiceRecords).values(record).returning();
    return created;
  }

  async updateFpServiceRecord(id: number, updates: Partial<InsertFpServiceRecord>): Promise<FpServiceRecord> {
    const [updated] = await db.update(fpServiceRecords)
      .set(updates)
      .where(eq(fpServiceRecords.id, id))
      .returning();
    return updated;
  }

  async deleteFpServiceRecord(id: number): Promise<boolean> {
    await db.delete(fpServiceRecords).where(eq(fpServiceRecords.id, id));
    return true;
  }

  // === GLOBAL CHAT ===
  async getGlobalChatMessages(): Promise<GlobalChatMessage[]> {
    // Fetch the most-recent 100 rows (DESC), then re-sort oldest-first for display
    const rows = await db.select().from(globalChatMessages)
      .orderBy(desc(globalChatMessages.createdAt))
      .limit(100);
    return rows.reverse();
  }

  async sendGlobalChatMessage(senderId: string, senderName: string, senderRole: string, content: string): Promise<GlobalChatMessage> {
    const [created] = await db.insert(globalChatMessages).values({
      senderId,
      senderName,
      senderRole,
      content,
    }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
