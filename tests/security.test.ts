/**
 * Security regression tests. They run against a REAL running server and
 * its database, over HTTP, exactly as a browser or an attacker would.
 *
 *   1. Start the server against a THROWAWAY database (never production).
 *      The suite makes dozens of deliberately failed sign-ins from one
 *      address, so lift the per-address limit for the test server:
 *        npm run db:migrate && LOGIN_IP_MAX_FAILURES=1000 npm run dev
 *   2. In another terminal:
 *        ALLOW_TEST_RESET=true npm run test:security
 *
 * Environment:
 *   BASE_URL       server under test (default http://localhost:5000)
 *   DATABASE_URL   the same database the server uses (to create test
 *                  accounts and records, and remove them afterwards)
 *
 * The suite creates its own accounts and a handful of clearly-labelled
 * records ("ZZ-SECURITY-TEST"), and deletes them when it finishes.
 *
 * The most important test is the first one: it reads the route
 * definitions out of the server source and proves that EVERY one of them
 * refuses a request with no session. A route added later without an auth
 * check is caught automatically.
 */
import "../server/load-env";
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import pg from "pg";
import { api } from "../shared/routes";
import { hashPassword } from "../server/passwords";
import { totpCode, totpStep } from "../server/totp";

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const TAG = "ZZ-SECURITY-TEST";
const RUN = Date.now().toString(36);
const STRONG_PASSWORD = "correct-horse-battery-staple-42";

