import type { Request, RequestHandler } from "express";
import "express-session";
import { db } from "../db";
import { users, userBarangays, barangays, UserRole, UserStatus, auditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { config } from "../config";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    /** Epoch ms when this session was created at login (absolute timeout). */
    createdAt?: number;
  }
}

// Extended request type with user info
declare global {
  namespace Express {
    interface Request {
      userInfo?: {
        id: string;
        username: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        role: string;
        status: string;
        assignedBarangays: string[];
        mustChangePassword: boolean;
      };
    }
  }
}

const VIEW_ONLY_ROLES: readonly string[] = [UserRole.MAYOR, UserRole.HEALTH_COMMITTEE];

export function isViewOnlyRole(role: string | undefined): boolean {
  return !!role && VIEW_ONLY_ROLES.includes(role);
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

/**
 * Loads the logged-in user (role, status, assigned barangays) onto
 * req.userInfo. Never rejects on its own for "not logged in" — that is
 * apiGate's / requireAuth's job — but it does end sessions that have
 * outlived the absolute limit or whose account is no longer active.
 *
 * Idempotent: many routes still list it explicitly after the global
 * registration, and the second call must not hit the database again.
 */
export const loadUserInfo: RequestHandler = async (req, res, next) => {
  if (req.userInfo) return next();

  const userId = req.session?.userId;
  if (!userId) return next();

  try {
    // Absolute session lifetime, independent of activity.
    const createdAt = req.session.createdAt ?? 0;
    const maxAgeMs = config.SESSION_MAX_HOURS * 60 * 60 * 1000;
    if (!createdAt || Date.now() - createdAt > maxAgeMs) {
      await destroySession(req);
      return next();
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!dbUser) {
      await destroySession(req);
      return next();
    }

    // Only ACTIVE accounts may hold a session. Anything else (disabled,
    // legacy pending / rejected registrations) is signed out immediately.
    if (dbUser.status !== UserStatus.ACTIVE) {
      await destroySession(req);
      return res.status(403).json({
        message: dbUser.status === UserStatus.DISABLED
          ? "Account is disabled. Please contact an administrator."
          : "Account is not active. Please contact an administrator.",
      });
    }

    let assignedBarangays: string[] = [];
    if (dbUser.role === UserRole.TL) {
      const assignments = await db
        .select({ barangayName: barangays.name })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, userId));
      assignedBarangays = assignments.map((a) => a.barangayName);
    }

    req.userInfo = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role: dbUser.role,
      status: dbUser.status,
      assignedBarangays,
      mustChangePassword: dbUser.mustChangePassword,
    };

    next();
  } catch (error) {
    // Fail closed: if we cannot establish who this is, they are nobody.
    console.error("Error loading user info:", (error as Error)?.message || error);
    res.status(503).json({ message: "Service temporarily unavailable" });
  }
};

// --- The API gate -----------------------------------------------------------
//
// Every /api request passes through here before reaching a route. The rule
// is deny-by-default: a route is reachable without a session ONLY if it is
// listed in PUBLIC_ROUTES. A new route added without thinking about auth is
// therefore private, not public.

/** "METHOD /path" entries reachable without logging in. Keep this short. */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "GET /api/health",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  // Answers 401 itself; the client uses it to ask "am I logged in?".
  "GET /api/auth/me",
  // LGU name + brand colours for the login screen. No personal data.
  "GET /api/theme-settings",
]);

/** While a password change is pending, only these are allowed. */
const PASSWORD_CHANGE_ROUTES: ReadonlySet<string> = new Set([
  "GET /api/auth/me",
  "PUT /api/auth/me/password",
  "POST /api/auth/logout",
  "GET /api/theme-settings",
]);

/**
 * Write endpoints that view-only roles (Mayor, Health Committee) may still
 * use: their own account, and internal messaging. Everything else that is
 * not a read is refused for them regardless of what the route itself checks.
 */
