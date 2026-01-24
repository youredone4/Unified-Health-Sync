import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  return httpServer;
}
