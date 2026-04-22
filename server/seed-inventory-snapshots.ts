/**
 * seed-inventory-snapshots.ts
 * Standalone seeder for inventory_snapshots table only.
 * Safe to run independently without truncating other tables.
 * Skips seeding if rows already exist (use --force to re-seed).
 *
 * Usage:
 *   ALLOW_TEST_RESET=true npx tsx server/seed-inventory-snapshots.ts --confirm
 *   ALLOW_TEST_RESET=true npx tsx server/seed-inventory-snapshots.ts --confirm --force
 */

import { db, pool } from "./db";
import { inventorySnapshots, InsertInventorySnapshot } from "@shared/schema";
import { sql } from "drizzle-orm";

const isConfirm = process.argv.includes("--confirm");
const isForce = process.argv.includes("--force");

const SEED_START_YEAR = new Date().getFullYear() - 1;

const BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong",
];

const VACCINE_SNAPSHOT_KEYS = ["bcg", "hepB", "penta", "opv", "mr"] as const;
const MEDICINE_SNAPSHOT_NAMES = [
  "Amlodipine", "Losartan", "Hydrochlorothiazide", "Enalapril", "Metoprolol",
  "Paracetamol", "Amoxicillin", "Cotrimoxazole", "Iron + Folic Acid", "Vitamin A", "ORS Sachet",
] as const;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

async function chunkInsert(rows: InsertInventorySnapshot[]): Promise<number> {
  const chunkSize = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(inventorySnapshots).values(rows.slice(i, i + chunkSize));
    total += Math.min(chunkSize, rows.length - i);
  }
  return total;
}

async function main() {
  console.log("=".repeat(60));
  console.log("HealthSync Inventory Snapshots Seeder");
  console.log("=".repeat(60));

  if (!isConfirm) {
    console.error("ERROR: Pass --confirm to execute seeding.");
    process.exit(1);
  }

  if (process.env.ALLOW_TEST_RESET !== "true") {
    console.error("ERROR: Set ALLOW_TEST_RESET=true to proceed.");
    process.exit(1);
  }

  const countRes = await db.execute(sql.raw(`SELECT COUNT(*) AS n FROM "inventory_snapshots"`));
  const existing = parseInt((countRes.rows[0] as { n: string }).n, 10);

  if (existing > 0 && !isForce) {
    console.error(`\nERROR: inventory_snapshots already has ${existing} rows. Pass --force to truncate and reseed.`);
    process.exit(1);
  }

  if (existing > 0 && isForce) {
    console.log(`\n--force detected: truncating inventory_snapshots (${existing} rows)...`);
    await db.execute(sql.raw(`TRUNCATE inventory_snapshots RESTART IDENTITY`));
    console.log("Table cleared.");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months = monthsInRange(SEED_START_YEAR, 1, currentYear, currentMonth);

  console.log(`\nDate range: ${SEED_START_YEAR}-01 → ${currentYear}-${String(currentMonth).padStart(2, "0")} (${months.length} months)`);
  console.log(`Barangays: ${BARANGAYS.length}, Vaccines: ${VACCINE_SNAPSHOT_KEYS.length}, Medicines: ${MEDICINE_SNAPSHOT_NAMES.length}`);
  console.log(`Expected rows: ${BARANGAYS.length * (VACCINE_SNAPSHOT_KEYS.length + MEDICINE_SNAPSHOT_NAMES.length) * months.length}`);

  const rows: InsertInventorySnapshot[] = [];

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

  console.log("\nInserting rows...");
  const count = await chunkInsert(rows);
  console.log(`\n=== Done: ${count} inventory_snapshot rows inserted ===`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
