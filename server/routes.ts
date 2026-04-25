import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { max, eq } from "drizzle-orm";
import { prenatalVisits, childVisits, seniorVisits, insertFpServiceRecordSchema, insertNutritionFollowUpSchema, insertColdChainLogSchema, insertTbDoseLogSchema, insertPostpartumVisitSchema, insertPrenatalScreeningSchema, insertBirthAttendanceRecordSchema, insertSickChildVisitSchema, insertSchoolImmunizationSchema, insertOralHealthVisitSchema, insertPhilpenAssessmentSchema, insertNcdScreeningSchema, insertVisionScreeningSchema, insertCervicalCancerScreeningSchema, insertMentalHealthScreeningSchema, insertFilariasisRecordSchema, insertRabiesExposureSchema, insertSchistosomiasisRecordSchema, insertSthRecordSchema, insertLeprosyRecordSchema, insertDeathEventSchema, insertHouseholdWaterRecordSchema } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./auth";
import { registerAdminRoutes } from "./routes/admin";
import { loadUserInfo, requireAuth, requireRole, createAuditLog } from "./middleware/rbac";
import { UserRole } from "@shared/schema";
import { ensureReportsRegistered, listReports, getReport } from "./reports";
import { monthRange, quarterRange } from "./reports/types";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register admin routes (user management, audit logs, etc.)
  registerAdminRoutes(app);

  // Seed data on startup — run asynchronously so the server can start
  // listening and pass the health check before seeding completes.
  storage.seedData().catch((err) =>
    console.error("[seed] seedData failed:", err)
  );

  // RBAC middleware for registry read - all authenticated users can read
  const registryReadRBAC = [loadUserInfo, requireAuth];
  // RBAC middleware for registry CRUD - all operational roles can create/update
  const registryRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL)];
  // RBAC middleware for registry DELETE - SYSTEM_ADMIN only
  const adminOnlyRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN)];

  // Helper to filter data by TL's assigned barangays.
  // If an explicit barangay query param is provided and the user is a TL,
  // validates it is in their assigned list and filters to only that barangay.
  // Returns null (caller should send 403) if the requested barangay is not allowed.
  function filterByBarangay<T extends { barangay: string }>(
    data: T[],
    userInfo: Express.Request["userInfo"],
    explicitBarangay?: string
  ): T[] | null {
    if (!userInfo) return [];
    if (userInfo.role === UserRole.TL) {
      if (explicitBarangay) {
        if (!userInfo.assignedBarangays.includes(explicitBarangay)) {
          return null; // forbidden – requested barangay not assigned
        }
        return data.filter(item => item.barangay === explicitBarangay);
      }
      // TL without explicit barangay: return empty to prevent merged-data leakage.
      // Frontend must always pass ?barangay= for TL users via scopedPath().
      return [];
    }
    // Non-TL roles: if explicit barangay requested, just filter to it (no restriction)
    if (explicitBarangay) {
      return data.filter(item => item.barangay === explicitBarangay);
    }
    return data;
  }

  // Safe integer ID parser — returns the parsed integer or sends 400 and returns null
  function parseId(raw: string | undefined, res: any): number | null {
    const n = parseInt(raw ?? "", 10);
    if (isNaN(n) || n <= 0) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    return n;
  }

  // Wraps async route handlers so uncaught errors are forwarded to Express error handler
  type AsyncHandler = (req: any, res: any, next: any) => Promise<any>;
  function ar(fn: AsyncHandler): AsyncHandler {
    return (req, res, next) => fn(req, res, next).catch(next);
  }

  // === MOTHERS ===
  app.get(api.mothers.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getMothers();
    const explicitBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const filtered = filterByBarangay(data, req.userInfo, explicitBarangay);
    if (filtered === null) return res.status(403).json({ message: "Access denied to this barangay" });
    res.json(filtered);
  });

  // Mother search for FP registry linking
  app.get("/api/mothers/search", registryReadRBAC, async (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    const data = await storage.getMothers();
    // For TL users, search within their assigned barangays (cross-barangay search within their scope)
    const scoped = req.userInfo?.role === UserRole.TL
      ? data.filter(m => req.userInfo!.assignedBarangays.includes(m.barangay))
      : data;
    const currentYear = new Date().getFullYear();
    const results = scoped
      .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
      .slice(0, 10)
      .map(m => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        barangay: m.barangay,
        // Approximate DOB from age (mid-year) so FP age-group bucketing has a reference
        dob: m.age ? `${currentYear - m.age}-07-01` : undefined,
      }));
    res.json(results);
  });

  app.get(api.mothers.get.path, registryReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const mother = await storage.getMother(id);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(mother);
  }));

  app.post(api.mothers.create.path, registryRBAC, async (req, res) => {
    try {
      const input = api.mothers.create.input.parse(req.body);
      // TL can only create records in their assigned barangays
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
      }
      const created = await storage.createMother(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.mothers.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.mothers.update.input.parse(req.body);
    const updated = await storage.updateMother(id, input);
    res.json(updated);
  }));

  app.delete(api.mothers.delete.path, adminOnlyRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const mother = await storage.getMother(id);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    await storage.deleteMother(id);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "DELETE", "MOTHER", String(id), undefined, undefined, undefined, req);
    res.json({ success: true });
  }));

  // === CHILDREN ===
  app.get(api.children.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getChildren();
    const explicitBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const filtered = filterByBarangay(data, req.userInfo, explicitBarangay);
    if (filtered === null) return res.status(403).json({ message: "Access denied to this barangay" });
    res.json(filtered);
  });

  app.get(api.children.get.path, registryReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const child = await storage.getChild(id);
    if (!child) return res.status(404).json({ message: "Child not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(child);
  }));

  app.post(api.children.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.children.create.input.parse(req.body);
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
      return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
    }
    const created = await storage.createChild(input);
    res.status(201).json(created);
  }));

  app.put(api.children.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.children.update.input.parse(req.body);
    const updated = await storage.updateChild(id, input);
    res.json(updated);
  }));

  app.delete(api.children.delete.path, adminOnlyRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const child = await storage.getChild(id);
    if (!child) return res.status(404).json({ message: "Child not found" });
    await storage.deleteChild(id);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "DELETE", "CHILD", String(id), undefined, undefined, undefined, req);
    res.json({ success: true });
  }));

  // === SENIORS ===
  app.get(api.seniors.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getSeniors();
    const explicitBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const filtered = filterByBarangay(data, req.userInfo, explicitBarangay);
    if (filtered === null) return res.status(403).json({ message: "Access denied to this barangay" });
    res.json(filtered);
  });

  app.get(api.seniors.get.path, registryReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const senior = await storage.getSenior(id);
    if (!senior) return res.status(404).json({ message: "Senior not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(senior.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(senior);
  }));

  app.post(api.seniors.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.seniors.create.input.parse(req.body);
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
      return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
    }
    const created = await storage.createSenior(input);
    res.status(201).json(created);
  }));

  app.put(api.seniors.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.seniors.update.input.parse(req.body);
    const updated = await storage.updateSenior(id, input);
    res.json(updated);
  }));

  app.delete(api.seniors.delete.path, adminOnlyRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const senior = await storage.getSenior(id);
    if (!senior) return res.status(404).json({ message: "Senior not found" });
    await storage.deleteSenior(id);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "DELETE", "SENIOR", String(id), undefined, undefined, undefined, req);
    res.json({ success: true });
  }));

  // Senior bulk import from AMOS logs
  app.post("/api/seniors/bulk-import", loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO), ar(async (req, res) => {
    const { rows, replace } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ message: "rows must be an array" });
    const count = await storage.bulkImportSeniors(rows, replace === true);
    res.json({ imported: count });
  }));

  // === SENIOR MEDICATION CLAIMS (Cross-barangay verification) ===
  app.get("/api/senior-med-claims", async (req, res) => {
    try {
      const seniorId = req.query.seniorId ? Number(req.query.seniorId) : undefined;
      const claims = await storage.getSeniorMedClaims(seniorId);
      res.json(claims);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch medication claims" });
    }
  });

  app.get("/api/senior-med-claims/check-eligibility/:seniorUniqueId", async (req, res) => {
    try {
      const { seniorUniqueId } = req.params;
      const result = await storage.checkSeniorEligibility(seniorUniqueId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to check eligibility" });
    }
  });

  app.post("/api/senior-med-claims", async (req: any, res) => {
    try {
      const { seniorId, seniorUniqueId, claimedBarangayId, claimedBarangayName, medicationName, dose, quantity, cycleDays = 30 } = req.body;
      
      // Check eligibility first
      if (seniorUniqueId) {
        const eligibility = await storage.checkSeniorEligibility(seniorUniqueId);
        if (!eligibility.eligible) {
          return res.status(400).json({ message: eligibility.reason, lastClaim: eligibility.lastClaim });
        }
      }

      const now = new Date();
      const nextEligibleAt = new Date(now);
      nextEligibleAt.setDate(nextEligibleAt.getDate() + cycleDays);

      const claim = await storage.createSeniorMedClaim({
        seniorId,
        seniorUniqueId,
        claimedAt: now.toISOString(),
        claimedBarangayId,
        claimedBarangayName,
        medicationName,
        dose,
        quantity,
        cycleDays,
        nextEligibleAt: nextEligibleAt.toISOString(),
        claimedByUserId: req.userInfo?.id,
        createdAt: now.toISOString(),
      });

      res.status(201).json(claim);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create medication claim" });
    }
  });

  // === INVENTORY ===
  app.get(api.inventory.list.path, async (req, res) => {
    const data = await storage.getInventory();
    res.json(data);
  });

  app.get('/api/inventory/snapshots', async (req, res) => {
    const { barangay, itemType, itemKey } = req.query as Record<string, string>;
    if (!itemType || !itemKey) {
      return res.status(400).json({ message: "itemType and itemKey are required" });
    }
    const VALID_ITEM_TYPES = ["vaccine", "medicine"] as const;
    const VALID_VACCINE_KEYS = ["bcg", "hepB", "penta", "opv", "mr"] as const;
    if (!(VALID_ITEM_TYPES as readonly string[]).includes(itemType)) {
      return res.status(400).json({ message: `itemType must be one of: ${VALID_ITEM_TYPES.join(", ")}` });
    }
    if (itemType === "vaccine" && !(VALID_VACCINE_KEYS as readonly string[]).includes(itemKey)) {
      return res.status(400).json({ message: `For itemType 'vaccine', itemKey must be one of: ${VALID_VACCINE_KEYS.join(", ")}` });
    }
    const data = await storage.getInventorySnapshots({ barangay: barangay || undefined, itemType, itemKey });
    res.json(data);
  });

  // === COLD-CHAIN TEMPERATURE LOGS ===
  // Per DOH NIP/EPI Cold Chain Manual: twice-daily fridge readings.
  // TL: scoped to assigned barangays. MHO/SHA/Admin: full read.
  app.get("/api/cold-chain/logs", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    const toDate = req.query.toDate ? String(req.query.toDate) : undefined;

    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getColdChainLogs({ barangay: requestedBarangay, fromDate, toDate });
      const scoped = requestedBarangay ? all : all.filter(l => assigned.includes(l.barangay));
      return res.json(scoped);
    }
    const data = await storage.getColdChainLogs({ barangay: requestedBarangay, fromDate, toDate });
    res.json(data);
  }));

  app.get("/api/cold-chain/today", loadUserInfo, requireAuth, ar(async (req, res) => {
    const barangay = req.query.barangay ? String(req.query.barangay) : undefined;
    if (!barangay) return res.status(400).json({ message: "barangay query param is required" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const status = await storage.getColdChainTodayStatus(barangay, today);
    res.json(status);
  }));

  app.post("/api/cold-chain/logs", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertColdChainLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid cold-chain log", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createColdChainLog({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "COLD_CHAIN_LOG", String(created.id),
        created.barangay, undefined,
        { readingDate: created.readingDate, readingPeriod: created.readingPeriod, tempCelsius: created.tempCelsius, vvmStatus: created.vvmStatus },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === MEDICINE INVENTORY ===
  app.get(api.medicineInventory.list.path, async (req, res) => {
    const data = await storage.getMedicineInventory();
    res.json(data);
  });

  app.get(api.medicineInventory.get.path, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const item = await storage.getMedicineInventoryById(id);
    if (!item) return res.status(404).json({ message: "Medicine inventory item not found" });
    res.json(item);
  });

  app.post(api.medicineInventory.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.medicineInventory.create.input.parse(req.body);
    const created = await storage.createMedicineInventory(input);
    res.status(201).json(created);
  }));

  app.put(api.medicineInventory.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const existing = await storage.getMedicineInventoryById(id);
    if (!existing) return res.status(404).json({ message: "Medicine inventory item not found" });
    const input = api.medicineInventory.update.input.parse(req.body);
    const updated = await storage.updateMedicineInventory(id, input);
    res.json(updated);
  }));

  // === HEALTH STATIONS ===
  app.get(api.healthStations.list.path, async (req, res) => {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const tbDotsParam = typeof req.query.tbDots === "string" ? req.query.tbDots : undefined;
    const filter: { facilityType?: string; hasTbDots?: boolean } = {};
    if (type) filter.facilityType = type;
    if (tbDotsParam === "1" || tbDotsParam === "true") filter.hasTbDots = true;
    const data = await storage.getHealthStations(Object.keys(filter).length ? filter : undefined);
    res.json(data);
  });

  // === SMS (Demo) ===
  app.get(api.sms.list.path, async (req, res) => {
    const data = await storage.getSmsMessages();
    res.json(data);
  });

  app.post(api.sms.send.path, async (req, res) => {
    try {
      const input = api.sms.send.input.parse(req.body);

      // Send real SMS via Semaphore if API key is configured
      const semaphoreKey = process.env.SEMAPHORE_API_KEY;
      let status = "Queued (Demo)";
      if (semaphoreKey && input.recipientPhone) {
        try {
          const params = new URLSearchParams({
            apikey: semaphoreKey,
            number: input.recipientPhone.replace(/^\+63/, "0"),
            message: input.message,
            sendername: "HealthSync",
          });
          const smsFetch = await fetch("https://api.semaphore.co/api/v4/messages", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          });
          const smsResult = await smsFetch.json();
          if (smsFetch.ok && Array.isArray(smsResult) && smsResult[0]?.status) {
            status = smsResult[0].status === "Queued" ? "Sent" : smsResult[0].status;
          } else {
            const errMsg = smsResult?.message || JSON.stringify(smsResult);
            console.error("Semaphore error:", errMsg);
            status = `Failed: ${errMsg}`;
          }
        } catch (smsErr) {
          console.error("Semaphore request failed:", smsErr);
          status = "Failed: network error";
        }
      }

      const created = await storage.sendSms({ ...input, status });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid SMS data" });
    }
  });

  // === DISEASE CASES ===
  app.get(api.diseaseCases.list.path, loadUserInfo, requireAuth, async (req, res) => {
    let data = await storage.getDiseaseCases();
    const { month } = req.query;
    const explicitBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const filtered = filterByBarangay(data, req.userInfo, explicitBarangay);
    if (filtered === null) return res.status(403).json({ message: "Access denied to this barangay" });
    data = filtered;
    if (month) data = data.filter(c => c.dateReported.startsWith(String(month)));
    res.json(data);
  });

  app.get(api.diseaseCases.get.path, loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const diseaseCase = await storage.getDiseaseCase(id);
    if (!diseaseCase) return res.status(404).json({ message: "Disease case not found" });
    if (req.userInfo!.role === UserRole.TL && !req.userInfo!.assignedBarangays.includes(diseaseCase.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(diseaseCase);
  }));

  app.post(api.diseaseCases.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.diseaseCases.create.input.parse(req.body);
    const created = await storage.createDiseaseCase(input);
    res.status(201).json(created);
  }));

  app.put(api.diseaseCases.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.diseaseCases.update.input.parse(req.body);
    const updated = await storage.updateDiseaseCase(id, input);
    res.json(updated);
  }));

  app.delete(api.diseaseCases.delete.path, adminOnlyRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const diseaseCase = await storage.getDiseaseCase(id);
    if (!diseaseCase) return res.status(404).json({ message: "Disease case not found" });
    await storage.deleteDiseaseCase(id);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "DELETE", "DISEASE_SURVEILLANCE", String(id), undefined, undefined, undefined, req);
    res.json({ success: true });
  }));

  app.post("/api/disease-cases/bulk", loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO), ar(async (req, res) => {
    const { rows, replace = false } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ message: "rows must be an array" });
    }
    const imported = await storage.bulkImportDiseaseCases(rows, replace as boolean);
    res.json({ imported });
  }));

  // === TB PATIENTS ===
  // Each municipality runs a single RHU, so referralToRHU is just a flag — we
  // don't ask the operator to pick a facility. If a referredRhuId is supplied
  // (legacy data, future multi-facility support) it must still be a verified
  // TB DOTS RHU and is only meaningful when the referral flag is on.
  async function validateTbRhuReferral(
    referralToRHU: boolean,
    referredRhuId: number | null,
  ): Promise<string | null> {
    if (referredRhuId) {
      if (!referralToRHU) {
        return "Referred RHU can only be set when the patient is marked as referred.";
      }
      const dotsRhus = await storage.getHealthStations({ facilityType: "RHU", hasTbDots: true });
      if (!dotsRhus.some(r => r.id === referredRhuId)) {
        return "The selected facility is not a verified TB DOTS RHU.";
      }
    }
    return null;
  }

  app.get(api.tbPatients.list.path, loadUserInfo, requireAuth, async (req, res) => {
    let data = await storage.getTBPatients();
    const explicitBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const filtered = filterByBarangay(data, req.userInfo, explicitBarangay);
    if (filtered === null) return res.status(403).json({ message: "Access denied to this barangay" });
    res.json(filtered);
  });

  app.get(api.tbPatients.get.path, loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const patient = await storage.getTBPatient(id);
    if (!patient) return res.status(404).json({ message: "TB patient not found" });
    if (req.userInfo!.role === UserRole.TL && !req.userInfo!.assignedBarangays.includes(patient.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(patient);
  }));

  app.post(api.tbPatients.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.tbPatients.create.input.parse(req.body);
    // Only run the referral consistency check when the write actually touches
    // those fields — legacy rows where referralToRHU=true but referredRhuId is
    // null would otherwise block every unrelated update (e.g. dose logging).
    if (input.referralToRHU !== undefined || input.referredRhuId !== undefined) {
      const rhuError = await validateTbRhuReferral(!!input.referralToRHU, input.referredRhuId ?? null);
      if (rhuError) return res.status(400).json({ message: rhuError });
    }
    const created = await storage.createTBPatient(input);
    res.status(201).json(created);
  }));

  app.put(api.tbPatients.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.tbPatients.update.input.parse(req.body);
    // Skip validation entirely for patches that don't touch referral fields.
    // A legacy row carrying (referralToRHU=true, referredRhuId=null) must
    // still be able to record doses, sputum checks, etc.
    if (input.referralToRHU !== undefined || input.referredRhuId !== undefined) {
      const existing = await storage.getTBPatient(id);
      if (!existing) return res.status(404).json({ message: "TB patient not found" });
      const mergedRefer = input.referralToRHU !== undefined ? input.referralToRHU : existing.referralToRHU;
      const mergedRhuId = input.referredRhuId !== undefined ? input.referredRhuId : existing.referredRhuId;
      const rhuError = await validateTbRhuReferral(!!mergedRefer, mergedRhuId ?? null);
      if (rhuError) return res.status(400).json({ message: rhuError });
    }
    const updated = await storage.updateTBPatient(id, input);
    res.json(updated);
  }));

  app.delete(api.tbPatients.delete.path, adminOnlyRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const patient = await storage.getTBPatient(id);
    if (!patient) return res.status(404).json({ message: "TB patient not found" });
    await storage.deleteTBPatient(id);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "DELETE", "TB_DOTS", String(id), undefined, undefined, undefined, req);
    res.json({ success: true });
  }));

  // === TB DOSE LOGS (NTP MoP 6th Ed. — directly-observed daily dose) ===
  app.get("/api/tb-dose-logs", loadUserInfo, requireAuth, ar(async (req, res) => {
    const patientIdRaw = req.query.patientId ? Number(req.query.patientId) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
    if (patientIdRaw === undefined || !Number.isFinite(patientIdRaw)) {
      return res.status(400).json({ message: "patientId query param is required" });
    }
    const patient = await storage.getTBPatient(patientIdRaw);
    if (!patient) return res.status(404).json({ message: "TB patient not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(patient.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const data = await storage.getTbDoseLogs({ tbPatientId: patientIdRaw, fromDate, toDate });
    res.json(data);
  }));

  app.get("/api/tb-dose-logs/today", loadUserInfo, requireAuth, ar(async (req, res) => {
    const barangay = req.query.barangay ? String(req.query.barangay) : undefined;
    if (!barangay) return res.status(400).json({ message: "barangay query param is required" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const summary = await storage.getTbDoseTodaySummary(barangay, today);
    res.json(summary);
  }));

  app.post("/api/tb-dose-logs", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertTbDoseLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid TB dose log", issues: parsed.error.issues });
      }
      const input = parsed.data;
      const patient = await storage.getTBPatient(input.tbPatientId);
      if (!patient) return res.status(404).json({ message: "TB patient not found" });
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(patient.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createTbDoseLog({
        ...input,
        observedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "TB_DOSE_LOG", String(created.id),
        patient.barangay, undefined,
        { tbPatientId: created.tbPatientId, doseDate: created.doseDate, observedStatus: created.observedStatus },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === POSTPARTUM (PNC) VISITS — DOH MNCHN AO 2008-0029 ===
  app.get("/api/postpartum-visits", loadUserInfo, requireAuth, ar(async (req, res) => {
    const motherIdRaw = req.query.motherId ? Number(req.query.motherId) : undefined;
    if (motherIdRaw === undefined || !Number.isFinite(motherIdRaw)) {
      return res.status(400).json({ message: "motherId query param is required" });
    }
    const mother = await storage.getMother(motherIdRaw);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const data = await storage.getPostpartumVisits(motherIdRaw);
    res.json(data);
  }));

  app.get("/api/postpartum-visits/today", loadUserInfo, requireAuth, ar(async (req, res) => {
    const barangay = req.query.barangay ? String(req.query.barangay) : undefined;
    if (!barangay) return res.status(400).json({ message: "barangay query param is required" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const summary = await storage.getPostpartumDueToday(barangay, today);
    res.json(summary);
  }));

  app.post("/api/postpartum-visits", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertPostpartumVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid postpartum visit", issues: parsed.error.issues });
      }
      const input = parsed.data;
      const mother = await storage.getMother(input.motherId);
      if (!mother) return res.status(404).json({ message: "Mother not found" });
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createPostpartumVisit({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "POSTPARTUM_VISIT", String(created.id),
        mother.barangay, undefined,
        { motherId: created.motherId, visitDate: created.visitDate, visitType: created.visitType },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === PRENATAL SCREENINGS — feeds M1 Section A page-19 extras ===
  app.get("/api/prenatal-screenings", loadUserInfo, requireAuth, ar(async (req, res) => {
    const motherIdRaw = req.query.motherId ? Number(req.query.motherId) : undefined;
    if (motherIdRaw === undefined || !Number.isFinite(motherIdRaw)) {
      return res.status(400).json({ message: "motherId query param is required" });
    }
    const mother = await storage.getMother(motherIdRaw);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const data = await storage.getPrenatalScreenings(motherIdRaw);
    res.json(data);
  }));

  app.post("/api/prenatal-screenings", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertPrenatalScreeningSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid prenatal screening", issues: parsed.error.issues });
      }
      const input = parsed.data;
      const mother = await storage.getMother(input.motherId);
      if (!mother) return res.status(404).json({ message: "Mother not found" });
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createPrenatalScreening({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "PRENATAL_SCREENING", String(created.id),
        mother.barangay, undefined,
        { motherId: created.motherId, screeningDate: created.screeningDate },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === SICK CHILD VISITS — feeds M1 Section F (IMCI) ===
  app.get("/api/sick-child-visits", loadUserInfo, requireAuth, ar(async (req, res) => {
    const childIdRaw = req.query.childId ? Number(req.query.childId) : undefined;
    if (childIdRaw === undefined || !Number.isFinite(childIdRaw)) {
      return res.status(400).json({ message: "childId query param is required" });
    }
    const child = await storage.getChild(childIdRaw);
    if (!child) return res.status(404).json({ message: "Child not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const data = await storage.getSickChildVisits(childIdRaw);
    res.json(data);
  }));

  app.post("/api/sick-child-visits", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertSickChildVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sick child visit", issues: parsed.error.issues });
      }
      const input = parsed.data;
      const child = await storage.getChild(input.childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createSickChildVisit({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "SICK_CHILD_VISIT", String(created.id),
        child.barangay, undefined,
        { childId: created.childId, visitDate: created.visitDate, vitaminAGiven: created.vitaminAGiven, hasAcuteDiarrhea: created.hasAcuteDiarrhea },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === SCHOOL IMMUNIZATIONS — feeds M1 Section D4 (HPV/Td) ===
  app.get("/api/school-immunizations", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const vaccine = req.query.vaccine ? String(req.query.vaccine) : undefined;
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getSchoolImmunizations({ barangay: requestedBarangay, vaccine });
      const scoped = requestedBarangay ? all : all.filter(r => assigned.includes(r.barangay));
      return res.json(scoped);
    }
    const data = await storage.getSchoolImmunizations({ barangay: requestedBarangay, vaccine });
    res.json(data);
  }));

  app.post("/api/school-immunizations", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertSchoolImmunizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid school immunization record", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createSchoolImmunization({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "SCHOOL_IMMUNIZATION", String(created.id),
        created.barangay, undefined,
        { learnerName: created.learnerName, vaccine: created.vaccine, doseNumber: created.doseNumber, vaccinationDate: created.vaccinationDate },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // ===== PHASE 4 — NCD & Lifestyle screenings =====
  // Generic factory: GET (TL-scoped to assigned barangays) + POST (audit-logged).
  // Each route group below uses the same shape as cold-chain/oral-health.
  const ncdRoute = (
    pathBase: string,
    auditEntity: string,
    schema: any,
    getter: (params: { barangay?: string }) => Promise<any[]>,
    creator: (record: any) => Promise<any>,
  ) => {
    app.get(pathBase, loadUserInfo, requireAuth, ar(async (req, res) => {
      const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
      if (req.userInfo?.role === UserRole.TL) {
        const assigned = req.userInfo.assignedBarangays;
        if (assigned.length === 0) return res.json([]);
        if (requestedBarangay && !assigned.includes(requestedBarangay)) {
          return res.status(403).json({ message: "Access denied to this barangay" });
        }
        const all = await getter({ barangay: requestedBarangay });
        const scoped = requestedBarangay ? all : all.filter(r => assigned.includes(r.barangay));
        return res.json(scoped);
      }
      const data = await getter({ barangay: requestedBarangay });
      res.json(data);
    }));

    app.post(pathBase, loadUserInfo, requireAuth,
      requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
      ar(async (req, res) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: `Invalid ${auditEntity}`, issues: parsed.error.issues });
        }
        const input = parsed.data;
        if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
          return res.status(403).json({ message: "Access denied to this barangay" });
        }
        const created = await creator({ ...input, recordedByUserId: req.userInfo?.id ?? null });
        await createAuditLog(
          req.userInfo!.id, req.userInfo!.role,
          "CREATE", auditEntity, String(created.id),
          created.barangay, undefined,
          { id: created.id }, req,
        );
        res.status(201).json(created);
      }),
    );
  };

  ncdRoute("/api/philpen-assessments", "PHILPEN_ASSESSMENT", insertPhilpenAssessmentSchema,
    (p) => storage.getPhilpenAssessments(p), (r) => storage.createPhilpenAssessment(r));
  ncdRoute("/api/ncd-screenings", "NCD_SCREENING", insertNcdScreeningSchema,
    (p) => storage.getNcdScreenings(p), (r) => storage.createNcdScreening(r));
  ncdRoute("/api/vision-screenings", "VISION_SCREENING", insertVisionScreeningSchema,
    (p) => storage.getVisionScreenings(p), (r) => storage.createVisionScreening(r));
  ncdRoute("/api/cervical-cancer-screenings", "CERVICAL_CANCER_SCREENING", insertCervicalCancerScreeningSchema,
    (p) => storage.getCervicalCancerScreenings(p), (r) => storage.createCervicalCancerScreening(r));
  ncdRoute("/api/mental-health-screenings", "MENTAL_HEALTH_SCREENING", insertMentalHealthScreeningSchema,
    (p) => storage.getMentalHealthScreenings(p), (r) => storage.createMentalHealthScreening(r));

  // ===== PHASE 5 — Disease surveillance =====
  ncdRoute("/api/filariasis-records", "FILARIASIS_RECORD", insertFilariasisRecordSchema,
    (p) => storage.getFilariasisRecords(p), (r) => storage.createFilariasisRecord(r));
  ncdRoute("/api/rabies-exposures", "RABIES_EXPOSURE", insertRabiesExposureSchema,
    (p) => storage.getRabiesExposures(p), (r) => storage.createRabiesExposure(r));
  ncdRoute("/api/schistosomiasis-records", "SCHISTOSOMIASIS_RECORD", insertSchistosomiasisRecordSchema,
    (p) => storage.getSchistosomiasisRecords(p), (r) => storage.createSchistosomiasisRecord(r));
  ncdRoute("/api/sth-records", "STH_RECORD", insertSthRecordSchema,
    (p) => storage.getSthRecords(p), (r) => storage.createSthRecord(r));
  ncdRoute("/api/leprosy-records", "LEPROSY_RECORD", insertLeprosyRecordSchema,
    (p) => storage.getLeprosyRecords(p), (r) => storage.createLeprosyRecord(r));

  // ===== PHASE 7 — Water & Sanitation =====
  ncdRoute("/api/household-water-records", "HOUSEHOLD_WATER_RECORD", insertHouseholdWaterRecordSchema,
    (p) => storage.getHouseholdWaterRecords(p), (r) => storage.createHouseholdWaterRecord(r));

  // ===== PHASE 6 — Mortality registry =====
  app.get("/api/death-events", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getDeathEvents({ barangay: requestedBarangay });
      return res.json(requestedBarangay ? all : all.filter(r => assigned.includes(r.barangay)));
    }
    const data = await storage.getDeathEvents({ barangay: requestedBarangay });
    res.json(data);
  }));

  app.post("/api/death-events", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertDeathEventSchema.safeParse({ ...req.body, createdAt: new Date().toISOString() });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid death event", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createDeathEvent({ ...input, reportedBy: req.userInfo?.id ?? null });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "DEATH_EVENT", String(created.id),
        created.barangay, undefined,
        { deceasedName: created.deceasedName, dateOfDeath: created.dateOfDeath },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === ORAL HEALTH VISITS — feeds M1 Section ORAL ===
  app.get("/api/oral-health-visits", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getOralHealthVisits({ barangay: requestedBarangay });
      const scoped = requestedBarangay ? all : all.filter(r => assigned.includes(r.barangay));
      return res.json(scoped);
    }
    const data = await storage.getOralHealthVisits({ barangay: requestedBarangay });
    res.json(data);
  }));

  app.post("/api/oral-health-visits", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertOralHealthVisitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid oral health visit", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createOralHealthVisit({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "ORAL_HEALTH_VISIT", String(created.id),
        created.barangay, undefined,
        { patientName: created.patientName, visitDate: created.visitDate },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === BIRTH ATTENDANCE RECORDS — feeds M1 B-04 delivery type breakdown ===
  app.get("/api/birth-attendance-records", loadUserInfo, requireAuth, ar(async (req, res) => {
    const motherIdRaw = req.query.motherId ? Number(req.query.motherId) : undefined;
    if (motherIdRaw === undefined || !Number.isFinite(motherIdRaw)) {
      return res.status(400).json({ message: "motherId query param is required" });
    }
    const mother = await storage.getMother(motherIdRaw);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const data = await storage.getBirthAttendanceRecords(motherIdRaw);
    res.json(data);
  }));

  app.post("/api/birth-attendance-records", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertBirthAttendanceRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid birth-attendance record", issues: parsed.error.issues });
      }
      const input = parsed.data;
      const mother = await storage.getMother(input.motherId);
      if (!mother) return res.status(404).json({ message: "Mother not found" });
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const created = await storage.createBirthAttendanceRecord({
        ...input,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "BIRTH_ATTENDANCE", String(created.id),
        mother.barangay, undefined,
        { motherId: created.motherId, deliveryDate: created.deliveryDate, deliveryType: created.deliveryType },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === THEME SETTINGS ===
  app.get(api.themeSettings.get.path, async (req, res) => {
    let settings = await storage.getThemeSettings();
    if (!settings) {
      settings = await storage.updateThemeSettings({
        lguName: "Placer Municipality",
        lguSubtitle: "Province of Surigao del Norte",
        colorScheme: "placer-brand",
        primaryHue: 142,
        primarySaturation: 60,
        primaryLightness: 38,
      });
    }
    res.json(settings);
  });

  app.put(api.themeSettings.update.path, async (req, res) => {
    try {
      const input = api.themeSettings.update.input.parse(req.body);
      const updated = await storage.updateThemeSettings(input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === CONSULTS (Patient Check-up Module - MHO/SYSTEM_ADMIN only access with backend RBAC) ===
  const patientCheckupRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO)];
  
  app.get(api.consults.list.path, patientCheckupRBAC, async (req, res) => {
    const data = await storage.getConsults();
    res.json(data);
  });

  app.get('/api/consults/by-patient', patientCheckupRBAC, ar(async (req, res) => {
    const name = String(req.query.name ?? "").trim();
    const barangay = String(req.query.barangay ?? "").trim();
    if (!name || !barangay) return res.status(400).json({ message: "name and barangay query params required" });
    const data = await storage.getConsultsByPatient(name, barangay);
    res.json(data);
  }));

  app.get('/api/consults/by-profile', patientCheckupRBAC, ar(async (req, res) => {
    const type = String(req.query.type ?? "").trim();
    const id = parseInt(String(req.query.id ?? ""), 10);
    const validTypes = ["Mother", "Child", "Senior"];
    if (!validTypes.includes(type)) return res.status(400).json({ message: "type must be Mother, Child, or Senior" });
    if (isNaN(id) || id <= 0) return res.status(400).json({ message: "id must be a positive integer" });
    const data = await storage.getConsultsByProfile(type, id);
    res.json(data);
  }));

  app.get(api.consults.get.path, patientCheckupRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const consult = await storage.getConsult(id);
    if (!consult) return res.status(404).json({ message: "Consult not found" });
    res.json(consult);
  }));

  app.post(api.consults.create.path, patientCheckupRBAC, ar(async (req, res) => {
    const input = api.consults.create.input.parse(req.body);
    const created = await storage.createConsult(input);
    res.status(201).json(created);
  }));

  app.put(api.consults.update.path, patientCheckupRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.consults.update.input.parse(req.body);
    const updated = await storage.updateConsult(id, input);
    res.json(updated);
  }));

  // === M1 TEMPLATE SYSTEM ===

  // === REPORTS HUB ===
  // Lazy-register on first hit so the route file stays self-contained.
  ensureReportsRegistered();

  app.get("/api/reports", loadUserInfo, requireAuth, ar(async (_req, res) => {
    const defs = listReports().map((d) => ({
      slug: d.slug,
      title: d.title,
      description: d.description,
      cadence: d.cadence,
      category: d.category,
      source: d.source ?? null,
    }));
    res.json(defs);
  }));

  app.get("/api/reports/:slug", loadUserInfo, requireAuth, ar(async (req, res) => {
    const def = getReport(req.params.slug);
    if (!def) return res.status(404).json({ message: "Report not found" });

    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "year query param required (2000-2100)" });
    }

    // Accept quarter (1-4) for quarterly reports; fall back to month (1-12).
    let fromDate: string, toDate: string, periodLabel: string;
    const quarter = req.query.quarter !== undefined ? Number(req.query.quarter) : NaN;
    if (Number.isInteger(quarter) && quarter >= 1 && quarter <= 4) {
      ({ fromDate, toDate, periodLabel } = quarterRange(quarter, year));
    } else {
      const month = Number(req.query.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "month query param required (1-12) — or pass quarter (1-4) for quarterly reports" });
      }
      ({ fromDate, toDate, periodLabel } = monthRange(month, year));
    }
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;

    // TL scoping: must specify a barangay they're assigned to.
    let scopedBarangay = requestedBarangay;
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) {
        return res.json({ columns: [], rows: [], meta: { sourceCount: 0, notes: "No assigned barangays" } });
      }
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      scopedBarangay = requestedBarangay ?? assigned[0];
    }

    const result = await def.fetch({ fromDate, toDate, periodLabel, barangay: scopedBarangay });
    res.json({
      definition: { slug: def.slug, title: def.title, cadence: def.cadence, category: def.category, source: def.source ?? null },
      period: {
        fromDate,
        toDate,
        periodLabel,
        year,
        ...(Number.isInteger(quarter) && quarter >= 1 && quarter <= 4
          ? { quarter }
          : { month: Number(req.query.month) }),
      },
      barangay: scopedBarangay ?? null,
      ...result,
    });
  }));

  // Get active M1 template version
  app.get("/api/m1/templates", loadUserInfo, requireAuth, async (req, res) => {
    const templates = await storage.getM1TemplateVersions();
    res.json(templates);
  });

  // Get M1 indicator catalog for a template version
  app.get("/api/m1/templates/:templateId/catalog", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.templateId, res); if (id === null) return;
    const catalog = await storage.getM1IndicatorCatalog(id);
    res.json(catalog);
  }));

  // Get all barangays
  app.get("/api/barangays", loadUserInfo, requireAuth, async (req, res) => {
    const data = await storage.getBarangays();
    res.json(data);
  });

  // Get M1 report instances (TL scoped to their assigned barangays)
  app.get("/api/m1/reports", loadUserInfo, requireAuth, async (req, res) => {
    const { barangayId, month, year } = req.query;
    // TL users may only access reports from their assigned barangays
    if (req.userInfo?.role === UserRole.TL) {
      const assignedNames = req.userInfo.assignedBarangays;
      if (assignedNames.length === 0) return res.json([]);
      const allBarangays = await storage.getBarangays();
      const allowedIds = allBarangays
        .filter(b => assignedNames.includes(b.name))
        .map(b => b.id);
      // Reject invalid/non-numeric barangayId query param
      if (barangayId !== undefined) {
        const parsedId = Number(barangayId);
        if (!Number.isFinite(parsedId) || parsedId <= 0) {
          return res.status(400).json({ message: "Invalid barangayId" });
        }
        if (!allowedIds.includes(parsedId)) {
          return res.status(403).json({ message: "Access denied to this barangay" });
        }
      }
      const requestedId = barangayId ? Number(barangayId) : undefined;
      // Default to first assigned barangay by assignedBarangays[0] name order (deterministic for multi-assigned TL)
      const firstAssignedName = assignedNames[0];
      const firstAssignedBarangay = allBarangays.find(b => b.name === firstAssignedName);
      const defaultId = firstAssignedBarangay?.id ?? allowedIds[0];
      const reports = await storage.getM1ReportInstances({
        barangayId: requestedId ?? defaultId,
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
      });
      return res.json(reports);
    }
    const reports = await storage.getM1ReportInstances({
      barangayId: barangayId ? Number(barangayId) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
    res.json(reports);
  });

  // Consolidated "All Barangays" read-only M1 view for a period.
  // Must be registered BEFORE /api/m1/reports/:id so "consolidated" is not
  // treated as a numeric id.
  app.get("/api/m1/reports/consolidated", loadUserInfo, requireAuth, ar(async (req, res) => {
    if (req.userInfo?.role === UserRole.TL) {
      return res.status(403).json({ message: "Consolidated view is not available to TL users" });
    }
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month" });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "Invalid year" });
    }
    const onlySubmitted = req.query.onlySubmitted === "true";
    const result = await storage.getConsolidatedM1Values(month, year, { onlySubmitted });
    res.json(result);
  }));

  // Get single M1 report instance with values
  app.get("/api/m1/reports/:id", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const report = await storage.getM1ReportInstance(id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    // TL scoping: verify barangay ownership; TL cannot access municipality-scoped (null) reports
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowed = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (!report.instance.barangayId || !allowed.includes(report.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    res.json(report);
  }));

  // Create new M1 report instance
  app.post("/api/m1/reports", loadUserInfo, requireAuth, ar(async (req, res) => {
    // TL can only create for their assigned barangays — require explicit valid barangayId
    if (req.userInfo?.role === UserRole.TL) {
      const { barangayName, barangayId } = req.body;
      if (!barangayId) {
        return res.status(403).json({ message: "A specific barangay is required for TL users" });
      }
      const allBarangays = await storage.getBarangays();
      const allowedIds = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (!allowedIds.includes(Number(barangayId))) {
        return res.status(403).json({ message: "You can only create reports for your assigned barangays" });
      }
      if (barangayName && !req.userInfo.assignedBarangays.includes(barangayName)) {
        return res.status(403).json({ message: "You can only create reports for your assigned barangays" });
      }
    }
    // Duplicate prevention: return 409 if report already exists for this barangay/month/year
    if (req.body.barangayId && req.body.month && req.body.year) {
      const existing = await storage.getM1ReportInstances({
        barangayId: Number(req.body.barangayId),
        month: Number(req.body.month),
        year: Number(req.body.year),
      });
      if (existing.length > 0) {
        return res.status(409).json({
          message: "Report already exists for this barangay and period",
          reportId: existing[0].id,
        });
      }
    }
    const report = await storage.createM1ReportInstance({
      ...req.body,
      createdByUserId: req.userInfo?.id || null,
    });
    await createAuditLog(
      req.userInfo!.id, req.userInfo!.role,
      "CREATE", "M1_REPORT", report.id,
      report.barangayName || undefined, undefined, { barangayId: report.barangayId, month: report.month, year: report.year }, req
    );
    res.status(201).json(report);
  }));

  // Update M1 indicator values for a report — audit each ENCODED field change
  app.put("/api/m1/reports/:id/values", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    // Verify report exists and TL scoping
    const existing = await storage.getM1ReportInstance(id);
    if (!existing) return res.status(404).json({ message: "Report not found" });
    // TL scoping: deny null-scoped and out-of-scope reports
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowed = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (!existing.instance.barangayId || !allowed.includes(existing.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    // Prevent editing SUBMITTED_LOCKED reports
    if (existing.instance.status === "SUBMITTED_LOCKED") {
      return res.status(403).json({ message: "Cannot edit a submitted report. Reopen it first." });
    }
    // Request body shape: { values: [...] }
    const values: any[] = req.body.values || [];
    // Build old-value map from existing saved values for field-level diff
    const oldValueMap: Record<string, any> = {};
    existing.values.forEach((v: any) => {
      const key = v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey;
      oldValueMap[key] = v.valueNumber ?? v.valueText ?? null;
    });
    const updated = await storage.updateM1IndicatorValues(id, values);
    // One audit row per changed ENCODED field — treat missing valueSource as ENCODED
    const auditPromises = values
      .filter((v: any) => !v.valueSource || v.valueSource === "ENCODED")
      .map(async (v: any) => {
        const fieldKey = v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey;
        const newVal = v.valueNumber ?? v.valueText ?? null;
        const oldVal = oldValueMap[fieldKey] ?? null;
        if (newVal !== oldVal) {
          await createAuditLog(
            req.userInfo!.id, req.userInfo!.role,
            "UPDATE", "M1_INDICATOR_VALUE", id,
            existing.instance.barangayName || undefined,
            { rowKey: v.rowKey, columnKey: v.columnKey ?? null, value: oldVal },
            { rowKey: v.rowKey, columnKey: v.columnKey ?? null, value: newVal }, req
          );
        }
      });
    await Promise.all(auditPromises);
    res.json(updated);
  }));

  // Update M1 report status via action: "submit" (DRAFT→SUBMITTED_LOCKED) or "reopen" (SUBMITTED_LOCKED→DRAFT)
  // Only MHO and SYSTEM_ADMIN may reopen a locked report.
  app.post("/api/m1/reports/:id/status", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const { action } = req.body;
    if (!action || !["submit", "reopen"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be 'submit' or 'reopen'" });
    }
    const existing = await storage.getM1ReportInstance(id);
    if (!existing) return res.status(404).json({ message: "Report not found" });
    // TL scoping: deny null-scoped and out-of-scope reports
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowedIds = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (!existing.instance.barangayId || !allowedIds.includes(existing.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    // Transition rules
    if (action === "submit") {
      if (existing.instance.status !== "DRAFT") {
        return res.status(400).json({ message: "Only DRAFT reports can be submitted" });
      }
    } else if (action === "reopen") {
      if (existing.instance.status !== "SUBMITTED_LOCKED") {
        return res.status(400).json({ message: "Only SUBMITTED_LOCKED reports can be reopened" });
      }
      // Only MHO and SYSTEM_ADMIN can reopen
      const reopenAllowedRoles: string[] = [UserRole.MHO, UserRole.SYSTEM_ADMIN];
      if (!reopenAllowedRoles.includes(req.userInfo!.role)) {
        return res.status(403).json({ message: "Only MHO or System Admin can reopen a submitted report" });
      }
    }
    const newStatus = action === "submit" ? "SUBMITTED_LOCKED" : "DRAFT";
    const updated = await storage.updateM1ReportStatus(id, newStatus);
    await createAuditLog(
      req.userInfo!.id, req.userInfo!.role,
      action === "submit" ? "SUBMIT" : "REOPEN", "M1_REPORT", id,
      existing.instance.barangayName || undefined,
      { status: existing.instance.status },
      { status: newStatus }, req
    );
    res.json(updated);
  }));

  // Get municipality settings
  app.get("/api/municipality-settings", async (req, res) => {
    const settings = await storage.getMunicipalitySettings();
    res.json(settings);
  });

  // Get barangay settings
  app.get("/api/barangay-settings/:barangayId", ar(async (req, res) => {
    const id = parseId(req.params.barangayId, res); if (id === null) return;
    const settings = await storage.getBarangaySettings(id);
    res.json(settings || {});
  }));

  // Compute M1 indicator values from system data (date-filtered, ENCODED-safe)
  app.post("/api/m1/reports/:id/compute", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const existing = await storage.getM1ReportInstance(id);
    if (!existing) return res.status(404).json({ message: "Report not found" });
    // TL scope check
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowed = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (!existing.instance.barangayId || !allowed.includes(existing.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    if (existing.instance.status === "SUBMITTED_LOCKED") {
      return res.status(403).json({ message: "Cannot compute into a submitted report. Reopen it first." });
    }
    const result = await storage.computeM1Values(id);
    await createAuditLog(
      req.userInfo!.id, req.userInfo!.role,
      "UPDATE", "M1_REPORT", id,
      existing.instance.barangayName || undefined,
      undefined, { action: "compute", computed: result.computed, skipped: result.skipped }, req
    );
    res.json(result);
  }));

  // Bulk import M1 CSV data for a specific barangay and month/year
  app.post("/api/m1/bulk-import", loadUserInfo, requireAuth, async (req, res) => {
    try {
      const { barangayId, barangayName, month, year, values, templateVersionId } = req.body;
      
      if (!barangayId || !month || !year || !values || !Array.isArray(values)) {
        return res.status(400).json({ message: "Missing required fields: barangayId, month, year, values" });
      }

      // TL scoping: only allow access to assigned barangays
      if (req.userInfo?.role === UserRole.TL) {
        const allBarangays = await storage.getBarangays();
        const allowedIds = allBarangays
          .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
          .map(b => b.id);
        if (!allowedIds.includes(Number(barangayId))) {
          return res.status(403).json({ message: "You can only import data for your assigned barangays" });
        }
      }
      
      // Check for existing report or create new one
      const existingReports = await storage.getM1ReportInstances({ barangayId, month, year });
      let reportId: number;
      
      if (existingReports.length > 0) {
        // Reject import if the existing report is locked
        if (existingReports[0].status === "SUBMITTED_LOCKED") {
          return res.status(403).json({ message: "Cannot import into a submitted report. Reopen it first." });
        }
        reportId = existingReports[0].id;
      } else {
        const newReport = await storage.createM1ReportInstance({
          templateVersionId: templateVersionId || 1,
          scopeType: "BARANGAY",
          barangayId,
          barangayName,
          month,
          year,
          createdByUserId: req.userInfo?.id || null,
        });
        reportId = newReport.id;
      }
      
      // Update values
      const updatedValues = await storage.updateM1IndicatorValues(reportId, values.map((v: any) => ({
        ...v,
        valueSource: "IMPORTED"
      })));
      
      res.json({ reportId, importedCount: updatedValues.length });
    } catch (err) {
      console.error("Bulk import error:", err);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  // Seed historical M1 data for all barangays (admin only)
  app.post("/api/m1/seed-historical", loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO), async (req, res) => {
    try {
      const result = await storage.seedHistoricalM1Data();
      res.json(result);
    } catch (err) {
      console.error("Historical seeding error:", err);
      res.status(500).json({ message: "Failed to seed historical data" });
    }
  });

  // === AI INSIGHTS (RAG) ===
  app.get("/api/ai/insights", loadUserInfo, requireAuth, async (req, res) => {
    try {
      const { generateHealthInsights } = await import("./ai-insights");
      const result = await generateHealthInsights();
      res.json(result);
    } catch (err) {
      console.error("AI insights error:", err);
      res.status(500).json({ message: "Failed to generate AI insights" });
    }
  });

  app.get("/api/ai/insights/stream", loadUserInfo, requireAuth, async (req, res) => {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { streamHealthInsights } = await import("./ai-insights");
      await streamHealthInsights((text) => {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      console.error("AI streaming error:", err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to stream insights" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to stream AI insights" });
      }
    }
  });

  app.get("/api/ai/risk-analysis", loadUserInfo, requireAuth, async (req, res) => {
    try {
      const { getRiskAnalysis } = await import("./ai-insights");
      const result = await getRiskAnalysis();
      res.json(result);
    } catch (err) {
      console.error("Risk analysis error:", err);
      res.status(500).json({ message: "Failed to get risk analysis" });
    }
  });

  // === DIRECT MESSAGES ===
  app.get("/api/dm/conversations", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId as string;
      const conversations = await storage.getDMConversations(userId);
      res.json(conversations);
    } catch (err) {
      console.error("DM conversations error:", err);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/dm/unread-count", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId as string;
      const count = await storage.getDMUnreadCount(userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/dm/messages/:userId", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session?.userId as string;
      const otherUserId = req.params.userId;
      const messages = await storage.getDMMessages(currentUserId, otherUserId);
      res.json(messages);
    } catch (err) {
      console.error("DM messages error:", err);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/dm/messages", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const senderId = req.session?.userId as string;
      const { receiverId, content } = req.body;
      if (!receiverId || !content?.trim()) {
        return res.status(400).json({ message: "receiverId and content are required" });
      }
      const message = await storage.sendDMMessage(senderId, receiverId, content.trim());
      res.json(message);
    } catch (err) {
      console.error("Send DM error:", err);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/dm/read/:userId", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session?.userId as string;
      const otherUserId = req.params.userId;
      await storage.markDMThreadRead(currentUserId, otherUserId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Mark thread as read via message id — looks up message to find the thread sender,
  // then marks all messages in that thread as read (canonical read endpoint per task spec)
  app.post("/api/dm/messages/:id/read", loadUserInfo, requireAuth, async (req: any, res) => {
    try {
      const currentUserId = req.session?.userId as string;
      const msgId = parseInt(req.params.id);
      if (isNaN(msgId)) return res.status(400).json({ message: "Invalid message id" });
      // First mark the single message (validates receiver)
      await storage.markDMMessageRead(msgId, currentUserId);
      // Then mark the whole thread from that sender as read
      const senderId = await storage.getDMMessageSender(msgId);
      if (senderId && senderId !== currentUserId) {
        await storage.markDMThreadRead(currentUserId, senderId);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // User search (for starting new DM conversations)
  const userSearchHandler = async (req: any, res: any) => {
    try {
      const currentUserId = req.session?.userId as string;
      const query = (req.query.q as string) || "";
      if (!query.trim()) return res.json([]);
      const results = await storage.searchUsers(query.trim(), currentUserId);
      res.json(results.map((u: any) => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to search users" });
    }
  };

  app.get("/api/users/search", loadUserInfo, requireAuth, userSearchHandler);
  app.get("/api/users", loadUserInfo, requireAuth, userSearchHandler);

  // === NURSE VISITS (Team Leader / Barangay Nurse monitoring visits) ===
  // RBAC: any authenticated role can read; only SYSTEM_ADMIN and TL can write.
  // Additionally, TL users are scoped to their assigned barangays via the parent record.
  const nurseVisitReadRBAC = [loadUserInfo, requireAuth];
  const nurseVisitWriteRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.TL)];

  // Helper: resolve next visit number using DB-level MAX aggregation.
  async function nextPrenatalVisitNumber(motherId: number): Promise<number> {
    const [row] = await db.select({ maxNum: max(prenatalVisits.visitNumber) })
      .from(prenatalVisits).where(eq(prenatalVisits.motherId, motherId));
    return (row?.maxNum ?? 0) + 1;
  }
  async function nextChildVisitNumber(childId: number): Promise<number> {
    const [row] = await db.select({ maxNum: max(childVisits.visitNumber) })
      .from(childVisits).where(eq(childVisits.childId, childId));
    return (row?.maxNum ?? 0) + 1;
  }
  async function nextSeniorVisitNumber(seniorId: number): Promise<number> {
    const [row] = await db.select({ maxNum: max(seniorVisits.visitNumber) })
      .from(seniorVisits).where(eq(seniorVisits.seniorId, seniorId));
    return (row?.maxNum ?? 0) + 1;
  }

  // Detect PostgreSQL unique-constraint violation (code 23505).
  function isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as any).code === "23505";
  }

  // --- Prenatal (Mother) visits ---
  app.get("/api/nurse-visits/mother/:id", nurseVisitReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    // Load parent to verify existence and enforce TL barangay scoping
    const mother = await storage.getMother(id);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const visits = await storage.getPrenatalVisits(id);
    res.json(visits);
  }));

  app.post("/api/nurse-visits/mother/:id", nurseVisitWriteRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const mother = await storage.getMother(id);
    if (!mother) return res.status(404).json({ message: "Mother not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "You can only add visits for patients in your assigned barangays" });
    }
    const { visitDate, gaWeeks, weightKg, bloodPressure, fundalHeight, fetalHeartTone, riskStatus, notes, nextScheduledVisit } = req.body;
    if (!visitDate) return res.status(400).json({ message: "visitDate is required" });
    let visit;
    for (let attempt = 0; attempt < 3; attempt++) {
      const visitNumber = await nextPrenatalVisitNumber(id);
      try {
        visit = await storage.createPrenatalVisit({
          motherId: id, visitNumber, visitDate,
          gaWeeks: gaWeeks ? Number(gaWeeks) : undefined,
          weightKg: weightKg || undefined, bloodPressure: bloodPressure || undefined,
          fundalHeight: fundalHeight || undefined, fetalHeartTone: fetalHeartTone || undefined,
          riskStatus: riskStatus || undefined, notes: notes || undefined,
          nextScheduledVisit: nextScheduledVisit || undefined,
          recordedBy: req.userInfo?.username || undefined, createdAt: new Date().toISOString(),
        });
        break;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
    // Auto-update mother's nextPrenatalCheckDate from the nurse-entered next scheduled visit
    if (nextScheduledVisit) {
      await storage.updateMother(id, { nextPrenatalCheckDate: nextScheduledVisit });
    }
    res.status(201).json(visit);
  }));

  // --- Child visits ---
  app.get("/api/nurse-visits/child/:id", nurseVisitReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const child = await storage.getChild(id);
    if (!child) return res.status(404).json({ message: "Child not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const visits = await storage.getChildVisits(id);
    res.json(visits);
  }));

  app.post("/api/nurse-visits/child/:id", nurseVisitWriteRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const child = await storage.getChild(id);
    if (!child) return res.status(404).json({ message: "Child not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
      return res.status(403).json({ message: "You can only add visits for patients in your assigned barangays" });
    }
    const { visitDate, weightKg, heightCm, muac, nutritionNotes, immunizationNotes, monitoringNotes } = req.body;
    if (!visitDate) return res.status(400).json({ message: "visitDate is required" });
    let visit;
    for (let attempt = 0; attempt < 3; attempt++) {
      const visitNumber = await nextChildVisitNumber(id);
      try {
        visit = await storage.createChildVisit({
          childId: id, visitNumber, visitDate,
          weightKg: weightKg || undefined, heightCm: heightCm || undefined,
          muac: muac || undefined, nutritionNotes: nutritionNotes || undefined,
          immunizationNotes: immunizationNotes || undefined,
          monitoringNotes: monitoringNotes || undefined,
          recordedBy: req.userInfo?.username || undefined, createdAt: new Date().toISOString(),
        });
        break;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
    // Sync weight (and optional height/muac) from the nurse visit into children.growth JSONB
    if (weightKg) {
      const weightNum = parseFloat(weightKg);
      if (!isNaN(weightNum)) {
        const currentChild = await storage.getChild(id);
        if (currentChild) {
          const existingGrowth: NonNullable<typeof currentChild.growth> =
            Array.isArray(currentChild.growth) ? [...currentChild.growth] : [];
          const idx = existingGrowth.findIndex(g => g.date === visitDate);
          const newEntry: { date: string; weightKg: number; heightCm?: number; muac?: number } = {
            date: visitDate,
            weightKg: weightNum,
          };
          if (heightCm) { const h = parseFloat(heightCm); if (!isNaN(h)) newEntry.heightCm = h; }
          if (muac) { const m = parseFloat(muac); if (!isNaN(m)) newEntry.muac = m; }
          if (idx >= 0) {
            existingGrowth[idx] = { ...existingGrowth[idx], ...newEntry };
          } else {
            existingGrowth.push(newEntry);
          }
          // Sort chronologically so the growth chart renders in order
          existingGrowth.sort((a, b) => a.date.localeCompare(b.date));
          await storage.updateChild(id, { growth: existingGrowth });
        }
      }
    }
    res.status(201).json(visit);
  }));

  // --- Senior visits ---
  app.get("/api/nurse-visits/senior/:id", nurseVisitReadRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const senior = await storage.getSenior(id);
    if (!senior) return res.status(404).json({ message: "Senior not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(senior.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const visits = await storage.getSeniorVisits(id);
    res.json(visits);
  }));

  app.post("/api/nurse-visits/senior/:id", nurseVisitWriteRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const senior = await storage.getSenior(id);
    if (!senior) return res.status(404).json({ message: "Senior not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(senior.barangay)) {
      return res.status(403).json({ message: "You can only add visits for patients in your assigned barangays" });
    }
    const { visitDate, bloodPressure, weightKg, medicationPickupNote, symptomsRemarks, followUpNotes } = req.body;
    if (!visitDate) return res.status(400).json({ message: "visitDate is required" });
    let visit;
    for (let attempt = 0; attempt < 3; attempt++) {
      const visitNumber = await nextSeniorVisitNumber(id);
      try {
        visit = await storage.createSeniorVisit({
          seniorId: id, visitNumber, visitDate,
          bloodPressure: bloodPressure || undefined, weightKg: weightKg || undefined,
          medicationPickupNote: medicationPickupNote || undefined,
          symptomsRemarks: symptomsRemarks || undefined,
          followUpNotes: followUpNotes || undefined,
          recordedBy: req.userInfo?.username || undefined, createdAt: new Date().toISOString(),
        });
        break;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
    // Mirror the BP onto the senior so the registry profile card reflects the
    // newest reading. Guarded on date so a back-dated visit can't overwrite a
    // more-recent value that's already on file.
    const bp = typeof bloodPressure === "string" ? bloodPressure.trim() : "";
    if (bp && (!senior.lastBPDate || visitDate >= senior.lastBPDate)) {
      await storage.updateSenior(id, { lastBP: bp, lastBPDate: visitDate });
    }
    res.status(201).json(visit);
  }));

  // === FP SERVICE RECORDS ===
  const fpRBAC = [loadUserInfo, requireAuth];

  app.get("/api/fp-records", fpRBAC, ar(async (req, res) => {
    const { barangay, month } = req.query as { barangay?: string; month?: string };
    const user = req.userInfo!;
    if (user.role === UserRole.TL) {
      if (barangay && !user.assignedBarangays.includes(barangay)) {
        return res.status(403).json({ message: "Not authorized for this barangay" });
      }
      const records = await storage.getFpServiceRecords({
        barangays: barangay ? [barangay] : user.assignedBarangays,
        month,
      });
      return res.json(records);
    }
    const records = await storage.getFpServiceRecords(barangay || month ? { barangay, month } : undefined);
    res.json(records);
  }));

  app.get("/api/fp-records/:id", fpRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const record = await storage.getFpServiceRecord(id);
    if (!record) return res.status(404).json({ message: "FP record not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(record.barangay)) {
      return res.status(403).json({ message: "Not authorized for this barangay" });
    }
    res.json(record);
  }));

  app.post("/api/fp-records", fpRBAC, ar(async (req, res) => {
    const user = req.userInfo!;
    const parsed = insertFpServiceRecordSchema.safeParse({
      ...req.body,
      recordedBy: user.username,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
    if (user.role === UserRole.TL && !user.assignedBarangays.includes(parsed.data.barangay)) {
      return res.status(403).json({ message: "Not authorized for this barangay" });
    }
    const record = await storage.createFpServiceRecord(parsed.data);
    res.status(201).json(record);
  }));

  app.put("/api/fp-records/:id", fpRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const existing = await storage.getFpServiceRecord(id);
    if (!existing) return res.status(404).json({ message: "FP record not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(existing.barangay)) {
      return res.status(403).json({ message: "Not authorized for this barangay" });
    }
    const parsed = insertFpServiceRecordSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
    // For TL: also validate the target barangay (if changed) is within their scope
    if (req.userInfo?.role === UserRole.TL && parsed.data.barangay && !req.userInfo.assignedBarangays.includes(parsed.data.barangay)) {
      return res.status(403).json({ message: "Not authorized to move record to this barangay" });
    }
    const updated = await storage.updateFpServiceRecord(id, parsed.data);
    res.json(updated);
  }));

  app.delete("/api/fp-records/:id", [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN)], ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const existing = await storage.getFpServiceRecord(id);
    if (!existing) return res.status(404).json({ message: "FP record not found" });
    await storage.deleteFpServiceRecord(id);
    res.json({ success: true });
  }));

  // === NUTRITION FOLLOW-UPS (PIMAM / OPT-Plus register) ===
  const nutritionRBAC = [loadUserInfo, requireAuth];
  const nutritionWriteRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.TL)];

  // If the operator checks REFER_RHU they must pick an actual RHU facility.
  // Returns an error message when the pairing is invalid, or null when OK.
  async function validateRhuReferral(
    actions: readonly string[] | null | undefined,
    referredRhuId: number | null | undefined,
  ): Promise<string | null> {
    const mentionsRhu = Array.isArray(actions) && actions.includes("REFER_RHU");
    if (mentionsRhu) {
      if (!referredRhuId) return "Select which RHU the child was referred to.";
      const rhus = await storage.getHealthStations({ facilityType: "RHU" });
      if (!rhus.some(r => r.id === referredRhuId)) {
        return "The selected referral facility is not a Rural Health Unit.";
      }
    } else if (referredRhuId) {
      return "Referred RHU can only be set when 'Refer to RHU' is selected.";
    }
    return null;
  }

  app.get("/api/nutrition-followups", nutritionRBAC, ar(async (req, res) => {
    const { childId, barangay } = req.query as { childId?: string; barangay?: string };
    const user = req.userInfo!;
    const childIdNum = childId ? Number(childId) : undefined;

    if (user.role === UserRole.TL) {
      if (barangay && !user.assignedBarangays.includes(barangay)) {
        return res.status(403).json({ message: "Not authorized for this barangay" });
      }
      const rows = await storage.getNutritionFollowUps({
        childId: childIdNum,
        barangays: barangay ? [barangay] : user.assignedBarangays,
      });
      return res.json(rows);
    }
    const rows = await storage.getNutritionFollowUps({
      childId: childIdNum,
      barangay,
    });
    res.json(rows);
  }));

  // Bulk latest-per-child lookup used by the worklist chip.
  app.get("/api/nutrition-followups/latest", nutritionRBAC, ar(async (req, res) => {
    const raw = (req.query.childIds as string | undefined) ?? "";
    const ids = raw.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return res.json({});
    const map = await storage.getLatestFollowUpsByChildIds(ids);

    // TL scoping: drop entries for barangays they don't own
    if (req.userInfo?.role === UserRole.TL) {
      const allowed = new Set(req.userInfo.assignedBarangays);
      for (const k of Object.keys(map)) {
        if (!allowed.has(map[Number(k)].barangay)) delete map[Number(k)];
      }
    }
    res.json(map);
  }));

  app.post("/api/nutrition-followups", nutritionWriteRBAC, ar(async (req, res) => {
    const user = req.userInfo!;
    const parsed = insertNutritionFollowUpSchema.safeParse({
      ...req.body,
      recordedBy: user.username,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
    }
    if (user.role === UserRole.TL && !user.assignedBarangays.includes(parsed.data.barangay)) {
      return res.status(403).json({ message: "Not authorized for this barangay" });
    }
    const rhuError = await validateRhuReferral(parsed.data.actions, parsed.data.referredRhuId);
    if (rhuError) return res.status(400).json({ message: rhuError });
    const record = await storage.createNutritionFollowUp(parsed.data);
    res.status(201).json(record);
  }));

  // CSV export of the PIMAM register (for Caraga PNAO roll-up)
  app.get("/api/nutrition-followups/export.csv", nutritionRBAC, ar(async (req, res) => {
    const { barangay, from, to } = req.query as { barangay?: string; from?: string; to?: string };
    const user = req.userInfo!;
    let rows = user.role === UserRole.TL
      ? await storage.getNutritionFollowUps({
          barangays: barangay ? [barangay] : user.assignedBarangays,
        })
      : await storage.getNutritionFollowUps(barangay ? { barangay } : undefined);

    // Optional date window
    if (from) rows = rows.filter(r => r.followUpDate >= from);
    if (to)   rows = rows.filter(r => r.followUpDate <= to);

    // Pre-load RHU facility names so the CSV can render the referral target.
    const rhuNameById = new Map<number, string>();
    for (const rhu of await storage.getHealthStations({ facilityType: "RHU" })) {
      rhuNameById.set(rhu.id, rhu.facilityName);
    }

    const headers = [
      "follow_up_date", "barangay", "child_id", "classification",
      "weight_kg", "height_cm", "muac_cm",
      "actions", "referred_rhu", "next_step", "next_follow_up_date",
      "outcome", "recorded_by", "notes",
    ];

    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const body = rows.map(r => [
      esc(r.followUpDate),
      esc(r.barangay),
      esc(r.childId),
      esc(r.classification),
      esc(r.weightKg),
      esc(r.heightCm),
      esc(r.muacCm),
      esc((r.actions || []).join(";")),
      esc(r.referredRhuId ? rhuNameById.get(r.referredRhuId) ?? "" : ""),
      esc(r.nextStep),
      esc(r.nextFollowUpDate),
      esc(r.outcome),
      esc(r.recordedBy),
      esc(r.notes),
    ].join(",")).join("\n");

    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = barangay
      ? `PIMAM_register_${barangay.replace(/\s+/g, "_")}_${filenameDate}.csv`
      : `PIMAM_register_${filenameDate}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send([headers.join(","), body].filter(Boolean).join("\n"));
  }));

  app.put("/api/nutrition-followups/:id", nutritionWriteRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const existing = (await storage.getNutritionFollowUps({ childId: undefined })).find(r => r.id === id);
    if (!existing) return res.status(404).json({ message: "Follow-up not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(existing.barangay)) {
      return res.status(403).json({ message: "Not authorized for this barangay" });
    }
    const parsed = insertNutritionFollowUpSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
    // Validate RHU referral against the merged (existing + patch) view.
    const mergedActions = parsed.data.actions ?? existing.actions ?? [];
    const mergedRhuId = parsed.data.referredRhuId !== undefined ? parsed.data.referredRhuId : existing.referredRhuId;
    const rhuError = await validateRhuReferral(mergedActions, mergedRhuId);
    if (rhuError) return res.status(400).json({ message: rhuError });
    const updated = await storage.updateNutritionFollowUp(id, parsed.data);
    res.json(updated);
  }));

  // === GENERAL CHAT (Global shared internal chat room) ===
  app.get("/api/general-chat/messages", [loadUserInfo, requireAuth], ar(async (req, res) => {
    const messages = await storage.getGlobalChatMessages();
    res.json(messages);
  }));

  app.post("/api/general-chat/messages", [loadUserInfo, requireAuth], ar(async (req, res) => {
    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ message: "Message content is required" });
    }
    if (content.trim().length > 2000) {
      return res.status(400).json({ message: "Message is too long (max 2000 characters)" });
    }
    const ui = req.userInfo!;
    const senderName = [ui.firstName, ui.lastName].filter(Boolean).join(" ") || ui.username;
    const created = await storage.sendGlobalChatMessage(ui.id, senderName, ui.role, content.trim());
    res.status(201).json(created);
  }));

  return httpServer;
}
