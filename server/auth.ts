/**
 * Authentication: sessions, login / logout, and "my account" endpoints.
 *
 * Accounts are created by a System Admin (server/routes/admin.ts) or by the
 * server operator through the admin CLI (script/admin.ts). There is no
 * self-registration and there are no built-in accounts.
 */
import session from "express-session";
import type { Express, Request, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db, pool } from "./db";
import { users, userBarangays, barangays, auditLogs, UserRole, UserStatus } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { config } from "./config";
import { hashPassword, verifyPassword, burnPasswordCheck, needsRehash } from "./passwords";
import { checkPassword, isKnownDefaultPassword } from "@shared/password-policy";
import { PLACER_BARANGAYS } from "@shared/placer-barangays";

export { hashPassword, verifyPassword };
export { writeAuthAudit, completeLogin, registerFailedAttempt, lockedResponse };

export const SESSION_COOKIE_NAME = "hs.sid";

// --- Sessions ---------------------------------------------------------------

export function getSession() {
  const idleMs = config.SESSION_IDLE_MINUTES * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: false,
    // Expired rows are pruned by connect-pg-simple on its own timer.
    ttl: Math.ceil(idleMs / 1000),
    tableName: "sessions",
  });
  return session({
    name: SESSION_COOKIE_NAME,
    secret: config.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    // Each request pushes the expiry forward, so the cookie lifetime is an
    // idle timeout. The absolute cap is enforced in loadUserInfo.
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      maxAge: idleMs,
    },
  });
}

/** Ends every session belonging to a user, optionally keeping one. */
export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  if (exceptSessionId) {
    await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId} AND sid <> ${exceptSessionId}`);
  } else {
    await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`);
  }
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

// --- Startup ----------------------------------------------------------------

export async function setupAuth(app: Express) {
  // Number of reverse-proxy hops to trust for req.ip / X-Forwarded-Proto.
  app.set("trust proxy", config.TRUST_PROXY);
  // Sessions are only needed by the API; static assets stay cookie-free.
  app.use("/api", getSession());

  await seedPlacerBarangays();
  await warnIfNoAdmin();
}

async function seedPlacerBarangays() {
  try {
    const existingBarangays = await db.select().from(barangays);
    const existingNames = new Set(existingBarangays.map(b => b.name));
    const missingBarangays = PLACER_BARANGAYS.filter(name => !existingNames.has(name));
    if (missingBarangays.length > 0) {
      await db.insert(barangays).values(
        missingBarangays.map(name => ({ name, municipalityId: 1 }))
      );
      console.log(`Seeded ${missingBarangays.length} missing Placer barangays`);
    }
  } catch (error) {
    console.error("Error seeding barangays:", (error as Error)?.message || error);
  }
}

async function warnIfNoAdmin() {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, UserRole.SYSTEM_ADMIN));
    if (!row || row.n === 0) {
      console.warn(
        "\n[auth] No System Admin account exists, so nobody can log in yet.\n" +
          "       Create the first one from the server:\n" +
          "         Docker:  docker compose exec app node dist/admin.cjs create-admin <username>\n" +
          "         Local:   npm run admin -- create-admin <username>\n",
      );
    }
  } catch (error) {
    console.error("Error checking for admin account:", (error as Error)?.message || error);
  }
}

// --- Audit helper -----------------------------------------------------------

async function writeAuthAudit(
  req: Request,
  action: string,
  actor: { id: string; role: string } | null,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  try {
    await db.insert(auditLogs).values({
      userId: actor?.id ?? "ANONYMOUS",
      userRole: actor?.role ?? "ANONYMOUS",
      action,
      entityType: "USER",
      entityId,
      afterJson: details,
      ipAddress: req.ip || null,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 300) : null,
    });
  } catch (err) {
    console.error("Failed to write auth audit log:", (err as Error)?.message || err);
  }
}

// --- Rate limiting ----------------------------------------------------------

// Per-IP brake on password guessing across many usernames. Only failed
// attempts count, so a busy clinic sharing one public IP is not penalised
// for logging in normally. Per-account lockout (below) is the second layer.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.LOGIN_IP_MAX_FAILURES,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many failed login attempts from this network. Please wait 15 minutes and try again." },
});

// Password changes verify the current password, so they are guessable too.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes and try again." },
});

// --- Validation -------------------------------------------------------------

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

const profileSchema = z.object({
  firstName: z.string().trim().max(100).nullish(),
  lastName: z.string().trim().max(100).nullish(),
  email: z.union([z.string().trim().email().max(200), z.literal(""), z.null()]).optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

type DbUser = typeof users.$inferSelect;

function sessionUser(user: DbUser, assignedBarangays: string[] = []) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    mfaEnabled: !!user.totpEnabledAt,
    mustEnrollMfa: !user.totpEnabledAt && config.MFA_REQUIRED_ROLES.includes(user.role),
    assignedBarangays,
  };
}

