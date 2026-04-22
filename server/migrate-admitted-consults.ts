/**
 * migrate-admitted-consults.ts
 *
 * One-shot migration: the "Admitted" consult disposition was retired because
 * the municipality health center does not admit patients — any case that
 * warrants admission is referred out to a hospital or specialist first.
 *
 * This script converts every existing consult row with disposition = "Admitted"
 * to disposition = "Referred" in place. No other fields are touched.
 *
 * Run with:
 *   npx tsx server/migrate-admitted-consults.ts
 */

import { db } from "./db";
import { consults } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Checking for consults with disposition = 'Admitted'...");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(consults)
    .where(eq(consults.disposition, "Admitted"));

  if (!count) {
    console.log("No 'Admitted' consults found — nothing to migrate.");
    process.exit(0);
  }

  console.log(`Found ${count} consult(s) with disposition='Admitted'. Migrating to 'Referred'...`);

  const updated = await db
    .update(consults)
    .set({ disposition: "Referred" })
    .where(eq(consults.disposition, "Admitted"))
    .returning({ id: consults.id });

  console.log(`Migrated ${updated.length} consult(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error migrating consult dispositions:", err);
  process.exit(1);
});
