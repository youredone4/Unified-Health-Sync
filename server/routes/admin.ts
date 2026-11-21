import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, barangays, userBarangays, auditLogs, UserRole, UserStatus } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole, createAuditLog } from "../middleware/rbac";
import { hashPassword, destroyUserSessions } from "../auth";
import { checkPassword } from "@shared/password-policy";

type DbUser = typeof users.$inferSelect;

const ROLE_VALUES = Object.values(UserRole) as [string, ...string[]];

/**
 * What an administrator sees of an account. Never includes the password
 * hash or the stored names of legacy KYC upload files.
 */
function adminUserView(user: DbUser, assignedBarangays: { id: number; name: string }[] = []) {
  const { passwordHash: _hash, kycIdFileUrl: _id, kycSelfieUrl: _selfie, ...safe } = user;
  return { ...safe, assignedBarangays };
}

/** Same, for the audit trail (no secrets, no upload file names). */
function auditUserView(user: DbUser) {
  const { passwordHash: _hash, kycIdFileUrl: _id, kycSelfieUrl: _selfie, ...safe } = user;
  return safe;
}

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(/^[A-Za-z0-9._-]+$/, "Username may only contain letters, numbers, dots, dashes and underscores");

const nameSchema = z.string().trim().max(100).nullish();
const emailSchema = z.union([z.string().trim().email().max(200), z.literal(""), z.null()]).optional();
const barangayIdsSchema = z.array(z.coerce.number().int().positive()).max(100).optional();

const createUserSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(200),
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.enum(ROLE_VALUES).default(UserRole.TL),
  // New accounts are either usable or parked; nothing else makes sense here.
  status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED]).default(UserStatus.ACTIVE),
  barangayIds: barangayIdsSchema,
});

const updateUserSchema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED]).optional(),
  password: z.union([z.string().max(200), z.null()]).optional(),
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

const barangayAssignmentSchema = z.object({
  barangayIds: z.array(z.coerce.number().int().positive()).max(100),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || "Invalid input";
}

/** Returns the ids that do not exist, so the caller can reject the request. */
async function findUnknownBarangayIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const found = await db.select({ id: barangays.id }).from(barangays).where(inArray(barangays.id, ids));
  const known = new Set(found.map((b) => b.id));
  return ids.filter((id) => !known.has(id));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Locks every active System Admin row for the rest of the transaction and
 * returns how many there are besides `excludingUserId`. Callers use it to
 * refuse removing the last administrator.
 */
async function lockOtherActiveAdmins(tx: Tx, excludingUserId: string): Promise<number> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, UserRole.SYSTEM_ADMIN), eq(users.status, UserStatus.ACTIVE)))
    .for("update");
  return rows.filter((r) => r.id !== excludingUserId).length;
}

