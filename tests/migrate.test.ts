/**
 * Migration tests. They prove the three ways a database reaches the current
 * schema all end in the same place:
 *
 *   1. a brand-new empty database,
 *   2. a database restored from the old Replit deployment (`--baseline`),
 *   3. the same, started without `--baseline` (must refuse, not guess).
 *
 * The second one matters most: it is run once, by hand, on real data, and a
 * mistake there leaves a system nobody can sign in to. This test fails if a
 * migration is added later and `--baseline` does not apply it.
 *
 *   DATABASE_URL=postgres://user:pass@host:port/anydb ALLOW_TEST_RESET=true npm run test:migrate
 *
 * DATABASE_URL must be a THROWAWAY server whose user may create databases.
 * The tests create and drop their own scratch databases (hs_migrate_test_*)
 * and never touch the database named in the URL.
 */
import "../server/load-env";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import pg from "pg";

if (process.env.ALLOW_TEST_RESET !== "true" || !process.env.DATABASE_URL) {
  console.error(
    "\nRefusing to run: these tests create and drop scratch databases.\n" +
      "Point DATABASE_URL at a throwaway PostgreSQL server and set ALLOW_TEST_RESET=true.\n",
  );
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, "..");
const RUN = Date.now().toString(36);
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const created: string[] = [];

function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function scratchDatabase(label: string): Promise<string> {
  const name = `hs_migrate_test_${label}_${RUN}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  created.push(name);
  return name;
}

async function withDb<T>(database: string, fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: urlFor(database), max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

function runMigrate(database: string, ...args: string[]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "script/migrate.ts", ...args], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: urlFor(database) },
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** Every table.column in the public schema, sorted: the shape of a database. */
async function shape(database: string): Promise<string[]> {
  return withDb(database, async (pool) => {
    const { rows } = await pool.query(
      `SELECT table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable AS c
         FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1`,
    );
    return rows.map((r) => r.c);
  });
}

const journal = JSON.parse(fs.readFileSync(path.join(ROOT, "migrations/meta/_journal.json"), "utf8"));
const migrationCount: number = journal.entries.length;
const firstMigration = fs.readFileSync(path.join(ROOT, "migrations", `${journal.entries[0].tag}.sql`), "utf8");

/** A database as Replit left it: the original tables, no migration history, some rows. */
async function replitStyleDatabase(label: string): Promise<string> {
  const name = await scratchDatabase(label);
  await withDb(name, async (pool) => {
    for (const statement of firstMigration.split("--> statement-breakpoint")) {
      if (statement.trim()) await pool.query(statement);
    }
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role) VALUES ('legacy-admin', 'admin', 'x', 'SYSTEM_ADMIN')`,
    );
    await pool.query(
      `INSERT INTO mothers (first_name, last_name, age, barangay, registration_date, ga_weeks)
       VALUES ('Legacy', 'Mother', 27, 'Amoslog', '2026-05-02', 20)`,
    );
  });
  return name;
}

let freshShape: string[] = [];

before(async () => {
  const fresh = await scratchDatabase("fresh");
  const run = runMigrate(fresh);
  assert.equal(run.status, 0, run.output);
  freshShape = await shape(fresh);
  assert.ok(freshShape.length > 500, "the fresh database looks far too small");
});

after(async () => {
  for (const name of created) {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => {});
  }
  await admin.end();
});

test("a fresh database passes its own check and migrating again changes nothing", async () => {
  const name = created[0];
  assert.equal(runMigrate(name, "--check").status, 0);
  const again = runMigrate(name);
  assert.equal(again.status, 0, again.output);
  assert.deepEqual(await shape(name), freshShape);
});

test("a database restored from Replit ends up identical to a fresh one, data intact", async () => {
  const name = await replitStyleDatabase("replit");
  const run = runMigrate(name, "--baseline");
  assert.equal(run.status, 0, run.output);

  assert.deepEqual(await shape(name), freshShape, "the adopted database differs from a fresh one");
  await withDb(name, async (pool) => {
    const recorded = await pool.query(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
    assert.equal(recorded.rows[0].n, migrationCount, "every migration must be recorded exactly once");
    const user = await pool.query(`SELECT username, must_change_password FROM users WHERE id = 'legacy-admin'`);
    assert.equal(user.rows[0].username, "admin");
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM mothers`)).rows[0].n, 1);
  });

  // It is a one-time step: a second --baseline is refused, a normal run is a no-op.
  assert.notEqual(runMigrate(name, "--baseline").status, 0);
  assert.equal(runMigrate(name).status, 0);
  assert.equal(runMigrate(name, "--check").status, 0);
});

test("a restored database is never migrated without --baseline", async () => {
  const name = await replitStyleDatabase("nobaseline");
  const run = runMigrate(name);
  assert.notEqual(run.status, 0);
  assert.match(run.output, /--baseline/);
  await withDb(name, async (pool) => {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'must_change_password'`,
    );
    assert.equal(rows.length, 0, "nothing may be changed before the operator confirms with --baseline");
  });
});

test("--baseline refuses an empty database", async () => {
  const name = await scratchDatabase("empty");
  const run = runMigrate(name, "--baseline");
  assert.notEqual(run.status, 0);
  assert.match(run.output, /empty/);
});

test("a database missing something the code needs is reported, by name", async () => {
  const name = await replitStyleDatabase("behind");
  // The Replit database was behind the code: one table and one column never created.
  await withDb(name, async (pool) => {
    await pool.query(`DROP TABLE medical_certificates CASCADE`);
    await pool.query(`ALTER TABLE mothers DROP COLUMN sms_opt_in`);
  });
  const check = runMigrate(name, "--check");
  assert.notEqual(check.status, 0);
  assert.match(check.output, /table medical_certificates is missing/);
  assert.match(check.output, /column mothers\.sms_opt_in is missing/);
});
