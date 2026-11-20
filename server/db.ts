import "./load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set (postgres://user:password@host:5432/dbname). See .env.example.",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// An idle client erroring (e.g. the database restarting) must not crash the
// whole server; the pool discards the client and reconnects on next use.
pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

export const db = drizzle(pool, { schema });