export function registerAdminRoutes(app: Express) {
  const adminOnly = [requireAuth, requireRole(UserRole.SYSTEM_ADMIN)];

  // === USER MANAGEMENT (Admin only) ===

  // List all users with their barangay assignments
  app.get("/api/admin/users", adminOnly, async (req: any, res: any) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const allUsers = status
        ? await db.select().from(users).where(eq(users.status, status))
        : await db.select().from(users);

      const assignments = await db
        .select({
          userId: userBarangays.userId,
          barangayId: userBarangays.barangayId,
          barangayName: barangays.name,
        })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id));

      const userAssignments: Record<string, { id: number; name: string }[]> = {};
      for (const a of assignments) {
        (userAssignments[a.userId] ??= []).push({ id: a.barangayId, name: a.barangayName });
      }

      res.json(allUsers.map((user) => adminUserView(user, userAssignments[user.id] || [])));
    } catch (error) {
      console.error("Error fetching users:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user with assignments
  app.get("/api/admin/users/:id", adminOnly, async (req: any, res: any) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const assignments = await db
        .select({ barangayId: userBarangays.barangayId, barangayName: barangays.name })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, user.id));

      res.json(adminUserView(user, assignments.map((a) => ({ id: a.barangayId, name: a.barangayName }))));
    } catch (error) {
      console.error("Error fetching user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create new user. The password given here is temporary: the new user is
  // forced to replace it at first login, so the admin never knows the
  // password the account ends up with.
  app.post("/api/admin/users", adminOnly, async (req: any, res: any) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: firstIssue(parsed.error) });
      }
      const input = parsed.data;
      const barangayIds = Array.from(new Set(input.barangayIds ?? []));

      const policy = checkPassword(input.password, input);
      if (!policy.ok) {
        return res.status(400).json({ message: policy.message });
      }

      if (input.role === UserRole.TL && barangayIds.length === 0) {
        return res.status(400).json({ message: "Team Leaders must be assigned to at least one barangay" });
      }
      const unknown = await findUnknownBarangayIds(barangayIds);
      if (unknown.length > 0) {
        return res.status(400).json({ message: "One or more selected barangays do not exist" });
      }

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username));
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const passwordHash = await hashPassword(input.password);

      const newUser = await db.transaction(async (tx) => {
        const [created] = await tx.insert(users).values({
          username: input.username,
          passwordHash,
          email: input.email || null,
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          role: input.role,
          status: input.status,
          mustChangePassword: true,
        }).returning();

        if (input.role === UserRole.TL && barangayIds.length > 0) {
          await tx.insert(userBarangays).values(
            barangayIds.map((barangayId) => ({ userId: created.id, barangayId })),
          );
        }
        return created;
      });

      await createAuditLog(
        req.userInfo.id, req.userInfo.role,
        "CREATE", "USER", newUser.id, undefined,
        null,
        { ...auditUserView(newUser), assignedBarangays: barangayIds },
        req,
      );

      res.status(201).json({ ...adminUserView(newUser), assignedBarangays: barangayIds });
    } catch (error) {
      console.error("Error creating user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Approve / reject a legacy pending registration. Self-registration no
  // longer exists; these remain so accounts created under the old flow can
  // still be resolved. An approved account must set a new password.
  app.post("/api/admin/users/:id/approve", adminOnly, async (req: any, res: any) => {
    try {
      const userId = req.params.id;
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.status !== UserStatus.PENDING_VERIFICATION) {
        return res.status(400).json({ message: "User is not pending verification" });
      }

      const [updated] = await db
        .update(users)
        .set({
          status: UserStatus.ACTIVE,
          kycReviewedAt: new Date(),
          kycReviewedById: req.userInfo.id,
          kycNotes: note || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      await createAuditLog(
        req.userInfo.id, req.userInfo.role,
        "KYC_APPROVE", "USER", userId, undefined,
        { status: user.status },
        { status: UserStatus.ACTIVE, reviewedBy: req.userInfo.username },
        req,
      );

      res.json(adminUserView(updated));
    } catch (error) {
      console.error("Error approving user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to approve user" });
    }
  });

  app.post("/api/admin/users/:id/reject", adminOnly, async (req: any, res: any) => {
    try {
      const userId = req.params.id;
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });
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
        req.userInfo.id, req.userInfo.role,
        "KYC_REJECT", "USER", userId, undefined,
        { status: user.status },
        { status: UserStatus.REJECTED, note, reviewedBy: req.userInfo.username },
        req,
      );

      res.json(adminUserView(updated));
    } catch (error) {
      console.error("Error rejecting user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to reject user" });
    }
  });

  // Update user (role, status, name, email, password reset)
  app.put("/api/admin/users/:id", adminOnly, async (req: any, res: any) => {
    try {
      const userId = req.params.id;
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: firstIssue(parsed.error) });
      }
      const input = parsed.data;

      const [beforeUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!beforeUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const newRole = input.role ?? beforeUser.role;
      const newStatus = input.status ?? beforeUser.status;
      const isSelf = userId === req.userInfo.id;

      // A Team Leader with no barangays is a nurse who can see nothing and
      // whose restriction has nothing to compare against. Assign barangays
      // first (PUT /api/admin/users/:id/barangays), then change the role.
      if (newRole === UserRole.TL && beforeUser.role !== UserRole.TL) {
        const assigned = await db.select({ barangayId: userBarangays.barangayId })
          .from(userBarangays).where(eq(userBarangays.userId, userId));
        if (assigned.length === 0) {
          return res.status(400).json({ message: "Assign at least one barangay before changing this user to Team Leader" });
        }
      }

      if (isSelf && newStatus === UserStatus.DISABLED) {
        return res.status(400).json({ message: "Cannot disable your own account" });
      }
      if (isSelf && newRole !== UserRole.SYSTEM_ADMIN) {
        return res.status(400).json({ message: "Cannot remove your own System Admin role" });
      }
      // Never leave the system without an administrator who can log in.
      // Enforced inside the update transaction below.
      const wasActiveAdmin = beforeUser.role === UserRole.SYSTEM_ADMIN && beforeUser.status === UserStatus.ACTIVE;
      const staysActiveAdmin = newRole === UserRole.SYSTEM_ADMIN && newStatus === UserStatus.ACTIVE;

      const updateData: Partial<DbUser> = {
        role: newRole,
        status: newStatus,
        firstName: input.firstName !== undefined ? (input.firstName || null) : beforeUser.firstName,
        lastName: input.lastName !== undefined ? (input.lastName || null) : beforeUser.lastName,
        email: input.email !== undefined ? (input.email || null) : beforeUser.email,
        updatedAt: new Date(),
      };

      // Password reset: the value is temporary and must be replaced by the
      // user. Resetting also clears any lockout.
      const passwordReset = typeof input.password === "string" && input.password.length > 0;
      if (passwordReset) {
        const policy = checkPassword(input.password, {
          username: beforeUser.username,
          firstName: updateData.firstName,
          lastName: updateData.lastName,
        });
        if (!policy.ok) {
          return res.status(400).json({ message: policy.message });
        }
        updateData.passwordHash = await hashPassword(input.password as string);
        updateData.mustChangePassword = true;
        updateData.failedLoginCount = 0;
        updateData.lockedUntil = null;
      }

      // The "is this the last admin?" check and the write happen under one
      // row lock, so two admins demoting each other at the same moment
      // cannot both succeed.
      const updated = await db.transaction(async (tx) => {
        if (wasActiveAdmin && !staysActiveAdmin) {
          const others = await lockOtherActiveAdmins(tx, userId);
          if (others === 0) return null;
        }
        const [row] = await tx.update(users).set(updateData).where(eq(users.id, userId)).returning();
        return row;
      });
      if (!updated) {
        return res.status(400).json({ message: "This is the last active System Admin and cannot be demoted or disabled" });
      }

      // Anything that changes what the account may do, or who knows its
      // password, ends its existing sessions.
      const accessChanged =
        passwordReset || newRole !== beforeUser.role || newStatus !== beforeUser.status;
      if (accessChanged && !isSelf) {
        await destroyUserSessions(userId);
      }

      let action = "UPDATE";
      if (newStatus === UserStatus.DISABLED && beforeUser.status !== UserStatus.DISABLED) {
        action = "DISABLE";
      } else if (newStatus === UserStatus.ACTIVE && beforeUser.status === UserStatus.DISABLED) {
        action = "ENABLE";
      } else if (passwordReset) {
        action = "PASSWORD_RESET";
      } else if (newRole !== beforeUser.role) {
        action = "ROLE_CHANGE";
      }

      await createAuditLog(
        req.userInfo.id, req.userInfo.role,
        action, "USER", userId, undefined,
        auditUserView(beforeUser),
        { ...auditUserView(updated), passwordReset },
        req,
      );

      res.json(adminUserView(updated));
    } catch (error) {
      console.error("Error updating user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/admin/users/:id", adminOnly, async (req: any, res: any) => {
    try {
      const userId = req.params.id;

      if (userId === req.userInfo.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      const targetIsActiveAdmin = target.role === UserRole.SYSTEM_ADMIN && target.status === UserStatus.ACTIVE;
      const deletedUser = await db.transaction(async (tx) => {
        if (targetIsActiveAdmin && (await lockOtherActiveAdmins(tx, userId)) === 0) return null;
        const [row] = await tx.delete(users).where(eq(users.id, userId)).returning();
        return row;
      });
      if (!deletedUser) {
        return res.status(400).json({ message: "This is the last active System Admin and cannot be deleted" });
      }
      await destroyUserSessions(userId);

      await createAuditLog(
        req.userInfo.id, req.userInfo.role,
        "DELETE", "USER", userId, undefined,
        auditUserView(deletedUser),
        null,
        req,
      );

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Assign barangays to a user (for TL role)
  app.put("/api/admin/users/:id/barangays", adminOnly, async (req: any, res: any) => {
    try {
      const userId = req.params.id;
      const parsed = barangayAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "barangayIds must be a list of barangay ids" });
      }
      const barangayIds = Array.from(new Set(parsed.data.barangayIds));

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === UserRole.TL && barangayIds.length === 0) {
        return res.status(400).json({ message: "Team Leaders must be assigned to at least one barangay" });
      }
      const unknown = await findUnknownBarangayIds(barangayIds);
      if (unknown.length > 0) {
        return res.status(400).json({ message: "One or more selected barangays do not exist" });
      }

      const beforeAssignments = await db
        .select({ barangayId: userBarangays.barangayId })
        .from(userBarangays)
        .where(eq(userBarangays.userId, userId));

      await db.transaction(async (tx) => {
        await tx.delete(userBarangays).where(eq(userBarangays.userId, userId));
        if (barangayIds.length > 0) {
          await tx.insert(userBarangays).values(barangayIds.map((barangayId) => ({ userId, barangayId })));
        }
      });

      const afterAssignments = await db
        .select({ barangayId: userBarangays.barangayId, barangayName: barangays.name })
        .from(userBarangays)
        .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
        .where(eq(userBarangays.userId, userId));

      await createAuditLog(
        req.userInfo.id, req.userInfo.role,
        "UPDATE", "USER_BARANGAY_ASSIGNMENT", userId, undefined,
        { barangayIds: beforeAssignments.map((a) => a.barangayId) },
        { barangayIds },
        req,
      );

      res.json(adminUserView(user, afterAssignments.map((a) => ({ id: a.barangayId, name: a.barangayName }))));
    } catch (error) {
      console.error("Error updating user barangays:", (error as Error)?.message || error);
      res.status(500).json({ message: "Failed to update user barangays" });
    }
  });

  // === AUDIT LOGS (Admin only) ===
  app.get("/api/admin/audit-logs", adminOnly, async (req: any, res: any) => {
    try {
      const { userId, action, entityType, barangayName, startDate, endDate } = req.query;
      // Hard caps so one request cannot pull the whole table.
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const conditions = [];
      if (userId) conditions.push(eq(auditLogs.userId, String(userId)));
      if (action) conditions.push(eq(auditLogs.action, String(action)));
      if (entityType) conditions.push(eq(auditLogs.entityType, String(entityType)));
      if (barangayName) conditions.push(eq(auditLogs.barangayName, String(barangayName)));
      const start = startDate ? new Date(String(startDate)) : null;
      const end = endDate ? new Date(String(endDate)) : null;
      if (start && !isNaN(start.getTime())) conditions.push(sql`${auditLogs.createdAt} >= ${start}`);
      if (end && !isNaN(end.getTime())) conditions.push(sql`${auditLogs.createdAt} <= ${end}`);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", (error as Error)?.message || error);
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
