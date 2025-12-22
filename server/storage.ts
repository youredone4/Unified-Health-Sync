
import { db } from "./db";
import { 
  mothers, children, seniors, inventory, healthStations,
  type Mother, type InsertMother,
  type Child, type InsertChild,
  type Senior, type InsertSenior,
  type InventoryItem, type InsertInventoryItem,
  type HealthStation
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Mothers
  getMothers(): Promise<Mother[]>;
  updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother>;
  
  // Children
  getChildren(): Promise<Child[]>;
  updateChild(id: number, updates: Partial<InsertChild>): Promise<Child>;

  // Seniors
  getSeniors(): Promise<Senior[]>;
  updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior>;

  // Inventory
  getInventory(): Promise<InventoryItem[]>;

  // Health Stations
  getHealthStations(): Promise<HealthStation[]>;

  // Seed
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Mothers
  async getMothers(): Promise<Mother[]> {
    return await db.select().from(mothers);
  }

  async updateMother(id: number, updates: Partial<InsertMother>): Promise<Mother> {
    const [updated] = await db.update(mothers)
      .set(updates)
      .where(eq(mothers.id, id))
      .returning();
    return updated;
  }

  // Children
  async getChildren(): Promise<Child[]> {
    return await db.select().from(children);
  }

  async updateChild(id: number, updates: Partial<InsertChild>): Promise<Child> {
    const [updated] = await db.update(children)
      .set(updates)
      .where(eq(children.id, id))
      .returning();
    return updated;
  }

  // Seniors
  async getSeniors(): Promise<Senior[]> {
    return await db.select().from(seniors);
  }

  async updateSenior(id: number, updates: Partial<InsertSenior>): Promise<Senior> {
    const [updated] = await db.update(seniors)
      .set(updates)
      .where(eq(seniors.id, id))
      .returning();
    return updated;
  }

  // Inventory
  async getInventory(): Promise<InventoryItem[]> {
    return await db.select().from(inventory);
  }

  // Health Stations
  async getHealthStations(): Promise<HealthStation[]> {
    return await db.select().from(healthStations);
  }

  // Seed Data
  async seedData(): Promise<void> {
    const existingMothers = await this.getMothers();
    if (existingMothers.length > 0) return;

    console.log("Seeding database...");

    // Mothers (Prenatal)
    await db.insert(mothers).values([
      { name: "Maria Santos", barangay: "Bugas-bugas", gaWeeks: 24, phone: "09171234567", tt1Date: "2024-11-01", tt2Date: null, tt3Date: null, registrationDate: "2024-10-15" },
      { name: "Elena Cruz", barangay: "San Isidro", gaWeeks: 32, phone: "09181234567", tt1Date: "2024-09-01", tt2Date: "2024-10-01", tt3Date: null, registrationDate: "2024-08-20" },
      { name: "Juana Dela Paz", barangay: "Poblacion", gaWeeks: 12, phone: "09191234567", tt1Date: null, tt2Date: null, tt3Date: null, registrationDate: "2024-12-01" },
      { name: "Sarah Geronimo", barangay: "Banban", gaWeeks: 28, phone: "09201234567", tt1Date: "2024-10-15", tt2Date: null, tt3Date: null, registrationDate: "2024-10-01" }, // Late for TT2
      { name: "Luz Vi", barangay: "Canlumacad", gaWeeks: 36, phone: "09211234567", tt1Date: "2024-08-01", tt2Date: "2024-09-01", tt3Date: null, registrationDate: "2024-07-15" },
    ]);

    // Children (Vaccines)
    // Dates calculated relative to "today" (approx Dec 2024/Jan 2025 context in user prompt? User says "Today is Dec 22, 2025")
    // Wait, system prompt says Today is Dec 22, 2025.
    // I will use that context.
    const today = new Date("2025-12-22");
    
    await db.insert(children).values([
      { 
        name: "Baby Boy Santos", 
        barangay: "Bugas-bugas", 
        dob: "2025-10-22", // 2 months old
        vaccines: { bcg: "2025-10-23", hepB: "2025-10-23" }, // Due for Penta1/OPV1
        growth: [{ date: "2025-11-22", weightKg: 4.5 }]
      },
      { 
        name: "Baby Girl Cruz", 
        barangay: "San Isidro", 
        dob: "2025-09-22", // 3 months old
        vaccines: { bcg: "2025-09-23", hepB: "2025-09-23", penta1: "2025-11-22", opv1: "2025-11-22" }, // Due for Penta2/OPV2 soon
        growth: [{ date: "2025-10-22", weightKg: 5.2 }, { date: "2025-11-22", weightKg: 5.8 }]
      },
      { 
        name: "John Doe Jr", 
        barangay: "Poblacion", 
        dob: "2025-01-15", // ~11 months
        vaccines: { bcg: "2025-01-16", hepB: "2025-01-16", penta1: "2025-03-15", opv1: "2025-03-15", penta2: "2025-05-15", opv2: "2025-05-15", penta3: "2025-07-15", opv3: "2025-07-15" }, // Due for MR1?
        growth: [{ date: "2025-11-15", weightKg: 7.5 }] // Underweight risk?
      },
    ]);

    // Seniors
    await db.insert(seniors).values([
      { name: "Lolo Pepe", barangay: "Bugas-bugas", phone: "09170000001", lastBP: "140/90", lastBPDate: "2025-12-01", htnMedsReady: true, medsReadyDate: "2025-12-20", pickedUp: false },
      { name: "Lola Rosa", barangay: "San Isidro", phone: "09170000002", lastBP: "120/80", lastBPDate: "2025-12-15", htnMedsReady: false, medsReadyDate: null, pickedUp: true },
      { name: "Tatay Carding", barangay: "Poblacion", phone: "09170000003", lastBP: "150/95", lastBPDate: "2025-11-20", htnMedsReady: true, medsReadyDate: "2025-12-10", pickedUp: false }, // Overdue pickup
    ]);

    // Inventory
    await db.insert(inventory).values([
      { item: "Paracetamol", barangay: "Bugas-bugas", quantity: 50, status: "Available", lastUpdated: "2025-12-20" },
      { item: "Amoxicillin", barangay: "Bugas-bugas", quantity: 5, status: "Low Stock", lastUpdated: "2025-12-20" },
      { item: "Losartan", barangay: "San Isidro", quantity: 0, status: "Out of Stock", lastUpdated: "2025-12-18" },
      { item: "Vitamin A", barangay: "Poblacion", quantity: 100, status: "Available", lastUpdated: "2025-12-21" },
    ]);

    // Health Stations
    await db.insert(healthStations).values([
      { name: "Bugas-bugas BHS", barangay: "Bugas-bugas", latitude: "9.56", longitude: "125.65" },
      { name: "San Isidro BHS", barangay: "San Isidro", latitude: "9.58", longitude: "125.67" },
      { name: "Poblacion RHU", barangay: "Poblacion", latitude: "9.60", longitude: "125.70" },
    ]);
  }
}

export const storage = new DatabaseStorage();
