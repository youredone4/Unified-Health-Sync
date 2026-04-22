/**
 * seed-patients.ts
 * Seeds Mothers, Children, Disease Cases, and TB Patient profiles across
 * all 20 barangays.
 *
 * This script is the SECOND step in the full demo reset+seed pipeline.
 * To reset and reseed everything (including inventory) in one command, use:
 *
 *   ALLOW_TEST_RESET=true bash scripts/demo-reset.sh
 *
 * Standalone usage:
 *   npx tsx server/seed-patients.ts
 *
 * Note: Run after reset-test-data.ts and before seed-transactional-data.ts.
 * The transactional seeder reads mothers and children seeded here.
 */

import { db } from "./db";
import { mothers, children, diseaseCases, tbPatients, InsertMother } from "@shared/schema";

const barangays = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

const firstNames = [
  "Maria", "Ana", "Rosa", "Elena", "Carmen", "Luz", "Gloria", "Josefa", "Teresa", "Rosario",
  "Lourdes", "Corazon", "Esperanza", "Milagros", "Pilar", "Remedios", "Soledad", "Consuelo",
  "Dolores", "Felicidad", "Angelica", "Patricia", "Diana", "Jennifer", "Michelle", "Nicole",
  "Kristine", "Joanna", "Rachel", "Sarah", "Hannah", "Sophia", "Isabella", "Mia", "Emma"
];

const lastNames = [
  "Santos", "Reyes", "Cruz", "Garcia", "Ramos", "Mendoza", "Torres", "Flores", "Gonzales",
  "Lopez", "Martinez", "Hernandez", "Perez", "Sanchez", "Rivera", "Fernandez", "Castillo",
  "Morales", "Aquino", "Bautista", "De Leon", "Villanueva", "Del Rosario", "Magno", "Castro",
  "Dizon", "Aguilar", "Pascual", "Salazar", "Valdez", "Navarro", "Soriano", "Ramirez"
];

const maleFirstNames = [
  "Juan", "Jose", "Pedro", "Carlos", "Miguel", "Roberto", "Luis", "Antonio", "Fernando", "Rafael",
  "Manuel", "Francisco", "Ricardo", "Eduardo", "Alejandro", "Daniel", "Mario", "Jorge", "Arturo",
  "Gabriel", "Mark", "John", "James", "Michael", "David", "Christopher", "Joshua", "Matthew"
];

