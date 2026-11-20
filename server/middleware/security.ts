/**
 * Cross-cutting HTTP security: response headers, cross-site request
 * protection, request logging that never records personal data, and the
 * final error handler.
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "../config";

// --- Response headers -------------------------------------------------------

/**
 * Security headers. The Content-Security-Policy is only applied to the
 * production build: the Vite dev server needs inline scripts and eval for
 * hot reloading.
 *
 * External origins allowed, and why:
 *   fonts.googleapis.com / fonts.gstatic.com  web fonts (client/index.html)
 *   *.basemaps.cartocdn.com                   map tiles (disease map)
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            scriptSrc: ["'self'"],
            // React sets inline style attributes; stylesheets themselves
            // only come from this origin and Google Fonts.
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.basemaps.cartocdn.com"],
            connectSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            // Generated PDFs / exports are opened from blob: URLs.
            frameSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"],
            formAction: ["'self'"],
            // Nobody may embed HealthSync in a frame (clickjacking).
            frameAncestors: ["'none'"],
            ...(config.cookieSecure ? { upgradeInsecureRequests: [] } : {}),
          },
        }
      : false,
    // Only meaningful (and only safe to promise) when served over HTTPS.
    strictTransportSecurity: config.cookieSecure
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
    crossOriginEmbedderPolicy: false,
  });
}

// --- Cross-site request protection -----------------------------------------

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Rejects state-changing API requests that come from another website.
 *
 * The session cookie is SameSite=Lax, which already stops most cross-site
 * POSTs; this is the second layer. Browsers attach `Origin` to every
 * cross-origin and every non-GET same-origin fetch, and `Sec-Fetch-Site`
 * to essentially everything, so a legitimate request from the HealthSync
 * page always carries an Origin equal to our own host. A request with
 * neither header is not from a browser (curl, scripts) and has no ambient
 * cookie to abuse, so it is allowed through to normal authentication.
 */
export const csrfGuard: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = req.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && fetchSite !== "same-origin" && fetchSite !== "none") {
    return res.status(403).json({ message: "Cross-site request blocked" });
  }

  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    // req.hostname honours X-Forwarded-Host only when trust proxy is set;
    // compare against the Host the browser actually addressed.
    const expected = (req.headers["x-forwarded-host"] && config.TRUST_PROXY > 0
      ? String(req.headers["x-forwarded-host"]).split(",")[0].trim()
      : req.headers.host || ""
    ).toLowerCase();
    if (!expected || hostOf(origin) !== expected) {
      return res.status(403).json({ message: "Cross-site request blocked" });
    }
  }

  next();
};

// --- Request logging --------------------------------------------------------

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * One line per API request: method, path, status, duration, user id.
 *
 * Deliberately NOT logged: request bodies, response bodies and query
 * strings. Those carry patient names, phone numbers and diagnoses, and log
 * files are copied, shipped and retained with far less care than the
 * database. The audit_logs table is the place for "who changed what".
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  if (!path.startsWith("/api") || path === "/api/health") return next();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const who = req.userInfo?.id ?? "-";
    console.log(`${timestamp()} [express] ${req.method} ${path} ${res.statusCode} ${duration}ms user=${who}`);
  });
  next();
};

// --- Error handling ---------------------------------------------------------

/**
 * Last-resort error handler. Internal error text (SQL fragments, file
 * paths, stack traces) never reaches the client; it goes to the server log
 * with a reference id the user can quote to whoever runs the server.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  // Validation failures thrown by `schema.parse()` inside route handlers.
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid input",
      issues: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    });
  }

  const status = Number(err?.status || err?.statusCode) || 500;

  // Body-parser and similar client errors are safe to describe.
  if (status === 413) return res.status(413).json({ message: "Request is too large" });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Request body is not valid JSON" });
  if (status >= 400 && status < 500 && err?.expose === true) {
    return res.status(status).json({ message: String(err.message || "Bad request") });
  }
  if (status === 503 && err?.name === "AiNotConfiguredError") {
    return res.status(503).json({ message: err.message });
  }

  // An update that changes nothing (drizzle refuses an empty SET clause).
  if (err?.message === "No values to set") {
    return res.status(400).json({ message: "Nothing to update" });
  }

  const reference = Math.random().toString(36).slice(2, 10);
  console.error(
    `[express] error ref=${reference} ${req.method} ${req.path} user=${req.userInfo?.id ?? "-"}:`,
    err?.stack || err?.message || err,
  );
  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: "Something went wrong. Please try again.",
    reference,
  });
};
