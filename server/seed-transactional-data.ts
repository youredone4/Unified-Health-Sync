/**
 * seed-transactional-data.ts
 * Seeds prenatal_visits, child_visits, consults, fp_service_records,
 * inventory (vaccines + HTN meds), and medicine_inventory spanning
 * January of the previous year through the current month across all 20 barangays.
 * The date window is always computed dynamically from new Date().getFullYear() - 1.
 *
 * This script is the THIRD step in the full demo reset+seed pipeline.
 * Run the full pipeline in order using the master script:
 *
 *   ALLOW_TEST_RESET=true bash scripts/demo-reset.sh
 *
 * Which executes:
 *   1. server/reset-test-data.ts         — truncates all transactional tables
 *   2. server/seed-patients.ts           — seeds Mothers, Children, Disease Cases, TB
 *   3. server/seed-transactional-data.ts — seeds visits, consults, FP records,
 *                                          and INVENTORY (vaccines + HTN meds)
 *
 * To run this script alone (standalone usage):
 *   ALLOW_TEST_RESET=true npx tsx server/seed-transactional-data.ts --confirm
 *   ALLOW_TEST_RESET=true npx tsx server/seed-transactional-data.ts --confirm --force
 *
 * Safety gates:
 *   - ALLOW_TEST_RESET=true (exact value) env var required
 *   - --confirm flag required
 *   - Refuses if target tables already have rows (unless --force is passed)
 *   - Bulk-inserts in chunks of 500 for performance
 */

import { db, pool } from "./db";
import {
  mothers,
  children,
  prenatalVisits,
  childVisits,
  consults,
  fpServiceRecords,
  inventory,
  medicineInventory,
  inventorySnapshots,
  FP_METHODS,
  FP_STATUSES,
  InsertPrenatalVisit,
  InsertChildVisit,
  InsertConsult,
  InsertFpServiceRecord,
  InsertInventoryItem,
  InsertMedicineInventoryItem,
  InsertInventorySnapshot,
} from "@shared/schema";
import { sql } from "drizzle-orm";

const isConfirm = process.argv.includes("--confirm");
const isForce = process.argv.includes("--force");

const BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong",
];

// Dynamic seed window: always covers the previous calendar year through the current month.
// This keeps demo data fresh regardless of when the script is run.
const SEED_START_YEAR = new Date().getFullYear() - 1;

const FIRST_NAMES_F = [
  "Maria", "Ana", "Rosa", "Elena", "Carmen", "Luz", "Gloria", "Josefa", "Teresa", "Rosario",
  "Lourdes", "Corazon", "Esperanza", "Milagros", "Pilar", "Remedios", "Soledad", "Consuelo",
];
const FIRST_NAMES_M = [
  "Juan", "Jose", "Pedro", "Carlos", "Miguel", "Roberto", "Luis", "Antonio", "Fernando", "Rafael",
  "Manuel", "Francisco", "Ricardo", "Eduardo", "Alejandro", "Daniel", "Mario", "Jorge",
];
const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Garcia", "Ramos", "Mendoza", "Torres", "Flores", "Gonzales",
  "Lopez", "Martinez", "Hernandez", "Perez", "Sanchez", "Rivera", "Fernandez", "Castillo",
  "Morales", "Aquino", "Bautista", "De Leon", "Villanueva", "Del Rosario", "Magno", "Castro",
];

