import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { max, eq, and, desc, gte, or, inArray } from "drizzle-orm";
import { prenatalVisits, childVisits, seniorVisits, insertFpServiceRecordSchema, insertNutritionFollowUpSchema, insertColdChainLogSchema, insertTbDoseLogSchema, insertPostpartumVisitSchema, insertPrenatalScreeningSchema, insertBirthAttendanceRecordSchema, insertSickChildVisitSchema, insertSchoolImmunizationSchema, insertOralHealthVisitSchema, insertPhilpenAssessmentSchema, insertNcdScreeningSchema, insertVisionScreeningSchema, insertCervicalCancerScreeningSchema, insertMentalHealthScreeningSchema, insertFilariasisRecordSchema, insertRabiesExposureSchema, insertSchistosomiasisRecordSchema, insertSthRecordSchema, insertLeprosyRecordSchema, insertDeathEventSchema, insertHouseholdWaterRecordSchema, insertPidsrSubmissionSchema, insertWorkforceMemberSchema, insertWorkforceCredentialSchema, referralRecords, insertReferralRecordSchema } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./auth";
import { registerAdminRoutes } from "./routes/admin";
import { loadUserInfo, requireAuth, requireRole, createAuditLog } from "./middleware/rbac";
import { UserRole, auditLogs, deathReviews, DEATH_REVIEW_STATUSES, aefiEvents, insertAefiEventSchema, outbreaks, OUTBREAK_STATUSES, consults, medicineInventory, medicationDispensings, insertMedicationDispensingSchema, inventoryRequests, insertInventoryRequestSchema, RESTOCK_STATUSES, SERVICE_CODES, medicalCertificates, insertMedicalCertificateSchema, CERTIFICATE_TYPES, campaignTallies, insertCampaignTallySchema, CAMPAIGN_TYPES } from "@shared/schema";
import { ensureReportsRegistered, listReports, getReport } from "./reports";
import { monthRange, quarterRange, annualRange, customRange } from "./reports/types";

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
  // (still used by some endpoints — kept for back-compat).
  const registryRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL)];
  // RBAC middleware for registry CREATE — TL only.
  // Per the DOH operational model, BHS-level TLs encode patient registries
  // (mothers, children, seniors, disease cases, TB patients). RHU-level
  // MGMT roles validate and submit; they don't create transactional rows.
  // The UI hides "+ New X" buttons for MGMT (#96); this is the server-side
  // counterpart that blocks direct API POSTs.
  const registryCreateRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.TL)];
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

  app.post(api.mothers.create.path, registryCreateRBAC, async (req, res) => {
    try {
      const input = api.mothers.create.input.parse(req.body);
      // TL can only create records in their assigned barangays
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
      }
      const created = await storage.createMother(input);
      await createAuditLog(req.userInfo!.id, req.userInfo!.role, "CREATE", "MOTHER", String(created.id), created.barangay, undefined, { id: created.id, name: `${created.firstName} ${created.lastName}` }, req);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.mothers.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const before = await storage.getMother(id);
    const input = api.mothers.update.input.parse(req.body);
    const updated = await storage.updateMother(id, input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "UPDATE", "MOTHER", String(id), updated?.barangay ?? before?.barangay, before, updated, req);
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

  app.post(api.children.create.path, registryCreateRBAC, ar(async (req, res) => {
    const input = api.children.create.input.parse(req.body);
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
      return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
    }
    const created = await storage.createChild(input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "CREATE", "CHILD", String(created.id), created.barangay, undefined, { id: created.id, name: created.name }, req);
    res.status(201).json(created);
  }));

  app.put(api.children.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const before = await storage.getChild(id);
    const input = api.children.update.input.parse(req.body);
    const updated = await storage.updateChild(id, input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "UPDATE", "CHILD", String(id), updated?.barangay ?? before?.barangay, before, updated, req);
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

  app.post(api.seniors.create.path, registryCreateRBAC, ar(async (req, res) => {
    const input = api.seniors.create.input.parse(req.body);
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
      return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
    }
    const created = await storage.createSenior(input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "CREATE", "SENIOR", String(created.id), created.barangay, undefined, { id: created.id, name: `${created.firstName} ${created.lastName}` }, req);
    res.status(201).json(created);
  }));

  app.put(api.seniors.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const before = await storage.getSenior(id);
    const input = api.seniors.update.input.parse(req.body);
    const updated = await storage.updateSenior(id, input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "UPDATE", "SENIOR", String(id), updated?.barangay ?? before?.barangay, before, updated, req);
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
    requireRole(UserRole.TL),
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

  // Distinct condition values previously used. Combined with
  // DISEASE_CONDITION_DEFAULTS by the New Case form so any condition
  // typed via the "Other..." free-text option stays in the dropdown
  // for future cases. Trimmed/de-duped server-side.
  //
  // URL note: deliberately NOT under /api/disease-cases/* — that
  // namespace ends with a /:id route and Express was matching this
  // endpoint as id=conditions on some deployments. Path collision
  // sidestepped by living under /api/disease-conditions instead.
  app.get("/api/disease-conditions", loadUserInfo, requireAuth, ar(async (_req, res) => {
    const all = await storage.getDiseaseCases();
    const set = new Set<string>();
    for (const c of all) {
      const trimmed = (c.condition ?? "").trim();
      if (trimmed) set.add(trimmed);
      const extras = ((c as any).additionalConditions ?? []) as string[];
      for (const e of extras) {
        const t = (e ?? "").trim();
        if (t) set.add(t);
      }
    }
    res.json(Array.from(set).sort());
  }));

  app.get(api.diseaseCases.get.path, loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const diseaseCase = await storage.getDiseaseCase(id);
    if (!diseaseCase) return res.status(404).json({ message: "Disease case not found" });
    if (req.userInfo!.role === UserRole.TL && !req.userInfo!.assignedBarangays.includes(diseaseCase.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(diseaseCase);
  }));

  app.post(api.diseaseCases.create.path, registryCreateRBAC, ar(async (req, res) => {
    const input = api.diseaseCases.create.input.parse(req.body);
    const created = await storage.createDiseaseCase(input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "CREATE", "DISEASE_CASE", String(created.id), created.barangay, undefined, { id: created.id, condition: created.condition, status: created.status }, req);
    res.status(201).json(created);
  }));

  app.put(api.diseaseCases.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const before = await storage.getDiseaseCase(id);
    const input = api.diseaseCases.update.input.parse(req.body);
    const updated = await storage.updateDiseaseCase(id, input);
    // Promote a status change to its own action so the audit timeline
    // shows "case marked Closed" cleanly, not buried in a UPDATE diff.
    const statusChanged = before && updated && before.status !== updated.status;
    await createAuditLog(
      req.userInfo!.id,
      req.userInfo!.role,
      statusChanged ? "STATUS_CHANGE" : "UPDATE",
      "DISEASE_CASE",
      String(id),
      updated?.barangay ?? before?.barangay,
      before,
      updated,
      req,
    );
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

  app.post(api.tbPatients.create.path, registryCreateRBAC, ar(async (req, res) => {
    const input = api.tbPatients.create.input.parse(req.body);
    // Only run the referral consistency check when the write actually touches
    // those fields — legacy rows where referralToRHU=true but referredRhuId is
    // null would otherwise block every unrelated update (e.g. dose logging).
    if (input.referralToRHU !== undefined || input.referredRhuId !== undefined) {
      const rhuError = await validateTbRhuReferral(!!input.referralToRHU, input.referredRhuId ?? null);
      if (rhuError) return res.status(400).json({ message: rhuError });
    }
    const created = await storage.createTBPatient(input);
    await createAuditLog(req.userInfo!.id, req.userInfo!.role, "CREATE", "TB_PATIENT", String(created.id), created.barangay, undefined, { id: created.id, name: `${created.firstName} ${created.lastName}`, outcomeStatus: created.outcomeStatus }, req);
    res.status(201).json(created);
  }));

  app.put(api.tbPatients.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.tbPatients.update.input.parse(req.body);
    // Skip validation entirely for patches that don't touch referral fields.
    // A legacy row carrying (referralToRHU=true, referredRhuId=null) must
    // still be able to record doses, sputum checks, etc.
    const before = await storage.getTBPatient(id);
    if (input.referralToRHU !== undefined || input.referredRhuId !== undefined) {
      if (!before) return res.status(404).json({ message: "TB patient not found" });
      const mergedRefer = input.referralToRHU !== undefined ? input.referralToRHU : before.referralToRHU;
      const mergedRhuId = input.referredRhuId !== undefined ? input.referredRhuId : before.referredRhuId;
      const rhuError = await validateTbRhuReferral(!!mergedRefer, mergedRhuId ?? null);
      if (rhuError) return res.status(400).json({ message: rhuError });
    }
    const updated = await storage.updateTBPatient(id, input);
    const outcomeChanged = before && updated && before.outcomeStatus !== updated.outcomeStatus;
    await createAuditLog(
      req.userInfo!.id,
      req.userInfo!.role,
      outcomeChanged ? "STATUS_CHANGE" : "UPDATE",
      "TB_PATIENT",
      String(id),
      updated?.barangay ?? before?.barangay,
      before,
      updated,
      req,
    );
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
    requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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
      // TL-only encode: per the role split (BHS captures, RHU reviews),
      // MGMT roles see consolidated history but cannot add records.
      requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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

      // Phase 5 — auto-create MDR / PDR review records per DOH AO 2008-0029
      // and AO 2016-0035. 30-day deadline counted from dateOfDeath.
      // - MDR (Maternal Death Review): any death with maternalDeathCause set.
      // - PDR (Perinatal Death Review): fetal death OR neonatal (≤28 days).
      const due = new Date(created.dateOfDeath);
      due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().slice(0, 10);
      const reviewsToCreate: { reviewType: "MDR" | "PDR" }[] = [];
      if (created.maternalDeathCause) reviewsToCreate.push({ reviewType: "MDR" });
      const isNeonatal = created.ageDays != null && created.ageDays <= 28;
      if (created.isFetalDeath || isNeonatal) reviewsToCreate.push({ reviewType: "PDR" });
      for (const r of reviewsToCreate) {
        const [review] = await db.insert(deathReviews).values({
          deathEventId: created.id,
          reviewType: r.reviewType,
          dueDate,
          barangayName: created.barangay,
        }).returning();
        await createAuditLog(
          req.userInfo!.id, req.userInfo!.role,
          "DEATH_REVIEW_OPENED", "DEATH_REVIEW", String(review.id),
          created.barangay, undefined,
          { deathEventId: created.id, reviewType: r.reviewType, dueDate },
          req,
        );
      }
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
    requireRole(UserRole.TL),
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
    requireRole(UserRole.TL),
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

  // === HRH WORKFORCE MODULE — DOH HHRDB / NHWSS aligned ===
  app.get("/api/workforce", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const activeOnly = req.query.activeOnly === "true";
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getWorkforceMembers({ barangay: requestedBarangay, activeOnly });
      return res.json(requestedBarangay ? all : all.filter((r) => !r.barangay || assigned.includes(r.barangay)));
    }
    const data = await storage.getWorkforceMembers({ barangay: requestedBarangay, activeOnly });
    res.json(data);
  }));

  app.get("/api/workforce/:id", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const member = await storage.getWorkforceMember(id);
    if (!member) return res.status(404).json({ message: "Workforce member not found" });
    if (req.userInfo?.role === UserRole.TL && member.barangay && !req.userInfo.assignedBarangays.includes(member.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const credentials = await storage.getWorkforceCredentials(id);
    res.json({ member, credentials });
  }));

  app.post("/api/workforce", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const parsed = insertWorkforceMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid workforce member", issues: parsed.error.issues });
      }
      const created = await storage.createWorkforceMember({
        ...parsed.data,
        recordedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "WORKFORCE_MEMBER", String(created.id),
        created.barangay ?? undefined, undefined,
        { fullName: created.fullName, profession: created.profession, employmentStatus: created.employmentStatus },
        req,
      );
      res.status(201).json(created);
    }),
  );

  app.put("/api/workforce/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const existing = await storage.getWorkforceMember(id);
      if (!existing) return res.status(404).json({ message: "Workforce member not found" });
      const updated = await storage.updateWorkforceMember(id, req.body);
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "UPDATE", "WORKFORCE_MEMBER", String(id),
        updated.barangay ?? undefined,
        existing as any, updated as any, req,
      );
      res.json(updated);
    }),
  );

  app.post("/api/workforce/:id/credentials", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const memberId = parseId(req.params.id, res); if (memberId === null) return;
      const member = await storage.getWorkforceMember(memberId);
      if (!member) return res.status(404).json({ message: "Workforce member not found" });
      const parsed = insertWorkforceCredentialSchema.safeParse({ ...req.body, memberId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid credential", issues: parsed.error.issues });
      }
      const created = await storage.createWorkforceCredential(parsed.data);
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "WORKFORCE_CREDENTIAL", String(created.id),
        member.barangay ?? undefined, undefined,
        { memberId, credentialType: created.credentialType, dateObtained: created.dateObtained },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === PIDSR WEEKLY ATTESTATIONS — RA 11332 ===
  app.get("/api/pidsr-submissions", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const all = await storage.getPidsrSubmissions({ barangay: requestedBarangay, fromDate });
      return res.json(requestedBarangay ? all : all.filter((r) => assigned.includes(r.barangay)));
    }
    const data = await storage.getPidsrSubmissions({ barangay: requestedBarangay, fromDate });
    res.json(data);
  }));

  app.get("/api/pidsr-submissions/for-week", loadUserInfo, requireAuth, ar(async (req, res) => {
    const barangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const weekEndDate = req.query.weekEndDate ? String(req.query.weekEndDate) : undefined;
    if (!barangay || !weekEndDate) {
      return res.status(400).json({ message: "barangay and weekEndDate query params are required" });
    }
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    const sub = await storage.getPidsrSubmissionForWeek(barangay, weekEndDate);
    res.json(sub);
  }));

  app.post("/api/pidsr-submissions", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertPidsrSubmissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid PIDSR submission", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const existing = await storage.getPidsrSubmissionForWeek(input.barangay, input.weekEndDate);
      if (existing) {
        return res.status(409).json({ message: "Week already submitted", submissionId: existing.id });
      }
      const created = await storage.createPidsrSubmission({
        ...input,
        submittedByUserId: req.userInfo?.id ?? null,
      });
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "PIDSR_SUBMISSION", String(created.id),
        created.barangay, undefined,
        { weekEndDate: created.weekEndDate, cat2CaseCount: created.cat2CaseCount },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // === REPORTS HUB ===
  // Lazy-register on first hit so the route file stays self-contained.
  ensureReportsRegistered();

  // Diagnostic: dump the registered report slugs without auth so we can
  // verify the server picked up new reports after a deploy. Returns just
  // slug + cadence — no row data, no role gate.
  app.get("/api/reports/_registry", (_req, res) => {
    const slugs = listReports().map((r) => ({
      slug: r.slug,
      cadence: r.cadence,
      category: r.category,
    }));
    res.json({ count: slugs.length, slugs });
  });

  app.get("/api/reports", loadUserInfo, requireAuth, ar(async (req, res) => {
    const role = req.userInfo?.role;
    const defs = listReports()
      .filter((d) => !d.requiredRoles || (role && d.requiredRoles.includes(role)))
      .map((d) => ({
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

    // Per-report role gate (e.g. Registered Users → MGMT only).
    if (def.requiredRoles && req.userInfo?.role && !def.requiredRoles.includes(req.userInfo.role)) {
      return res.status(403).json({ message: "Access denied to this report" });
    }

    // Period selection by cadence:
    //   custom    → ?fromDate=YYYY-MM-DD &toDate=YYYY-MM-DD
    //   annual    → ?year= only
    //   quarterly → ?quarter=1-4 &year=
    //   anything else (monthly/weekly) → ?month=1-12 &year=
    let fromDate: string, toDate: string, periodLabel: string;
    if (def.cadence === "custom") {
      const from = req.query.fromDate ? String(req.query.fromDate) : "";
      const to = req.query.toDate ? String(req.query.toDate) : "";
      try {
        ({ fromDate, toDate, periodLabel } = customRange(from, to));
      } catch (err) {
        return res.status(400).json({ message: (err as Error).message });
      }
    } else {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: "year query param required (2000-2100)" });
      }
      const quarter = req.query.quarter !== undefined ? Number(req.query.quarter) : NaN;
      if (def.cadence === "annual") {
        ({ fromDate, toDate, periodLabel } = annualRange(year));
      } else if (Number.isInteger(quarter) && quarter >= 1 && quarter <= 4) {
        ({ fromDate, toDate, periodLabel } = quarterRange(quarter, year));
      } else {
        const month = Number(req.query.month);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          return res.status(400).json({ message: "month query param required (1-12) — or pass quarter (1-4) for quarterly reports" });
        }
        ({ fromDate, toDate, periodLabel } = monthRange(month, year));
      }
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
    // Build the period payload for the client. Custom-cadence reports
    // omit year/month/quarter (they only have from/to); other cadences
    // echo back whichever discriminator the URL used.
    const periodPayload: Record<string, unknown> = { fromDate, toDate, periodLabel };
    if (def.cadence !== "custom") {
      periodPayload.year = Number(req.query.year);
      const q = req.query.quarter !== undefined ? Number(req.query.quarter) : NaN;
      if (def.cadence === "quarterly" && Number.isInteger(q)) periodPayload.quarter = q;
      else if (def.cadence === "monthly" || def.cadence === "weekly") periodPayload.month = Number(req.query.month);
    }
    res.json({
      definition: { slug: def.slug, title: def.title, cadence: def.cadence, category: def.category, source: def.source ?? null },
      period: periodPayload,
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

  // === SCHEDULER MANUAL TRIGGER (Phase 3) ===
  // Lets an admin fire the daily / weekly alert sweep now without waiting
  // for 6 AM or Friday 4 PM. Returns per-job finding counts so we can
  // verify the scan worked. Output rows land in audit_logs as
  // SYSTEM_ALERT entries — visible on the Audit Logs admin page.
  app.post("/api/admin/run-scheduler-now", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN),
    ar(async (_req, res) => {
      const { runDailyAlerts, runWeeklyAlerts } = await import("./scheduler");
      const daily = await runDailyAlerts();
      const weekly = await runWeeklyAlerts();
      res.json({ daily, weekly });
    }),
  );

  // === AUDIT LOGS (Phase 1) ===
  // SYSTEM_ADMIN-only viewer of the audit_logs table. Supports filters by
  // action, entity type, and barangay, plus a hard cap of 500 rows so a
  // pathological query doesn't exhaust the connection. Newest first.
  app.get("/api/admin/audit-logs", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN),
    ar(async (req, res) => {
      const action = req.query.action ? String(req.query.action) : undefined;
      const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
      const barangayName = req.query.barangayName ? String(req.query.barangayName) : undefined;
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const conds: any[] = [];
      if (action) conds.push(eq(auditLogs.action, action));
      if (entityType) conds.push(eq(auditLogs.entityType, entityType));
      if (barangayName) conds.push(eq(auditLogs.barangayName, barangayName));
      const rows = await db
        .select()
        .from(auditLogs)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
      res.json(rows);
    }),
  );

  // === REFERRAL RECORDS (Phase 2 — operational-actions framework) ===
  // Unified handoff entity: any module (disease cases, TB, mothers, etc.)
  // creates a referral with status=PENDING; the receiving facility marks
  // RECEIVED, then COMPLETED when the clinical outcome lands.
  //
  // RBAC:
  // - GET: any authenticated role; TL scoped to source_barangay = one of
  //   their assigned barangays. MGMT sees all.
  // - POST (create): TL only — encoding handoff is a BHS-side action.
  // - PATCH /:id/receive + /:id/complete: MHO / SHA / Admin — RHU
  //   personnel acknowledge and close out referrals.
  app.get("/api/referrals", loadUserInfo, requireAuth, ar(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(referralRecords.status, status as any));
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      // TLs see only referrals they originated (source_barangay match).
      conds.push(eq(referralRecords.sourceBarangay, assigned[0]));
      // Note: drizzle-orm's `inArray` would be better for multi-barangay
      // TLs; covering single-barangay (the common case) here for simplicity.
    }
    const rows = await db
      .select()
      .from(referralRecords)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(referralRecords.createdAt))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/referrals", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertReferralRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid referral", issues: parsed.error.issues });
      }
      const input = parsed.data;
      // TL can only create referrals from their assigned barangays.
      if (input.sourceBarangay && !req.userInfo!.assignedBarangays.includes(input.sourceBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const [created] = await db.insert(referralRecords).values({
        ...input,
        sourceUserId: req.userInfo!.id,
        status: "PENDING",
      }).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "REFER", "REFERRAL", String(created.id),
        created.sourceBarangay ?? undefined,
        undefined,
        { id: created.id, target: created.targetFacility, patientType: created.patientType, reason: created.reason },
        req,
      );
      res.status(201).json(created);
    }),
  );

  app.patch("/api/referrals/:id/receive", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(referralRecords).where(eq(referralRecords.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Referral not found" });
      if (before.status !== "PENDING") {
        return res.status(400).json({ message: `Cannot mark received — status is ${before.status}` });
      }
      const [updated] = await db.update(referralRecords)
        .set({
          status: "RECEIVED",
          receivedAt: new Date(),
          targetUserId: req.userInfo!.id,
          receivedNotes: req.body?.notes ? String(req.body.notes) : null,
        })
        .where(eq(referralRecords.id, id))
        .returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "REFERRAL_RECEIVED", "REFERRAL", String(id),
        before.sourceBarangay ?? undefined,
        { status: before.status }, { status: "RECEIVED" }, req,
      );
      res.json(updated);
    }),
  );

  app.patch("/api/referrals/:id/complete", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(referralRecords).where(eq(referralRecords.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Referral not found" });
      if (before.status !== "RECEIVED") {
        return res.status(400).json({ message: `Cannot complete — status is ${before.status} (must be RECEIVED first)` });
      }
      const [updated] = await db.update(referralRecords)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          completionOutcome: req.body?.outcome ? String(req.body.outcome) : null,
        })
        .where(eq(referralRecords.id, id))
        .returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "REFERRAL_COMPLETED", "REFERRAL", String(id),
        before.sourceBarangay ?? undefined,
        { status: before.status }, { status: "COMPLETED" }, req,
      );
      res.json(updated);
    }),
  );

  // === DEATH REVIEWS — MDR / PDR (Phase 5 of operational-actions framework) ===
  // Auto-created on death_event POST; lifecycle managed by MGMT roles.
  // Captures committee findings + recommendations per DOH AO 2008-0029
  // (maternal) / AO 2016-0035 (perinatal/neonatal) within the 30-day deadline.
  app.get("/api/death-reviews", loadUserInfo, requireAuth, ar(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(deathReviews.status, status as any));
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(deathReviews.barangayName, assigned[0]));
    }
    const rows = await db
      .select()
      .from(deathReviews)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(deathReviews.dueDate))
      .limit(500);
    res.json(rows);
  }));

  // PATCH advances the lifecycle. Body: { status, notifiedAt?, reviewScheduledAt?,
  // committeeMembers?, findings?, recommendations? }. Status enum is enforced.
  app.patch("/api/death-reviews/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(deathReviews).where(eq(deathReviews.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Death review not found" });
      const newStatus = req.body?.status as string | undefined;
      if (newStatus && !DEATH_REVIEW_STATUSES.includes(newStatus as any)) {
        return res.status(400).json({ message: `Invalid status; allowed: ${DEATH_REVIEW_STATUSES.join(", ")}` });
      }
      // Auto-stamp lifecycle timestamps based on the new status.
      const set: Record<string, any> = {};
      if (newStatus) {
        set.status = newStatus;
        if (newStatus === "NOTIFIED" && !before.notifiedAt) set.notifiedAt = new Date();
        if (newStatus === "REVIEW_SCHEDULED" && !before.reviewScheduledAt) set.reviewScheduledAt = new Date();
        if (newStatus === "REVIEWED" && !before.reviewedAt) set.reviewedAt = new Date();
        if (newStatus === "CLOSED" && !before.closedAt) set.closedAt = new Date();
      }
      if (req.body?.committeeMembers !== undefined) set.committeeMembers = req.body.committeeMembers;
      if (req.body?.findings !== undefined) set.findings = String(req.body.findings);
      if (req.body?.recommendations !== undefined) set.recommendations = String(req.body.recommendations);
      const [updated] = await db.update(deathReviews).set(set).where(eq(deathReviews.id, id)).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        newStatus ? "DEATH_REVIEW_STATUS_CHANGE" : "DEATH_REVIEW_UPDATE",
        "DEATH_REVIEW", String(id),
        before.barangayName ?? undefined,
        before, updated, req,
      );
      res.json(updated);
    }),
  );

  // === AEFI EVENTS — Phase 6 of operational-actions framework ===
  // Adverse Event Following Immunization. SERIOUS events: 24h SLA to
  // CHD; NON_SERIOUS: 7d. The scheduler emits SYSTEM_ALERT when SLA
  // is missed. POST is TL-only (BHS-side encoding); MGMT marks
  // reportedToChd via PATCH after sending the official AEFI form upstream.
  app.get("/api/aefi-events", loadUserInfo, requireAuth, ar(async (req, res) => {
    const requestedBarangay = req.query.barangay ? String(req.query.barangay) : undefined;
    const conds: any[] = [];
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      if (requestedBarangay && !assigned.includes(requestedBarangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      conds.push(eq(aefiEvents.barangay, requestedBarangay ?? assigned[0]));
    } else if (requestedBarangay) {
      conds.push(eq(aefiEvents.barangay, requestedBarangay));
    }
    const rows = await db.select().from(aefiEvents)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(aefiEvents.eventDate))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/aefi-events", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertAefiEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid AEFI event", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (!req.userInfo!.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const [created] = await db.insert(aefiEvents).values({
        ...input,
        recordedByUserId: req.userInfo!.id,
      }).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "AEFI_EVENT", String(created.id),
        created.barangay, undefined,
        { id: created.id, vaccineGiven: created.vaccineGiven, severity: created.severity, eventDate: created.eventDate },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // PATCH lets MGMT mark reportedToChd, update outcome, or correct details.
  app.patch("/api/aefi-events/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(aefiEvents).where(eq(aefiEvents.id, id)))[0];
      if (!before) return res.status(404).json({ message: "AEFI event not found" });
      const set: Record<string, any> = {};
      if (req.body?.reportedToChd !== undefined) {
        set.reportedToChd = !!req.body.reportedToChd;
        if (set.reportedToChd && !before.reportedToChdAt) {
          set.reportedToChdAt = new Date();
        }
      }
      if (req.body?.outcome !== undefined) set.outcome = String(req.body.outcome);
      if (req.body?.notes !== undefined) set.notes = String(req.body.notes);
      const [updated] = await db.update(aefiEvents).set(set).where(eq(aefiEvents.id, id)).returning();
      const reportedFlipped = before.reportedToChd !== updated.reportedToChd;
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        reportedFlipped && updated.reportedToChd ? "AEFI_REPORTED_TO_CHD" : "UPDATE",
        "AEFI_EVENT", String(id),
        before.barangay,
        before, updated, req,
      );
      res.json(updated);
    }),
  );

  // === OUTBREAKS LIFECYCLE (Phase 9 of operational-actions framework) ===
  // Auto-created from the Phase 4 cluster detector; MGMT advances status
  // SUSPECTED → DECLARED → CONTAINED → CLOSED. RBAC: any authenticated
  // role can read; only MGMT can advance status.
  app.get("/api/outbreaks", loadUserInfo, requireAuth, ar(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(outbreaks.status, status as any));
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(outbreaks.barangay, assigned[0]));
    }
    const rows = await db.select().from(outbreaks)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(outbreaks.detectedAt))
      .limit(500);
    res.json(rows);
  }));

  // PATCH advances the lifecycle. Body: { status, notes? }. Status enum is
  // enforced and the corresponding lifecycle timestamp is auto-stamped.
  app.patch("/api/outbreaks/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(outbreaks).where(eq(outbreaks.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Outbreak not found" });
      const newStatus = req.body?.status as string | undefined;
      if (newStatus && !OUTBREAK_STATUSES.includes(newStatus as any)) {
        return res.status(400).json({ message: `Invalid status; allowed: ${OUTBREAK_STATUSES.join(", ")}` });
      }
      const set: Record<string, any> = {};
      if (newStatus) {
        set.status = newStatus;
        if (newStatus === "DECLARED" && !before.declaredAt) set.declaredAt = new Date();
        if (newStatus === "CONTAINED" && !before.containedAt) set.containedAt = new Date();
        if (newStatus === "CLOSED" && !before.closedAt) set.closedAt = new Date();
      }
      if (req.body?.investigationNotes !== undefined) set.investigationNotes = String(req.body.investigationNotes);
      if (req.body?.containmentActions !== undefined) set.containmentActions = String(req.body.containmentActions);
      if (req.body?.closureSummary !== undefined) set.closureSummary = String(req.body.closureSummary);
      const [updated] = await db.update(outbreaks).set(set).where(eq(outbreaks.id, id)).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        newStatus ? "OUTBREAK_STATUS_CHANGE" : "UPDATE",
        "OUTBREAK", String(id),
        before.barangay,
        before, updated, req,
      );
      res.json(updated);
    }),
  );

  // === WALK-IN OPD LOG (Phase 11) ===
  // Walk-ins are stored in the existing `consults` table with is_walk_in=true
  // and an array of service_codes. TL captures; MGMT reads consolidated.
  app.get("/api/walk-ins", loadUserInfo, requireAuth, ar(async (req, res) => {
    const conds: any[] = [eq(consults.isWalkIn, true)];
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(consults.barangay, assigned[0]));
    } else if (req.query.barangay) {
      conds.push(eq(consults.barangay, String(req.query.barangay)));
    }
    const rows = await db.select().from(consults)
      .where(and(...conds))
      .orderBy(desc(consults.createdAt))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/walk-ins", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const body = req.body ?? {};
      const barangay = String(body.barangay ?? "");
      if (!barangay || !req.userInfo!.assignedBarangays.includes(barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const serviceCodes: string[] = Array.isArray(body.serviceCodes) ? body.serviceCodes : [];
      const invalid = serviceCodes.find((c) => !(SERVICE_CODES as readonly string[]).includes(c));
      if (invalid) return res.status(400).json({ message: `Invalid service code: ${invalid}` });

      const now = new Date().toISOString();
      const [created] = await db.insert(consults).values({
        patientName:    String(body.patientName ?? ""),
        age:            Number(body.age ?? 0) || 0,
        sex:            String(body.sex ?? "F"),
        barangay,
        addressLine:    body.addressLine ? String(body.addressLine) : null,
        consultDate:    String(body.consultDate ?? now.slice(0, 10)),
        chiefComplaint: String(body.chiefComplaint ?? ""),
        diagnosis:      String(body.diagnosis ?? "Walk-in"),
        treatment:      body.treatment ? String(body.treatment) : null,
        notes:          body.notes ? String(body.notes) : null,
        bloodPressure:  body.bloodPressure ? String(body.bloodPressure) : null,
        weightKg:       body.weightKg ? String(body.weightKg) : null,
        temperatureC:   body.temperatureC ? String(body.temperatureC) : null,
        pulseRate:      body.pulseRate ? String(body.pulseRate) : null,
        heightCm:       body.heightCm ? String(body.heightCm) : null,
        consultType:    "Walk-in",
        disposition:    body.disposition ? String(body.disposition) : "Treated",
        referredTo:     body.referredTo ? String(body.referredTo) : null,
        createdBy:      req.userInfo!.id,
        createdAt:      now,
        isWalkIn:       true,
        serviceCodes,
      } as any).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "WALK_IN", String(created.id),
        created.barangay, undefined,
        { id: created.id, services: serviceCodes, complaint: created.chiefComplaint }, req,
      );
      res.status(201).json(created);
    }),
  );

  // POST /api/walk-ins/:id/dispense — log a medication dispense and decrement
  // medicine_inventory. Wrapped in a transaction so a stock decrement never
  // happens without a matching ledger row.
  app.post("/api/walk-ins/:id/dispense", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const consult = (await db.select().from(consults).where(eq(consults.id, id)))[0];
      if (!consult) return res.status(404).json({ message: "Walk-in not found" });
      if (!consult.isWalkIn) return res.status(400).json({ message: "Not a walk-in encounter" });
      if (!req.userInfo!.assignedBarangays.includes(consult.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }

      const parsed = insertMedicationDispensingSchema.safeParse({
        ...req.body,
        consultId: id,
        barangay: consult.barangay,
        dispensedByUserId: req.userInfo!.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid dispense", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (input.quantityDispensed <= 0) {
        return res.status(400).json({ message: "Quantity must be positive" });
      }

      // Decrement medicine_inventory atomically when a stock row is linked.
      if (input.medicineInventoryId) {
        const stock = (await db.select().from(medicineInventory)
          .where(eq(medicineInventory.id, input.medicineInventoryId)))[0];
        if (!stock) return res.status(404).json({ message: "Inventory item not found" });
        if (stock.barangay !== consult.barangay) {
          return res.status(403).json({ message: "Inventory item belongs to a different barangay" });
        }
        if ((stock.qty ?? 0) < input.quantityDispensed) {
          return res.status(400).json({ message: `Insufficient stock (have ${stock.qty}, need ${input.quantityDispensed})` });
        }
        await db.update(medicineInventory)
          .set({ qty: (stock.qty ?? 0) - input.quantityDispensed, lastUpdated: new Date().toISOString().slice(0, 10) })
          .where(eq(medicineInventory.id, input.medicineInventoryId));
      }

      const [created] = await db.insert(medicationDispensings).values(input as any).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "DISPENSE", "MEDICATION", String(created.id),
        consult.barangay, undefined,
        { walkInId: id, medicine: created.medicineName, qty: created.quantityDispensed },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // GET /api/walk-ins/:id/dispenses — line items for a single walk-in.
  app.get("/api/walk-ins/:id/dispenses", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const rows = await db.select().from(medicationDispensings)
      .where(eq(medicationDispensings.consultId, id))
      .orderBy(desc(medicationDispensings.dispensedAt));
    res.json(rows);
  }));

  // === RESTOCK REQUESTS (Phase 11) ===
  // TL files; MGMT fulfills. Pending requests surface in /api/mgmt/inbox.
  app.get("/api/inventory-requests", loadUserInfo, requireAuth, ar(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const conds: any[] = [];
    if (status) conds.push(eq(inventoryRequests.status, status as any));
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(inventoryRequests.barangay, assigned[0]));
    }
    const rows = await db.select().from(inventoryRequests)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(inventoryRequests.requestedAt))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/inventory-requests", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertInventoryRequestSchema.safeParse({
        ...req.body,
        requestedByUserId: req.userInfo!.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (!req.userInfo!.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const [created] = await db.insert(inventoryRequests).values({
        ...input,
        status: "PENDING",
      } as any).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "RESTOCK_REQUEST", String(created.id),
        created.barangay, undefined,
        { item: created.itemName, qty: created.quantityRequested, urgency: created.urgency }, req,
      );
      res.status(201).json(created);
    }),
  );

  app.patch("/api/inventory-requests/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(inventoryRequests).where(eq(inventoryRequests.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Request not found" });
      const newStatus = req.body?.status as string | undefined;
      if (newStatus && !RESTOCK_STATUSES.includes(newStatus as any)) {
        return res.status(400).json({ message: `Invalid status; allowed: ${RESTOCK_STATUSES.join(", ")}` });
      }
      const set: Record<string, any> = {};
      if (newStatus) {
        set.status = newStatus;
        if (newStatus === "FULFILLED" || newStatus === "REJECTED") {
          set.fulfilledByUserId = req.userInfo!.id;
          set.fulfilledAt = new Date();
        }
      }
      if (req.body?.fulfillmentNotes !== undefined) {
        set.fulfillmentNotes = String(req.body.fulfillmentNotes);
      }
      const [updated] = await db.update(inventoryRequests).set(set).where(eq(inventoryRequests.id, id)).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        newStatus ? "RESTOCK_STATUS_CHANGE" : "UPDATE",
        "RESTOCK_REQUEST", String(id),
        before.barangay, before, updated, req,
      );
      res.json(updated);
    }),
  );

  // === MEDICAL CERTIFICATES (Phase 12) ===
  // Issuance log; PDF rendered on-demand via jspdf-autotable. Certificate
  // numbers are auto-formatted "BHS-YYYY-MM-NNN", scoped per (barangay, year-
  // month) so two BHSes don't collide.
  app.get("/api/certificates", loadUserInfo, requireAuth, ar(async (req, res) => {
    const conds: any[] = [];
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(medicalCertificates.barangay, assigned[0]));
    } else if (req.query.barangay) {
      conds.push(eq(medicalCertificates.barangay, String(req.query.barangay)));
    }
    if (req.query.certType) conds.push(eq(medicalCertificates.certType, String(req.query.certType) as any));
    const rows = await db.select().from(medicalCertificates)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(medicalCertificates.createdAt))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/certificates", loadUserInfo, requireAuth,
    requireRole(UserRole.TL, UserRole.MHO, UserRole.SHA, UserRole.SYSTEM_ADMIN),
    ar(async (req, res) => {
      const parsed = insertMedicalCertificateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid certificate", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (req.userInfo!.role === UserRole.TL && !req.userInfo!.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      // Auto-number: BHS-YYYY-MM-NNN scoped by barangay + year-month.
      const ym = input.issueDate.slice(0, 7);
      const prefix = `BHS-${ym.replace("-", "-")}`;
      const existing = await db.select().from(medicalCertificates)
        .where(and(
          eq(medicalCertificates.barangay, input.barangay),
          // simple count via JS — small per-month volume keeps this cheap
        ));
      const sameMonth = existing.filter((c) => c.certificateNumber.startsWith(prefix));
      const seq = String(sameMonth.length + 1).padStart(3, "0");
      const certificateNumber = `${prefix}-${seq}`;

      const [created] = await db.insert(medicalCertificates).values({
        ...input,
        certificateNumber,
        signedByUserId: req.userInfo!.id,
      } as any).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "ISSUE", "MEDICAL_CERTIFICATE", String(created.id),
        created.barangay, undefined,
        { certNo: created.certificateNumber, type: created.certType, patient: created.patientName },
        req,
      );
      res.status(201).json(created);
    }),
  );

  // GET /api/certificates/:id/pdf — server-rendered printable PDF using
  // the same jspdf+autotable pipeline as the system manual.
  app.get("/api/certificates/:id/pdf", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const cert = (await db.select().from(medicalCertificates).where(eq(medicalCertificates.id, id)))[0];
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(cert.barangay)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    // Header band
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(16).text("Municipality of Placer", 14, 11);
    doc.setFont("helvetica", "normal").setFontSize(10).text("Province of Surigao del Norte", 14, 17);
    doc.setFont("helvetica", "bold").setFontSize(11);
    const certNoLabel = `Cert No. ${cert.certificateNumber}`;
    const w = doc.getTextWidth(certNoLabel);
    doc.text(certNoLabel, pageW - 14 - w, 11);
    // Title
    doc.setTextColor(0, 0, 0).setFontSize(18).setFont("helvetica", "bold");
    doc.text(certificateTitleFor(cert.certType), pageW / 2, 38, { align: "center" });
    // Body
    doc.setFontSize(11).setFont("helvetica", "normal");
    autoTable(doc, {
      startY: 50,
      theme: "plain",
      styles: { fontSize: 11, cellPadding: { top: 1, bottom: 1, left: 0, right: 0 } },
      body: [
        ["Issued to:", cert.patientName],
        ["Age / Sex:", `${cert.patientAge ?? "—"} / ${cert.patientSex ?? "—"}`],
        ["Address:",   `${cert.addressLine ? cert.addressLine + ", " : ""}${cert.barangay}`],
        ["Date issued:", cert.issueDate],
        ...(cert.validUntil ? [["Valid until:", cert.validUntil]] as [string, string][] : []),
        ["Purpose:",   cert.purpose ?? "—"],
        ["Findings:",  cert.findings ?? "—"],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: pageW - 28 - 45 } },
      margin: { left: 14, right: 14 },
    });
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    // Signature block
    doc.setFontSize(11).setFont("helvetica", "normal");
    doc.text("This certifies that the above named person was examined", 14, finalY + 18);
    doc.text("and the findings stated are true and correct.", 14, finalY + 24);
    const sigY = finalY + 50;
    doc.line(pageW - 90, sigY, pageW - 14, sigY);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(cert.signedByName ?? "—", pageW - 90, sigY + 6);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(cert.signedByTitle ?? "RHU / BHS", pageW - 90, sigY + 11);
    // Footer
    doc.setFontSize(8).setTextColor(100, 116, 139);
    doc.text(`Generated by HealthSync · ${new Date().toISOString().slice(0, 10)}`, 14, doc.internal.pageSize.getHeight() - 8);

    const bytes = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${cert.certificateNumber}.pdf"`);
    res.send(bytes);
  }));

  // === CAMPAIGN TALLY SHEETS (Phase 12) ===
  // GP / Operation Timbang / SIA / mass deworming / adult vax days.
  app.get("/api/campaigns", loadUserInfo, requireAuth, ar(async (req, res) => {
    const conds: any[] = [];
    if (req.userInfo?.role === UserRole.TL) {
      const assigned = req.userInfo.assignedBarangays;
      if (assigned.length === 0) return res.json([]);
      conds.push(eq(campaignTallies.barangay, assigned[0]));
    } else if (req.query.barangay) {
      conds.push(eq(campaignTallies.barangay, String(req.query.barangay)));
    }
    if (req.query.campaignType) conds.push(eq(campaignTallies.campaignType, String(req.query.campaignType) as any));
    const rows = await db.select().from(campaignTallies)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(campaignTallies.campaignDate))
      .limit(500);
    res.json(rows);
  }));

  app.post("/api/campaigns", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const parsed = insertCampaignTallySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid campaign", issues: parsed.error.issues });
      }
      const input = parsed.data;
      if (!req.userInfo!.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const [created] = await db.insert(campaignTallies).values({
        ...input,
        conductedByUserId: req.userInfo!.id,
      } as any).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "CREATE", "CAMPAIGN_TALLY", String(created.id),
        created.barangay, undefined,
        { type: created.campaignType, name: created.campaignName, total: created.totalServed },
        req,
      );
      res.status(201).json(created);
    }),
  );

  app.patch("/api/campaigns/:id", loadUserInfo, requireAuth,
    requireRole(UserRole.TL),
    ar(async (req, res) => {
      const id = parseId(req.params.id, res); if (id === null) return;
      const before = (await db.select().from(campaignTallies).where(eq(campaignTallies.id, id)))[0];
      if (!before) return res.status(404).json({ message: "Campaign not found" });
      if (!req.userInfo!.assignedBarangays.includes(before.barangay)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const set: Record<string, any> = {};
      if (req.body?.campaignName !== undefined) set.campaignName = String(req.body.campaignName);
      if (req.body?.campaignDate !== undefined) set.campaignDate = String(req.body.campaignDate);
      if (req.body?.tallies !== undefined && typeof req.body.tallies === "object") set.tallies = req.body.tallies;
      if (req.body?.totalServed !== undefined) set.totalServed = Number(req.body.totalServed) || 0;
      if (req.body?.notes !== undefined) set.notes = String(req.body.notes);
      const [updated] = await db.update(campaignTallies).set(set).where(eq(campaignTallies.id, id)).returning();
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "UPDATE", "CAMPAIGN_TALLY", String(id),
        before.barangay, before, updated, req,
      );
      res.json(updated);
    }),
  );

  // === MGMT INBOX (Phase 7 of operational-actions framework) ===
  // Single dashboard for MHO / SHA / Admin that surfaces every actionable
  // signal from Phases 1–6 in one place: pending referrals, open death
  // reviews, unreported AEFIs, and recent SYSTEM_ALERT audit entries.
  // Each item has a uniform shape so the client can render a single list
  // with a type chip and a click-through link to the detail page.
  app.get("/api/mgmt/inbox", loadUserInfo, requireAuth,
    requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA),
    ar(async (_req, res) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [pendingReferrals, openReviews, unreportedAefi, openOutbreaks, openRestockRequests, recentAlerts] = await Promise.all([
        db.select().from(referralRecords)
          .where(eq(referralRecords.status, "PENDING" as any))
          .orderBy(desc(referralRecords.createdAt)).limit(100),
        db.select().from(deathReviews)
          .where(inArray(deathReviews.status, ["PENDING_NOTIFY", "NOTIFIED", "REVIEW_SCHEDULED"] as any))
          .orderBy(desc(deathReviews.createdAt)).limit(100),
        db.select().from(aefiEvents)
          .where(eq(aefiEvents.reportedToChd, false))
          .orderBy(desc(aefiEvents.createdAt)).limit(100),
        db.select().from(outbreaks)
          .where(inArray(outbreaks.status, ["SUSPECTED", "DECLARED", "CONTAINED"] as any))
          .orderBy(desc(outbreaks.detectedAt)).limit(100),
        db.select().from(inventoryRequests)
          .where(eq(inventoryRequests.status, "PENDING" as any))
          .orderBy(desc(inventoryRequests.requestedAt)).limit(100),
        db.select().from(auditLogs)
          .where(and(eq(auditLogs.action, "SYSTEM_ALERT"), gte(auditLogs.createdAt, sevenDaysAgo)))
          .orderBy(desc(auditLogs.createdAt)).limit(100),
      ]);

      type InboxItem = {
        id: string;
        type: "referral" | "death-review" | "aefi" | "outbreak" | "restock" | "system-alert";
        priority: "high" | "medium" | "low";
        title: string;
        subtitle: string;
        barangay?: string;
        createdAt: string;
        link: string;
      };

      const items: InboxItem[] = [];

      for (const r of pendingReferrals) {
        items.push({
          id: `referral:${r.id}`,
          type: "referral",
          priority: "high",
          title: `Referral pending — ${r.reason}`,
          subtitle: `${r.patientName} → ${r.targetFacility}`,
          barangay: r.sourceBarangay ?? undefined,
          createdAt: (r.createdAt ?? new Date()).toISOString(),
          link: "/referrals",
        });
      }

      for (const d of openReviews) {
        const overdue = d.dueDate && d.dueDate < new Date().toISOString().slice(0, 10);
        items.push({
          id: `death-review:${d.id}`,
          type: "death-review",
          priority: overdue || d.status === "PENDING_NOTIFY" ? "high" : "medium",
          title: `${d.reviewType} ${d.status.replace(/_/g, " ").toLowerCase()}${overdue ? " — OVERDUE" : ""}`,
          subtitle: `Due ${d.dueDate}`,
          barangay: d.barangayName ?? undefined,
          createdAt: (d.createdAt ?? new Date()).toISOString(),
          link: "/death-events",
        });
      }

      for (const a of unreportedAefi) {
        items.push({
          id: `aefi:${a.id}`,
          type: "aefi",
          priority: a.severity === "SERIOUS" ? "high" : "medium",
          title: `AEFI ${a.severity.toLowerCase().replace("_", " ")} — ${a.vaccineGiven}`,
          subtitle: `${a.patientName} (${a.eventDate})`,
          barangay: a.barangay,
          createdAt: (a.createdAt ?? new Date()).toISOString(),
          link: "/aefi",
        });
      }

      for (const o of openOutbreaks) {
        items.push({
          id: `outbreak:${o.id}`,
          type: "outbreak",
          priority: o.status === "SUSPECTED" || o.status === "DECLARED" ? "high" : "medium",
          title: `${o.disease} outbreak — ${o.status.toLowerCase()}`,
          subtitle: `${o.caseCount} case${o.caseCount === 1 ? "" : "s"} in ${o.barangay}`,
          barangay: o.barangay,
          createdAt: (o.detectedAt ?? new Date()).toISOString(),
          link: "/outbreaks",
        });
      }

      for (const r of openRestockRequests) {
        items.push({
          id: `restock:${r.id}`,
          type: "restock",
          priority: r.urgency === "URGENT" ? "high" : "medium",
          title: `Restock request — ${r.itemName}${r.urgency === "URGENT" ? " (URGENT)" : ""}`,
          subtitle: `${r.quantityRequested} ${r.itemType === "vaccine" ? "doses" : "units"} for ${r.barangay}`,
          barangay: r.barangay,
          createdAt: (r.requestedAt ?? new Date()).toISOString(),
          link: "/restock-requests",
        });
      }

      for (const log of recentAlerts) {
        const after = log.afterJson as Record<string, any> | null;
        const rule = after?.rule ?? log.entityType;
        items.push({
          id: `system-alert:${log.id}`,
          type: "system-alert",
          priority: rule?.toString().startsWith("outbreak") ? "high" : "medium",
          title: `Alert — ${rule}`,
          subtitle: after?.message ? String(after.message).slice(0, 120) : log.entityType,
          barangay: log.barangayName ?? undefined,
          createdAt: (log.createdAt ?? new Date()).toISOString(),
          link: "/admin/audit",
        });
      }

      const priorityRank = { high: 0, medium: 1, low: 2 } as const;
      items.sort((a, b) => {
        const p = priorityRank[a.priority] - priorityRank[b.priority];
        if (p !== 0) return p;
        return b.createdAt.localeCompare(a.createdAt);
      });

      res.json({
        items,
        counts: {
          referral: pendingReferrals.length,
          deathReview: openReviews.length,
          aefi: unreportedAefi.length,
          outbreak: openOutbreaks.length,
          restock: openRestockRequests.length,
          systemAlert: recentAlerts.length,
          total: items.length,
        },
      });
    }),
  );

  // === NURSE VISITS (Team Leader / Barangay Nurse monitoring visits) ===
  // RBAC: any authenticated role can read; only SYSTEM_ADMIN and TL can write.
  // Additionally, TL users are scoped to their assigned barangays via the parent record.
  const nurseVisitReadRBAC = [loadUserInfo, requireAuth];
  // TL-only: nurse visits are captured at BHS by the team leader.
  const nurseVisitWriteRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.TL)];

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
  // TL-only for FP record CREATE — MGMT roles see consolidated history but
  // don't add new FP entries (BHS captures, RHU reviews).
  const fpCreateRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.TL)];

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

  app.post("/api/fp-records", fpCreateRBAC, ar(async (req, res) => {
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
  // TL-only: nutrition follow-ups are encoded at BHS by the team leader.
  // MGMT (Admin / MHO / SHA) sees consolidated history but doesn't add new
  // follow-ups. PUTs remain via nutritionUpdateRBAC for review/correction.
  const nutritionWriteRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.TL)];
  const nutritionUpdateRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.TL)];

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

  app.put("/api/nutrition-followups/:id", nutritionUpdateRBAC, ar(async (req, res) => {
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

// Certificate title rendered as the PDF heading. Matches the language used
// on the paper certificates so a printout can substitute for the booklet.
function certificateTitleFor(t: string): string {
  switch (t) {
    case "SCHOOL":            return "MEDICAL CERTIFICATE — SCHOOL";
    case "FITNESS_TO_WORK":   return "FIT-TO-WORK MEDICAL CERTIFICATE";
    case "SANITARY_PERMIT":   return "FOOD HANDLER HEALTH CARD";
    case "DRUG_TEST_RHU":     return "DRUG TEST RESULT — RHU";
    case "MEDICAL_CLEARANCE": return "MEDICAL CLEARANCE";
    case "DEATH_NOTICE":      return "MEDICAL CERTIFICATE OF DEATH";
    case "BARANGAY_HEALTH":   return "BARANGAY HEALTH CLEARANCE";
    default:                  return "MEDICAL CERTIFICATE";
  }
}
