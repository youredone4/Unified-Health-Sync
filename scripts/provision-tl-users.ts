/**
 * provision-tl-users.ts
 *
 * One-time (idempotent) script to create 12 Team Leader accounts
 * for the Municipality of Placer, Surigao del Norte.
 *
 * Run with:  npx tsx scripts/provision-tl-users.ts
 *
 * Safe to re-run: skips any username that already exists.
 * Default password for all accounts: 123456
 * Users should change their password after first login.
 *
 * Barangay name notes:
 *   "Amogis" (request) → Amoslog (ID 16) in DB
 *   "Magpayang" (request) → Magupange (ID 26) in DB
 *   "San Jose" → Added as new barangay (ID 33)
 *   "Mabuhay" → Added as new barangay (ID 34)
 */

import { db } from "../server/db";
import { users, userBarangays, barangays } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const DEFAULT_PASSWORD = "123456";
const SALT_ROUNDS = 10;

interface TLUserSpec {
  username: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  barangayNames: string[];
}

const TL_USERS: TLUserSpec[] = [
  {
    username: "CHapa",
    firstName: "Carespin",
    middleName: "V.",
    lastName: "Hapa",
    barangayNames: ["Mabini"],
  },
  {
    username: "ADeramaso",
    firstName: "April",
    middleName: "T.",
    lastName: "Deramaso",
    barangayNames: ["Ellaperal (Nonok)"],
  },
  {
    username: "RPolestico",
    firstName: "Ranibeth",
    middleName: "P.",
    lastName: "Polestico",
    barangayNames: ["Central (Poblacion)"],
  },
  {
    username: "BBarcos",
    firstName: "Wilgen",
    middleName: "C.",
    lastName: "Barcos",
    barangayNames: ["Boyongan", "Macalaya"],
  },
  {
    username: "PPagobo",
    firstName: "Princess Jackie",
    middleName: "B.",
    lastName: "Pagobo",
    barangayNames: ["San Isidro", "Mabuhay"],
  },
  {
    username: "CGalvez",
    firstName: "Charlito",
    middleName: "D.",
    lastName: "Galvez",
    barangayNames: ["San Jose"],
  },
  {
    username: "RRivera",
    firstName: "Ruth",
    middleName: "E.",
    lastName: "Rivera",
    // "Magpayang" from request → Magupange in DB
    barangayNames: ["Magupange"],
  },
  {
    username: "RJamiel",
    firstName: "Rennie",
    middleName: "M.",
    lastName: "Jamiel",
    // "Amogis" from request → Amoslog in DB
    barangayNames: ["Amoslog"],
  },
  {
    username: "BBullas",
    firstName: "Jensen",
    middleName: "B.",
    lastName: "Bullas",
    barangayNames: ["Panhutongan"],
  },
  {
    username: "RDalgume",
    firstName: "Meljay",
    middleName: "R.",
    lastName: "Dalgume",
    barangayNames: ["Tagbongabong"],
  },
  {
    username: "LLlado",
    firstName: "Risha Ann",
    middleName: "C.",
    lastName: "Llado",
    barangayNames: ["Anislagan"],
  },
  {
    username: "DOcol",
    firstName: "Dulce Mae",
    middleName: "D.",
    lastName: "Ocol",
    barangayNames: ["Suyoc", "Bugas-bugas"],
  },
];

async function main() {
  console.log("=== HealthSync TL User Provisioning Script ===\n");

  // Load all barangays into a name→id map
  const allBarangays = await db.select().from(barangays);
  const barangayMap = new Map<string, number>(
    allBarangays.map((b) => [b.name, b.id])
  );

  console.log(`Loaded ${allBarangays.length} barangays from DB\n`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const spec of TL_USERS) {
    try {
      // Check if username already exists
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, spec.username));

      if (existing) {
        console.log(`SKIP: ${spec.username} (already exists, id=${existing.id})`);
        skipped++;
        continue;
      }

      // Resolve barangay IDs
      const barangayIds: number[] = [];
      const resolvedNames: string[] = [];
      for (const bName of spec.barangayNames) {
        const bId = barangayMap.get(bName);
        if (!bId) {
          throw new Error(`Barangay not found in DB: "${bName}"`);
        }
        barangayIds.push(bId);
        resolvedNames.push(`${bName} (ID ${bId})`);
      }

      // Insert user
      const [newUser] = await db
        .insert(users)
        .values({
          username: spec.username,
          passwordHash,
          firstName: spec.firstName,
          lastName: spec.lastName,
          role: "TL",
          status: "ACTIVE",
        })
        .returning({ id: users.id });

      // Assign barangays
      await db.insert(userBarangays).values(
        barangayIds.map((bId) => ({
          userId: newUser.id,
          barangayId: bId,
        }))
      );

      console.log(
        `CREATED: ${spec.username} (${spec.firstName} ${spec.lastName}) → ${resolvedNames.join(", ")}`
      );
      created++;
    } catch (err: any) {
      const msg = `ERROR: ${spec.username} — ${err.message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created:  ${created}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Errors:   ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(" -", e));
    process.exit(1);
  }

  console.log("\nAll TL accounts provisioned successfully.");
  console.log(`Default password: ${DEFAULT_PASSWORD}`);
  console.log("Remind users to change their password after first login via their profile page.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
