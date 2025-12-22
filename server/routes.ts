
import type { Express } from "express";
import { createServer, type Server } from "http";
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

  return httpServer;
}
