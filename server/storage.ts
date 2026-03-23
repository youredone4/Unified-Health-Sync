import { db } from "./db";
import { 
  mothers, children, seniors, inventory, medicineInventory, healthStations, smsOutbox, diseaseCases, tbPatients, themeSettings,
  barangays, users, userBarangays, municipalitySettings, UserRole, consults, seniorMedClaims,
  m1TemplateVersions, m1IndicatorCatalog, m1ReportInstances, m1ReportHeader, m1IndicatorValues, barangaySettings,
  directMessages,
  prenatalVisits, childVisits, seniorVisits,
  fpServiceRecords,
  globalChatMessages,
  type Mother, type InsertMother,
  type Child, type InsertChild,
  type Senior, type InsertSenior,
  type InventoryItem,
  type MedicineInventoryItem, type InsertMedicineInventoryItem,
  type HealthStation,
  type SmsMessage, type InsertSmsMessage,
  type DiseaseCase, type InsertDiseaseCase,
  type TBPatient, type InsertTBPatient,
  type ThemeSettings, type InsertThemeSettings,
  type Consult, type InsertConsult,
  type Barangay, type User,
  type M1TemplateVersion, type M1IndicatorCatalog, type M1ReportInstance, type M1IndicatorValue,
  type MunicipalitySettings, type BarangaySettings,
  type SeniorMedClaim, type InsertSeniorMedClaim,
  type DirectMessage,
  type PrenatalVisit, type InsertPrenatalVisit,
  type ChildVisit, type InsertChildVisit,
  type SeniorVisit, type InsertSeniorVisit,
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
  getHealthStations(): Promise<HealthStation[]>;

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

  async getHealthStations(): Promise<HealthStation[]> {
    return await db.select().from(healthStations);
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
    return created;
  }

  async updateDiseaseCase(id: number, updates: Partial<InsertDiseaseCase>): Promise<DiseaseCase> {
    const [updated] = await db.update(diseaseCases)
      .set(updates)
      .where(eq(diseaseCases.id, id))
      .returning();
    return updated;
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

  async seedData(): Promise<void> {
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

    // HEALTH STATIONS
    await db.insert(healthStations).values([
      { facilityName: "Bugas-bugas Barangay Health Station", barangay: "Bugas-bugas", latitude: "9.6450", longitude: "125.6520" },
      { facilityName: "San Isidro Barangay Health Station", barangay: "San Isidro", latitude: "9.6520", longitude: "125.6680" },
      { facilityName: "Central (Poblacion) Rural Health Unit", barangay: "Central (Poblacion)", latitude: "9.6600", longitude: "125.6850" },
      { facilityName: "Mabini Barangay Health Station", barangay: "Mabini", latitude: "9.6380", longitude: "125.6400" },
      { facilityName: "Lakandula Barangay Health Station", barangay: "Lakandula", latitude: "9.6700", longitude: "125.6950" },
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

    // THEME SETTINGS - Default LGU branding
    await db.insert(themeSettings).values([
      {
        lguName: "Placer Municipality",
        lguSubtitle: "Province of Surigao del Norte",
        logoUrl: null,
        colorScheme: "healthcare-green",
        primaryHue: 152,
        primarySaturation: 60,
        primaryLightness: 40,
      }
    ]);

    console.log("Database seeded successfully!");
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
    return await db.select().from(globalChatMessages)
      .orderBy(globalChatMessages.createdAt)
      .limit(100);
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
