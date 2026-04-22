/**
 * reset-test-data.ts
 * Safe truncate-only reset for the HealthSync TEST database.
 *
 * Usage:
 *   npx tsx server/reset-test-data.ts --dry-run          (prints row counts, no changes)
 *   ALLOW_TEST_RESET=true npx tsx server/reset-test-data.ts --confirm
 *
 * Safety gates:
 *   - ALLOW_TEST_RESET=true env var required
 *   - --confirm flag required (else --dry-run only)
 *   - Optional PRODUCTION_DB_HOST env var — refuses if DATABASE_URL host matches
 *   - Prints host + db name and waits 5 seconds before executing
 *   - Runs inside a single transaction; rolls back on any error
 *   - Prints before/after row counts; exits non-zero if any post-truncate count > 0
 *
 * Tables PRESERVED (never touched):
 *   seniors, senior_visits, senior_med_claims
 *   users, sessions, barangays, user_barangays, barangay_settings,
 *   municipality_settings, theme_settings, health_stations, audit_logs
 *   m1_template_versions, m1_indicator_catalog
 */

import { pool } from "./db";

const isDryRun = process.argv.includes("--dry-run");
const isConfirm = process.argv.includes("--confirm");

// Tables to truncate — ordered to satisfy FK constraints (children first)
const TABLES_TO_TRUNCATE = [
  "prenatal_visits",
  "child_visits",
  "fp_service_records",
  "consults",
  "disease_cases",
  "tb_patients",
  "death_events",
  "m1_indicator_values",
  "m1_report_header",
  "m1_report_instances",
  "mothers",
  "children",
  "inventory",
  "medicine_inventory",
  "sms_outbox",
  "global_chat_messages",
  "messages",
  "conversations",
  "direct_messages",
];

function parseDbUrl(url: string): { host: string; database: string } {
  try {
    const u = new URL(url);
    return { host: u.hostname, database: u.pathname.replace(/^\//, "") };
  } catch {
    return { host: "unknown", database: "unknown" };
  }
}

async function getRowCount(client: any, table: string): Promise<number> {
  try {
    const res = await client.query(`SELECT COUNT(*) AS n FROM "${table}"`);
    return parseInt(res.rows[0].n, 10);
  } catch {
    return -1;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  const { host, database } = parseDbUrl(dbUrl);
  const productionHost = process.env.PRODUCTION_DB_HOST;

  console.log("=".repeat(60));
  console.log("HealthSync TEST Database Reset Script");
  console.log("=".repeat(60));
  console.log(`Host:     ${host}`);
  console.log(`Database: ${database}`);
  console.log(`Mode:     ${isDryRun ? "DRY-RUN (no changes)" : "LIVE RESET"}`);
  console.log("=".repeat(60));

  if (!isDryRun && !isConfirm) {
    console.error("\nERROR: Pass --confirm to execute, or --dry-run to preview.");
    process.exit(1);
  }

  if (!isDryRun) {
    if (!process.env.ALLOW_TEST_RESET) {
      console.error("\nERROR: Set ALLOW_TEST_RESET=true to proceed with a live reset.");
      process.exit(1);
    }

    if (productionHost && host === productionHost) {
      console.error(`\nERROR: DATABASE_URL host (${host}) matches PRODUCTION_DB_HOST. Refusing to reset production.`);
      process.exit(1);
    }

    console.log("\nWARNING: This will permanently delete data from the tables listed below.");
    console.log("Proceeding in 5 seconds... (Ctrl+C to abort)\n");
    await sleep(5000);
  }

  const client = await pool.connect();

  try {
    console.log("\n--- Before row counts ---");
    const before: Record<string, number> = {};
    for (const table of TABLES_TO_TRUNCATE) {
      const count = await getRowCount(client, table);
      before[table] = count;
      console.log(`  ${table.padEnd(30)} ${count >= 0 ? count : "table not found"}`);
    }

    if (isDryRun) {
      console.log("\nDry-run complete. No changes made.");
      await client.release();
      process.exit(0);
    }

    console.log("\nExecuting TRUNCATE inside a transaction...");
    await client.query("BEGIN");

    const tableList = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");
    await client.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);

    await client.query("COMMIT");
    console.log("Transaction committed.\n");

    console.log("--- After row counts ---");
    let failed = false;
    for (const table of TABLES_TO_TRUNCATE) {
      const count = await getRowCount(client, table);
      const ok = count === 0;
      if (!ok && count >= 0) failed = true;
      console.log(`  ${table.padEnd(30)} ${count >= 0 ? count : "table not found"} ${count === 0 ? "OK" : count < 0 ? "" : "WARN: not zero!"}`);
    }

    console.log("\n=== Reset Summary ===");
    for (const table of TABLES_TO_TRUNCATE) {
      const b = before[table];
      console.log(`  ${table.padEnd(30)} ${b} → 0`);
    }

    if (failed) {
      console.error("\nERROR: Some tables still have rows after truncation.");
      process.exit(1);
    }

    console.log("\nReset complete. DSWD seniors and auth data are untouched.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\nERROR: Transaction rolled back due to:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(0);
}

main();
