import bcrypt from "bcrypt";
import session from "express-session";
import path from "path";
import fs from "fs";
import multer from "multer";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users, userBarangays, barangays, auditLogs, UserRole, UserStatus } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

interface TLUserSeed {
  username: string;
  firstName: string;
  lastName: string;
  barangayNames: string[];
}

const PLACER_TL_USERS: TLUserSeed[] = [
  { username: "CHapa",      firstName: "Carespin",       lastName: "Hapa",      barangayNames: ["Mabini"] },
  { username: "ADeramaso",  firstName: "April",          lastName: "Deramaso",  barangayNames: ["Ellaperal (Nonok)"] },
  { username: "RPolestico", firstName: "Ranibeth",       lastName: "Polestico", barangayNames: ["Central (Poblacion)"] },
  { username: "BBarcos",    firstName: "Wilgen",         lastName: "Barcos",    barangayNames: ["Boyongan", "Macalaya"] },
  { username: "PPagobo",    firstName: "Princess Jackie",lastName: "Pagobo",    barangayNames: ["San Isidro", "Magupange"] },
  { username: "CGalvez",    firstName: "Charlito",       lastName: "Galvez",    barangayNames: ["Sani-sani"] },
  { username: "RRivera",    firstName: "Ruth",           lastName: "Rivera",    barangayNames: ["Magupange"] },
  { username: "RJamiel",    firstName: "Rennie",         lastName: "Jamiel",    barangayNames: ["Amoslog"] },
  { username: "BBullas",    firstName: "Jensen",         lastName: "Bullas",    barangayNames: ["Panhutongan"] },
  { username: "RDalgume",   firstName: "Meljay",         lastName: "Dalgume",   barangayNames: ["Tagbongabong"] },
  { username: "LLlado",     firstName: "Risha Ann",      lastName: "Llado",     barangayNames: ["Anislagan"] },
  { username: "DOcol",      firstName: "Dulce Mae",      lastName: "Ocol",      barangayNames: ["Suyoc", "Bugas-bugas"] },
];

const SALT_ROUNDS = 10;

// KYC upload directory (not publicly accessible)
const KYC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "kyc");
if (!fs.existsSync(KYC_UPLOAD_DIR)) {
  fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
}

// Multer storage for KYC uploads
const kycStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, KYC_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `kyc-${uniqueSuffix}${ext}`);
  },
});

const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".heic"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, PDF, and HEIC files are allowed"));
    }
  },
});

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session setup
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// Extend Express session
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Setup auth middleware
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  // Seed initial admin user if none exists
  await seedInitialAdmin();
  
  // Seed the 20 Placer barangays if not present
  await seedPlacerBarangays();

  // Seed the 12 Placer TL (Barangay Nurse) accounts if not present
  await seedTLUsers();
}

// Seed initial SYSTEM_ADMIN
async function seedInitialAdmin() {
  try {
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin"));
    
    if (!existingAdmin) {
      const passwordHash = await hashPassword("admin123");
      await db.insert(users).values({
        id: "admin",
        username: "admin",
        passwordHash,
        email: "admin@geohealthsync.local",
        firstName: "System",
        lastName: "Administrator",
        role: UserRole.SYSTEM_ADMIN,
        status: UserStatus.ACTIVE,
      });
      console.log("Initial admin user created: admin / admin123");
    } else {
      console.log("Admin user already exists");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

// Seed the 20 official Placer, Surigao del Norte barangays
const PLACER_BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

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
    } else {
      console.log("All 20 Placer barangays already exist");
    }
  } catch (error) {
    console.error("Error seeding barangays:", error);
  }
}