const diseases = ["Diarrhea", "Chickenpox", "ARI", "Dengue suspected", "Measles suspected"];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startYear: number, endYear: number): string {
  const year = randomInt(startYear, endYear);
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function randomPhone(): string {
  return `09${randomInt(10, 99)}${randomInt(1000000, 9999999)}`;
}

const todayStr = new Date().toISOString().split("T")[0];
const today = new Date(todayStr);

async function seedMothers() {
  console.log("Seeding mothers...");
  const mothersData: InsertMother[] = [];
  
  for (const barangay of barangays) {
    const count = randomInt(15, 30);
    
    for (let i = 0; i < count; i++) {
      const registrationDate = randomDate(2024, 2025);
      const gaWeeks = randomInt(8, 32);
      const age = randomInt(18, 42);
      const ancVisits = randomInt(0, 6);
      
      const tt1Date = ancVisits >= 1 ? addDays(registrationDate, randomInt(0, 14)) : null;
      const tt2Date = ancVisits >= 2 && tt1Date ? addDays(tt1Date, randomInt(28, 42)) : null;
      const tt3Date = ancVisits >= 3 && tt2Date ? addDays(tt2Date, randomInt(28, 60)) : null;
      const tt4Date = ancVisits >= 4 && tt3Date ? addDays(tt3Date, randomInt(60, 365)) : null;
      const tt5Date = ancVisits >= 5 && tt4Date ? addDays(tt4Date, randomInt(365, 730)) : null;
      
      const eddDate = addDays(registrationDate, (40 - gaWeeks) * 7);
      const delivered = new Date(eddDate) < today;
      
      const bmiStatuses = ["normal", "low", "high"] as const;
      const attendants = ["physician", "nurse", "midwife", "hilot"] as const;
      const locations = ["hospital", "birthing_center", "home"] as const;
      
      const bwKg = delivered ? (2.2 + Math.random() * 1.8).toFixed(2) : null;
      
      mothersData.push({
        firstName: randomElement(firstNames),
        lastName: randomElement(lastNames),
        age,
        barangay,
        addressLine: `Purok ${randomInt(1, 8)}`,
        phone: randomPhone(),
        registrationDate,
        gaWeeks,
        expectedDeliveryDate: eddDate,
        nextPrenatalCheckDate: delivered ? null : addDays(todayStr, randomInt(-7, 21)),
        ancVisits,
        bmiStatus: randomElement(bmiStatuses),
        tt1Date,
        tt2Date,
        tt3Date,
        tt4Date,
        tt5Date,
        status: delivered ? "delivered" : "active",
        outcome: delivered ? "live_birth" : null,
        outcomeDate: delivered ? eddDate : null,
        deliveryAttendant: delivered ? randomElement(attendants) : null,
        deliveryLocation: delivered ? randomElement(locations) : null,
        birthWeightKg: bwKg,
        birthWeightCategory: bwKg ? (parseFloat(bwKg) >= 2.5 ? "normal" : "low") : null,
        breastfedWithin1hr: delivered ? Math.random() > 0.2 : false,
        ironSuppGiven: delivered && Math.random() > 0.7,
      });
    }
  }
  
  await db.insert(mothers).values(mothersData);
  console.log(`Inserted ${mothersData.length} mothers`);
  return mothersData.length;
}

async function seedChildren() {
  console.log("Seeding children...");
  const childrenData = [];
  
  for (const barangay of barangays) {
    const count = randomInt(20, 40);
    
    for (let i = 0; i < count; i++) {
      const dob = randomDate(2022, 2025);
      const ageInMonths = Math.floor((today.getTime() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30));
      const sex = Math.random() > 0.5 ? "male" : "female";
      const birthWeight = (2.2 + Math.random() * 1.8).toFixed(2);
      
      const vaccines: Record<string, string> = {};
      
      if (ageInMonths >= 0) {
        if (Math.random() > 0.1) vaccines.bcg = addDays(dob, randomInt(0, 7));
        if (Math.random() > 0.1) vaccines.hepB = addDays(dob, randomInt(0, 3));
      }
      if (ageInMonths >= 2) {
        if (Math.random() > 0.15) vaccines.penta1 = addDays(dob, randomInt(42, 60));
        if (Math.random() > 0.15) vaccines.opv1 = addDays(dob, randomInt(42, 60));
      }
      if (ageInMonths >= 3) {
        if (vaccines.penta1 && Math.random() > 0.2) vaccines.penta2 = addDays(vaccines.penta1, randomInt(28, 42));
        if (vaccines.opv1 && Math.random() > 0.2) vaccines.opv2 = addDays(vaccines.opv1, randomInt(28, 42));
      }
      if (ageInMonths >= 4) {
        if (vaccines.penta2 && Math.random() > 0.25) vaccines.penta3 = addDays(vaccines.penta2, randomInt(28, 42));
        if (vaccines.opv2 && Math.random() > 0.25) vaccines.opv3 = addDays(vaccines.opv2, randomInt(28, 42));
        if (Math.random() > 0.3) vaccines.ipv1 = addDays(dob, randomInt(100, 150));
      }
      if (ageInMonths >= 9) {
        if (Math.random() > 0.3) vaccines.mr1 = addDays(dob, randomInt(270, 365));
      }
      if (ageInMonths >= 12) {
        if (vaccines.mr1 && Math.random() > 0.4) vaccines.mr2 = addDays(vaccines.mr1, randomInt(90, 180));
        if (vaccines.ipv1 && Math.random() > 0.4) vaccines.ipv2 = addDays(vaccines.ipv1, randomInt(180, 270));
      }
      
      const growth = [];
      let currentWeight = parseFloat(birthWeight);
      for (let m = 0; m <= Math.min(ageInMonths, 24); m += randomInt(2, 4)) {
        currentWeight += 0.3 + Math.random() * 0.4;
        growth.push({
          date: addDays(dob, m * 30),
          weightKg: parseFloat(currentWeight.toFixed(2)),
          heightCm: 45 + m * 2.5 + Math.random() * 3,
        });
      }
      
      const firstName = sex === "male" ? randomElement(maleFirstNames) : randomElement(firstNames);
      
      childrenData.push({
        name: `${firstName} ${randomElement(lastNames)}`,
        dob,
        sex,
        barangay,
        addressLine: `Purok ${randomInt(1, 8)}`,
        birthWeightKg: birthWeight,
        birthWeightCategory: parseFloat(birthWeight) >= 2.5 ? "normal" : "low",
        vaccines,
        vitaminA1Date: ageInMonths >= 6 && Math.random() > 0.3 ? addDays(dob, randomInt(180, 330)) : null,
        vitaminA2Date: ageInMonths >= 12 && Math.random() > 0.4 ? addDays(dob, randomInt(365, 540)) : null,
        ironSuppComplete: parseFloat(birthWeight) < 2.5 && Math.random() > 0.5,
        breastfedExclusively: ageInMonths <= 6 && Math.random() > 0.3,
        growth,
        nextVisitDate: addDays(todayStr, randomInt(-14, 30)),
      });
    }
  }
  
  await db.insert(children).values(childrenData);
  console.log(`Inserted ${childrenData.length} children`);
  return childrenData.length;
}

async function seedDiseaseCases() {
  console.log("Seeding disease cases...");
  const casesData = [];
  
  for (const barangay of barangays) {
    const count = randomInt(5, 15);
    
    for (let i = 0; i < count; i++) {
      const sex = Math.random() > 0.5 ? "male" : "female";
      const firstName = sex === "male" ? randomElement(maleFirstNames) : randomElement(firstNames);
      const age = randomInt(1, 80);
      
      const statuses = ["New", "Monitoring", "Referred", "Closed"];
      const statusWeights = [0.2, 0.3, 0.2, 0.3];
      let statusIndex = 0;
      const rand = Math.random();
      let cumulative = 0;
      for (let j = 0; j < statusWeights.length; j++) {
        cumulative += statusWeights[j];
        if (rand <= cumulative) {
          statusIndex = j;
          break;
        }
      }
      
      casesData.push({
        patientName: `${firstName} ${randomElement(lastNames)}`,
        age,
        barangay,
        addressLine: `Purok ${randomInt(1, 8)}`,
        phone: Math.random() > 0.5 ? randomPhone() : null,
        condition: randomElement(diseases),
        dateReported: randomDate(2025, 2025),
        status: statuses[statusIndex],
        notes: Math.random() > 0.7 ? "Under observation" : null,
      });
    }
  }
  
  await db.insert(diseaseCases).values(casesData);
  console.log(`Inserted ${casesData.length} disease cases`);
  return casesData.length;
}

async function seedTBPatients() {
  console.log("Seeding TB patients...");
  const tbData = [];
  
  for (const barangay of barangays) {
    const count = randomInt(2, 8);
    
    for (let i = 0; i < count; i++) {
      const sex = Math.random() > 0.4 ? "male" : "female";
      const firstName = sex === "male" ? randomElement(maleFirstNames) : randomElement(firstNames);
      const age = randomInt(18, 75);
      
      const treatmentStart = randomDate(2024, 2025);
      const startDate = new Date(treatmentStart);
      const now = today;
      const monthsOnTreatment = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      const phase = monthsOnTreatment < 2 ? "Intensive" : "Continuation";
      const outcomes = ["Ongoing", "Completed", "Transferred", "LTFU"];
      const outcome = monthsOnTreatment >= 6 
        ? (Math.random() > 0.7 ? "Completed" : randomElement(outcomes))
        : "Ongoing";
      
      const lastDoseDate = randomDate(2025, 2025);
      
      tbData.push({
        firstName,
        lastName: randomElement(lastNames),
        age,
        barangay,
        addressLine: `Purok ${randomInt(1, 8)}`,
        phone: Math.random() > 0.3 ? randomPhone() : null,
        tbType: Math.random() > 0.85 ? "Extra-pulmonary" : "Pulmonary",
        treatmentPhase: phase,
        treatmentStartDate: treatmentStart,
        lastObservedDoseDate: lastDoseDate,
        nextDotsVisitDate: addDays(lastDoseDate, randomInt(1, 7)),
        missedDosesCount: randomInt(0, 5),
        medsRegimenName: Math.random() > 0.5 ? "2HRZE/4HR" : "HRZE",
        referralToRHU: Math.random() > 0.8,
        nextSputumCheckDate: phase === "Intensive" ? addDays(treatmentStart, randomInt(60, 90)) : null,
        outcomeStatus: outcome,
      });
    }
  }
  
  await db.insert(tbPatients).values(tbData);
  console.log(`Inserted ${tbData.length} TB patients`);
  return tbData.length;
}

async function main() {
  console.log("Starting patient data seeding for all 20 Placer barangays...");
  console.log("NOTE: Seniors (DSWD data) are intentionally skipped by this script.\n");
  
  try {
    const motherCount = await seedMothers();
    const childCount = await seedChildren();
    const diseaseCount = await seedDiseaseCases();
    const tbCount = await seedTBPatients();
    
    console.log("\n=== Seeding Complete ===");
    console.log(`Total Mothers:       ${motherCount}`);
    console.log(`Total Children:      ${childCount}`);
    console.log(`Total Disease Cases: ${diseaseCount}`);
    console.log(`Total TB Patients:   ${tbCount}`);
    console.log(`\nData distributed across ${barangays.length} barangays`);
    console.log("Seniors (DSWD data) were NOT touched.");
    
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
