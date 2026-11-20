/**
 * Two-step sign-in (TOTP authenticator app + recovery codes).
 *
 * Sign-in:   POST /api/auth/login        password ok -> { mfaRequired: true }
 *            POST /api/auth/mfa/verify   code ok     -> logged in
 * Enrolment: POST /api/auth/mfa/setup    password    -> secret + QR link
 *            POST /api/auth/mfa/enable   first code  -> on; recovery codes
 * Upkeep:    POST /api/auth/mfa/recovery-codes   new set of recovery codes
 *            POST /api/auth/mfa/disable          off (if the role allows)
 *
 * Roles listed in MFA_REQUIRED_ROLES cannot use the system until they have
 * enrolled (enforced by apiGate) and cannot switch it off.
 */
import type { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { users, userRecoveryCodes, UserStatus } from "@shared/schema";
import { config } from "./config";
import { verifyPassword } from "./passwords";
import {
  completeLogin, destroyUserSessions, lockedResponse, registerFailedAttempt, writeAuthAudit,
} from "./auth";
import {
  decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode,
  looksLikeRecoveryCode, otpauthUrl, verifyTotp,
} from "./totp";

type DbUser = typeof users.$inferSelect;

/** How long after the password step the code may still be entered. */
const PENDING_MFA_MS = 5 * 60 * 1000;

// Key for encrypting TOTP secrets at rest. Derived (HKDF) from the session
// secret, so a database or backup on its own does not reveal them.
const SECRET_KEY = config.SESSION_SECRET;

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.LOGIN_IP_MAX_FAILURES,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes and try again." },
});

const codeSchema = z.object({ code: z.string().trim().min(6).max(40) });
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200) });
const passwordAndCodeSchema = passwordSchema.merge(codeSchema);

function actorOf(user: { id: string; role: string }) {
  return { id: user.id, role: user.role };
}

/**
 * Checks a 6-digit code and, if it is good, records its time step in the
 * same statement. The WHERE clause makes the write succeed only when that
 * step has not been used yet, so two parallel requests carrying the same
 * code cannot both pass.
 */
async function consumeTotp(user: DbUser, code: string): Promise<boolean> {
  if (!user.totpSecret) return false;
  let secret: string;
  try {
    secret = decryptSecret(user.totpSecret, SECRET_KEY);
  } catch {
    // Wrong key (SESSION_SECRET changed) or damaged value. Treated as a
    // failed code; an admin or the CLI must reset this account's two-step.
    console.error(`[mfa] could not decrypt the two-step secret for user ${user.id}; it needs to be reset`);
    return false;
  }
  const step = verifyTotp(secret, code, user.totpLastStep);
  if (step === null) return false;
  const claimed = await db.update(users)
    .set({ totpLastStep: step })
    .where(and(eq(users.id, user.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
    .returning({ id: users.id });
  return claimed.length === 1;
}

/** Marks a recovery code used. Single statement, so it can only succeed once. */
async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const used = await db.update(userRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(
      eq(userRecoveryCodes.userId, userId),
      eq(userRecoveryCodes.codeHash, hashRecoveryCode(code)),
      isNull(userRecoveryCodes.usedAt),
    ))
    .returning({ id: userRecoveryCodes.id });
  return used.length === 1;
}

async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
    await tx.insert(userRecoveryCodes).values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));
  });
  return codes;
}

async function remainingRecoveryCodes(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userRecoveryCodes)
    .where(and(eq(userRecoveryCodes.userId, userId), isNull(userRecoveryCodes.usedAt)));
  return row?.n ?? 0;
}