const CONSULT_COMPLAINTS = [
  "Fever", "Cough and colds", "Headache", "Body malaise", "Abdominal pain",
  "Diarrhea", "Vomiting", "Hypertension follow-up", "Wound dressing", "Prenatal check",
  "Immunization", "Medication refill", "Urinary tract infection", "Skin rash", "Joint pain",
];
const DIAGNOSES = [
  "Upper Respiratory Tract Infection", "Hypertension", "Acute Gastroenteritis",
  "Type 2 Diabetes Mellitus", "Urinary Tract Infection", "Dengue Fever",
  "Skin Infection", "Anemia", "Asthma", "Acute Pharyngitis",
  "Influenza", "Diarrhea NOS", "Wound Infection", "Arthralgia", "Fever NOS",
];
const CONSULT_TYPES = ["General", "Prenatal", "Child", "Senior"] as const;
const DISPOSITIONS = ["Treated", "Referred", "Admitted"] as const;
const PRENATAL_NOTES = [
  "TT1 administered. Patient counseled on nutrition.",
  "TT2 administered. BP normal. Continue iron supplementation.",
  "TT3 completed. Fetal heart tones heard. Growth on track.",
  "Routine ANC check. Iron and folate dispensed.",
  "Risk assessment done. Patient referred for ultrasound.",
  "Follow-up visit. Edema noted, rest advised.",
  "TT booster given. Maternal weight gaining normally.",
];
const IMMUNIZATION_NOTES = [
  "BCG and Hepatitis B administered at birth.",
  "Pentavalent 1st dose given. No adverse reaction.",
  "OPV and IPV doses completed for this month.",
  "Measles-Rubella vaccine given. Vitamin A supplemented.",
  "Full EPI schedule on track. Growth measured.",
  "Catch-up immunization completed.",
  "Penta 2nd dose. Child weight within normal range.",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isoNow(): string {
  return new Date().toISOString();
}

type MonthEntry = { year: number; month: number };

function monthsInRange(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number
): MonthEntry[] {
  const months: MonthEntry[] = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function dateForMonth(year: number, month: number): string {
  const day = randInt(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function yyyyMm(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function chunkInsert<T>(
  rows: T[],
  insertFn: (chunk: T[]) => Promise<unknown>,
  chunkSize = 500
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await insertFn(chunk);
    inserted += chunk.length;
  }
  return inserted;
}

async function checkEmpty(tableName: string): Promise<number> {
  const res = await db.execute(sql.raw(`SELECT COUNT(*) AS n FROM "${tableName}"`));
  const row = res.rows[0] as { n: string };
  return parseInt(row.n, 10);
}

type MotherRow = { id: number; barangay: string; gaWeeks: number | null };
type ChildRow = { id: number; barangay: string };

async function seedPrenatalVisits(allMothers: MotherRow[]): Promise<number> {
  console.log("  Generating prenatal visits...");
  const rows: InsertPrenatalVisit[] = [];

  for (const mother of allMothers) {
    const numVisits = randInt(3, 6);
    const startDate = dateForMonth(SEED_START_YEAR, randInt(1, 3));
    let currentDate = startDate;

    for (let v = 1; v <= numVisits; v++) {
      const riskOptions = ["low", "low", "low", "moderate", "high"] as const;
      rows.push({
        motherId: mother.id,
        visitNumber: v,
        visitDate: currentDate,
        gaWeeks: Math.min(40, (mother.gaWeeks ?? 12) + (v - 1) * 4),
        weightKg: (45 + Math.random() * 20).toFixed(1),
        bloodPressure: `${randInt(100, 130)}/${randInt(60, 85)}`,
        fundalHeight: `${randInt(16, 38)}`,
        fetalHeartTone: `${randInt(130, 160)}`,
        riskStatus: pick(riskOptions),
        notes: pick(PRENATAL_NOTES),
        nextScheduledVisit: addDays(currentDate, 28),
        recordedBy: "seeder",
        createdAt: isoNow(),
      });
      currentDate = addDays(currentDate, randInt(25, 35));
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(prenatalVisits).values(chunk)
  );
  console.log(`  Inserted ${count} prenatal visits`);
  return count;
}

async function seedChildVisits(allChildren: ChildRow[], months: MonthEntry[]): Promise<number> {
  console.log("  Generating child visits...");
  const rows: InsertChildVisit[] = [];

  for (const child of allChildren) {
    const numVisits = randInt(2, 5);
    const usedMonths = new Set<string>();
    const visitMonths: MonthEntry[] = [];

    while (visitMonths.length < numVisits) {
      const m = pick(months);
      const key = yyyyMm(m.year, m.month);
      if (!usedMonths.has(key)) {
        usedMonths.add(key);
        visitMonths.push(m);
      }
    }

    visitMonths.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    for (let v = 0; v < visitMonths.length; v++) {
      const { year, month } = visitMonths[v];
      rows.push({
        childId: child.id,
        visitNumber: v + 1,
        visitDate: dateForMonth(year, month),
        weightKg: (3 + Math.random() * 15).toFixed(1),
        heightCm: (50 + Math.random() * 50).toFixed(1),
        muac: (12 + Math.random() * 8).toFixed(1),
        immunizationNotes: pick(IMMUNIZATION_NOTES),
        monitoringNotes: "Growth monitoring recorded.",
        recordedBy: "seeder",
        createdAt: isoNow(),
      });
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(childVisits).values(chunk)
  );
  console.log(`  Inserted ${count} child visits`);
  return count;
}

async function seedConsults(months: MonthEntry[]): Promise<number> {
  console.log("  Generating consult records...");
  const rows: InsertConsult[] = [];

  for (const barangay of BARANGAYS) {
    for (const { year, month } of months) {
      const numConsults = randInt(7, 13);
      for (let i = 0; i < numConsults; i++) {
        const sex = Math.random() > 0.5 ? "M" : "F";
        const firstName = sex === "F" ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
        rows.push({
          patientName: `${firstName} ${pick(LAST_NAMES)}`,
          age: randInt(1, 80),
          sex,
          barangay,
          addressLine: `Purok ${randInt(1, 8)}`,
          consultDate: dateForMonth(year, month),
          chiefComplaint: pick(CONSULT_COMPLAINTS),
          diagnosis: pick(DIAGNOSES),
          treatment: "Medications prescribed and dispensed.",
          disposition: pick(DISPOSITIONS),
          consultType: pick(CONSULT_TYPES),
          createdAt: isoNow(),
        });
      }
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(consults).values(chunk)
  );
  console.log(`  Inserted ${count} consult records`);
  return count;
}

const HTN_MEDS = [
  { name: "Amlodipine", doseMg: 5 },
  { name: "Amlodipine", doseMg: 10 },
  { name: "Losartan", doseMg: 50 },
  { name: "Losartan", doseMg: 100 },
  { name: "Hydrochlorothiazide", doseMg: 25 },
  { name: "Enalapril", doseMg: 5 },
  { name: "Metoprolol", doseMg: 50 },
];

function realisticQty(): number {
  const roll = Math.random();
  if (roll < 0.15) return randInt(2, 9);
  if (roll < 0.75) return randInt(20, 80);
  return randInt(105, 180);
}

async function seedInventory(): Promise<number> {
  console.log("  Generating inventory rows (vaccines + HTN meds)...");
  const lastUpdated = new Date().toISOString().split("T")[0];
  const rows: InsertInventoryItem[] = [];

  for (const barangay of BARANGAYS) {
    rows.push({
      barangay,
      vaccines: {
        bcgQty: realisticQty(),
        hepBQty: realisticQty(),
        pentaQty: realisticQty(),
        opvQty: realisticQty(),
        mrQty: realisticQty(),
      },
      htnMeds: HTN_MEDS.map((m) => ({
        name: m.name,
        doseMg: m.doseMg,
        qty: realisticQty(),
      })),
      lowStockThreshold: 10,
      surplusThreshold: 100,
      lastUpdated,
    });
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(inventory).values(chunk)
  );
  console.log(`  Inserted ${count} inventory rows`);
  return count;
}

async function seedMedicineInventory(): Promise<number> {
  console.log("  Generating medicine_inventory rows...");
  const lastUpdated = new Date().toISOString().split("T")[0];
  const futureDate = (offsetMonths: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths);
    return d.toISOString().split("T")[0];
  };

  const medicines = [
    { name: "Amlodipine", strength: "5mg", unit: "tablet", category: "HTN", expiryOffset: 18 },
    { name: "Amlodipine", strength: "10mg", unit: "tablet", category: "HTN", expiryOffset: 18 },
    { name: "Losartan", strength: "50mg", unit: "tablet", category: "HTN", expiryOffset: 24 },
    { name: "Losartan", strength: "100mg", unit: "tablet", category: "HTN", expiryOffset: 24 },
    { name: "Hydrochlorothiazide", strength: "25mg", unit: "tablet", category: "HTN", expiryOffset: 20 },
    { name: "Enalapril", strength: "5mg", unit: "tablet", category: "HTN", expiryOffset: 16 },
    { name: "Metoprolol", strength: "50mg", unit: "tablet", category: "HTN", expiryOffset: 14 },
    { name: "Paracetamol", strength: "500mg", unit: "tablet", category: "Analgesic", expiryOffset: 30 },
    { name: "Amoxicillin", strength: "500mg", unit: "capsule", category: "Antibiotic", expiryOffset: 12 },
    { name: "Cotrimoxazole", strength: "400/80mg", unit: "tablet", category: "Antibiotic", expiryOffset: 12 },
    { name: "Iron + Folic Acid", strength: "60mg/400mcg", unit: "tablet", category: "Supplement", expiryOffset: 24 },
    { name: "Vitamin A", strength: "100,000 IU", unit: "capsule", category: "Supplement", expiryOffset: 18 },
    { name: "ORS Sachet", strength: "N/A", unit: "sachet", category: "Rehydration", expiryOffset: 36 },
  ];

  const rows: InsertMedicineInventoryItem[] = [];
  for (const barangay of BARANGAYS) {
    for (const med of medicines) {
      rows.push({
        barangay,
        medicineName: med.name,
        strength: med.strength,
        unit: med.unit,
        qty: realisticQty(),
        expirationDate: futureDate(med.expiryOffset),
        category: med.category,
        notes: null,
        lowStockThreshold: 10,
        lastUpdated,
      });
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(medicineInventory).values(chunk)
  );
  console.log(`  Inserted ${count} medicine_inventory rows`);
  return count;
}

async function seedFpServiceRecords(months: MonthEntry[]): Promise<number> {
  console.log("  Generating FP service records...");
  const rows: InsertFpServiceRecord[] = [];

  for (const barangay of BARANGAYS) {
    for (const { year, month } of months) {
      const numFp = randInt(5, 11);
      for (let i = 0; i < numFp; i++) {
        const firstName = pick(FIRST_NAMES_F);
        const dateStarted = dateForMonth(year, month);
        rows.push({
          barangay,
          patientName: `${firstName} ${pick(LAST_NAMES)}`,
          linkedPersonType: "GENERAL",
          dob: `${randInt(1975, 2005)}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`,
          fpMethod: pick(FP_METHODS),
          fpStatus: pick(FP_STATUSES),
          dateStarted,
          reportingMonth: yyyyMm(year, month),
          recordedBy: "seeder",
          createdAt: isoNow(),
        });
      }
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(fpServiceRecords).values(chunk)
  );
  console.log(`  Inserted ${count} FP service records`);
  return count;
}

const VACCINE_SNAPSHOT_KEYS = ["bcg", "hepB", "penta", "opv", "mr"] as const;
const MEDICINE_SNAPSHOT_NAMES = [
  "Amlodipine", "Losartan", "Hydrochlorothiazide", "Enalapril", "Metoprolol",
  "Paracetamol", "Amoxicillin", "Cotrimoxazole", "Iron + Folic Acid", "Vitamin A", "ORS Sachet",
] as const;

async function seedInventorySnapshots(): Promise<number> {
  console.log("  Generating inventory_snapshots rows...");
  const rows: InsertInventorySnapshot[] = [];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months = monthsInRange(SEED_START_YEAR, 1, currentYear, currentMonth);

  for (const barangay of BARANGAYS) {
    for (const key of VACCINE_SNAPSHOT_KEYS) {
      let qty = randInt(50, 120);
      let monthsSinceRestock = randInt(0, 2);
      for (const { year, month } of months) {
        qty = Math.max(0, qty - randInt(3, 12));
        monthsSinceRestock++;
        if (monthsSinceRestock >= randInt(3, 5)) {
          qty = Math.min(150, qty + randInt(40, 100));
          monthsSinceRestock = 0;
        }
        rows.push({
          barangay,
          snapshotDate: `${year}-${String(month).padStart(2, "0")}-01`,
          itemType: "vaccine",
          itemKey: key,
          qty,
        });
      }
    }

    for (const medName of MEDICINE_SNAPSHOT_NAMES) {
      let qty = randInt(30, 90);
      let monthsSinceRestock = randInt(0, 2);
      for (const { year, month } of months) {
        qty = Math.max(0, qty - randInt(2, 8));
        monthsSinceRestock++;
        if (monthsSinceRestock >= randInt(2, 4)) {
          qty = Math.min(120, qty + randInt(30, 80));
          monthsSinceRestock = 0;
        }
        rows.push({
          barangay,
          snapshotDate: `${year}-${String(month).padStart(2, "0")}-01`,
          itemType: "medicine",
          itemKey: medName,
          qty,
        });
      }
    }
  }

  const count = await chunkInsert(
    rows,
    (chunk) => db.insert(inventorySnapshots).values(chunk)
  );
  console.log(`  Inserted ${count} inventory_snapshot rows`);
  return count;
}

async function main() {
  console.log("=".repeat(60));
  console.log("HealthSync Transactional Data Seeder");
  console.log("=".repeat(60));

  if (!isConfirm) {
    console.error("ERROR: Pass --confirm to execute seeding.");
    process.exit(1);
  }

  if (process.env.ALLOW_TEST_RESET !== "true") {
    console.error("ERROR: Set ALLOW_TEST_RESET=true to proceed.");
    process.exit(1);
  }

  console.log("Checking for existing data...");
  const pvCount = await checkEmpty("prenatal_visits");
  const cvCount = await checkEmpty("child_visits");
  const cCount = await checkEmpty("consults");
  const fpCount = await checkEmpty("fp_service_records");
  const invCount = await checkEmpty("inventory");
  const medInvCount = await checkEmpty("medicine_inventory");
  const snapCount = await checkEmpty("inventory_snapshots");
  const totals = pvCount + cvCount + cCount + fpCount + invCount + medInvCount + snapCount;

  if (totals > 0 && !isForce) {
    console.error(
      `\nERROR: Target tables already contain data:\n` +
      `  prenatal_visits:      ${pvCount}\n` +
      `  child_visits:         ${cvCount}\n` +
      `  consults:             ${cCount}\n` +
      `  fp_service_records:   ${fpCount}\n` +
      `  inventory:            ${invCount}\n` +
      `  medicine_inventory:   ${medInvCount}\n` +
      `  inventory_snapshots:  ${snapCount}\n\n` +
      `Pass --force to truncate these tables and reseed.`
    );
    process.exit(1);
  }

  if (totals > 0 && isForce) {
    console.log("\n--force detected: truncating target tables before reseeding...");
    await db.execute(sql.raw(
      `TRUNCATE prenatal_visits, child_visits, consults, fp_service_records, inventory, medicine_inventory, inventory_snapshots RESTART IDENTITY CASCADE`
    ));
    console.log("Tables cleared. Proceeding with fresh seed.");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months = monthsInRange(SEED_START_YEAR, 1, currentYear, currentMonth);
  console.log(`\nDate range: ${yyyyMm(SEED_START_YEAR, 1)} → ${yyyyMm(currentYear, currentMonth)} (${months.length} months)`);
  console.log(`Barangays: ${BARANGAYS.length}`);

  console.log("\nLoading existing mothers and children from DB...");
  const allMothers: MotherRow[] = await db
    .select({ id: mothers.id, barangay: mothers.barangay, gaWeeks: mothers.gaWeeks })
    .from(mothers);
  const allChildren: ChildRow[] = await db
    .select({ id: children.id, barangay: children.barangay })
    .from(children);
  console.log(`  Found ${allMothers.length} mothers, ${allChildren.length} children`);

  console.log("\nSeeding transactional data...");
  const pvInserted = await seedPrenatalVisits(allMothers);
  const cvInserted = await seedChildVisits(allChildren, months);
  const cInserted = await seedConsults(months);
  const fpInserted = await seedFpServiceRecords(months);

  console.log("\nSeeding inventory data...");
  const invInserted = await seedInventory();
  const medInvInserted = await seedMedicineInventory();
  const snapshotsInserted = await seedInventorySnapshots();

  console.log("\n=== Seeding Complete ===");
  console.log(`  prenatal_visits:       ${pvInserted}`);
  console.log(`  child_visits:          ${cvInserted}`);
  console.log(`  consults:              ${cInserted}`);
  console.log(`  fp_service_records:    ${fpInserted}`);
  console.log(`  inventory:             ${invInserted}`);
  console.log(`  medicine_inventory:    ${medInvInserted}`);
  console.log(`  inventory_snapshots:   ${snapshotsInserted}`);
  console.log(`  Total rows:            ${pvInserted + cvInserted + cInserted + fpInserted + invInserted + medInvInserted + snapshotsInserted}`);
  console.log("\nSchema was NOT modified. No drizzle-kit push required.");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
