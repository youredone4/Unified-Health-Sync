/**
 * Database migration runner.
 *
 *   npm run db:migrate                 apply any pending migrations
 *   npm run db:migrate -- --baseline   adopt a database restored from the old
 *                                      Replit deployment, then bring it up to date
 *   npm run db:migrate -- --check      only compare the database with what
 *                                      this version expects; changes nothing
 *
 * Use --baseline exactly once, on a database whose tables already exist
 * because it was created by `drizzle-kit push` (i.e. a dump restored from
 * the old Replit database). It records the FIRST migration (the schema as
 * it was on Replit) as already applied without running it, then applies
 * every later migration normally. A brand-new empty database never needs it.
 *
 * In the Docker image this is bundled to dist/migrate.cjs and run
 * automatically before the server starts.
 */
import "../server/load-env";
import fs from "fs";
import path from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "migrations");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

async function main() {
  const baseline = process.argv.includes("--baseline");
  const checkOnly = process.argv.includes("--check");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. See .env.example.");
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    if (checkOnly) {
      const problems = await schemaProblems(pool);
      if (problems.length > 0) {
        throw new Error(describeProblems(problems));
      }
      console.log("[migrate] The database has every table and column this version expects.");
      return;
    }

    const applied = await countApplied(pool);
    const hasExistingSchema = await tableExists(pool, "public", "users");

    if (baseline) {
      if (!hasExistingSchema) {
        throw new Error(
          "--baseline is only for a database that already has the HealthSync tables. " +
            "This database is empty — run `npm run db:migrate` without --baseline.",
        );
      }
      if (applied > 0) {
        throw new Error(
          `--baseline refused: ${applied} migration(s) are already recorded. Run \`npm run db:migrate\` instead.`,
        );
      }
      // Only the first migration describes what Replit's `drizzle-kit push`
      // had already created. Everything after it (account security, two-step
      // sign-in, ...) is NOT in a Replit database and must really run, so it
      // is left for migrate() below. Marking those as applied too would leave
      // the tables without the new columns and every sign-in would fail.
      const [first] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
      await pool.query(
        `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
           id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
      );
      await pool.query(
        `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
        [first.hash, first.folderMillis],
      );
      console.log("[migrate] Baseline recorded: the existing tables are taken as the starting point.");
    } else if (applied === 0 && hasExistingSchema) {
      throw new Error(
        "This database already has HealthSync tables but no migration history " +
          "(it was probably restored from the Replit database).\n" +
          "Run once:  npm run db:migrate -- --baseline\n" +
          "See docs/deployment.md, 'Moving your data from Replit'.",
      );
    }

    await migrate(drizzle(pool), {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });
    const ran = (await countApplied(pool)) - applied - (baseline ? 1 : 0);
    if (ran > 0) console.log(`[migrate] Applied ${ran} migration(s).`);

    // Prove the result rather than assume it. A restored database can differ
    // from what the code expects (for example if the Replit database was
    // behind the code that was running against it).
    const problems = await schemaProblems(pool);
    if (problems.length > 0) {
      if (baseline) {
        throw new Error(describeProblems(problems));
      }
      // At a normal start-up, say so loudly but let the app run: most of it
      // will still work, and stopping here would take the whole system down.
      console.error(`[migrate] WARNING: ${describeProblems(problems)}`);
    }
    console.log("[migrate] Database is up to date.");
  } finally {
    await pool.end();
  }
}

/**
 * Tables and columns the newest migration expects but the database lacks.
 * Reads the schema snapshot drizzle-kit writes next to each migration.
 */
async function schemaProblems(pool: pg.Pool): Promise<string[]> {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"));
  const last = journal.entries[journal.entries.length - 1];
  const snapshotFile = path.join(MIGRATIONS_FOLDER, "meta", `${String(last.idx).padStart(4, "0")}_snapshot.json`);
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));

  const { rows } = await pool.query(
    "SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema')",
  );
  const present = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.table_schema}.${r.table_name}`;
    if (!present.has(key)) present.set(key, new Set());
    present.get(key)!.add(r.column_name);
  }

  const problems: string[] = [];
  for (const table of Object.values<any>(snapshot.tables)) {
    const key = `${table.schema || "public"}.${table.name}`;
    const columns = present.get(key);
    if (!columns) {
      problems.push(`table ${table.name} is missing`);
      continue;
    }
    for (const column of Object.values<any>(table.columns)) {
      if (!columns.has(column.name)) problems.push(`column ${table.name}.${column.name} is missing`);
    }
  }
  return problems;
}

function describeProblems(problems: string[]): string {
  const shown = problems.slice(0, 40).map((p) => `  - ${p}`).join("\n");
  const more = problems.length > 40 ? `\n  ... and ${problems.length - 40} more` : "";
  return (
    `the database does not match what this version of HealthSync expects (${problems.length} difference(s)):\n` +
    `${shown}${more}\n` +
    "Parts of the system will fail until this is fixed. Keep this list and the\n" +
    "database dump, and do not let staff start using the system yet."
  );
}

async function tableExists(pool: pg.Pool, schema: string, table: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
    [schema, table],
  );
  return rows.length > 0;
}

async function countApplied(pool: pg.Pool): Promise<number> {
  if (!(await tableExists(pool, MIGRATIONS_SCHEMA, MIGRATIONS_TABLE))) return 0;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
  );
  return rows[0].n;
}

main().catch((err) => {
  console.error(`[migrate] FAILED: ${err.message || err}`);
  process.exit(1);
});