/**
 * Turns a verified identity into a logged-in session. Called once the
 * password is right AND, for accounts with two-step sign-in, the code too.
 */
async function completeLogin(req: Request, user: DbUser) {
  await db.update(users).set({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  // New session id on every login: a session id planted in the browser
  // before login (session fixation) must not survive authentication.
  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.createdAt = Date.now();
  await saveSession(req);
  await writeAuthAudit(req, "LOGIN", { id: user.id, role: user.role }, user.id, { username: user.username });
  return sessionUser(user, await getAssignedBarangayNames(user));
}

/**
 * Counts one failed attempt (wrong password or wrong second-step code)
 * against an account and locks it at the limit. One statement, so parallel
 * guesses cannot all read the same count and slip under the limit.
 */
async function registerFailedAttempt(userId: string): Promise<{ failures: number; locked: boolean }> {
  const [counted] = await db.update(users)
    .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
    .where(eq(users.id, userId))
    .returning({ failures: users.failedLoginCount });
  const failures = counted?.failures ?? 1;
  const locked = failures >= config.LOGIN_MAX_ATTEMPTS;
  if (locked) {
    await db.update(users).set({
      failedLoginCount: 0,
      lockedUntil: new Date(Date.now() + config.LOGIN_LOCK_MINUTES * 60 * 1000),
    }).where(eq(users.id, userId));
  }
  return { failures, locked };
}

async function getAssignedBarangayNames(user: DbUser): Promise<string[]> {
  if (user.role !== UserRole.TL) return [];
  const assignments = await db.select({ barangayName: barangays.name })
    .from(userBarangays)
    .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
    .where(eq(userBarangays.userId, user.id));
  return assignments.map(a => a.barangayName);
}

const INVALID_CREDENTIALS = { message: "Invalid username or password" };

function lockedResponse(lockedUntil: Date) {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
  return {
    message: `Too many failed attempts. This account is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}.`,
    statusCode: "LOCKED",
  };
}

// Usernames that do not exist get the same lockout behaviour as ones that
// do. Otherwise "does it lock after five tries?" would tell an anonymous
// caller which usernames are real. Kept in memory and bounded: this is
// only about making the two cases indistinguishable.
const PHANTOM_LIMIT = 5000;
const phantomFailures = new Map<string, { count: number; lockedUntil: number }>();

function phantomLockedUntil(username: string): Date | null {
  const entry = phantomFailures.get(username.toLowerCase());
  if (!entry) return null;
  if (entry.lockedUntil > Date.now()) return new Date(entry.lockedUntil);
  if (entry.lockedUntil !== 0) phantomFailures.delete(username.toLowerCase());
  return null;
}

function recordPhantomFailure(username: string) {
  const key = username.toLowerCase();
  const entry = phantomFailures.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= config.LOGIN_MAX_ATTEMPTS) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + config.LOGIN_LOCK_MINUTES * 60 * 1000;
  }
  phantomFailures.delete(key);
  phantomFailures.set(key, entry);
  if (phantomFailures.size > PHANTOM_LIMIT) {
    // Map iterates in insertion order: drop the oldest entry.
    phantomFailures.delete(phantomFailures.keys().next().value as string);
  }
}

// --- Routes -----------------------------------------------------------------

