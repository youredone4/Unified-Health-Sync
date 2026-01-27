import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./auth";
import { registerAdminRoutes } from "./routes/admin";
import { loadUserInfo, requireAuth, requireRole } from "./middleware/rbac";
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

  // === MOTHERS ===
  app.get(api.mothers.list.path, async (req, res) => {
    const data = await storage.getMothers();
    res.json(data);
  });

  app.get(api.mothers.get.path, async (req, res) => {
    const mother = await storage.getMother(Number(req.params.id));
    if (!mother) {
      return res.status(404).json({ message: "Mother not found" });
    }
    res.json(mother);
  });

  app.put(api.mothers.update.path, async (req, res) => {
    try {
      const input = api.mothers.update.input.parse(req.body);
      const updated = await storage.updateMother(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === CHILDREN ===
  app.get(api.children.list.path, async (req, res) => {
    const data = await storage.getChildren();
    res.json(data);
  });

  app.get(api.children.get.path, async (req, res) => {
    const child = await storage.getChild(Number(req.params.id));
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }
    res.json(child);
  });

  app.put(api.children.update.path, async (req, res) => {
    try {
      const input = api.children.update.input.parse(req.body);
      const updated = await storage.updateChild(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === SENIORS ===
  app.get(api.seniors.list.path, async (req, res) => {
    const data = await storage.getSeniors();
    res.json(data);
  });

  app.get(api.seniors.get.path, async (req, res) => {
    const senior = await storage.getSenior(Number(req.params.id));
    if (!senior) {
      return res.status(404).json({ message: "Senior not found" });
    }
    res.json(senior);
  });

  app.put(api.seniors.update.path, async (req, res) => {
    try {
      const input = api.seniors.update.input.parse(req.body);
      const updated = await storage.updateSenior(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

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
      const created = await storage.sendSms(input);
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

  app.get(api.diseaseCases.get.path, async (req, res) => {
    const diseaseCase = await storage.getDiseaseCase(Number(req.params.id));
    if (!diseaseCase) {
      return res.status(404).json({ message: "Disease case not found" });
    }
    res.json(diseaseCase);
  });

  app.put(api.diseaseCases.update.path, async (req, res) => {
    try {
      const input = api.diseaseCases.update.input.parse(req.body);
      const updated = await storage.updateDiseaseCase(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === TB PATIENTS ===
  app.get(api.tbPatients.list.path, async (req, res) => {
    const data = await storage.getTBPatients();
    res.json(data);
  });

  app.get(api.tbPatients.get.path, async (req, res) => {
    const patient = await storage.getTBPatient(Number(req.params.id));
    if (!patient) {
      return res.status(404).json({ message: "TB patient not found" });
    }
    res.json(patient);
  });

  app.put(api.tbPatients.update.path, async (req, res) => {
    try {
      const input = api.tbPatients.update.input.parse(req.body);
      const updated = await storage.updateTBPatient(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

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

  // === CONSULTS (Morbidity Module - MHO/SYSTEM_ADMIN only access with backend RBAC) ===
  const morbidityRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO)];
  
  app.get(api.consults.list.path, morbidityRBAC, async (req, res) => {
    const data = await storage.getConsults();
    res.json(data);
  });

  app.get(api.consults.get.path, morbidityRBAC, async (req, res) => {
    const consult = await storage.getConsult(Number(req.params.id));
    if (!consult) {
      return res.status(404).json({ message: "Consult not found" });
    }
    res.json(consult);
  });

  app.post(api.consults.create.path, morbidityRBAC, async (req, res) => {
    try {
      const input = api.consults.create.input.parse(req.body);
      const created = await storage.createConsult(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.consults.update.path, morbidityRBAC, async (req, res) => {
    try {
      const input = api.consults.update.input.parse(req.body);
      const updated = await storage.updateConsult(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === M1 TEMPLATE SYSTEM ===
  
  // Get active M1 template version
  app.get("/api/m1/templates", async (req, res) => {
    const templates = await storage.getM1TemplateVersions();
    res.json(templates);
  });

  // Get M1 indicator catalog for a template version
  app.get("/api/m1/templates/:templateId/catalog", async (req, res) => {
    const catalog = await storage.getM1IndicatorCatalog(Number(req.params.templateId));
    res.json(catalog);
  });

  // Get all barangays
  app.get("/api/barangays", async (req, res) => {
    const data = await storage.getBarangays();
    res.json(data);
  });

  // Get M1 report instances
  app.get("/api/m1/reports", async (req, res) => {
    const { barangayId, month, year } = req.query;
    const reports = await storage.getM1ReportInstances({
      barangayId: barangayId ? Number(barangayId) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
    res.json(reports);
  });

  // Get single M1 report instance with values
  app.get("/api/m1/reports/:id", async (req, res) => {
    const report = await storage.getM1ReportInstance(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  });

  // Create new M1 report instance
  app.post("/api/m1/reports", async (req, res) => {
    try {
      const report = await storage.createM1ReportInstance(req.body);
      res.status(201).json(report);
    } catch (err) {
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  // Update M1 indicator values for a report
  app.put("/api/m1/reports/:id/values", async (req, res) => {
    try {
      const updated = await storage.updateM1IndicatorValues(Number(req.params.id), req.body.values);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Failed to update values" });
    }
  });

  // Get municipality settings
  app.get("/api/municipality-settings", async (req, res) => {
    const settings = await storage.getMunicipalitySettings();
    res.json(settings);
  });

  // Get barangay settings
  app.get("/api/barangay-settings/:barangayId", async (req, res) => {
    const settings = await storage.getBarangaySettings(Number(req.params.barangayId));
    res.json(settings || {});
  });

  return httpServer;
}