// Seed the 12 Placer TL (Barangay Nurse) accounts — idempotent, skips existing usernames
async function seedTLUsers() {
  try {
    const allBarangays = await db.select().from(barangays);
    const barangayMap = new Map<string, number>(allBarangays.map(b => [b.name, b.id]));

    let created = 0;
    for (const spec of PLACER_TL_USERS) {
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, spec.username));
      if (existing) continue;

      const barangayIds: number[] = [];
      let valid = true;
      for (const bName of spec.barangayNames) {
        const bId = barangayMap.get(bName);
        if (!bId) { console.warn(`seedTLUsers: barangay not found: "${bName}" for ${spec.username}`); valid = false; break; }
        barangayIds.push(bId);
      }
      if (!valid) continue;

      const passwordHash = await hashPassword("123456");
      await db.transaction(async (tx) => {
        const [newUser] = await tx.insert(users).values({
          username: spec.username,
          passwordHash,
          firstName: spec.firstName,
          lastName: spec.lastName,
          role: UserRole.TL,
          status: UserStatus.ACTIVE,
        }).returning({ id: users.id });

        await tx.insert(userBarangays).values(
          barangayIds.map(bId => ({ userId: newUser.id, barangayId: bId }))
        );
      });
      created++;
    }
    if (created > 0) {
      console.log(`Seeded ${created} Placer TL user accounts`);
    } else {
      console.log("All Placer TL accounts already exist");
    }
  } catch (error) {
    console.error("Error seeding TL users:", error);
  }
}

// Helper to write audit log
async function writeAuditLog(
  actingUserId: string,
  actingUserRole: string,
  action: string,
  entityId: string,
  afterData: Record<string, unknown>,
  req?: Express.Request
) {
  try {
    await db.insert(auditLogs).values({
      userId: actingUserId,
      userRole: actingUserRole,
      action,
      entityType: "USER",
      entityId,
      afterJson: afterData,
      ipAddress: (req as any)?.ip || null,
      userAgent: (req as any)?.headers?.["user-agent"] || null,
    });
  } catch (err) {
    console.error("Failed to write auth audit log:", err);
  }
}