export function registerAuthRoutes(app: Express): void {
  // Login
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      const { username, password } = parsed.data;

      const [user] = await db.select().from(users).where(eq(users.username, username));

      if (!user) {
        // Spend the same time as a real check, and lock after the same
        // number of tries, so neither timing nor lockout behaviour reveals
        // which usernames exist.
        await burnPasswordCheck(password);
        const phantomLock = phantomLockedUntil(username);
        if (phantomLock) {
          return res.status(429).json(lockedResponse(phantomLock));
        }
        recordPhantomFailure(username);
        await writeAuthAudit(req, "LOGIN_FAILED", null, null, { username: username.slice(0, 100), reason: "UNKNOWN_USER" });
        return res.status(401).json(INVALID_CREDENTIALS);
      }

      // Locked after repeated failures. Checked before the password so a
      // locked account cannot be used to keep guessing.
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        await burnPasswordCheck(password);
        await writeAuthAudit(req, "LOGIN_FAILED", null, user.id, { username: user.username, reason: "LOCKED" });
        return res.status(429).json(lockedResponse(user.lockedUntil));
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        const { failures, locked: lockNow } = await registerFailedAttempt(user.id);
        await writeAuthAudit(req, lockNow ? "ACCOUNT_LOCKED" : "LOGIN_FAILED", null, user.id, {
          username: user.username,
          reason: "BAD_PASSWORD",
          failures,
        });
        return res.status(401).json(INVALID_CREDENTIALS);
      }

      // Password is correct from here on, so it is safe to be specific.
      if (user.status !== UserStatus.ACTIVE) {
        await writeAuthAudit(req, "LOGIN_FAILED", null, user.id, { username: user.username, reason: user.status });
        const message =
          user.status === UserStatus.DISABLED
            ? "Your account has been disabled. Please contact the administrator."
            : "Your account is not active. Please contact the administrator.";
        return res.status(403).json({ message, statusCode: user.status });
      }

      // An account still on a built-in default password ("admin123",
      // "123456") is refused even though the password matches: those values
      // are public, so whoever is typing it may not be the account owner.
      // An administrator must issue a new temporary password.
      if (isKnownDefaultPassword(password)) {
        await writeAuthAudit(req, "LOGIN_BLOCKED_DEFAULT_PASSWORD", null, user.id, { username: user.username });
        return res.status(403).json({
          message:
            "This account is still using a default password and has been locked for safety. " +
            "Ask your System Administrator to reset your password.",
          statusCode: "DEFAULT_PASSWORD",
        });
      }

      // A password that predates the current policy still logs in, but must
      // be replaced before anything else can be done.
      const policy = checkPassword(password, user);
      const mustChangePassword = user.mustChangePassword || !policy.ok;

      const updates: Partial<DbUser> = {
        failedLoginCount: 0,
        lockedUntil: null,
        mustChangePassword,
      };
      // Transparently upgrade hashes made with an older, weaker work factor.
      if (needsRehash(user.passwordHash)) {
        updates.passwordHash = await hashPassword(password);
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));

      // Two-step sign-in: the password alone does not log this account in.
      // The fresh session only remembers WHO is half-way through, for five
      // minutes; POST /api/auth/mfa/verify (server/mfa.ts) finishes the job.
      if (user.totpEnabledAt && user.totpSecret) {
        await regenerateSession(req);
        req.session.pendingMfaUserId = user.id;
        req.session.pendingMfaAt = Date.now();
        await saveSession(req);
        return res.json({ mfaRequired: true });
      }

      res.json(await completeLogin(req, { ...user, mustChangePassword }));
    } catch (error) {
      console.error("Login error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    const actor = req.userInfo ? { id: req.userInfo.id, role: req.userInfo.role } : null;
    req.session.destroy(async (err) => {
      if (err) {
        console.error("Logout error:", err?.message || err);
        return res.status(500).json({ message: "Logout failed" });
      }
      if (actor) await writeAuthAudit(req, "LOGOUT", actor, actor.id, {});
      res.clearCookie(SESSION_COOKIE_NAME);
      res.json({ message: "Logged out successfully" });
    });
  });

  // Current user. Relies on loadUserInfo (registered globally before this),
  // which has already enforced session expiry and account status.
  app.get("/api/auth/me", async (req, res) => {
    if (!req.userInfo) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.userInfo);
  });

  // Update own profile (firstName, lastName, email only)
  app.put("/api/auth/me/profile", async (req, res) => {
    try {
      const userId = req.userInfo!.id;
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Please check the name and email fields." });
      }
      const { firstName, lastName, email } = parsed.data;

      const [updated] = await db
        .update(users)
        .set({
          firstName: firstName !== undefined ? (firstName || null) : undefined,
          lastName: lastName !== undefined ? (lastName || null) : undefined,
          email: email !== undefined ? (email || null) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(sessionUser(updated, req.userInfo!.assignedBarangays));
    } catch (error) {
      console.error("Error updating profile:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change own password (requires current password)
  app.put("/api/auth/me/password", passwordChangeLimiter, async (req, res) => {
    try {
      const userId = req.userInfo!.id;
      const parsed = passwordChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      const { currentPassword, newPassword } = parsed.data;

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        await writeAuthAudit(req, "PASSWORD_CHANGE_FAILED", { id: user.id, role: user.role }, user.id, {});
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (newPassword === currentPassword) {
        return res.status(400).json({ message: "New password must be different from the current one." });
      }

      const policy = checkPassword(newPassword, user);
      if (!policy.ok) {
        return res.status(400).json({ message: policy.message });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.update(users).set({
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      // Sign out every other device; this one continues.
      await destroyUserSessions(userId, req.sessionID);
      await writeAuthAudit(req, "PASSWORD_CHANGE", { id: user.id, role: user.role }, user.id, {});

      res.json({ success: true });
    } catch (error) {
      console.error("Error changing password:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
