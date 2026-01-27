import type { Express } from "express";
import { db } from "../db";
import { users, barangays, userBarangays, auditLogs, UserRole, UserStatus } from "@shared/schema";
import { eq, and, desc, like, or, inArray, sql } from "drizzle-orm";
import { loadUserInfo, requireAuth, requireRole, createAuditLog, permissions } from "../middleware/rbac";
import { hashPassword } from "../auth";

export function registerAdminRoutes(app: Express) {
  // Apply user info loading to all routes
  app.use(loadUserInfo);

  // Note: /api/auth/me is defined in server/auth.ts - no duplicate here

  // === BARANGAYS ===
  app.get("/api/barangays", requireAuth, async (req, res) => {
    try {
      const allBarangays = await db.select().from(barangays);
      res.json(allBarangays);
    } catch (error) {
      console.error("Error fetching barangays:", error);
      res.status(500).json({ message: "Failed to fetch barangays" });
    }
  });

  // === USER MANAGEMENT (Admin only) ===
  
  // List all users with their barangay assignments
  app.get("/api/admin/users", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      
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
      
      const usersWithAssignments = allUsers.map(user => ({
        ...user,
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

      res.json({
        ...user,
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
      const { username, password, email, firstName, lastName, role, status } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      // Check if username already exists
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
        role: role || UserRole.TL,
        status: status || UserStatus.ACTIVE,
      }).returning();
      
      // Audit log
      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "CREATE",
        "USER",
        newUser.id,
        undefined,
        null,
        { ...newUser, passwordHash: "[REDACTED]" },
        req
      );
      
      res.status(201).json({
        ...newUser,
        passwordHash: undefined,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user (role, status, password)
  app.put("/api/admin/users/:id", requireAuth, requireRole(UserRole.SYSTEM_ADMIN), async (req: any, res) => {
    try {
      const { role, status, password, firstName, lastName, email } = req.body;
      const userId = req.params.id;

      // Get before state for audit
      const [beforeUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!beforeUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent admin from disabling themselves
      if (userId === req.userInfo.id && status === UserStatus.DISABLED) {
        return res.status(400).json({ message: "Cannot disable your own account" });
      }

      // Build update object
      const updateData: any = {
        role: role || beforeUser.role,
        status: status || beforeUser.status,
        firstName: firstName !== undefined ? firstName : beforeUser.firstName,
        lastName: lastName !== undefined ? lastName : beforeUser.lastName,
        email: email !== undefined ? email : beforeUser.email,
        updatedAt: new Date(),
      };
      
      // Update password if provided
      if (password && password.length >= 6) {
        updateData.passwordHash = await hashPassword(password);
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      // Audit log
      await createAuditLog(
        req.userInfo.id,
        req.userInfo.role,
        "UPDATE",
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
      
      // Prevent admin from deleting themselves
      if (userId === req.userInfo.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning();
      
      if (!deletedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Audit log
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

      // Verify user exists
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get before state for audit
      const beforeAssignments = await db
        .select({ barangayId: userBarangays.barangayId })
        .from(userBarangays)
        .where(eq(userBarangays.userId, userId));

      // Remove existing assignments
      await db.delete(userBarangays).where(eq(userBarangays.userId, userId));

      // Add new assignments
      if (barangayIds && barangayIds.length > 0) {
        await db.insert(userBarangays).values(
          barangayIds.map((barangayId: number) => ({
            userId,
            barangayId,
          }))
        );
      }

      // Get updated assignments
      const afterAssignments = await db
        .select({
          barangayId: userBarangays.barangayId,
          barangayName: barangays.name,
        })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, userId));

      // Audit log
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

      let query = db.select().from(auditLogs);
      
      // Build conditions array
      const conditions = [];
      
      if (userId) {
        conditions.push(eq(auditLogs.userId, userId as string));
      }
      if (action) {
        conditions.push(eq(auditLogs.action, action as string));
      }
      if (entityType) {
        conditions.push(eq(auditLogs.entityType, entityType as string));
      }
      if (barangayName) {
        conditions.push(eq(auditLogs.barangayName, barangayName as string));
      }
      if (startDate) {
        conditions.push(sql`${auditLogs.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${auditLogs.createdAt} <= ${new Date(endDate as string)}`);
      }

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