async function loadCurrentUser(req: Request): Promise<DbUser | null> {
  const id = req.userInfo?.id;
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export function registerMfaRoutes(app: Express): void {
  // --- Second step of sign-in ------------------------------------------------
  app.post("/api/auth/mfa/verify", codeLimiter, async (req, res) => {
    try {
      const pendingId = req.session.pendingMfaUserId;
      const startedAt = req.session.pendingMfaAt ?? 0;
      if (!pendingId || Date.now() - startedAt > PENDING_MFA_MS) {
        delete req.session.pendingMfaUserId;
        delete req.session.pendingMfaAt;
        return res.status(401).json({
          message: "Your sign-in timed out. Please enter your username and password again.",
          statusCode: "MFA_EXPIRED",
        });
      }

      const parsed = codeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter the 6-digit code from your authenticator app." });
      const { code } = parsed.data;

      const [user] = await db.select().from(users).where(eq(users.id, pendingId));
      if (!user || user.status !== UserStatus.ACTIVE || !user.totpEnabledAt) {
        delete req.session.pendingMfaUserId;
        return res.status(401).json({ message: "Please sign in again.", statusCode: "MFA_EXPIRED" });
      }
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json(lockedResponse(user.lockedUntil));
      }

      const usedRecoveryCode = looksLikeRecoveryCode(code);
      const ok = usedRecoveryCode ? await consumeRecoveryCode(user.id, code) : await consumeTotp(user, code);

      if (!ok) {
        // Wrong codes count toward the same lockout as wrong passwords:
        // knowing the password must not buy unlimited guesses at the code.
        const { locked } = await registerFailedAttempt(user.id);
        await writeAuthAudit(req, locked ? "ACCOUNT_LOCKED" : "MFA_FAILED", null, user.id, { username: user.username });
        if (locked) {
          delete req.session.pendingMfaUserId;
          delete req.session.pendingMfaAt;
        }
        return res.status(401).json({ message: "That code is not correct. Check your authenticator app and try again." });
      }

      delete req.session.pendingMfaUserId;
      delete req.session.pendingMfaAt;
      const body = await completeLogin(req, user);
      if (usedRecoveryCode) {
        await writeAuthAudit(req, "MFA_RECOVERY_CODE_USED", actorOf(user), user.id, { username: user.username });
        return res.json({ ...body, recoveryCodesRemaining: await remainingRecoveryCodes(user.id) });
      }
      res.json(body);
    } catch (error) {
      console.error("MFA verify error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Sign-in failed" });
    }
  });

  // --- Enrolment, step 1: prove the password, get a secret -------------------
  // The password is asked for again so that someone who walks up to an
  // unlocked, signed-in computer cannot attach their own phone to the account.
  app.post("/api/auth/mfa/setup", codeLimiter, async (req, res) => {
    try {
      const user = await loadCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const parsed = passwordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter your current password." });
      if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
        await writeAuthAudit(req, "MFA_SETUP_FAILED", actorOf(user), user.id, { reason: "BAD_PASSWORD" });
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      if (user.totpEnabledAt) {
        return res.status(400).json({ message: "Two-step sign-in is already on for this account." });
      }

      const secret = generateTotpSecret();
      // Kept in the session until the first code proves the app was set up
      // correctly; only then is it saved to the account.
      req.session.mfaSetupSecret = encryptSecret(secret, SECRET_KEY);
      res.json({ secret, otpauthUrl: otpauthUrl(secret, user.username, config.MFA_ISSUER) });
    } catch (error) {
      console.error("MFA setup error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Could not start two-step sign-in setup" });
    }
  });

  // --- Enrolment, step 2: confirm with a first code ---------------------------
  app.post("/api/auth/mfa/enable", codeLimiter, async (req, res) => {
    try {
      const user = await loadCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const parsed = codeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter the 6-digit code from your authenticator app." });
      const pending = req.session.mfaSetupSecret;
      if (!pending) return res.status(400).json({ message: "Start the setup again." });
      if (user.totpEnabledAt) return res.status(400).json({ message: "Two-step sign-in is already on for this account." });

      const secret = decryptSecret(pending, SECRET_KEY);
      const step = verifyTotp(secret, parsed.data.code, null);
      if (step === null) {
        return res.status(400).json({ message: "That code is not correct. Check your authenticator app and try again." });
      }

      await db.update(users).set({
        totpSecret: encryptSecret(secret, SECRET_KEY),
        totpEnabledAt: new Date(),
        totpLastStep: step,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      const recoveryCodes = await replaceRecoveryCodes(user.id);
      delete req.session.mfaSetupSecret;

      // Other devices signed in with only a password are signed out.
      await destroyUserSessions(user.id, req.sessionID);
      await writeAuthAudit(req, "MFA_ENABLED", actorOf(user), user.id, { username: user.username });

      res.json({ success: true, recoveryCodes });
    } catch (error) {
      console.error("MFA enable error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Could not turn on two-step sign-in" });
    }
  });

  // --- New recovery codes (the old ones stop working) ------------------------
  app.post("/api/auth/mfa/recovery-codes", codeLimiter, async (req, res) => {
    try {
      const user = await loadCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const parsed = passwordAndCodeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter your current password and a 6-digit code." });
      if (!user.totpEnabledAt) return res.status(400).json({ message: "Two-step sign-in is not on for this account." });
      if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      if (!(await consumeTotp(user, parsed.data.code))) {
        return res.status(400).json({ message: "That code is not correct. Wait for a new code and try again." });
      }
      const recoveryCodes = await replaceRecoveryCodes(user.id);
      await writeAuthAudit(req, "MFA_RECOVERY_CODES_REPLACED", actorOf(user), user.id, {});
      res.json({ recoveryCodes });
    } catch (error) {
      console.error("MFA recovery-codes error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Could not create new recovery codes" });
    }
  });

  // --- Switch off --------------------------------------------------------------
  app.post("/api/auth/mfa/disable", codeLimiter, async (req, res) => {
    try {
      const user = await loadCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (config.MFA_REQUIRED_ROLES.includes(user.role)) {
        return res.status(403).json({ message: "Two-step sign-in is required for your role and cannot be switched off." });
      }
      const parsed = passwordAndCodeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter your current password and a 6-digit code." });
      if (!user.totpEnabledAt) return res.status(400).json({ message: "Two-step sign-in is not on for this account." });
      if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const ok = looksLikeRecoveryCode(parsed.data.code)
        ? await consumeRecoveryCode(user.id, parsed.data.code)
        : await consumeTotp(user, parsed.data.code);
      if (!ok) return res.status(400).json({ message: "That code is not correct. Wait for a new code and try again." });

      await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));
      });
      await writeAuthAudit(req, "MFA_DISABLED", actorOf(user), user.id, { username: user.username });
      res.json({ success: true });
    } catch (error) {
      console.error("MFA disable error:", (error as Error)?.message || error);
      res.status(500).json({ message: "Could not turn off two-step sign-in" });
    }
  });

  // --- Status for the account page --------------------------------------------
  app.get("/api/auth/mfa/status", async (req, res) => {
    const user = await loadCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({
      enabled: !!user.totpEnabledAt,
      required: config.MFA_REQUIRED_ROLES.includes(user.role),
      recoveryCodesRemaining: user.totpEnabledAt ? await remainingRecoveryCodes(user.id) : 0,
    });
  });
}
