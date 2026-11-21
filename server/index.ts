// Must be first: loads .env and validates configuration before any other
// module reads process.env.
import { config } from "./config";
import express from "express";
import { registerRoutes } from "./routes";
import { startScheduler } from "./scheduler";
import { serveStatic } from "./static";
import { createServer } from "http";
import { securityHeaders, requestLogger, errorHandler, BULK_IMPORT_PATHS } from "./middleware/security";

const app = express();
const httpServer = createServer(app);

app.use(securityHeaders());

// Express sends a weak ETag on every JSON response. When the app is reverse-proxied
// (Caddy/nginx, corporate caches) a GET issued right after a PUT can be served
// stale with 304 + the pre-update body, leaving the React Query cache holding
// the old record even though the write succeeded. Turn ETag off and mark every
// /api response non-cacheable. no-store also keeps patient data out of shared
// and on-disk browser caches.
app.set("etag", false);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Lightweight health-check endpoint (used by the Docker healthcheck).
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Request bodies. Everything is a single form and gets a small limit, so
// an oversized body is rejected before it is parsed. The spreadsheet-import
// routes need a large limit; they are skipped here and parsed in
// routes.ts AFTER authentication, so an anonymous client can never make
// the server parse more than 1 MB.
const smallJson = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  const p = req.path.length > 1 && req.path.endsWith("/") ? req.path.slice(0, -1) : req.path;
  if (BULK_IMPORT_PATHS.includes(p.toLowerCase())) return next();
  smallJson(req, res, next);
});
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use(requestLogger);

(async () => {
  await registerRoutes(httpServer, app);

  // Unknown /api paths get a JSON 404 instead of falling through to the
  // single-page app's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use(errorHandler);

  process.on("unhandledRejection", (reason) => {
    console.error("[express] Unhandled promise rejection:", (reason as Error)?.stack || reason);
  });

  process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
    console.error("[express] Uncaught exception:", err.stack || err.message || err);
  });

  // Graceful shutdown: force-close all open connections (including Vite HMR
  // WebSockets) so the port is freed immediately — no blocking on persistent
  // connections that would delay the next restart.
  const shutdown = () => {
    (httpServer as any).closeAllConnections?.();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (config.isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // One port serves both the API and the client. In production this sits
  // behind a TLS-terminating reverse proxy (see docker-compose.yml).
  httpServer.once("error", (err: NodeJS.ErrnoException) => {
    console.error(`[express] Fatal: cannot listen on ${config.HOST}:${config.PORT} — ${err.message}`);
    process.exit(1);
  });

  httpServer.listen({ port: config.PORT, host: config.HOST }, () => {
    log(`serving on ${config.HOST}:${config.PORT} (${config.NODE_ENV})`);
    if (config.SCHEDULER_ENABLED) {
      startScheduler();
    } else {
      log("scheduler disabled (SCHEDULER_ENABLED=false)", "startup");
    }
  });
})();