const VIEW_ONLY_WRITE_PREFIXES: readonly string[] = [
  "/api/auth/",
  "/api/dm/",
  "/api/general-chat/",
  "/api/recommendations/log",
  "/api/recommendations/plain-language",
];

const READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

function normalisePath(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export const apiGate: RequestHandler = (req, res, next) => {
  // Mounted at /api, so req.path is relative to it; rebuild the full path.
  const path = normalisePath(`${req.baseUrl}${req.path}`);
  const key = `${req.method} ${path}`;

  if (PUBLIC_ROUTES.has(key)) return next();

  const user = req.userInfo;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.mustChangePassword && !PASSWORD_CHANGE_ROUTES.has(key)) {
    return res.status(403).json({
      message: "You must change your password before continuing.",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }

  if (isViewOnlyRole(user.role) && !READ_METHODS.has(req.method)) {
    const allowed = VIEW_ONLY_WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
    if (!allowed) {
      return res.status(403).json({ message: "Your account has view-only access." });
    }
  }

  next();
};

// Middleware to require authentication
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Middleware to require specific roles
export function requireRole(...allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.userInfo) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.userInfo.role)) {
      return res.status(403).json({ message: "You do not have permission to do this." });
    }

    next();
  };
}

// Middleware to scope data by barangay for TL role
export function scopeByBarangay(barangayField: string = "barangay"): RequestHandler {
  return (req, res, next) => {
    if (!req.userInfo) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // TL can only see their assigned barangays
    if (req.userInfo.role === UserRole.TL) {
      // Store scoped barangays in request for use in handlers
      (req as any).scopedBarangays = req.userInfo.assignedBarangays;
    } else {
      // Admin, MHO, SHA can see all
      (req as any).scopedBarangays = null; // null means no filtering
    }

    next();
  };
}

/**
 * Can this user touch data belonging to `barangayName`?
 *
 * Team Leaders (barangay nurses) are confined to their assigned barangays.
 * A record with no barangay is NOT accessible to a TL: an unlabelled record
 * must not become a way around the restriction. Every other role is
 * municipality-wide.
 */
export function canAccessBarangay(
  userInfo: Express.Request["userInfo"],
  barangayName: string | null | undefined,
): boolean {
  if (!userInfo) return false;
  if (userInfo.role !== UserRole.TL) return true;
  if (!barangayName) return false;
  return userInfo.assignedBarangays.includes(barangayName);
}

// Create audit log entry
export async function createAuditLog(
  userId: string,
  userRole: string,
  action: string,
  entityType: string,
  entityId?: string | number,
  barangayName?: string,
  beforeJson?: any,
  afterJson?: any,
  req?: any
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      userRole,
      action,
      entityType,
      entityId: entityId?.toString(),
      barangayName,
      beforeJson,
      afterJson,
      // req.ip honours the configured trust-proxy hop count. Never read the
      // raw X-Forwarded-For header: the client controls it.
      ipAddress: req?.ip || null,
      userAgent: typeof req?.headers?.["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null,
    });
  } catch (error) {
    console.error("Error creating audit log:", (error as Error)?.message || error);
  }
}

// Permission matrix helpers
export const permissions = {
  // User Management - Admin only
  canManageUsers: (role: string) => role === UserRole.SYSTEM_ADMIN,

  // Patient Check-up/Consult - Admin and MHO only
  canAccessPatientCheckup: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.MHO].includes(role as any),

  // Audit Logs - Admin only
  canViewAuditLogs: (role: string) => role === UserRole.SYSTEM_ADMIN,

  // Reports - All can view, but TL is scoped
  canGenerateReports: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL].includes(role as any),
  canImportReports: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.MHO].includes(role as any),

  // CRUD permissions per module
  canCreate: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.TL].includes(role as any),
  canUpdate: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.TL].includes(role as any),
  canDelete: (role: string) => role === UserRole.SYSTEM_ADMIN,

  // Inventory - TL can only view, not edit
  canEditInventory: (role: string) => role === UserRole.SYSTEM_ADMIN,
};
