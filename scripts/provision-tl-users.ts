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
 * Users should change their password after first login via their profile page.
 *
 * Barangay name notes (staff list → DB name):
 *   "Amogis"    → Amoslog        (alternate spelling)
 *   "Magpayang" → Magupange      (alternate spelling)
 */

import { db } from "../server/db";
import { users, userBarangays, barangays } from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";

const DEFAULT_PASSWORD = "123456";

interface TLUserSpec {
  username: string;
  firstName: string;
  lastName: string;
  barangayNames: string[];
}

const TL_USERS: TLUserSpec[] = [
  {
    username: "CHapa",
    firstName: "Carespin",
    lastName: "Hapa",
    barangayNames: ["Mabini"],
  },
  {
    username: "ADeramaso",
    firstName: "April",
    lastName: "Deramaso",
    barangayNames: ["Ellaperal (Nonok)"],
  },
  {
    username: "RPolestico",
    firstName: "Ranibeth",
    lastName: "Polestico",
    barangayNames: ["Central (Poblacion)"],
  },
  {
    username: "BBarcos",
    firstName: "Wilgen",
    lastName: "Barcos",
    barangayNames: ["Boyongan", "Macalaya"],
  },
  {
    username: "PPagobo",
    firstName: "Princess Jackie",
    lastName: "Pagobo",
    barangayNames: ["San Isidro", "Magupange"],
  },
  {
    username: "CGalvez",
    firstName: "Charlito",
    lastName: "Galvez",
    // "San Jose" on staff list was a typo — correct barangay is Sani-sani
    barangayNames: ["Sani-sani"],
  },
  {
    username: "RRivera",
    firstName: "Ruth",
    lastName: "Rivera",
    // "Magpayang" on staff list → Magupange in DB
    barangayNames: ["Magupange"],
  },
  {
    username: "RJamiel",
    firstName: "Rennie",
    lastName: "Jamiel",
    // "Amogis" on staff list → Amoslog in DB
    barangayNames: ["Amoslog"],
  },
  {
    username: "BBullas",
    firstName: "Jensen",
    lastName: "Bullas",
    barangayNames: ["Panhutongan"],
  },
  {
    username: "RDalgume",
    firstName: "Meljay",
    lastName: "Dalgume",
    barangayNames: ["Tagbongabong"],
  },
  {
    username: "LLlado",
    firstName: "Risha Ann",
    lastName: "Llado",
    barangayNames: ["Anislagan"],
  },
  {
    username: "DOcol",
    firstName: "Dulce Mae",
    lastName: "Ocol",
    barangayNames: ["Suyoc", "Bugas-bugas"],
  },
];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function main() {
  console.log("=== HealthSync TL User Provisioning Script ===\n");

  // Load all barangays into a name→id map
  const allBarangays = await db.select().from(barangays);
  const barangayMap = new Map<string, number>(
    allBarangays.map((b) => [b.name, b.id])
  );

  console.log(`Loaded ${allBarangays.length} barangays from DB\n`);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const spec of TL_USERS) {
    try {
      // Check if username already exists — skip cleanly if so
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, spec.username));

      if (existing) {
        console.log(`SKIP: ${spec.username} (already exists, id=${existing.id})`);
        skipped++;
        continue;
      }

      // Resolve barangay names to IDs
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

      // Hash per-user (unique salt per account even with the same plaintext)
      const passwordHash = await hashPassword(DEFAULT_PASSWORD);

      // Wrap user insert + barangay assignment in a transaction so partial
      // failures don't leave orphaned users without assignments
      await db.transaction(async (tx) => {
        const [newUser] = await tx
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

        await tx.insert(userBarangays).values(
          barangayIds.map((bId) => ({
            userId: newUser.id,
            barangayId: bId,
          }))
        );
      });

      console.log(
        `CREATED: ${spec.username} (${spec.firstName} ${spec.lastName}) → ${resolvedNames.join(", ")}`
      );
      created++;
    } catch (err: unknown) {
      const msg = `ERROR: ${spec.username} — ${getErrorMessage(err)}`;
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
  console.log(
    "Remind users to change their password after first login via their profile page."
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", getErrorMessage(err));
  process.exit(1);
});
