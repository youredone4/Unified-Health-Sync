/**
 * Server-side account administration. Run on the server itself — it talks
 * straight to the database, so being able to run it means you already
 * control the machine.
 *
 *   create-admin <username> [--first-name X] [--last-name Y]
 *       Create a System Admin. Use this once, to create the first account.
 *
 *   reset-password <username>
 *       Issue a new temporary password, clear any lockout and sign the
 *       account out everywhere. This is also how you recover an account
 *       that was refused for still using an old default password.
 *
 *   reset-mfa <username>
 *       Switch off two-step sign-in for an account whose owner lost both
 *       their phone and their recovery codes. If their role requires
 *       two-step sign-in they set it up again at next login.
 *
 *   list
 *       Show accounts, roles and status (never passwords).
 *
 * Docker:  docker compose exec app node dist/admin.cjs <command>
 * Local:   npm run admin -- <command>
 *
 * A temporary password is printed exactly once. Whoever receives it must
 * replace it at first login; nothing else works until they do.
 */
import "../server/load-env";
import pg from "pg";
import { hashPassword, generateTemporaryPassword } from "../server/passwords";

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

function flag(args: string[], name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

function printTemporaryPassword(username: string, password: string) {
  console.log("");
  console.log(`  Username:            ${username}`);
  console.log(`  Temporary password:  ${password}`);
  console.log("");
  console.log("  This password is shown only once and is not stored anywhere readable.");
  console.log("  Give it to the account owner privately. They must set their own");
  console.log("  password the first time they log in.");
  console.log("");
}

async function createAdmin(pool: pg.Pool, args: string[]) {
  const username = args[0];
  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new Error("Usage: create-admin <username>   (3-50 letters, numbers, dots, dashes or underscores)");
  }
  const existing = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
  if (existing.rowCount) {
    throw new Error(`An account named "${username}" already exists. Use: reset-password ${username}`);
  }

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, role, status, must_change_password)
     VALUES ($1, $2, $3, $4, 'SYSTEM_ADMIN', 'ACTIVE', true)`,
    [username, passwordHash, flag(args, "--first-name"), flag(args, "--last-name")],
  );
  await audit(pool, "CREATE", username, { role: "SYSTEM_ADMIN", via: "cli" });

  console.log("\nSystem Admin account created.");
  printTemporaryPassword(username, password);
}

async function resetPassword(pool: pg.Pool, args: string[]) {
  const username = args[0];
  if (!username) throw new Error("Usage: reset-password <username>");

  const found = await pool.query("SELECT id, status FROM users WHERE username = $1", [username]);
  if (!found.rowCount) throw new Error(`No account named "${username}".`);
  const { id, status } = found.rows[0];

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  await pool.query(
    `UPDATE users
        SET password_hash = $1, must_change_password = true,
            failed_login_count = 0, locked_until = NULL, updated_at = (now() AT TIME ZONE 'utc')
      WHERE id = $2`,
    [passwordHash, id],
  );
  // Sign the account out everywhere.
  await pool.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [id]);
  await audit(pool, "PASSWORD_RESET", username, { via: "cli" }, id);

  console.log("\nPassword reset.");
  if (status !== "ACTIVE") {
    console.log(`  Note: this account's status is ${status}; it cannot log in until a System Admin activates it.`);
  }
  printTemporaryPassword(username, password);
}

async function resetMfa(pool: pg.Pool, args: string[]) {
  const username = args[0];
  if (!username) throw new Error("Usage: reset-mfa <username>");

  const found = await pool.query("SELECT id, totp_enabled_at FROM users WHERE username = $1", [username]);
  if (!found.rowCount) throw new Error(`No account named "${username}".`);
  const { id, totp_enabled_at } = found.rows[0];
  if (!totp_enabled_at) {
    console.log(`\nTwo-step sign-in is not on for "${username}"; nothing to do.\n`);
    return;
  }

  await pool.query(
    `UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL,
            updated_at = (now() AT TIME ZONE 'utc') WHERE id = $1`,
    [id],
  );
  await pool.query("DELETE FROM user_recovery_codes WHERE user_id = $1", [id]);
  await pool.query("DELETE FROM sessions WHERE sess->>'userId' = $1", [id]);
  await audit(pool, "MFA_RESET", username, { via: "cli" }, id);

  console.log(`\nTwo-step sign-in switched off for "${username}" and the account signed out everywhere.`);
  console.log("If their role requires it, they will be asked to set it up again at next login.\n");
}

async function list(pool: pg.Pool) {
  // Timestamp columns hold UTC without a zone (that is how the app writes
  // them), so comparisons and formatting are done in SQL, in UTC.
  const { rows } = await pool.query(
    `SELECT username, role, status, must_change_password,
            (totp_enabled_at IS NOT NULL) AS two_step,
            COALESCE(locked_until > (now() AT TIME ZONE 'utc'), false) AS locked,
            to_char(last_login_at, 'YYYY-MM-DD HH24:MI') AS last_login_utc
       FROM users ORDER BY role, username`,
  );
  if (rows.length === 0) {
    console.log("No accounts yet. Create the first one with: create-admin <username>");
    return;
  }
  console.table(
    rows.map((r) => ({
      username: r.username,
      role: r.role,
      status: r.status,
      "must change password": r.must_change_password ? "yes" : "no",
      "two-step": r.two_step ? "on" : "off",
      locked: r.locked ? "yes" : "no",
      "last login (UTC)": r.last_login_utc ?? "never",
    })),
  );
}

async function audit(pool: pg.Pool, action: string, username: string, details: object, entityId?: string) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, after_json)
       VALUES ('SERVER_CLI', 'SERVER_CLI', $1, 'USER', $2, $3)`,
      [action, entityId ?? null, JSON.stringify({ username, ...details })],
    );
  } catch (err) {
    console.warn(`(could not write audit log entry: ${(err as Error).message})`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    console.log(
      "Commands:\n" +
        "  create-admin <username> [--first-name X] [--last-name Y]\n" +
        "  reset-password <username>\n" +
        "  reset-mfa <username>\n" +
        "  list",
    );
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set. See .env.example.");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    if (command === "create-admin") await createAdmin(pool, args);
    else if (command === "reset-password") await resetPassword(pool, args);
    else if (command === "reset-mfa") await resetMfa(pool, args);
    else if (command === "list") await list(pool);
    else throw new Error(`Unknown command "${command}". Run with --help.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\n[admin] ${err.message || err}\n`);
  process.exit(1);
});
