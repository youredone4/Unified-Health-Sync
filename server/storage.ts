import { db } from "./db";
import { 
  mothers, children, seniors, inventory, healthStations, smsOutbox,
  type Mother, type InsertMother,
  type Child, type InsertChild,
  type Senior, type InsertSenior,
  type InventoryItem,
  type HealthStation,
  type SmsMessage, type InsertSmsMessage
} from "@shared/schema";
import { eq } from "drizzle-orm";

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
      .set(updates)
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

  async seedData(): Promise<void> {
    const existingMothers = await this.getMothers();
    if (existingMothers.length > 0) return;

    console.log("Seeding database with comprehensive demo data...");

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

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
