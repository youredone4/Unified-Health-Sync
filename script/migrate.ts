/**
 * Database migration runner.
 *
 *   npm run db:migrate                 apply any pending migrations
 *   npm run db:migrate -- --baseline   mark all current migrations as already
 *                                      applied WITHOUT running them
 *
 * Use --baseline exactly once, on a database whose tables already exist
 * because it was created by `drizzle-kit push` (i.e. a dump restored from
 * the old Replit database). A brand-new empty database never needs it.
 *
 * In the Docker image this is bundled to dist/migrate.cjs and run
 * automatically before the server starts.
 */
import "../server/load-env";
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

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. See .env.example.");
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
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
      const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
      await pool.query(
        `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
           id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
      );
      for (const m of migrations) {
        await pool.query(
          `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) VALUES ($1, $2)`,
          [m.hash, m.folderMillis],
        );
      }
      console.log(`[migrate] Baseline recorded: ${migrations.length} migration(s) marked as applied.`);
      return;
    }

    if (applied === 0 && hasExistingSchema) {
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
    console.log("[migrate] Database is up to date.");
  } finally {
    await pool.end();
  }
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
