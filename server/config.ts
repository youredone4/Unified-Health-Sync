/**
 * Central, validated runtime configuration.
 *
 * Every environment variable the server depends on is declared and
 * validated here, once, at startup. If something required is missing or
 * malformed the process exits immediately with a readable message instead
 * of booting half-configured (e.g. signing sessions with an undefined
 * secret).
 *
 * Local development: put values in a `.env` file at the repo root (see
 * `.env.example`). It is loaded automatically if present. In Docker the
 * values come from docker-compose / the container environment instead.
 */
import "./load-env";
import { z } from "zod";

const TRUE_VALUES = ["true", "1"];
const FALSE_VALUES = ["false", "0"];

/** Boolean env var. Unset or empty means `fallback`; anything unrecognised is an error. */
function boolEnv<T extends boolean | undefined>(fallback: T) {
  return z
    .string()
    .optional()
    .transform((raw, ctx): boolean | T => {
      const v = (raw ?? "").trim().toLowerCase();
      if (v === "") return fallback;
      if (TRUE_VALUES.includes(v)) return true;
      if (FALSE_VALUES.includes(v)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be "true" or "false"' });
      return z.NEVER;
    });
}

const schema = z.object({
  // The production bundle has `process.env.NODE_ENV` compiled in as
  // "production" (script/build.ts), so `node dist/index.cjs` is always a
  // production server even if the variable is not set in the environment.
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default(process.env.NODE_ENV === "production" ? "production" : "development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required (postgres://user:pass@host:5432/db)" })
    .url("DATABASE_URL must be a postgres:// connection URL"),

  SESSION_SECRET: z
    .string({ required_error: "SESSION_SECRET is required. Generate one with: openssl rand -hex 32" })
    .min(32, "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32"),

  // Number of reverse-proxy hops in front of the app. Needed so req.ip and
  // secure cookies work behind TLS termination. Defaults to 0 (trust
  // nothing): with no proxy in front, a client could otherwise forge its
  // IP address with an X-Forwarded-For header and dodge the login rate
  // limit. docker-compose.yml sets this to 1 for Caddy.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  // Set to false ONLY for local HTTP testing of a production build.
  COOKIE_SECURE: boolEnv(undefined),

  // A session ends after this long without any request...
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  // ...and no session outlives this, however active (forces a daily login).
  SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(72).default(12),

  // Consecutive wrong passwords before an account is locked, and for how long.
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(15),
  // Failed sign-ins allowed from one network address per 15 minutes before
  // that address is paused. Everyone in an office usually shares one
  // address, so raise this for a large site with many mistyped passwords.
  LOGIN_IP_MAX_FAILURES: z.coerce.number().int().min(5).max(100000).default(30),

  // Roles that MUST use two-step sign-in (an authenticator app). Comma
  // separated; "none" turns the requirement off. Anyone else may opt in
  // from their account page.
  MFA_REQUIRED_ROLES: z
    .string()
    .default("SYSTEM_ADMIN")
    .transform((raw, ctx) => {
      const known = ["SYSTEM_ADMIN", "MHO", "SHA", "TL", "MAYOR", "HEALTH_COMMITTEE"];
      if (raw.trim().toLowerCase() === "none") return [] as string[];
      const roles = raw.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);
      const unknown = roles.filter((r) => !known.includes(r));
      if (unknown.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown role(s): ${unknown.join(", ")}. Use ${known.join(", ")} or "none"` });
        return z.NEVER;
      }
      return roles;
    }),
  // Name shown in the authenticator app next to the account.
  MFA_ISSUER: z.string().trim().min(1).max(40).default("HealthSync"),

  // OpenAI (AI insights + plain-language recommendation summaries).
  // Optional: when unset the AI endpoints return 503 and the rest of the
  // system works normally.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Background scheduler (daily alerts, DOH scraper). Disable on extra
  // replicas so jobs don't run twice.
  SCHEDULER_ENABLED: boolEnv(true),

  // Inserts FABRICATED patients and records for demos / testing. Must stay
  // false on any database that holds, or will hold, real patient data.
  SEED_DEMO_DATA: boolEnv(false),
});

// docker-compose passes unset optional variables through as empty strings;
// treat those the same as "not set".
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ""),
);

const parsed = schema.safeParse(rawEnv);
if (!parsed.success) {
  console.error("\n[config] Invalid or missing configuration:\n");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(env)"}: ${issue.message}`);
  }
  console.error("\nSee .env.example for every supported setting.\n");
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProduction: env.NODE_ENV === "production",
  // Secure cookies default ON in production; can be forced off explicitly.
  cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  aiEnabled: Boolean(env.OPENAI_API_KEY),
} as const;

export type AppConfig = typeof config;
