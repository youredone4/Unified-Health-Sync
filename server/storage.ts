import { db } from "./db";
import { 
  mothers, children, seniors, inventory, healthStations, smsOutbox, diseaseCases, tbPatients, themeSettings,
  barangays, users, userBarangays, municipalitySettings, UserRole, consults,
  m1TemplateVersions, m1IndicatorCatalog, m1ReportInstances, m1ReportHeader, m1IndicatorValues, barangaySettings,
  type Mother, type InsertMother,
  type Child, type InsertChild,
  type Senior, type InsertSenior,
  type InventoryItem,
  type HealthStation,
  type SmsMessage, type InsertSmsMessage,
  type DiseaseCase, type InsertDiseaseCase,
  type TBPatient, type InsertTBPatient,
  type ThemeSettings, type InsertThemeSettings,
  type Consult, type InsertConsult,
  type Barangay, type User,
  type M1TemplateVersion, type M1IndicatorCatalog, type M1ReportInstance, type M1IndicatorValue,
  type MunicipalitySettings, type BarangaySettings,
} from "@shared/schema";
import { eq, and, inArray, desc, isNull } from "drizzle-orm";

export interface IStorage {
  getMothers(): Promise<Mother[]>;
  getMother(id: number): Promise<Mother | undefined>;
  updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother>;
  
  getChildren(): Promise<Child[]>;
  getChild(id: number): Promise<Child | undefined>;
  updateChild(id: number, updates: Partial<InsertChild>): Promise<Child>;

  getSeniors(): Promise<Senior[]>;
  getSenior(id: number): Promise<Senior | undefined>;
  updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior>;

  getInventory(): Promise<InventoryItem[]>;
  getHealthStations(): Promise<HealthStation[]>;

  getSmsMessages(): Promise<SmsMessage[]>;
  sendSms(sms: InsertSmsMessage): Promise<SmsMessage>;

  getDiseaseCases(): Promise<DiseaseCase[]>;
  getDiseaseCase(id: number): Promise<DiseaseCase | undefined>;
  updateDiseaseCase(id: number, updates: Partial<InsertDiseaseCase>): Promise<DiseaseCase>;

  getTBPatients(): Promise<TBPatient[]>;
  getTBPatient(id: number): Promise<TBPatient | undefined>;
  updateTBPatient(id: number, updates: Partial<InsertTBPatient>): Promise<TBPatient>;

  getThemeSettings(): Promise<ThemeSettings | undefined>;
  updateThemeSettings(updates: Partial<InsertThemeSettings>): Promise<ThemeSettings>;

  getConsults(): Promise<Consult[]>;
  getConsult(id: number): Promise<Consult | undefined>;
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
  getMunicipalitySettings(): Promise<MunicipalitySettings | undefined>;
  getBarangaySettings(barangayId: number): Promise<BarangaySettings | undefined>;

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

  async updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother> {
    const [updated] = await db.update(mothers)
      .set(updates)
      .where(eq(mothers.id, id))
      .returning();
    return updated;
  }

  async getChildren(): Promise<Child[]> {
    return await db.select().from(children);
  }

  async getChild(id: number): Promise<Child | undefined> {
    const [child] = await db.select().from(children).where(eq(children.id, id));
    return child;
  }

  async updateChild(id: number, updates: Partial<InsertChild>): Promise<Child> {
    const [updated] = await db.update(children)
      .set(updates as any)
      .where(eq(children.id, id))
      .returning();
    return updated;
  }

  async getSeniors(): Promise<Senior[]> {
    return await db.select().from(seniors);
  }

  async getSenior(id: number): Promise<Senior | undefined> {
    const [senior] = await db.select().from(seniors).where(eq(seniors.id, id));
    return senior;
  }

  async updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior> {
    const [updated] = await db.update(seniors)
      .set(updates)
      .where(eq(seniors.id, id))
      .returning();
    return updated;
  }

