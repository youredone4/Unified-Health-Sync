import "./server/load-env";
import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only reads the schema and never connects, so a
// placeholder is fine there. `push` / `studio` need the real DATABASE_URL.
const url = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