if (process.env.ALLOW_TEST_RESET !== "true") {
  console.error(
    "\nRefusing to run: these tests create accounts and records in the database.\n" +
      "Point DATABASE_URL at a throwaway database and set ALLOW_TEST_RESET=true.\n",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("\nDATABASE_URL must be set (the database the server under test uses).\n");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

// --- tiny HTTP client with a cookie jar ------------------------------------

class Client {
  cookie = "";

  async request(method: string, urlPath: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE_URL + urlPath, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const pair = c.split(";")[0];
      if (pair.startsWith("hs.sid=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, json, text, headers: res.headers, setCookie };
  }

  get(p: string) { return this.request("GET", p); }
  post(p: string, body: unknown = {}) { return this.request("POST", p, body); }
  put(p: string, body: unknown = {}) { return this.request("PUT", p, body); }
  patch(p: string, body: unknown = {}) { return this.request("PATCH", p, body); }
  del(p: string) { return this.request("DELETE", p); }

  async login(username: string, password: string) {
    return this.post("/api/auth/login", { username, password });
  }
}

// --- route discovery ---------------------------------------------------------

interface Route { method: string; path: string }

function resolveApiPath(expr: string): string | null {
  // "api.mothers.list.path" -> api["mothers"]["list"]["path"]
  let cur: any = { api };
  for (const part of expr.split(".")) cur = cur?.[part];
  return typeof cur === "string" ? cur : null;
}

function discoverRoutes(): Route[] {
  const files = ["server/routes.ts", "server/routes/admin.ts", "server/auth.ts"];
  const found = new Map<string, Route>();
  const add = (method: string, p: string) => {
    if (!p.startsWith("/api")) return;
    const concrete = p.replace(/:[A-Za-z_]+/g, "1");
    found.set(`${method} ${concrete}`, { method, path: concrete });
  };

  for (const file of files) {
    const src = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

    const direct = /app\.(get|post|put|patch|delete)\(\s*(?:"([^"]+)"|'([^']+)'|(api\.[\w.]+\.path))/g;
    for (const m of src.matchAll(direct)) {
      const literal = m[2] ?? m[3];
      const resolved = literal ?? (m[4] ? resolveApiPath(m[4]) : null);
      if (resolved) add(m[1].toUpperCase(), resolved);
    }
    // Route factories: ncdRoute("/api/x", ...) registers GET + POST;
    // surveillancePatchRoute("/api/x", ...) registers PATCH /api/x/:id/status.
    for (const m of src.matchAll(/\bncdRoute\(\s*"([^"]+)"/g)) {
      add("GET", m[1]);
      add("POST", m[1]);
    }
    for (const m of src.matchAll(/\bsurveillancePatchRoute\(\s*"([^"]+)"/g)) {
      add("PATCH", `${m[1]}/1/status`);
    }
  }
  return [...found.values()].sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}

// Mirrors PUBLIC_ROUTES in server/middleware/rbac.ts. If you add a route
// here you are declaring that it is safe for the whole internet to call.
const PUBLIC = new Set([
  "GET /api/health",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/auth/me",
  "GET /api/theme-settings",
  "POST /api/auth/mfa/verify",
]);
const VIEW_ONLY_WRITE_PREFIXES = ["/api/auth/", "/api/dm/", "/api/general-chat/", "/api/recommendations/log", "/api/recommendations/plain-language"];
const PASSWORD_CHANGE_ALLOWED = new Set(["GET /api/auth/me", "PUT /api/auth/me/password", "POST /api/auth/logout", "GET /api/theme-settings"]);

const routes = discoverRoutes();

// --- fixtures ------------------------------------------------------------------

const BARANGAY_A = "Amoslog";
const BARANGAY_B = "Anislagan";

const names = {
  admin: `sec_admin_${RUN}`,
  mho: `sec_mho_${RUN}`,
  tlA: `sec_tl_a_${RUN}`,
  tlB: `sec_tl_b_${RUN}`,
  mayor: `sec_mayor_${RUN}`,
  mustChange: `sec_mustchange_${RUN}`,
  defaultPw: `sec_default_${RUN}`,
  weakPw: `sec_weak_${RUN}`,
  lock: `sec_lock_${RUN}`,
  mfa: `sec_mfa_${RUN}`,
  mfaLock: `sec_mfa_lock_${RUN}`,
  mfaAdmin: `sec_mfa_admin_${RUN}`,
  disabled: `sec_disabled_${RUN}`,
  tlNone: `sec_tl_none_${RUN}`,
  race: `sec_race_${RUN}`,
};
const ids: Record<string, string> = {};
const seeded = { motherB: 0, seniorB: 0, diseaseB: 0, rabiesB: 0, smsB: 0, walkInB: 0, motherA: 0, childA: 0, childB: 0, seniorA: 0, seniorC: 0 };
const barangayIds: Record<string, number> = {};

async function createUser(
  username: string,
  role: string,
  opts: { password?: string; barangay?: string; mustChange?: boolean; status?: string } = {},
) {
  const hash = await hashPassword(opts.password ?? STRONG_PASSWORD);
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, role, status, must_change_password)
     VALUES ($1, $2, 'Security', 'Test', $3, $4, $5) RETURNING id`,
    [username, hash, role, opts.status ?? "ACTIVE", opts.mustChange ?? false],
  );
  const id = rows[0].id as string;
  if (opts.barangay) {
    await pool.query(
      `INSERT INTO user_barangays (user_id, barangay_id) SELECT $1, id FROM barangays WHERE name = $2`,
      [id, opts.barangay],
    );
  }
  return id;
}

// --- two-step sign-in helpers ----------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Authenticator "apps" held by the test, keyed by username. */
const authenticators = new Map<string, { secret: string; lastStep: number }>();
/** Sessions of accounts that use two-step sign-in are reused: each sign-in spends a 30-second code. */
const mfaSessions = new Map<string, Client>();

/** A code the server has not seen yet. Waits for the next 30-second step if it has to. */
async function nextCode(username: string): Promise<string> {
  const app = authenticators.get(username);
  assert.ok(app, `no authenticator enrolled for ${username}`);
  const step = Math.max(totpStep(), app.lastStep + 1);
  while (step > totpStep() + 1) await sleep(1000); // server accepts up to one step ahead
  app.lastStep = step;
  return totpCode(app.secret, step);
}

/** Enrols the signed-in client in two-step sign-in; returns the recovery codes. */
async function enrol(c: Client, username: string, password = STRONG_PASSWORD): Promise<string[]> {
  const setup = await c.post("/api/auth/mfa/setup", { currentPassword: password });
  assert.equal(setup.status, 200, setup.text);
  authenticators.set(username, { secret: setup.json.secret, lastStep: 0 });
  const enable = await c.post("/api/auth/mfa/enable", { code: await nextCode(username) });
  assert.equal(enable.status, 200, enable.text);
  return enable.json.recoveryCodes;
}

/**
 * A signed-in client. Handles both ways the server may involve two-step
 * sign-in: asking for a code (account already enrolled) and demanding
 * enrolment (role listed in MFA_REQUIRED_ROLES, the default for admins).
 */
async function session(username: string, password = STRONG_PASSWORD): Promise<Client> {
  const cached = mfaSessions.get(username);
  if (cached && (await cached.get("/api/auth/me")).status === 200) return cached;

  const c = new Client();
  let res = await c.login(username, password);
  assert.equal(res.status, 200, `login as ${username} failed: ${res.text}`);
  if (res.json.mfaRequired) {
    res = await c.post("/api/auth/mfa/verify", { code: await nextCode(username) });
    assert.equal(res.status, 200, `second step for ${username} failed: ${res.text}`);
    mfaSessions.set(username, c);
  } else if (res.json.mustEnrollMfa) {
    await enrol(c, username, password);
    mfaSessions.set(username, c);
  }
  return c;
}

before(async () => {
  const health = await fetch(BASE_URL + "/api/health").catch(() => null);
  assert.ok(health?.ok, `No server answering at ${BASE_URL}. Start it first (see the top of this file).`);

  ids.admin = await createUser(names.admin, "SYSTEM_ADMIN");
  ids.mho = await createUser(names.mho, "MHO");
  ids.tlA = await createUser(names.tlA, "TL", { barangay: BARANGAY_A });
  ids.tlB = await createUser(names.tlB, "TL", { barangay: BARANGAY_B });
  ids.mayor = await createUser(names.mayor, "MAYOR");
  ids.mustChange = await createUser(names.mustChange, "TL", { barangay: BARANGAY_A, mustChange: true });
  ids.defaultPw = await createUser(names.defaultPw, "TL", { barangay: BARANGAY_A, password: "123456" });
  ids.weakPw = await createUser(names.weakPw, "TL", { barangay: BARANGAY_A, password: "oldpass99" });
  ids.lock = await createUser(names.lock, "TL", { barangay: BARANGAY_A });
  ids.disabled = await createUser(names.disabled, "TL", { barangay: BARANGAY_A, status: "DISABLED" });
  ids.mfa = await createUser(names.mfa, "MHO");
  ids.mfaLock = await createUser(names.mfaLock, "MHO");
  ids.mfaAdmin = await createUser(names.mfaAdmin, "SYSTEM_ADMIN");
  ids.tlNone = await createUser(names.tlNone, "TL"); // a Team Leader with NO barangays
  ids.race = await createUser(names.race, "TL", { barangay: BARANGAY_A });
  for (const row of (await pool.query(`SELECT id, name FROM barangays WHERE name = ANY($1)`, [[BARANGAY_A, BARANGAY_B]])).rows) {
    barangayIds[row.name] = row.id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const one = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0].id as number;
  seeded.motherB = await one(
    `INSERT INTO mothers (first_name, last_name, age, barangay, registration_date, ga_weeks)
     VALUES ($1, 'Mother-B', 30, $2, $3, 20) RETURNING id`, [TAG, BARANGAY_B, today]);
  seeded.motherA = await one(
    `INSERT INTO mothers (first_name, last_name, age, barangay, registration_date, ga_weeks)
     VALUES ($1, 'Mother-A', 30, $2, $3, 20) RETURNING id`, [TAG, BARANGAY_A, today]);
  seeded.seniorB = await one(
    `INSERT INTO seniors (first_name, last_name, age, barangay) VALUES ($1, 'Senior-B', 70, $2) RETURNING id`,
    [TAG, BARANGAY_B]);
  seeded.seniorA = await one(
    `INSERT INTO seniors (first_name, last_name, age, barangay, senior_unique_id) VALUES ($1, 'Senior-A', 70, $2, $3) RETURNING id`,
    [TAG, BARANGAY_A, `SEC-A-${RUN}`]);
  await pool.query(`UPDATE seniors SET senior_unique_id = $1 WHERE id = $2`, [`SEC-B-${RUN}`, seeded.seniorB]);
  seeded.seniorC = await one(
    `INSERT INTO seniors (first_name, last_name, age, barangay, senior_unique_id) VALUES ($1, 'Senior-C', 70, $2, $3) RETURNING id`,
    [TAG, BARANGAY_B, `SEC-C-${RUN}`]);
  seeded.childA = await one(
    `INSERT INTO children (name, dob, barangay) VALUES ($1, '2024-01-01', $2) RETURNING id`, [`${TAG} Child-A`, BARANGAY_A]);
  seeded.childB = await one(
    `INSERT INTO children (name, dob, barangay) VALUES ($1, '2024-01-01', $2) RETURNING id`, [`${TAG} Child-B`, BARANGAY_B]);
  seeded.diseaseB = await one(
    `INSERT INTO disease_cases (patient_name, age, barangay, condition, date_reported)
     VALUES ($1, 40, $2, 'Dengue', $3) RETURNING id`, [TAG, BARANGAY_B, today]);
  seeded.rabiesB = await one(
    `INSERT INTO rabies_exposures (patient_name, barangay, dob, sex, exposure_date, category)
     VALUES ($1, $2, '1990-01-01', 'F', $3, 'II') RETURNING id`, [TAG, BARANGAY_B, today]);
  seeded.smsB = await one(
    `INSERT INTO sms_outbox (recipient, recipient_phone, message, sent_at, barangay)
     VALUES ($1, '09170000000', 'security test message', $2, $3) RETURNING id`, [TAG, new Date().toISOString(), BARANGAY_B]);
  // Stock and staff, for the "nurses see only their own barangays" checks.
  for (const b of [BARANGAY_A, BARANGAY_B]) {
    await pool.query(`INSERT INTO inventory (barangay, last_updated) VALUES ($1, $2)`, [b, `${TAG}`]);
    await pool.query(`INSERT INTO medicine_inventory (barangay, medicine_name, last_updated) VALUES ($1, $2, $3)`, [b, `${TAG} ${b}`, today]);
    await pool.query(
      `INSERT INTO inventory_snapshots (barangay, snapshot_date, item_type, item_key) VALUES ($1, $2, 'vaccine', 'bcg')`, [b, `${TAG}`]);
    await pool.query(
      `INSERT INTO workforce_members (full_name, profession, employment_status, barangay) VALUES ($1, 'Nurse', 'REGULAR', $2)`, [`${TAG} ${b}`, b]);
  }
  await pool.query(
    `INSERT INTO workforce_members (full_name, profession, employment_status, barangay) VALUES ($1, 'Physician', 'REGULAR', NULL)`, [`${TAG} RHU`]);
  await pool.query(
    `INSERT INTO disease_cases (patient_name, age, barangay, condition, date_reported) VALUES ($1, 30, $2, $3, $4)`,
    [TAG, BARANGAY_B, `Condition-only-in-B-${RUN}`, today]);
  seeded.walkInB = await one(
    `INSERT INTO consults (patient_name, age, sex, barangay, consult_date, chief_complaint, diagnosis, created_at, is_walk_in)
     VALUES ($1, 40, 'F', $2, $3, 'test', 'test', $4, true) RETURNING id`, [TAG, BARANGAY_B, today, new Date().toISOString()]);
});

after(async () => {
  const userIds = Object.values(ids);
  await pool.query(`DELETE FROM sessions WHERE sess->>'userId' = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM senior_med_claims WHERE senior_id = ANY($1)`, [[seeded.seniorA, seeded.seniorB, seeded.seniorC]]);
  await pool.query(`DELETE FROM children WHERE name LIKE $1`, [`${TAG}%`]); // cascades to nutrition follow-ups
  await pool.query(
    `DELETE FROM m1_indicator_values WHERE report_instance_id IN (SELECT id FROM m1_report_instances WHERE created_by_user_id = ANY($1))`,
    [userIds]);
  await pool.query(`DELETE FROM m1_report_instances WHERE created_by_user_id = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM mothers WHERE first_name = $1`, [TAG]);
  await pool.query(`DELETE FROM seniors WHERE first_name = $1`, [TAG]);
  await pool.query(`DELETE FROM disease_cases WHERE patient_name = $1`, [TAG]);
  await pool.query(`DELETE FROM rabies_exposures WHERE patient_name = $1`, [TAG]);
  await pool.query(`DELETE FROM sms_outbox WHERE recipient = $1`, [TAG]);
  await pool.query(`DELETE FROM consults WHERE patient_name = $1`, [TAG]);
  await pool.query(`DELETE FROM inventory WHERE last_updated = $1`, [TAG]);
  await pool.query(`DELETE FROM medicine_inventory WHERE medicine_name LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM inventory_snapshots WHERE snapshot_date = $1`, [TAG]);
  await pool.query(`DELETE FROM workforce_members WHERE full_name LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM medical_certificates WHERE patient_name LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`sec\\_%\\_${RUN}%`]);
  await pool.query(`DELETE FROM audit_logs WHERE user_id = ANY($1) OR entity_id = ANY($1)`, [userIds]);
  await pool.end();
});

