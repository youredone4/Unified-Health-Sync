import type { RequestHandler } from "express";
import "express-session";
import { db } from "../db";
import { users, userBarangays, barangays, UserRole, auditLogs } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
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
      };
    }
  }
}

// Middleware to load full user info including role and assigned barangays
export const loadUserInfo: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId;
  
  if (!userId) {
    return next();
  }

  try {
    // Get user with role
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!dbUser) {
      return next();
    }

    // Check if user is disabled
    if (dbUser.status === "DISABLED") {
      return res.status(403).json({ message: "Account is disabled. Please contact an administrator." });
    }

    // Get assigned barangays for TL role
    let assignedBarangays: string[] = [];
    if (dbUser.role === UserRole.TL) {
      const assignments = await db
        .select({ barangayName: barangays.name })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, userId));
      
      assignedBarangays = assignments.map(a => a.barangayName);
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
    };

    next();
  } catch (error) {
    console.error("Error loading user info:", error);
    next();
  }
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
      return res.status(403).json({ 
        message: "Access denied. Required role: " + allowedRoles.join(" or ")
      });
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

// Check if user can access a specific barangay's data
export function canAccessBarangay(userInfo: Express.Request["userInfo"], barangayName: string): boolean {
  if (!userInfo) return false;
  
  // Admin, MHO, SHA can access all barangays
  if (userInfo.role !== UserRole.TL) {
    return true;
  }

  // TL can only access assigned barangays
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
      ipAddress: req?.ip || req?.headers?.["x-forwarded-for"]?.toString(),
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

// Permission matrix helpers
export const permissions = {
  // User Management - Admin only
  canManageUsers: (role: string) => role === UserRole.SYSTEM_ADMIN,
  
  // Morbidity/Consult - Admin and MHO only
  canAccessMorbidity: (role: string) => [UserRole.SYSTEM_ADMIN, UserRole.MHO].includes(role as any),
  
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
