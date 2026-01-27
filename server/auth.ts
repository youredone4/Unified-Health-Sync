import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users, UserRole, UserStatus } from "@shared/schema";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 10;

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
}

// Seed initial SYSTEM_ADMIN
async function seedInitialAdmin() {
  try {
    // Check if any user with username "admin" exists
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

// Register auth routes
export function registerAuthRoutes(app: Express): void {
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Find user by username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Check if user is disabled
      if (user.status === UserStatus.DISABLED) {
        return res.status(403).json({ message: "Account is disabled. Please contact an administrator." });
      }
      
      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
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
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
