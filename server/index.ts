// Must be first: loads .env and validates configuration before any other
// module reads process.env.
import { config } from "./config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startScheduler } from "./scheduler";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Express sends a weak ETag on every JSON response. When the app is reverse-proxied
// (Caddy/nginx, corporate caches) a GET issued right after a PUT can be served
// stale with 304 + the pre-update body, leaving the React Query cache holding
// the old record even though the write succeeded. Turn ETag off and mark every
// /api response non-cacheable.
app.set("etag", false);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Lightweight health-check endpoint (used by the Docker healthcheck).
app.get("/api/health", (_req, res) => res.json({ ok: true }));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[express] Unhandled error:", err.message || err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[express] Unhandled promise rejection:", reason);
  });

  process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
    console.error("[express] Uncaught exception:", err.message || err);
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