// --- 1. deny by default --------------------------------------------------------

describe("deny by default", () => {
  test("route discovery found the API surface", () => {
    assert.ok(routes.length > 150, `only found ${routes.length} routes; the scanner is probably broken`);
  });

  test("every API route refuses a request with no session", async () => {
    const anonymous = new Client();
    const open: string[] = [];
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      if (PUBLIC.has(key)) continue;
      const res = await anonymous.request(r.method, r.path, r.method === "GET" ? undefined : {});
      if (res.status !== 401) open.push(`${key} -> ${res.status}`);
    }
    assert.deepEqual(open, [], "these routes answered an anonymous request with something other than 401");
  });

  test("unknown API paths are not served to anonymous users", async () => {
    const res = await new Client().get("/api/this-does-not-exist");
    assert.equal(res.status, 401);
  });

  test("self-registration no longer exists", async () => {
    const res = await new Client().post("/api/auth/register", { username: "x", password: STRONG_PASSWORD });
    assert.ok(res.status === 401 || res.status === 404, `got ${res.status}`);
  });

  test("view-only roles cannot call any write endpoint", async () => {
    const mayor = await session(names.mayor);
    const allowed: string[] = [];
    for (const r of routes) {
      if (r.method === "GET") continue;
      if (VIEW_ONLY_WRITE_PREFIXES.some((p) => r.path.startsWith(p))) continue;
      const res = await mayor.request(r.method, r.path, {});
      if (res.status !== 403) allowed.push(`${r.method} ${r.path} -> ${res.status}`);
    }
    assert.deepEqual(allowed, [], "a view-only account was not refused on these write endpoints");
  });

  test("an account that must change its password can do nothing else", async () => {
    const c = await session(names.mustChange);
    const leaked: string[] = [];
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      if (PASSWORD_CHANGE_ALLOWED.has(key) || PUBLIC.has(key)) continue;
      const res = await c.request(r.method, r.path, r.method === "GET" ? undefined : {});
      if (res.status !== 403 || res.json?.code !== "PASSWORD_CHANGE_REQUIRED") leaked.push(`${key} -> ${res.status}`);
    }
    assert.deepEqual(leaked, []);
  });
});

// --- 2. barangay isolation -------------------------------------------------------