// Register auth routes
export function registerAuthRoutes(app: Express): void {
  // Self-Registration (no auth required)
  // Multer error handling wrapper
  const kycUploadFields = kycUpload.fields([
    { name: "kycIdFile", maxCount: 1 },
    { name: "kycSelfie", maxCount: 1 },
  ]);

  app.post("/api/auth/register",
    (req, res, next) => {
      kycUploadFields(req, res, (err) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File is too large. Maximum size is 10MB." });
          }
          if (err.message) {
            return res.status(400).json({ message: err.message });
          }
          return res.status(400).json({ message: "File upload failed. Please try again." });
        }
        next();
      });
    },
    async (req: any, res) => {
      try {
        const {
          username, password, confirmPassword,
          fullName, email, contactNumber,
          role, barangayIds: barangayIdsRaw,
          kycIdType,
        } = req.body;

        // Basic validation
        if (!username?.trim() || !password || !fullName?.trim() || !contactNumber?.trim()) {
          return res.status(400).json({ message: "Username, password, full name, and contact number are required" });
        }

        if (password.length < 8) {
          return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        if (password !== confirmPassword) {
          return res.status(400).json({ message: "Passwords do not match" });
        }

        // Only allow SHA or TL for self-registration
        const allowedRoles = [UserRole.SHA, UserRole.TL];
        const requestedRole = role || UserRole.TL;
        if (!allowedRoles.includes(requestedRole)) {
          return res.status(400).json({ message: "Invalid role. You may register as SHA or TL only." });
        }

        // Resolve uploaded files BEFORE further validation so we can delete orphans on error
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const uploadedIdFile = files?.kycIdFile?.[0];
        const uploadedSelfie = files?.kycSelfie?.[0];

        // Helper to delete orphan upload file(s) on validation error
        const cleanupUploads = () => {
          [uploadedIdFile, uploadedSelfie].forEach(f => {
            if (f?.path && fs.existsSync(f.path)) {
              fs.unlink(f.path, (err) => { if (err) console.error("Cleanup failed:", err); });
            }
          });
        };

        // Server-side KYC enforcement: ID type and file are mandatory for all self-registrants
        if (!kycIdType?.trim()) {
          cleanupUploads();
          return res.status(400).json({ message: "A valid government ID type is required." });
        }

        if (!uploadedIdFile) {
          cleanupUploads();
          return res.status(400).json({ message: "A valid government ID photo is required. Please upload a clear photo or scan." });
        }

        // Server-side TL barangay enforcement: TL must be assigned to at least one valid barangay
        if (requestedRole === UserRole.TL) {
          const rawIds: number[] = (Array.isArray(barangayIdsRaw) ? barangayIdsRaw : barangayIdsRaw ? [barangayIdsRaw] : [])
            .map((id: string) => parseInt(id, 10))
            .filter((id: number) => !isNaN(id) && id > 0);

          // Deduplicate
          const uniqueBarangayIds = [...new Set(rawIds)];

          if (uniqueBarangayIds.length === 0) {
            cleanupUploads();
            return res.status(400).json({ message: "Team Leaders must be assigned to at least one barangay." });
          }

          // Verify ALL provided barangay IDs actually exist in the database
          const existingBarangays = await db.select({ id: barangays.id })
            .from(barangays)
            .where(inArray(barangays.id, uniqueBarangayIds));

          if (existingBarangays.length !== uniqueBarangayIds.length) {
            cleanupUploads();
            return res.status(400).json({ message: "One or more selected barangays are invalid. Please select from the available barangays." });
          }
        }

        // Check username uniqueness
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username.trim()));
        if (existing) {
          cleanupUploads();
          return res.status(400).json({ message: "Username is already taken" });
        }

        const kycIdFileUrl = uploadedIdFile.filename;
        const kycSelfieUrl = uploadedSelfie?.filename || null;
        const passwordHash = await hashPassword(password);

        const [newUser] = await db.insert(users).values({
          username: username.trim(),
          passwordHash,
          fullName: fullName.trim(),
          email: email?.trim() || null,
          contactNumber: contactNumber.trim(),
          role: requestedRole,
          status: UserStatus.PENDING_VERIFICATION,
          kycIdType: kycIdType.trim(),
          kycIdFileUrl,
          kycSelfieUrl,
        }).returning();

        // Assign barangays if TL (IDs already validated above)
        if (requestedRole === UserRole.TL && barangayIdsRaw) {
          const barangayIds: number[] = (Array.isArray(barangayIdsRaw) ? barangayIdsRaw : [barangayIdsRaw])
            .map((id: string) => parseInt(id, 10))
            .filter((id: number) => !isNaN(id) && id > 0);

          if (barangayIds.length > 0) {
            await db.insert(userBarangays).values(
              barangayIds.map(bId => ({ userId: newUser.id, barangayId: bId }))
            ).onConflictDoNothing();
          }
        }

        // Audit log — use system as actor since user is not logged in
        await writeAuditLog(
          "SYSTEM",
          "SYSTEM",
          "REGISTER",
          newUser.id,
          { username: newUser.username, fullName: newUser.fullName, role: newUser.role, status: newUser.status }
        );

        res.status(201).json({
          message: "Registration submitted successfully. Your account is pending administrator verification.",
          userId: newUser.id,
        });
      } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Registration failed. Please try again." });
      }
    }
  );

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Verify password first (same error message to prevent username enumeration)
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check account status after password verification
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        return res.status(403).json({
          message: "Your account is pending verification. Please wait for administrator approval.",
          statusCode: "PENDING_VERIFICATION",
        });
      }

      if (user.status === UserStatus.REJECTED) {
        const noteMsg = user.kycNotes ? ` Reason: ${user.kycNotes}` : "";
        return res.status(403).json({
          message: `Your account registration was not approved.${noteMsg} Please contact the administrator for assistance.`,
          statusCode: "REJECTED",
        });
      }

      if (user.status === UserStatus.DISABLED) {
        return res.status(403).json({
          message: "Your account has been disabled. Please contact the administrator.",
          statusCode: "DISABLED",
        });
      }
      
      // Set session
      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      if (user.status === UserStatus.DISABLED) {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Account is disabled" });
      }
      
      // Get assigned barangays for TL users (return names for frontend use)
      let assignedBarangays: string[] = [];
      if (user.role === UserRole.TL) {
        const assignments = await db.select({ barangayName: barangays.name })
          .from(userBarangays)
          .innerJoin(barangays, eq(userBarangays.barangayId, barangays.id))
          .where(eq(userBarangays.userId, userId));
        assignedBarangays = assignments.map(a => a.barangayName);
      }
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        assignedBarangays,
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update own profile (firstName, lastName, email only)
  app.put("/api/auth/me/profile", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { firstName, lastName, email } = req.body;

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

      res.json({
        id: updated.id,
        username: updated.username,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        status: updated.status,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change own password (requires current password)
  app.put("/api/auth/me/password", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (user.status === UserStatus.DISABLED) {
      return res.status(403).json({ message: "Account is disabled" });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: "Authentication check failed" });
  }
};

// Export KYC upload dir for use in admin routes
export { KYC_UPLOAD_DIR };