  async getInventory(): Promise<InventoryItem[]> {
    return await db.select().from(inventory);
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

  async updateDiseaseCase(id: number, updates: Partial<InsertDiseaseCase>): Promise<DiseaseCase> {
    const [updated] = await db.update(diseaseCases)
      .set(updates)
      .where(eq(diseaseCases.id, id))
      .returning();
    return updated;
  }

  async getTBPatients(): Promise<TBPatient[]> {
    return await db.select().from(tbPatients);
  }

  async getTBPatient(id: number): Promise<TBPatient | undefined> {
    const [patient] = await db.select().from(tbPatients).where(eq(tbPatients.id, id));
    return patient;
  }

  async updateTBPatient(id: number, updates: Partial<InsertTBPatient>): Promise<TBPatient> {
    const [updated] = await db.update(tbPatients)
      .set(updates)
      .where(eq(tbPatients.id, id))
      .returning();
    return updated;
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

  async getMunicipalitySettings(): Promise<MunicipalitySettings | undefined> {
    const [settings] = await db.select().from(municipalitySettings);
    return settings;
  }

  async getBarangaySettings(barangayId: number): Promise<BarangaySettings | undefined> {
    const [settings] = await db.select().from(barangaySettings).where(eq(barangaySettings.barangayId, barangayId));
    return settings;
  }

  async seedData(): Promise<void> {
    const existingMothers = await this.getMothers();
    if (existingMothers.length > 0) return;

    console.log("Seeding database with comprehensive demo data...");

    // BARANGAYS - Seed the barangays table first
    const barangayNames = ["Bugas-bugas", "San Isidro", "Poblacion", "Banban", "Canlumacad"];
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
        barangay: "Poblacion", addressLine: "Purok 5, Centro",
        phone: "09191234567", registrationDate: "2024-12-01", gaWeeks: 12,
        nextPrenatalCheckDate: "2025-12-20", // Overdue
        tt1Date: null, tt2Date: null, tt3Date: null
      },
      { 
        firstName: "Sarah", lastName: "Geronimo", age: 26,
        barangay: "Banban", addressLine: "Sitio Riverside",
        phone: "09201234567", registrationDate: "2024-10-01", gaWeeks: 28,
        nextPrenatalCheckDate: "2025-12-30",
        tt1Date: "2024-10-15", tt2Date: null, tt3Date: null // TT2 overdue
      },
      { 
        firstName: "Luz", lastName: "Villareal", age: 30,
        barangay: "Canlumacad", addressLine: "Purok 2",
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
        barangay: "Poblacion", addressLine: "Purok 5, Centro",
        dob: "2025-01-15", // ~11 months
        motherId: null,
        nextVisitDate: "2025-12-20", // Overdue visit
        vaccines: { bcg: "2025-01-16", hepB: "2025-01-16", penta1: "2025-03-15", opv1: "2025-03-15", penta2: "2025-05-15", opv2: "2025-05-15", penta3: "2025-07-15", opv3: "2025-07-15" },
        growth: [{ date: "2025-09-15", weightKg: 6.8 }] // Missing recent growth - underweight risk
      },
      { 
        name: "Maria Angela Reyes", 
        barangay: "Banban", addressLine: "Sitio Riverside",
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
        barangay: "Poblacion", addressLine: "Centro",
        phone: "09170000003",
        lastBP: "150/95", lastBPDate: "2025-11-20",
        lastMedicationName: "Amlodipine", lastMedicationDoseMg: 10, lastMedicationQuantity: 30,
        lastMedicationGivenDate: "2025-11-10",
        nextPickupDate: "2025-12-10", // Overdue
        htnMedsReady: true, pickedUp: false
      },
      { 
        firstName: "Carmen", lastName: "Villanueva", age: 70,
        barangay: "Canlumacad", addressLine: "Purok 3",
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
        barangay: "Poblacion",
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
        barangay: "Banban",
        vaccines: { bcgQty: 18, hepBQty: 22, pentaQty: 15, opvQty: 20, mrQty: 12 },
        htnMeds: [
          { name: "Metoprolol", doseMg: 25, qty: 45 }
        ],
        lowStockThreshold: 10, surplusThreshold: 100,
        lastUpdated: "2025-12-19"
      },
      { 
        barangay: "Canlumacad",
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
      { facilityName: "Poblacion Rural Health Unit", barangay: "Poblacion", latitude: "9.6600", longitude: "125.6850" },
      { facilityName: "Banban Barangay Health Station", barangay: "Banban", latitude: "9.6380", longitude: "125.6400" },
      { facilityName: "Canlumacad Barangay Health Station", barangay: "Canlumacad", latitude: "9.6700", longitude: "125.6950" },
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
        age: 45, barangay: "Poblacion", addressLine: "Centro",
        phone: "09184444444",
        condition: "Dengue suspected",
        dateReported: "2025-12-10",
        status: "Referred",
        notes: "Referred to RHU for confirmatory test",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Maria Lourdes",
        age: 28, barangay: "Banban", addressLine: "Sitio Riverside",
        phone: "09185555555",
        condition: "ARI",
        dateReported: "2025-12-21",
        status: "New",
        notes: "Cough and cold symptoms",
        linkedPersonType: null, linkedPersonId: null
      },
      {
        patientName: "Jose Rizal Jr",
        age: 2, barangay: "Canlumacad", addressLine: "Purok 1",
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
        barangay: "Poblacion", addressLine: "Centro",
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
        barangay: "Banban", addressLine: "Sitio Hilltop",
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
        barangay: "Canlumacad", addressLine: "Purok 3",
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
}

export const storage = new DatabaseStorage();
