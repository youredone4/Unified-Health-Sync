import type { Express } from "express";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { users, barangays, userBarangays, auditLogs, UserRole, UserStatus } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { loadUserInfo, requireAuth, requireRole, createAuditLog } from "../middleware/rbac";
import { hashPassword, KYC_UPLOAD_DIR } from "../auth";

export function registerAdminRoutes(app: Express) {
  // Apply user info loading to all routes
  app.use(loadUserInfo);

  // Note: /api/auth/me is defined in server/auth.ts - no duplicate here

  // === BARANGAYS ===
  // Intentionally unauthenticated: barangay names are not sensitive and
  // must be accessible to unauthenticated users during self-registration.
  app.get("/api/barangays", async (req, res) => {
    try {
      const allBarangays = await db.select().from(barangays);
      res.json(allBarangays);
    } catch (error) {
      console.error("Error fetching barangays:", error);
      res.status(500).json({ message: "Failed to fetch barangays" });
    }
  });

  // === PROTECTED KYC FILE SERVING (SYSTEM_ADMIN only) ===
  // Uses query param ?type=id|selfie to avoid exposing raw storage filenames
  app.get("/api/admin/kyc-files/:userId", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
    try {
      const { userId } = req.params;
      const type = req.query.type as string; // "id" or "selfie"

      if (type !== "id" && type !== "selfie") {
        return res.status(400).json({ message: "Invalid type. Use ?type=id or ?type=selfie" });
      }

      const [user] = await db.select({
        kycIdFileUrl: users.kycIdFileUrl,
        kycSelfieUrl: users.kycSelfieUrl,
      }).from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const storedFilename = type === "selfie" ? user.kycSelfieUrl : user.kycIdFileUrl;

      if (!storedFilename) {
        return res.status(404).json({ message: "File not uploaded" });
      }

      // Double-check: only allow filenames, no path traversal
      const safeName = path.basename(storedFilename);
      const filePath = path.join(KYC_UPLOAD_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Serve inline without leaking the storage path
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving KYC file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // === USER MANAGEMENT (Admin only) ===
  
  // List all users with their barangay assignments
  app.get("/api/admin/users", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
    try {
      const { status } = req.query;
      
      let query = db.select().from(users);
      const allUsers = status
        ? await db.select().from(users).where(eq(users.status, status as string))
        : await db.select().from(users);
      
      // Get barangay assignments for all users
      const assignments = await db
        .select({
          userId: userBarangays.userId,
          barangayId: userBarangays.barangayId,
          barangayName: barangays.name,
        })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id));
      
      // Group assignments by user
      const userAssignments: Record<string, { id: number; name: string }[]> = {};
      for (const a of assignments) {
        if (!userAssignments[a.userId]) {
          userAssignments[a.userId] = [];
        }
        userAssignments[a.userId].push({ id: a.barangayId, name: a.barangayName });
      }
      
      const usersWithAssignments = allUsers.map(({ passwordHash: _pw, kycIdFileUrl, kycSelfieUrl, ...user }) => ({
        ...user,
        hasKycIdFile: !!kycIdFileUrl,
        hasKycSelfie: !!kycSelfieUrl,
        assignedBarangays: userAssignments[user.id] || [],
      }));
      
      res.json(usersWithAssignments);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user with assignments
  app.get("/api/admin/users/:id", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const assignments = await db
        .select({
          barangayId: userBarangays.barangayId,
          barangayName: barangays.name,
        })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, user.id));

      const { passwordHash: _pw, kycIdFileUrl, kycSelfieUrl, ...userSafe } = user;
      res.json({
        ...userSafe,
        hasKycIdFile: !!kycIdFileUrl,
        hasKycSelfie: !!kycSelfieUrl,
        assignedBarangays: assignments.map(a => ({ id: a.barangayId, name: a.barangayName })),
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create new user (Admin only)
  app.post("/api/admin/users", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const { username, password, email, firstName, lastName, role, status, barangayIds } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const userRole = role || UserRole.TL;
      if (userRole === UserRole.TL && (!barangayIds || barangayIds.length === 0)) {
        return res.status(400).json({ message: "Team Leaders must be assigned to at least one barangay" });
      }
      
      const [existing] = await db.select().from(users).where(eq(users.username, username));
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const passwordHash = await hashPassword(password);
      
      const [newUser] = await db.insert(users).values({
        username,
        passwordHash,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        role: userRole,
        status: status || UserStatus.ACTIVE,
      }).returning();
      
      if (userRole === UserRole.TL && barangayIds && barangayIds.length > 0) {
        await db.insert(userBarangays).values(
          barangayIds.map((barangayId: number) => ({
            userId: newUser.id,
            barangayId,
          }))
        );
      }
      
      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "CREATE",
        "USER",
        newUser.id,
        undefined,
        null,
        { ...newUser, passwordHash: "[REDACTED]", assignedBarangays: barangayIds || [] },
        req
      );
      
      res.status(201).json({
        ...newUser,
        passwordHash: undefined,
        assignedBarangays: barangayIds || [],
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Approve pending registration (SYSTEM_ADMIN only)
  // Accepts optional { note } body for reviewer comments on approval
  app.post("/api/admin/users/:id/approve", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { note } = req.body || {};

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.status !== UserStatus.PENDING_VERIFICATION) {
        return res.status(400).json({ message: "User is not pending verification" });
      }

      const [updated] = await db
        .update(users)
        .set({
          status: UserStatus.ACTIVE,
          kycReviewedAt: new Date(),
          kycReviewedById: req.userInfo.id,
          kycNotes: note?.trim() || null, // optional reviewer note on approval
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "KYC_APPROVE",
        "USER",
        userId,
        undefined,
        { status: user.status },
        { status: UserStatus.ACTIVE, reviewedBy: req.userInfo.username },
        req
      );

      res.json({ ...updated, passwordHash: undefined });
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Failed to approve user" });
    }
  });

  // Reject pending registration (SYSTEM_ADMIN only)
  app.post("/api/admin/users/:id/reject", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { note } = req.body;

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.status !== UserStatus.PENDING_VERIFICATION) {
        return res.status(400).json({ message: "User is not pending verification" });
      }

      const [updated] = await db
        .update(users)
        .set({
          status: UserStatus.REJECTED,
          kycNotes: note || null,
          kycReviewedAt: new Date(),
          kycReviewedById: req.userInfo.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "KYC_REJECT",
        "USER",
        userId,
        undefined,
        { status: user.status },
        { status: UserStatus.REJECTED, note, reviewedBy: req.userInfo.username },
        req
      );

      res.json({ ...updated, passwordHash: undefined });
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: "Failed to reject user" });
    }
  });

  // Update user (role, status, password)
  app.put("/api/admin/users/:id", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const { role, status, password, firstName, lastName, email } = req.body;
      const userId = req.params.id;

      const [beforeUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!beforeUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent admin from disabling themselves
      if (userId === req.userInfo.id && status === UserStatus.DISABLED) {
        return res.status(400).json({ message: "Cannot disable your own account" });
      }

      const updateData: any = {
        role: role || beforeUser.role,
        status: status || beforeUser.status,
        firstName: firstName !== undefined ? firstName : beforeUser.firstName,
        lastName: lastName !== undefined ? lastName : beforeUser.lastName,
        email: email !== undefined ? email : beforeUser.email,
        updatedAt: new Date(),
      };
      
      if (password && password.length >= 6) {
        updateData.passwordHash = await hashPassword(password);
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      // Determine action label for audit
      let action = "UPDATE";
      if (status === UserStatus.DISABLED && beforeUser.status !== UserStatus.DISABLED) {
        action = "DISABLE";
      } else if (status === UserStatus.ACTIVE && beforeUser.status === UserStatus.DISABLED) {
        action = "ENABLE";
      }

      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        action,
        "USER",
        userId,
        undefined,
        { ...beforeUser, passwordHash: "[REDACTED]" },
        { ...updated, passwordHash: "[REDACTED]" },
        req
      );

      res.json({
        ...updated,
        passwordHash: undefined,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/admin/users/:id", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      if (userId === req.userInfo.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning();
      
      if (!deletedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "DELETE",
        "USER",
        userId,
        undefined,
        { ...deletedUser, passwordHash: "[REDACTED]" },
        null,
        req
      );
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Assign barangays to a user (for TL role)
  app.put("/api/admin/users/:id/barangays", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { barangayIds } = req.body as { barangayIds: number[] };

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.role === UserRole.TL && (!barangayIds || barangayIds.length === 0)) {
        return res.status(400).json({ message: "Team Leaders must be assigned to at least one barangay" });
      }

      const beforeAssignments = await db
        .select({ barangayId: userBarangays.barangayId })
        .from(userBarangays)
        .where(eq(userBarangays.userId, userId));

      await db.delete(userBarangays).where(eq(userBarangays.userId, userId));

      if (barangayIds && barangayIds.length > 0) {
        await db.insert(userBarangays).values(
          barangayIds.map((barangayId: number) => ({
            userId,
            barangayId,
          }))
        );
      }

      const afterAssignments = await db
        .select({
          barangayId: userBarangays.barangayId,
          barangayName: barangays.name,
        })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, userId));

      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "UPDATE",
        "USER_BARANGAY_ASSIGNMENT",
        userId,
        undefined,
        { barangayIds: beforeAssignments.map(a => a.barangayId) },
        { barangayIds: barangayIds || [] },
        req
      );

      res.json({
        ...user,
        passwordHash: undefined,
        assignedBarangays: afterAssignments.map(a => ({ id: a.barangayId, name: a.barangayName })),
      });
    } catch (error) {
      console.error("Error updating user barangays:", error);
      res.status(500).json({ message: "Failed to update user barangays" });
    }
  });

  // === AUDIT LOGS (Admin only) ===
  app.get("/api/admin/audit-logs", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
    try {
      const { userId, action, entityType, barangayName, startDate, endDate, limit = 100, offset = 0 } = req.query;

      const conditions = [];
      
      if (userId) conditions.push(eq(auditLogs.userId, userId as string));
      if (action) conditions.push(eq(auditLogs.action, action as string));
      if (entityType) conditions.push(eq(auditLogs.entityType, entityType as string));
      if (barangayName) conditions.push(eq(auditLogs.barangayName, barangayName as string));
      if (startDate) conditions.push(sql`${auditLogs.createdAt} >= ${new Date(startDate as string)}`);
      if (endDate) conditions.push(sql`${auditLogs.createdAt} <= ${new Date(endDate as string)}`);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // === ROLE INFO ===
  app.get("/api/roles", requireAuth, (req, res) => {
    res.json({
      roles: Object.values(UserRole),
      statuses: Object.values(UserStatus),
    });
  });
}