describe("a Team Leader is confined to their assigned barangays", () => {
  let tlA: Client;
  before(async () => { tlA = await session(names.tlA); });

  const denied = async (label: string, res: { status: number; text: string }) => {
    assert.equal(res.status, 403, `${label}: expected 403, got ${res.status} ${res.text.slice(0, 120)}`);
  };

  // Positive controls: without these, a server that refused EVERYTHING
  // would pass every "is denied" test below.
  test("can read and edit patients in their own barangay", async () => {
    const read = await tlA.get(`/api/mothers/${seeded.motherA}`);
    assert.equal(read.status, 200);
    const edit = await tlA.put(`/api/mothers/${seeded.motherA}`, { lastName: "Mother-A-edited" });
    assert.equal(edit.status, 200, edit.text);
    assert.equal(edit.json.lastName, "Mother-A-edited");
    const visits = await tlA.get(`/api/nurse-visits/mother/${seeded.motherA}`);
    assert.equal(visits.status, 200);
    const exportOwn = await tlA.get(`/api/nutrition-followups/export.csv?barangay=${encodeURIComponent(BARANGAY_A)}`);
    assert.equal(exportOwn.status, 200);
  });

  test("a municipality-wide role can read every barangay", async () => {
    const mho = await session(names.mho);
    assert.equal((await mho.get(`/api/mothers/${seeded.motherB}`)).status, 200);
    assert.equal((await mho.get(`/api/mothers/${seeded.motherA}`)).status, 200);
  });

  test("cannot read another barangay's patient", async () => {
    await denied("mother", await tlA.get(`/api/mothers/${seeded.motherB}`));
    await denied("senior", await tlA.get(`/api/seniors/${seeded.seniorB}`));
    await denied("disease case", await tlA.get(`/api/disease-cases/${seeded.diseaseB}`));
    await denied("linked encounters", await tlA.get(`/api/patients/mother/${seeded.motherB}/linked-encounters`));
    await denied("nurse visits", await tlA.get(`/api/nurse-visits/mother/${seeded.motherB}`));
    await denied("postpartum visits", await tlA.get(`/api/postpartum-visits?motherId=${seeded.motherB}`));
    await denied("medication claims", await tlA.get(`/api/senior-med-claims?seniorId=${seeded.seniorB}`));
    await denied("walk-in dispenses", await tlA.get(`/api/walk-ins/${seeded.walkInB}/dispenses`));
  });

  test("lists never include another barangay's records", async () => {
    await denied("explicit other barangay", await tlA.get(`/api/mothers?barangay=${encodeURIComponent(BARANGAY_B)}`));
    const own = await tlA.get(`/api/mothers?barangay=${encodeURIComponent(BARANGAY_A)}`);
    assert.equal(own.status, 200);
    assert.ok(own.json.every((m: any) => m.barangay === BARANGAY_A));
    const sms = await tlA.get("/api/sms");
    assert.equal(sms.status, 200);
    assert.ok(!sms.json.some((m: any) => m.id === seeded.smsB), "SMS for another barangay was visible");
    const search = await tlA.get(`/api/patients/search?q=${TAG}`);
    assert.equal(search.status, 200);
    assert.ok(!JSON.stringify(search.json).includes("Mother-B"), "patient search leaked another barangay");
  });

  test("cannot edit another barangay's patient, and the record is unchanged", async () => {
    await denied("mother update", await tlA.put(`/api/mothers/${seeded.motherB}`, { lastName: "HACKED" }));
    await denied("senior update", await tlA.put(`/api/seniors/${seeded.seniorB}`, { lastName: "HACKED" }));
    await denied("disease update", await tlA.put(`/api/disease-cases/${seeded.diseaseB}`, { notes: "HACKED" }));
    await denied("surveillance status", await tlA.patch(`/api/rabies-exposures/${seeded.rabiesB}/status`, { status: "CLOSED" }));

    const { rows } = await pool.query(
      `SELECT (SELECT last_name FROM mothers WHERE id = $1) AS mother,
              (SELECT last_name FROM seniors WHERE id = $2) AS senior,
              (SELECT status FROM rabies_exposures WHERE id = $3) AS rabies`,
      [seeded.motherB, seeded.seniorB, seeded.rabiesB],
    );
    assert.equal(rows[0].mother, "Mother-B");
    assert.equal(rows[0].senior, "Senior-B");
    assert.notEqual(rows[0].rabies, "CLOSED", "status was changed before the barangay check ran");
  });

  test("cannot move their own patient into another barangay", async () => {
    await denied("move", await tlA.put(`/api/mothers/${seeded.motherA}`, { barangay: BARANGAY_B }));
  });

  test("cannot create records or pull exports for another barangay", async () => {
    await denied("medication claim", await tlA.post("/api/senior-med-claims", {
      seniorId: seeded.seniorB, claimedBarangayId: 1, medicationName: "Amlodipine", quantity: 30,
    }));
    await denied("nutrition export", await tlA.get(`/api/nutrition-followups/export.csv?barangay=${encodeURIComponent(BARANGAY_B)}`));
    await denied("triage context", await tlA.get(`/api/walk-ins/triage-context?name=test&barangay=${encodeURIComponent(BARANGAY_B)}`));
    await denied("cluster hint", await tlA.get(`/api/recommendations/cluster-hint?module=rabies&entityId=1&barangay=${encodeURIComponent(BARANGAY_B)}`));
    await denied("sms for other barangay", await tlA.post("/api/sms", {
      recipient: TAG, recipientPhone: "09170000000", message: "x", sentAt: new Date().toISOString(), barangay: BARANGAY_B,
    }));
  });

  test("stock, staff and analytics are limited to their barangays too", async () => {
    const enc = encodeURIComponent;
    // Vaccine and medicine stock.
    const stock = await tlA.get("/api/inventory");
    assert.equal(stock.status, 200);
    assert.ok(stock.json.length > 0 && stock.json.every((r: any) => r.barangay === BARANGAY_A), "vaccine stock of another barangay was listed");
    await denied("vaccine stock, other barangay", await tlA.get(`/api/inventory?barangay=${enc(BARANGAY_B)}`));

    const meds = await tlA.get("/api/medicine-inventory");
    assert.ok(meds.json.length > 0 && meds.json.every((r: any) => r.barangay === BARANGAY_A), "medicine stock of another barangay was listed");
    const otherMed = (await pool.query(`SELECT id FROM medicine_inventory WHERE medicine_name = $1`, [`${TAG} ${BARANGAY_B}`])).rows[0].id;
    await denied("medicine item, other barangay", await tlA.get(`/api/medicine-inventory/${otherMed}`));

    await denied("stock history, other barangay", await tlA.get(`/api/inventory/snapshots?itemType=vaccine&itemKey=bcg&barangay=${enc(BARANGAY_B)}`));
    const history = await tlA.get("/api/inventory/snapshots?itemType=vaccine&itemKey=bcg");
    assert.ok(history.json.every((r: any) => r.barangay === BARANGAY_A), "stock history of another barangay was listed");

    // Staff: own barangay only; municipal-level staff (no barangay) are not listed.
    const staff = await tlA.get("/api/workforce");
    const names: string[] = staff.json.map((m: any) => m.fullName);
    assert.ok(names.includes(`${TAG} ${BARANGAY_A}`));
    assert.ok(!names.includes(`${TAG} ${BARANGAY_B}`) && !names.includes(`${TAG} RHU`), "staff outside the nurse's barangays were listed");
    const rhuStaff = (await pool.query(`SELECT id FROM workforce_members WHERE full_name = $1`, [`${TAG} RHU`])).rows[0].id;
    await denied("municipal staff record", await tlA.get(`/api/workforce/${rhuStaff}`));

    // Municipality-wide analytics.
    for (const p of ["/api/ai/insights", "/api/ai/risk-analysis", "/api/ai/insights/stream"]) {
      await denied(p, await tlA.get(p));
    }

    // Values derived from other barangays' records.
    const conditions = await tlA.get("/api/disease-conditions");
    assert.ok(!conditions.json.includes(`Condition-only-in-B-${RUN}`), "a condition recorded only in another barangay was listed");
    await denied("barangay settings", await tlA.get(`/api/barangay-settings/${barangayIds[BARANGAY_B]}`));
    assert.equal((await tlA.get(`/api/barangay-settings/${barangayIds[BARANGAY_A]}`)).status, 200);
  });

  test("municipality-wide roles still see every barangay's stock, staff and analytics", async () => {
    const mho = await session(names.mho);
    const stock = await mho.get("/api/inventory");
    const seen = new Set(stock.json.map((r: any) => r.barangay));
    assert.ok(seen.has(BARANGAY_A) && seen.has(BARANGAY_B));
    const staff = await mho.get("/api/workforce");
    assert.ok(staff.json.some((m: any) => m.fullName === `${TAG} RHU`));
    assert.equal((await mho.get("/api/ai/risk-analysis")).status, 200);
    const conditions = await mho.get("/api/disease-conditions");
    assert.ok(conditions.json.includes(`Condition-only-in-B-${RUN}`));
  });

  test("a claim made elsewhere blocks a duplicate without saying where", async () => {
    // A senior claims in barangay B (recorded by the MHO)...
    const mho = await session(names.mho);
    const claim = await mho.post("/api/senior-med-claims", {
      seniorId: seeded.seniorC, claimedBarangayId: barangayIds[BARANGAY_B], medicationName: "Losartan", quantity: 30,
    });
    assert.equal(claim.status, 201, claim.text);
    // ...a nurse from barangay A is told "already claimed", but not the barangay.
    const check = await tlA.get(`/api/senior-med-claims/check-eligibility/SEC-C-${RUN}`);
    assert.equal(check.json.eligible, false);
    assert.ok(!check.json.reason.includes(BARANGAY_B), `the reason named the other barangay: ${check.json.reason}`);
    const forMho = await mho.get(`/api/senior-med-claims/check-eligibility/SEC-C-${RUN}`);
    assert.ok(forMho.json.reason.includes(BARANGAY_B), "municipal roles still see where");
  });

  test("cannot reach administration", async () => {
    for (const p of ["/api/admin/users", "/api/admin/audit-logs", "/api/consults", "/api/reports/_registry"]) {
      await denied(p, await tlA.get(p));
    }
    await denied("create user", await tlA.post("/api/admin/users", { username: "evil", password: STRONG_PASSWORD, role: "SYSTEM_ADMIN" }));
    await denied("theme", await tlA.put("/api/theme-settings", { lguName: "HACKED" }));
  });
});

