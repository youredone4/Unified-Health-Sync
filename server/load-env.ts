/**
 * Loads a local `.env` file into process.env, if one exists.
 *
 * Import this (for its side effect) before reading any environment
 * variable. Variables already present in the real environment always win,
 * so in Docker — where docker-compose injects the values — this is a no-op.
 */
import fs from "fs";
import path from "path";

const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}
