/**
 * Security regression tests. They run against a REAL running server and
 * its database, over HTTP, exactly as a browser or an attacker would.
 *
 *   1. Start the server against a THROWAWAY database (never production):
 *        npm run db:migrate && npm run dev
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
  disabled: `sec_disabled_${RUN}`,
};
const ids: Record<string, string> = {};
const seeded = { motherB: 0, seniorB: 0, diseaseB: 0, rabiesB: 0, smsB: 0, walkInB: 0, motherA: 0 };

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

async function session(username: string, password = STRONG_PASSWORD): Promise<Client> {
  const c = new Client();
  const res = await c.login(username, password);
  assert.equal(res.status, 200, `login as ${username} failed: ${res.text}`);
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
  seeded.diseaseB = await one(
    `INSERT INTO disease_cases (patient_name, age, barangay, condition, date_reported)
     VALUES ($1, 40, $2, 'Dengue', $3) RETURNING id`, [TAG, BARANGAY_B, today]);
  seeded.rabiesB = await one(
    `INSERT INTO rabies_exposures (patient_name, barangay, dob, sex, exposure_date, category)
     VALUES ($1, $2, '1990-01-01', 'F', $3, 'II') RETURNING id`, [TAG, BARANGAY_B, today]);
  seeded.smsB = await one(
    `INSERT INTO sms_outbox (recipient, recipient_phone, message, sent_at, barangay)
     VALUES ($1, '09170000000', 'security test message', $2, $3) RETURNING id`, [TAG, new Date().toISOString(), BARANGAY_B]);
  seeded.walkInB = await one(
    `INSERT INTO consults (patient_name, age, sex, barangay, consult_date, chief_complaint, diagnosis, created_at, is_walk_in)
     VALUES ($1, 40, 'F', $2, $3, 'test', 'test', $4, true) RETURNING id`, [TAG, BARANGAY_B, today, new Date().toISOString()]);
});

after(async () => {
  const userIds = Object.values(ids);
  await pool.query(`DELETE FROM sessions WHERE sess->>'userId' = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM senior_med_claims WHERE senior_id = $1`, [seeded.seniorB]);
  await pool.query(`DELETE FROM mothers WHERE first_name = $1`, [TAG]);
  await pool.query(`DELETE FROM seniors WHERE first_name = $1`, [TAG]);
  await pool.query(`DELETE FROM disease_cases WHERE patient_name = $1`, [TAG]);
  await pool.query(`DELETE FROM rabies_exposures WHERE patient_name = $1`, [TAG]);
  await pool.query(`DELETE FROM sms_outbox WHERE recipient = $1`, [TAG]);
  await pool.query(`DELETE FROM consults WHERE patient_name = $1`, [TAG]);
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
      if (PASSWORD_CHANGE_ALLOWED.has(key) || key === "POST /api/auth/login") continue;
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

  test("cannot reach administration", async () => {
    for (const p of ["/api/admin/users", "/api/admin/audit-logs", "/api/consults", "/api/reports/_registry"]) {
      await denied(p, await tlA.get(p));
    }
    await denied("create user", await tlA.post("/api/admin/users", { username: "evil", password: STRONG_PASSWORD, role: "SYSTEM_ADMIN" }));
    await denied("theme", await tlA.put("/api/theme-settings", { lguName: "HACKED" }));
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
    for (const expected of ["LOGIN", "LOGIN_FAILED", "ACCOUNT_LOCKED", "PASSWORD_RESET", "LOGIN_BLOCKED_DEFAULT_PASSWORD"]) {
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
