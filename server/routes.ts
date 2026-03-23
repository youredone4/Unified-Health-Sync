import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { max, eq } from "drizzle-orm";
import { prenatalVisits, childVisits, seniorVisits } from "@shared/schema";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./auth";
import { registerAdminRoutes } from "./routes/admin";
import { loadUserInfo, requireAuth, requireRole, createAuditLog } from "./middleware/rbac";
import { UserRole } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register admin routes (user management, audit logs, etc.)
  registerAdminRoutes(app);

  // Seed data on startup
  await storage.seedData();

  // RBAC middleware for registry read - all authenticated users can read
  const registryReadRBAC = [loadUserInfo, requireAuth];
  // RBAC middleware for registry CRUD - all operational roles can create/update
  const registryRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL)];
  // RBAC middleware for registry DELETE - SYSTEM_ADMIN only
  const adminOnlyRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN)];

  // Helper to filter data by TL's assigned barangays
  function filterByBarangay<T extends { barangay: string }>(data: T[], userInfo: Express.Request["userInfo"]): T[] {
    if (!userInfo) return [];
    if (userInfo.role === UserRole.TL) {
      return data.filter(item => userInfo.assignedBarangays.includes(item.barangay));
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
    res.json(filterByBarangay(data, req.userInfo));
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
    res.json(filterByBarangay(data, req.userInfo));
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
    res.json(filterByBarangay(data, req.userInfo));
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
    const data = await storage.getHealthStations();
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
  app.get(api.diseaseCases.list.path, async (req, res) => {
    const data = await storage.getDiseaseCases();
    res.json(data);
  });

  app.get(api.diseaseCases.get.path, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const diseaseCase = await storage.getDiseaseCase(id);
    if (!diseaseCase) return res.status(404).json({ message: "Disease case not found" });
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
  app.get(api.tbPatients.list.path, async (req, res) => {
    const data = await storage.getTBPatients();
    res.json(data);
  });

  app.get(api.tbPatients.get.path, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const patient = await storage.getTBPatient(id);
    if (!patient) return res.status(404).json({ message: "TB patient not found" });
    res.json(patient);
  }));

  app.post(api.tbPatients.create.path, registryRBAC, ar(async (req, res) => {
    const input = api.tbPatients.create.input.parse(req.body);
    const created = await storage.createTBPatient(input);
    res.status(201).json(created);
  }));

  app.put(api.tbPatients.update.path, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const input = api.tbPatients.update.input.parse(req.body);
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

  // === THEME SETTINGS ===
  app.get(api.themeSettings.get.path, async (req, res) => {
    let settings = await storage.getThemeSettings();
    if (!settings) {
      settings = await storage.updateThemeSettings({
        lguName: "Placer Municipality",
        lguSubtitle: "Province of Surigao del Norte",
        colorScheme: "healthcare-green",
        primaryHue: 152,
        primarySaturation: 60,
        primaryLightness: 40,
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
      const requestedId = barangayId ? Number(barangayId) : undefined;
      if (requestedId && !allowedIds.includes(requestedId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      const reports = await storage.getM1ReportInstances({
        barangayId: requestedId || allowedIds[0],
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

  // Get single M1 report instance with values
  app.get("/api/m1/reports/:id", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const report = await storage.getM1ReportInstance(id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    // TL scoping: verify barangay ownership
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowed = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (report.instance.barangayId && !allowed.includes(report.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    res.json(report);
  }));

  // Create new M1 report instance
  app.post("/api/m1/reports", loadUserInfo, requireAuth, ar(async (req, res) => {
    // TL can only create for their assigned barangays
    if (req.userInfo?.role === UserRole.TL) {
      const { barangayName } = req.body;
      if (barangayName && !req.userInfo.assignedBarangays.includes(barangayName)) {
        return res.status(403).json({ message: "You can only create reports for your assigned barangays" });
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

  // Update M1 indicator values for a report — audit each ENCODED save
  app.put("/api/m1/reports/:id/values", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    // Verify report exists and TL scoping
    const existing = await storage.getM1ReportInstance(id);
    if (!existing) return res.status(404).json({ message: "Report not found" });
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowed = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (existing.instance.barangayId && !allowed.includes(existing.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
    }
    // Prevent editing SUBMITTED_LOCKED reports
    if (existing.instance.status === "SUBMITTED_LOCKED") {
      return res.status(403).json({ message: "Cannot edit a submitted report. Reopen it first." });
    }
    // req.body can be an array (values directly) or { values: [...] }
    const values: any[] = Array.isArray(req.body) ? req.body : (req.body.values || []);
    const updated = await storage.updateM1IndicatorValues(id, values);
    // Audit ENCODED saves
    const encodedCount = values.filter((v: any) => v.valueSource === "ENCODED").length;
    if (encodedCount > 0) {
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        "UPDATE", "M1_INDICATOR_VALUES", id,
        existing.instance.barangayName || undefined,
        { previousSavedCount: existing.values.length },
        { updatedCount: encodedCount, reportId: id }, req
      );
    }
    res.json(updated);
  }));

  // Update M1 report status (Submit / Reopen)
  app.post("/api/m1/reports/:id/status", loadUserInfo, requireAuth, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;
    const { status } = req.body;
    const allowed = ["DRAFT", "READY_FOR_REVIEW", "SUBMITTED_LOCKED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowed.join(", ")}` });
    }
    const existing = await storage.getM1ReportInstance(id);
    if (!existing) return res.status(404).json({ message: "Report not found" });
    // TL scoping
    if (req.userInfo?.role === UserRole.TL) {
      const allBarangays = await storage.getBarangays();
      const allowedIds = allBarangays
        .filter(b => req.userInfo!.assignedBarangays.includes(b.name))
        .map(b => b.id);
      if (existing.instance.barangayId && !allowedIds.includes(existing.instance.barangayId)) {
        return res.status(403).json({ message: "Access denied to this barangay" });
      }
      // TL cannot reopen a SUBMITTED_LOCKED report
      if (existing.instance.status === "SUBMITTED_LOCKED" && status !== "SUBMITTED_LOCKED") {
        return res.status(403).json({ message: "Only MHO or Admin can reopen a submitted report" });
      }
    }
    const updated = await storage.updateM1ReportStatus(id, status);
    await createAuditLog(
      req.userInfo!.id, req.userInfo!.role,
      "UPDATE", "M1_REPORT_STATUS", id,
      existing.instance.barangayName || undefined,
      { previousStatus: existing.instance.status },
      { newStatus: status }, req
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

  // Bulk import M1 CSV data for a specific barangay and month/year
  app.post("/api/m1/bulk-import", loadUserInfo, requireAuth, async (req, res) => {
    try {
      const { barangayId, barangayName, month, year, values, templateVersionId } = req.body;
      
      if (!barangayId || !month || !year || !values || !Array.isArray(values)) {
        return res.status(400).json({ message: "Missing required fields: barangayId, month, year, values" });
      }
      
      // Check for existing report or create new one
      const existingReports = await storage.getM1ReportInstances({ barangayId, month, year });
      let reportId: number;
      
      if (existingReports.length > 0) {
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
    res.status(201).json(visit);
  }));

  return httpServer;
}
