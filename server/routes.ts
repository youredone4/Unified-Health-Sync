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

  // RBAC middleware for registry read - all authenticated users can read
  const registryReadRBAC = [loadUserInfo, requireAuth];
  // RBAC middleware for registry CRUD - TL, SHA, MHO, and SYSTEM_ADMIN can create/update/delete
  const registryRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA, UserRole.TL)];

  // Helper to filter data by TL's assigned barangays
  function filterByBarangay<T extends { barangay: string }>(data: T[], userInfo: Express.Request["userInfo"]): T[] {
    if (!userInfo) return [];
    // TL can only see their assigned barangays
    if (userInfo.role === UserRole.TL) {
      return data.filter(item => userInfo.assignedBarangays.includes(item.barangay));
    }
    // Other roles see all data
    return data;
  }

  // === MOTHERS ===
  app.get(api.mothers.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getMothers();
    res.json(filterByBarangay(data, req.userInfo));
  });

  app.get(api.mothers.get.path, registryReadRBAC, async (req, res) => {
    const mother = await storage.getMother(Number(req.params.id));
    if (!mother) {
      return res.status(404).json({ message: "Mother not found" });
    }
    // Check TL barangay access
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(mother.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(mother);
  });

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

  app.put(api.mothers.update.path, registryRBAC, async (req, res) => {
    try {
      const input = api.mothers.update.input.parse(req.body);
      const updated = await storage.updateMother(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.mothers.delete.path, registryRBAC, async (req, res) => {
    try {
      const mother = await storage.getMother(Number(req.params.id));
      if (!mother) {
        return res.status(404).json({ message: "Mother not found" });
      }
      await storage.deleteMother(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete mother" });
    }
  });

  // === CHILDREN ===
  app.get(api.children.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getChildren();
    res.json(filterByBarangay(data, req.userInfo));
  });

  app.get(api.children.get.path, registryReadRBAC, async (req, res) => {
    const child = await storage.getChild(Number(req.params.id));
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }
    // Check TL barangay access
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(child.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(child);
  });

  app.post(api.children.create.path, registryRBAC, async (req, res) => {
    try {
      const input = api.children.create.input.parse(req.body);
      // TL can only create records in their assigned barangays
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
      }
      const created = await storage.createChild(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.children.update.path, registryRBAC, async (req, res) => {
    try {
      const input = api.children.update.input.parse(req.body);
      const updated = await storage.updateChild(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.children.delete.path, registryRBAC, async (req, res) => {
    try {
      const child = await storage.getChild(Number(req.params.id));
      if (!child) {
        return res.status(404).json({ message: "Child not found" });
      }
      await storage.deleteChild(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete child" });
    }
  });

  // === SENIORS ===
  app.get(api.seniors.list.path, registryReadRBAC, async (req, res) => {
    const data = await storage.getSeniors();
    res.json(filterByBarangay(data, req.userInfo));
  });

  app.get(api.seniors.get.path, registryReadRBAC, async (req, res) => {
    const senior = await storage.getSenior(Number(req.params.id));
    if (!senior) {
      return res.status(404).json({ message: "Senior not found" });
    }
    // Check TL barangay access
    if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(senior.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }
    res.json(senior);
  });

  app.post(api.seniors.create.path, registryRBAC, async (req, res) => {
    try {
      const input = api.seniors.create.input.parse(req.body);
      // TL can only create records in their assigned barangays
      if (req.userInfo?.role === UserRole.TL && !req.userInfo.assignedBarangays.includes(input.barangay)) {
        return res.status(403).json({ message: "You can only add patients to your assigned barangays" });
      }
      const created = await storage.createSenior(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.seniors.update.path, registryRBAC, async (req, res) => {
    try {
      const input = api.seniors.update.input.parse(req.body);
      const updated = await storage.updateSenior(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.seniors.delete.path, registryRBAC, async (req, res) => {
    try {
      const senior = await storage.getSenior(Number(req.params.id));
      if (!senior) {
        return res.status(404).json({ message: "Senior not found" });
      }
      await storage.deleteSenior(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete senior" });
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

  app.post(api.diseaseCases.create.path, registryRBAC, async (req, res) => {
    try {
      const input = api.diseaseCases.create.input.parse(req.body);
      const created = await storage.createDiseaseCase(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.diseaseCases.update.path, registryRBAC, async (req, res) => {
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

  app.post(api.tbPatients.create.path, registryRBAC, async (req, res) => {
    try {
      const input = api.tbPatients.create.input.parse(req.body);
      const created = await storage.createTBPatient(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.tbPatients.update.path, registryRBAC, async (req, res) => {
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

  // === CONSULTS (Patient Check-up Module - MHO/SYSTEM_ADMIN only access with backend RBAC) ===
  const patientCheckupRBAC = [loadUserInfo, requireAuth, requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO)];
  
  app.get(api.consults.list.path, patientCheckupRBAC, async (req, res) => {
    const data = await storage.getConsults();
    res.json(data);
  });

  app.get(api.consults.get.path, patientCheckupRBAC, async (req, res) => {
    const consult = await storage.getConsult(Number(req.params.id));
    if (!consult) {
      return res.status(404).json({ message: "Consult not found" });
    }
    res.json(consult);
  });

  app.post(api.consults.create.path, patientCheckupRBAC, async (req, res) => {
    try {
      const input = api.consults.create.input.parse(req.body);
      const created = await storage.createConsult(input);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.consults.update.path, patientCheckupRBAC, async (req, res) => {
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

  // Bulk import M1 CSV data for a specific barangay and month/year
  app.post("/api/m1/bulk-import", async (req, res) => {
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
          createdByUserId: null,
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

  // Seed historical M1 data for all barangays
  app.post("/api/m1/seed-historical", async (req, res) => {
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

  return httpServer;
}