// --- 2b. the check and the effect must be about the same record --------------------
//
// Each of these was a real hole: access was checked on one field of the
// request while the write (or the computation) used another.

describe("authorisation follows the record, not the request", () => {
  let tlA: Client;
  before(async () => { tlA = await session(names.tlA); });

  test("a Team Leader with no barangays finds no patients", async () => {
    const c = await session(names.tlNone);
    const res = await c.get(`/api/patients/search?q=${TAG.slice(0, 4)}&limit=25`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, []);
    assert.deepEqual((await c.get("/api/mothers")).json, []);
  });

  test("an account cannot be made a Team Leader without barangays", async () => {
    const admin = await session(names.admin);
    const res = await admin.put(`/api/admin/users/${ids.mho}`, { role: "TL" });
    assert.equal(res.status, 400, res.text);
  });

  test("a nutrition follow-up takes its barangay from the child", async () => {
    const body = { followUpDate: "2026-01-15", classification: "MAM", actions: [] };
    const forged = await tlA.post("/api/nutrition-followups", { ...body, childId: seeded.childB, barangay: BARANGAY_A });
    assert.equal(forged.status, 403, "a follow-up was attached to another barangay's child");

    // Own child, but claiming another barangay: stored under the child's.
    const own = await tlA.post("/api/nutrition-followups", { ...body, childId: seeded.childA, barangay: BARANGAY_B, notes: "=HYPERLINK(1)" });
    assert.equal(own.status, 201, own.text);
    assert.equal(own.json.barangay, BARANGAY_A);

    const move = await tlA.put(`/api/nutrition-followups/${own.json.id}`, { barangay: BARANGAY_B, childId: seeded.childB, recordedBy: "someone.else" });
    assert.equal(move.status, 400, "identity fields must not be editable");
    const { rows } = await pool.query(`SELECT barangay, child_id, recorded_by FROM nutrition_followups WHERE id = $1`, [own.json.id]);
    assert.equal(rows[0].barangay, BARANGAY_A);
    assert.equal(rows[0].child_id, seeded.childA);
    assert.notEqual(rows[0].recorded_by, "someone.else");
  });

  test("exported free text cannot run as a spreadsheet formula", async () => {
    const res = await tlA.get(`/api/nutrition-followups/export.csv?barangay=${encodeURIComponent(BARANGAY_A)}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes("'=HYPERLINK(1)"), "formula cell was not neutralised");
    assert.ok(!/(^|,)=HYPERLINK/m.test(res.text));
  });

  test("an M1 report's barangay name always matches its barangay id", async () => {
    const noBarangay = await tlA.post("/api/m1/reports", { templateVersionId: 1, month: 1, year: 2031 });
    assert.equal(noBarangay.status, 403, "a TL created a municipality-wide report");

    const created = await tlA.post("/api/m1/reports", {
      templateVersionId: 1, barangayId: barangayIds[BARANGAY_A], barangayName: BARANGAY_B, month: 1, year: 2031,
    });
    // 201 normally; anything else means the template is not seeded here.
    if (created.status === 201) {
      assert.equal(created.json.barangayName, BARANGAY_A, "caller-supplied barangay name was stored");
    } else {
      assert.ok(created.status < 500, created.text);
    }

    const imported = await tlA.post("/api/m1/bulk-import", {
      barangayId: barangayIds[BARANGAY_A], barangayName: BARANGAY_B, month: 2, year: 2031,
      values: [{ rowKey: "SEC-TEST", valueNumber: 1 }],
    });
    if (imported.status === 200) {
      const { rows } = await pool.query(`SELECT barangay_name FROM m1_report_instances WHERE id = $1`, [imported.json.reportId]);
      assert.equal(rows[0].barangay_name, BARANGAY_A, "bulk import stored a caller-supplied barangay name");
    } else {
      assert.ok(imported.status < 500, imported.text);
    }

    const other = await tlA.post("/api/m1/bulk-import", {
      barangayId: barangayIds[BARANGAY_B], month: 2, year: 2031, values: [{ rowKey: "SEC-TEST", valueNumber: 1 }],
    });
    assert.equal(other.status, 403);
  });

  test("a medication claim is filed against the senior it names, nobody else", async () => {
    const res = await tlA.post("/api/senior-med-claims", {
      seniorId: seeded.seniorA,
      seniorUniqueId: `SEC-B-${RUN}`,            // someone else's unique id
      claimedBarangayId: barangayIds[BARANGAY_B], // somewhere else
      claimedBarangayName: BARANGAY_B,
      medicationName: "Amlodipine", quantity: 30,
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.seniorUniqueId, `SEC-A-${RUN}`);
    assert.equal(res.json.claimedBarangayName, BARANGAY_A);

    const victim = await tlA.get(`/api/senior-med-claims/check-eligibility/SEC-B-${RUN}`);
    assert.equal(victim.json.eligible, true, "another senior was blocked from claiming");
    const self = await tlA.get(`/api/senior-med-claims/check-eligibility/SEC-A-${RUN}`);
    assert.equal(self.json.eligible, false);
    assert.ok(!("lastClaim" in self.json), "eligibility check returned the full claim row");
  });

  test("editing one field of a record leaves its other fields alone", async () => {
    // zod 4's partial() fills in defaults for fields that were not sent; an
    // update built on it would erase them. See shared/patch.ts.
    const { rows } = await pool.query(
      `INSERT INTO disease_cases (patient_name, age, barangay, condition, date_reported, additional_conditions)
       VALUES ($1, 40, $2, 'Dengue', '2031-01-10', '["Tuberculosis","HIV"]'::jsonb) RETURNING id`,
      [TAG, BARANGAY_A]);
    const id = rows[0].id;
    const res = await tlA.put(`/api/disease-cases/${id}`, { notes: "follow-up done" });
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.json.additionalConditions, ["Tuberculosis", "HIV"], "co-conditions were erased by an unrelated edit");
    assert.equal(res.json.notes, "follow-up done");

    const followUp = await tlA.post("/api/nutrition-followups", {
      childId: seeded.childA, barangay: BARANGAY_A, followUpDate: "2031-01-16", classification: "MAM", actions: ["ENROLL_OTC"],
    });
    if (followUp.status === 201) {
      const edited = await tlA.put(`/api/nutrition-followups/${followUp.json.id}`, { notes: "weighed again" });
      assert.equal(edited.status, 200, edited.text);
      assert.deepEqual(edited.json.actions, ["ENROLL_OTC"], "actions were erased by an unrelated edit");
    } else {
      assert.equal(followUp.status, 400, followUp.text); // action name not valid in this build
    }
  });

  test("a certificate can only name a real physician account as its signer", async () => {
    const cert = {
      certType: "SCHOOL", patientName: `${TAG} Cert`, barangay: BARANGAY_A,
      issueDate: "2031-01-15", purpose: "security test",
    };
    const signers = await tlA.get("/api/certificates/signers");
    assert.equal(signers.status, 200);
    assert.ok(signers.json.some((s: any) => s.id === ids.mho), "the MHO account is offered as a signer");
    assert.ok(!signers.json.some((s: any) => s.id === ids.tlA), "a nurse is not offered as a signer");

    // The old hole: type any name you like.
    const typed = await tlA.post("/api/certificates", { ...cert, signedByName: "Dr. Somebody Important" });
    assert.equal(typed.status, 400, "a certificate was issued with a typed-in signer name");
    const selfSigned = await tlA.post("/api/certificates", { ...cert, signedByUserId: ids.tlA });
    assert.equal(selfSigned.status, 400, "a nurse named themselves as the signing physician");

    const ok = await tlA.post("/api/certificates", { ...cert, signedByUserId: ids.mho, signedByName: "Dr. Forged Name" });
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.json.signedByUserId, ids.mho);
    assert.equal(ok.json.signedByName, "Security Test", "the printed name comes from the signer's account");
    assert.equal(ok.json.encodedByUserId, ids.tlA, "who typed it in is recorded");

    const pdf = await tlA.get(`/api/certificates/${ok.json.id}/pdf`);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
  });

  test("plain-language summaries are only generated for real rules", async () => {
    const unknown = await tlA.post("/api/recommendations/plain-language", {
      ruleId: "not-a-real-rule", title: "x", bullets: ["attacker supplied clinical advice"],
    });
    assert.equal(unknown.status, 404);
    const real = await tlA.post("/api/recommendations/plain-language", {
      ruleId: "rabies-cat-iii-pep", title: "ignored", bullets: ["ignored"],
    });
    assert.equal(real.status, 200);
  });

  test("replacing the seniors registry is System Admin only and validated", async () => {
    const mho = await session(names.mho);
    const row = { firstName: TAG, lastName: "Bulk", age: 70, barangay: BARANGAY_A };
    assert.equal((await mho.post("/api/seniors/bulk-import", { rows: [row], replace: true })).status, 403);
    assert.equal((await mho.post("/api/seniors/bulk-import", { rows: [{ firstName: 1 }] })).status, 400);
    const admin = await session(names.admin);
    assert.equal((await admin.post("/api/seniors/bulk-import", { rows: [], replace: true })).status, 400);
  });

  test("anonymous clients cannot make the server parse a large body", async () => {
    const res = await fetch(BASE_URL + "/api/seniors/bulk-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [], pad: "x".repeat(3 * 1024 * 1024) }),
    });
    assert.equal(res.status, 401);
  });
});

// --- 3. login and sessions -------------------------------------------------------

describe("login and sessions", () => {
  test("wrong password and unknown user get the same answer", async () => {
    const a = await new Client().login(names.admin, "definitely-not-the-password");
    const b = await new Client().login(`nobody_${RUN}`, "definitely-not-the-password");
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(a.json, b.json);
  });

  test("an account on a built-in default password is refused", async () => {
    const res = await new Client().login(names.defaultPw, "123456");
    assert.equal(res.status, 403);
    assert.equal(res.json.statusCode, "DEFAULT_PASSWORD");
  });

  test("an old weak password logs in but must be changed immediately", async () => {
    const c = new Client();
    const res = await c.login(names.weakPw, "oldpass99");
    assert.equal(res.status, 200);
    assert.equal(res.json.mustChangePassword, true);
    assert.equal((await c.get("/api/mothers")).status, 403);
  });

  test("a disabled account cannot log in", async () => {
    const res = await new Client().login(names.disabled, STRONG_PASSWORD);
    assert.equal(res.status, 403);
  });

  test("repeated wrong passwords lock the account, even for the right password", async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await new Client().login(names.lock, `wrong-${i}`)).status, 401);
    }
    const res = await new Client().login(names.lock, STRONG_PASSWORD);
    assert.equal(res.status, 429);
    assert.equal(res.json.statusCode, "LOCKED");
  });

  test("unknown usernames lock exactly like real ones (no username probing)", async () => {
    const ghost = `sec_ghost_${RUN}`;
    for (let i = 0; i < 5; i++) {
      assert.equal((await new Client().login(ghost, `wrong-${i}`)).status, 401);
    }
    const res = await new Client().login(ghost, "anything");
    assert.equal(res.status, 429);
    assert.equal(res.json.statusCode, "LOCKED");
  });

  test("parallel guesses cannot slip past the lockout", async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => new Client().login(names.race, `guess-${i}`)));
    // Compared inside the database: these columns hold UTC without a zone.
    const { rows } = await pool.query(
      `SELECT locked_until > (now() AT TIME ZONE 'utc') AS locked FROM users WHERE id = $1`, [ids.race]);
    assert.equal(rows[0].locked, true, "account was not locked after 12 parallel failures");
  });

  test("the session id changes at login (no session fixation)", async () => {
    const c = new Client();
    c.cookie = "hs.sid=s%3Aattacker-chosen-value.invalidsignature";
    const res = await c.login(names.mho, STRONG_PASSWORD);
    assert.equal(res.status, 200);
    assert.ok(c.cookie.startsWith("hs.sid=") && !c.cookie.includes("attacker-chosen-value"));
  });

  test("the session cookie is HttpOnly and SameSite", async () => {
    const res = await new Client().login(names.mho, STRONG_PASSWORD);
    const cookie = res.setCookie.find((c) => c.startsWith("hs.sid=")) ?? "";
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });

  test("logout ends the session on the server", async () => {
    const c = await session(names.mho);
    const stolen = c.cookie;
    assert.equal((await c.post("/api/auth/logout")).status, 200);
    const replay = new Client();
    replay.cookie = stolen;
    assert.equal((await replay.get("/api/mothers")).status, 401);
  });

  test("changing a password enforces the policy and signs out other devices", async () => {
    const username = `sec_pw_${RUN}`;
    ids.pw = await createUser(username, "MHO");
    const laptop = await session(username);
    const phone = await session(username);

    const weak = await laptop.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword: "short" });
    assert.equal(weak.status, 400);
    const common = await laptop.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword: "password123456" });
    assert.equal(common.status, 400);
    const hasName = await laptop.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword: `${username}-2026!` });
    assert.equal(hasName.status, 400);
    const wrongCurrent = await laptop.put("/api/auth/me/password", { currentPassword: "nope", newPassword: "a-brand-new-passphrase-77" });
    assert.equal(wrongCurrent.status, 400);

    const ok = await laptop.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword: "a-brand-new-passphrase-77" });
    assert.equal(ok.status, 200);
    assert.equal((await laptop.get("/api/auth/me")).status, 200, "the device that changed the password stays signed in");
    assert.equal((await phone.get("/api/auth/me")).status, 401, "other devices must be signed out");
    assert.equal((await new Client().login(username, STRONG_PASSWORD)).status, 401, "old password must stop working");
  });
});

// --- 3b. two-step sign-in ---------------------------------------------------------

describe("two-step sign-in", () => {
  let recoveryCodes: string[] = [];

  test("setting it up needs the password and a correct first code", async () => {
    const c = await session(names.mfa);
    assert.equal((await c.post("/api/auth/mfa/setup", { currentPassword: "wrong-password" })).status, 400);
    assert.equal((await c.post("/api/auth/mfa/enable", { code: "123456" })).status, 400, "enable without setup");

    const setup = await c.post("/api/auth/mfa/setup", { currentPassword: STRONG_PASSWORD });
    assert.equal(setup.status, 200, setup.text);
    assert.match(setup.json.secret, /^[A-Z2-7]{32}$/);
    assert.ok(setup.json.otpauthUrl.startsWith("otpauth://totp/"));
    authenticators.set(names.mfa, { secret: setup.json.secret, lastStep: 0 });

    const wrong = String((Number(totpCode(setup.json.secret, totpStep())) + 1) % 1_000_000).padStart(6, "0");
    assert.equal((await c.post("/api/auth/mfa/enable", { code: wrong })).status, 400);
    assert.equal((await c.get("/api/auth/mfa/status")).json.enabled, false, "a wrong code must not switch it on");

    const enable = await c.post("/api/auth/mfa/enable", { code: await nextCode(names.mfa) });
    assert.equal(enable.status, 200, enable.text);
    recoveryCodes = enable.json.recoveryCodes;
    assert.equal(recoveryCodes.length, 10);
    const status = await c.get("/api/auth/mfa/status");
    assert.deepEqual({ enabled: status.json.enabled, left: status.json.recoveryCodesRemaining }, { enabled: true, left: 10 });
  });

  test("the secret is stored encrypted and never returned", async () => {
    const plain = authenticators.get(names.mfa)!.secret;
    const { rows } = await pool.query(`SELECT totp_secret FROM users WHERE id = $1`, [ids.mfa]);
    assert.ok(rows[0].totp_secret.startsWith("v1:"));
    assert.ok(!rows[0].totp_secret.includes(plain));
    const codeRows = await pool.query(`SELECT code_hash FROM user_recovery_codes WHERE user_id = $1`, [ids.mfa]);
    assert.ok(codeRows.rows.every((r: any) => !recoveryCodes.includes(r.code_hash)), "recovery codes are stored hashed");

    const admin = await session(names.admin);
    const list = await admin.get("/api/admin/users");
    const text = JSON.stringify(list.json);
    assert.ok(!text.includes("totpSecret") && !text.includes(plain) && !text.includes("v1:"));
    assert.equal(list.json.find((u: any) => u.id === ids.mfa).mfaEnabled, true);
  });

  test("the password alone no longer signs the account in", async () => {
    const c = new Client();
    const res = await c.login(names.mfa, STRONG_PASSWORD);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { mfaRequired: true }, "nothing about the account is revealed before the second step");
    assert.equal((await c.get("/api/auth/me")).status, 401);
    assert.equal((await c.get("/api/mothers")).status, 401);
    assert.equal((await c.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword: "x".repeat(20) })).status, 401);

    assert.equal((await c.post("/api/auth/mfa/verify", { code: "000000" })).status, 401, "wrong code");
    const code = await nextCode(names.mfa);
    const ok = await c.post("/api/auth/mfa/verify", { code });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.json.username, names.mfa);
    assert.equal((await c.get("/api/mothers")).status, 200);

    // The same code again, on a new sign-in: refused (single use).
    const again = new Client();
    await again.login(names.mfa, STRONG_PASSWORD);
    assert.equal((await again.post("/api/auth/mfa/verify", { code })).status, 401, "a used code was accepted again");
  });

  test("the second step cannot be reached without the password step", async () => {
    const res = await new Client().post("/api/auth/mfa/verify", { code: "123456" });
    assert.equal(res.status, 401);
    assert.equal(res.json.statusCode, "MFA_EXPIRED");
  });

  test("a recovery code signs in exactly once", async () => {
    const first = new Client();
    await first.login(names.mfa, STRONG_PASSWORD);
    const ok = await first.post("/api/auth/mfa/verify", { code: recoveryCodes[0].toLowerCase() });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.json.recoveryCodesRemaining, 9);

    const second = new Client();
    await second.login(names.mfa, STRONG_PASSWORD);
    assert.equal((await second.post("/api/auth/mfa/verify", { code: recoveryCodes[0] })).status, 401);
  });

  test("wrong codes lock the account like wrong passwords", async () => {
    const c = await session(names.mfaLock);
    await enrol(c, names.mfaLock);
    const attacker = new Client(); // knows the password, not the code
    await attacker.login(names.mfaLock, STRONG_PASSWORD);
    for (let i = 0; i < 5; i++) {
      assert.equal((await attacker.post("/api/auth/mfa/verify", { code: String(100000 + i) })).status, 401);
    }
    const afterLock = await new Client().login(names.mfaLock, STRONG_PASSWORD);
    assert.equal(afterLock.status, 429);
    assert.equal(afterLock.json.statusCode, "LOCKED");
  });

  test("an administrator can reset it for someone who lost their phone", async () => {
    const admin = await session(names.admin);
    assert.equal((await admin.post(`/api/admin/users/${ids.admin}/mfa/reset`)).status, 400, "not on yourself");
    const tl = await session(names.tlA);
    assert.equal((await tl.post(`/api/admin/users/${ids.mfaLock}/mfa/reset`)).status, 403);

    const res = await admin.post(`/api/admin/users/${ids.mfaLock}/mfa/reset`);
    assert.equal(res.status, 200, res.text);
    const { rows } = await pool.query(
      `SELECT totp_secret, totp_enabled_at, (SELECT count(*)::int FROM user_recovery_codes WHERE user_id = $1) AS codes FROM users WHERE id = $1`,
      [ids.mfaLock]);
    assert.deepEqual(rows[0], { totp_secret: null, totp_enabled_at: null, codes: 0 });
  });

  test("switching it off needs the password and a code", async () => {
    const c = new Client();
    await c.login(names.mfa, STRONG_PASSWORD);
    assert.equal((await c.post("/api/auth/mfa/verify", { code: recoveryCodes[1] })).status, 200);

    assert.equal((await c.post("/api/auth/mfa/disable", { currentPassword: "wrong", code: recoveryCodes[2] })).status, 400);
    assert.equal((await c.post("/api/auth/mfa/disable", { currentPassword: STRONG_PASSWORD, code: "000000" })).status, 400);
    assert.equal((await c.get("/api/auth/mfa/status")).json.enabled, true);

    const off = await c.post("/api/auth/mfa/disable", { currentPassword: STRONG_PASSWORD, code: recoveryCodes[3] });
    assert.equal(off.status, 200, off.text);
    const plain = await new Client().login(names.mfa, STRONG_PASSWORD);
    assert.equal(plain.json.username, names.mfa, "password alone signs in again once it is off");
  });

  test("a brand-new admin can get through password change AND two-step setup", async (t) => {
    // Owes both at once. Each requirement must leave the other reachable.
    const username = `sec_fresh_admin_${RUN}`;
    ids.freshAdmin = await createUser(username, "SYSTEM_ADMIN", { mustChange: true });
    const c = new Client();
    const login = await c.login(username, STRONG_PASSWORD);
    assert.equal(login.json.mustChangePassword, true);

    const early = await c.post("/api/auth/mfa/setup", { currentPassword: STRONG_PASSWORD });
    assert.equal(early.json.code, "PASSWORD_CHANGE_REQUIRED", "password comes first");

    const newPassword = "a-fresh-admin-passphrase-58";
    const changed = await c.put("/api/auth/me/password", { currentPassword: STRONG_PASSWORD, newPassword });
    assert.equal(changed.status, 200, `password change was blocked: ${changed.text}`);

    const me = await c.get("/api/auth/me");
    assert.equal(me.json.mustChangePassword, false);
    if (!me.json.mustEnrollMfa) {
      t.skip("server is running with MFA_REQUIRED_ROLES=none");
      return;
    }
    assert.equal((await c.get("/api/admin/users")).json.code, "MFA_ENROLLMENT_REQUIRED");
    await enrol(c, username, newPassword);
    assert.equal((await c.get("/api/admin/users")).status, 200);
  });

  test("roles that require it cannot work, or switch it off, without it", async (t) => {
    const c = new Client();
    const login = await c.login(names.mfaAdmin, STRONG_PASSWORD);
    assert.equal(login.status, 200, login.text);
    if (!login.json.mustEnrollMfa) {
      t.skip("server is running with MFA_REQUIRED_ROLES=none");
      return;
    }
    const blocked = await c.get("/api/admin/users");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, "MFA_ENROLLMENT_REQUIRED");
    assert.equal((await c.get("/api/mothers")).status, 403);

    await enrol(c, names.mfaAdmin);
    assert.equal((await c.get("/api/admin/users")).status, 200, "works once enrolled");
    const off = await c.post("/api/auth/mfa/disable", { currentPassword: STRONG_PASSWORD, code: await nextCode(names.mfaAdmin) });
    assert.equal(off.status, 403, "a required role switched two-step sign-in off");
  });
});

// --- 4. administration -----------------------------------------------------------

describe("user administration", () => {
  let admin: Client;
  before(async () => { admin = await session(names.admin); });

  test("rejects weak passwords, unknown roles and bad usernames", async () => {
    const base = { username: `sec_new_${RUN}`, password: STRONG_PASSWORD, role: "MHO" };
    assert.equal((await admin.post("/api/admin/users", { ...base, password: "123456" })).status, 400);
    assert.equal((await admin.post("/api/admin/users", { ...base, role: "SUPERUSER" })).status, 400);
    assert.equal((await admin.post("/api/admin/users", { ...base, username: "a b<script>" })).status, 400);
    assert.equal((await admin.post("/api/admin/users", { ...base, role: "TL" })).status, 400, "TL without a barangay");
  });

  test("a new account must change its password, and its hash is never returned", async () => {
    const username = `sec_new_${RUN}`;
    const res = await admin.post("/api/admin/users", { username, password: STRONG_PASSWORD, role: "MHO" });
    assert.equal(res.status, 201, res.text);
    ids.created = res.json.id;
    assert.equal(res.json.mustChangePassword, true);
    assert.ok(!("passwordHash" in res.json) || res.json.passwordHash === undefined);

    const list = await admin.get("/api/admin/users");
    assert.ok(!JSON.stringify(list.json).includes("$2b$"), "a password hash appeared in the user list");
  });

  test("resetting a password signs the user out and forces a change", async () => {
    const victim = await session(names.tlB);
    const res = await admin.put(`/api/admin/users/${ids.tlB}`, { password: "temporary-reset-value-91" });
    assert.equal(res.status, 200, res.text);
    assert.equal((await victim.get("/api/auth/me")).status, 401);
    const again = await new Client().login(names.tlB, "temporary-reset-value-91");
    assert.equal(again.json.mustChangePassword, true);
  });

  test("disabling an account ends its sessions immediately", async () => {
    const c = await session(names.mho);
    assert.equal((await admin.put(`/api/admin/users/${ids.mho}`, { status: "DISABLED" })).status, 200);
    assert.notEqual((await c.get("/api/mothers")).status, 200);
    await admin.put(`/api/admin/users/${ids.mho}`, { status: "ACTIVE" });
  });

  test("an admin cannot demote, disable or delete themselves", async () => {
    assert.equal((await admin.put(`/api/admin/users/${ids.admin}`, { role: "TL" })).status, 400);
    assert.equal((await admin.put(`/api/admin/users/${ids.admin}`, { status: "DISABLED" })).status, 400);
    assert.equal((await admin.del(`/api/admin/users/${ids.admin}`)).status, 400);
  });

  test("logins and password resets are written to the audit log", async () => {
    const res = await admin.get("/api/admin/audit-logs?limit=500");
    assert.equal(res.status, 200);
    const actions = new Set(res.json.map((l: any) => l.action));
    for (const expected of ["LOGIN", "LOGIN_FAILED", "ACCOUNT_LOCKED", "PASSWORD_RESET", "LOGIN_BLOCKED_DEFAULT_PASSWORD", "MFA_ENABLED", "MFA_FAILED", "MFA_RESET", "MFA_RECOVERY_CODE_USED"]) {
      assert.ok(actions.has(expected), `no ${expected} entry in the audit log`);
    }
    assert.ok(!JSON.stringify(res.json).includes("$2b$"), "a password hash appeared in the audit log");
  });
});

// --- 5. browser-facing hardening ---------------------------------------------------

describe("HTTP hardening", () => {
  test("state-changing requests from another website are refused", async () => {
    const c = await session(names.admin);
    const evil = await c.request("PUT", "/api/theme-settings", { lguName: "HACKED" }, { Origin: "https://evil.example" });
    assert.equal(evil.status, 403);
    const fetchSite = await c.request("PUT", "/api/theme-settings", { lguName: "HACKED" }, { "Sec-Fetch-Site": "cross-site" });
    assert.equal(fetchSite.status, 403);
  });

  test("security headers are present", async () => {
    const res = await fetch(BASE_URL + "/api/health");
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  });

  test("errors do not leak internals", async () => {
    const c = await session(names.admin);
    const bad = await c.request("POST", "/api/mothers", undefined, { "Content-Type": "application/json" });
    assert.ok(bad.status < 500, `empty body caused a ${bad.status}`);
    const malformed = await fetch(BASE_URL + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json",
    });
    assert.equal(malformed.status, 400);
    const text = await malformed.text();
    assert.ok(!/at .*\.(ts|js|cjs):\d+/.test(text), "a stack trace was returned to the client");
  });

  test("oversized request bodies are rejected", async () => {
    const c = await session(names.admin);
    const res = await c.post("/api/general-chat/messages", { content: "x".repeat(2 * 1024 * 1024) });
    assert.equal(res.status, 413);
  });
});
