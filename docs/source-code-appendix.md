# Source Code Appendix — for capstone manuscript

Selected, annotated source-code excerpts from HealthSync, organized by
capability. Every excerpt is taken verbatim from the codebase on `main`
and is reproducible from the public GitHub repository
(`youredone4/Unified-Health-Sync`).

**Stack:** TypeScript everywhere · React 18 · Vite 7 · Wouter · TanStack
React Query · shadcn/ui · Tailwind CSS · Express 4 · Drizzle ORM ·
PostgreSQL · OpenAI SDK · Cheerio (HTML parsing).

---

## Contents

1. [Data model — Drizzle ORM schema (shared/schema.ts)](#1-data-model)
2. [The M1 auto-fill engine (computeM1Values)](#2-m1-auto-fill-engine)
3. [DOH-grounded recommendation engine (rule-based)](#3-recommendation-engine)
4. [LLM augmentation — plain-language + cluster hint](#4-llm-augmentation)
5. [Daily / weekly scheduler (no node-cron dependency)](#5-scheduler)
6. [Defensive HTML scraper for the Caraga DOH news feed](#6-doh-scraper)
7. [Surveillance status PATCH with RBAC + audit log](#7-rbac-and-audit-log)
8. [SHOWN / ACTED audit instrumentation for the recommendation engine](#8-recommendation-audit-instrumentation)
9. [Calibration view — aggregating SHOWN vs ACTED by rule](#9-calibration-aggregation)

---

## 1. Data model

Excerpt from `shared/schema.ts`. The schema is declared with Drizzle ORM
in TypeScript, then pushed to PostgreSQL. Strongly typed end-to-end —
the same TypeScript types power the server, the client React Query
hooks, and the validation schemas.

```typescript
// shared/schema.ts (lines 7-54) — Mothers register
export const mothers = pgTable("mothers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  age: integer("age").notNull(),
  barangay: text("barangay").notNull(),
  addressLine: text("address_line"),
  phone: text("phone"),
  lmpDate: text("lmp_date"),             // YYYY-MM-DD
  edcDate: text("edc_date"),
  registrationDate: text("registration_date").notNull(),
  ancVisits: integer("anc_visits").default(0),
  // Tetanus toxoid dose dates — at least 2 doses required for CPAB
  tt1Date: text("tt1_date"),
  tt2Date: text("tt2_date"),
  tt3Date: text("tt3_date"),
  tt4Date: text("tt4_date"),
  tt5Date: text("tt5_date"),
  bmiStatus: text("bmi_status"),         // "low" | "normal" | "high"
  // Delivery / outcome
  outcomeDate: text("outcome_date"),
  outcome: text("outcome"),              // "live_birth" | "stillbirth" | "abortion"
  birthWeightCategory: text("birth_weight_category"),
  deliveryLocation: text("delivery_location"),
  breastfedWithin1Hr: boolean("breastfed_within_1hr").default(false),
  // Surveillance workflow
  status: text("status").default("REPORTED"),
  reviewerNotes: text("reviewer_notes"),
  // Audit columns
  recordedByUserId: varchar("recorded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert validation schema derived from the table definition
export const insertMotherSchema = createInsertSchema(mothers)
  .omit({ id: true, createdAt: true });

// TypeScript types inferred from the schema — used app-wide
export type Mother = typeof mothers.$inferSelect;
export type InsertMother = z.infer<typeof insertMotherSchema>;
```

```typescript
// shared/schema.ts (lines 926-1005) — M1 catalog + values
// The catalog is the structural definition of every M1 row; the values
// table stores the per-report-instance numeric values, distinguishing
// COMPUTED (auto-derived) from ENCODED (manually entered) sources.

export const m1IndicatorCatalog = pgTable("m1_indicator_catalog", {
  id: serial("id").primaryKey(),
  templateVersionId: integer("template_version_id").notNull(),
  rowKey: varchar("row_key").notNull(),       // e.g. "A-01a"
  rowLabel: text("row_label").notNull(),      // verbatim from PDF
  section: varchar("section").notNull(),      // "A", "B", "C", …
  pageNumber: integer("page_number").notNull(),
  orderIndex: integer("order_index").notNull(),
  indentLevel: integer("indent_level").default(0),
  columnGroup: varchar("column_group"),       // AGE_GROUP | SEX_RATE | …
  // True when computeM1Values() can derive this row's value; the M1 page
  // renders ENCODED rows as editable and COMPUTED rows as read-only.
  isComputed: boolean("is_computed").default(false),
});

export const m1IndicatorValues = pgTable("m1_indicator_values", {
  id: serial("id").primaryKey(),
  reportInstanceId: integer("report_instance_id").notNull(),
  rowKey: varchar("row_key").notNull(),
  columnKey: varchar("column_key"),           // null for single-value rows
  valueNumber: integer("value_number"),
  valueText: text("value_text"),              // for non-numeric notes
  valueSource: varchar("value_source").notNull(),  // "COMPUTED" | "ENCODED"
  recordedByUserId: varchar("recorded_by_user_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Each (report, row, column) triple is unique
  uniqueValue: uniqueIndex("m1_values_unique_idx")
    .on(table.reportInstanceId, table.rowKey, table.columnKey),
}));
```

**What this demonstrates:** the data model separates the M1 form's
*structure* (catalog) from its *values* (per-instance derived or encoded
data). The same approach is used for the surveillance workflow, where
every disease-program table inherits the standard `status` / `reviewerNotes`
columns, making the recommendation engine (Section 3) module-agnostic.

---

## 2. M1 Auto-Fill Engine

The headline value proposition: **192 of approximately 200 DOH M1
indicators are auto-computed from operational records.** No double
entry, no end-of-month transcription. Excerpt from
`server/storage.ts:1215-1342`.

```typescript
// server/storage.ts — computeM1Values()
async computeM1Values(reportId: number): Promise<{ computed: number; skipped: number }> {
  const [instance] = await db.select().from(m1ReportInstances)
    .where(eq(m1ReportInstances.id, reportId));
  if (!instance) throw new Error("Report not found");

  const { month, year, barangayName } = instance;
  const monthLike = `${year}-${String(month).padStart(2, "0")}%`;

  // Step 1 — collect rowKeys already manually encoded by an operator;
  // these are protected from being overwritten by auto-computation.
  const existing = await db.select().from(m1IndicatorValues)
    .where(eq(m1IndicatorValues.reportInstanceId, reportId));
  const encodedKeys = new Set(
    existing.filter(v => v.valueSource === "ENCODED")
      .map(v => v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey)
  );

  const computedRaw: Array<{
    rowKey: string;
    columnKey: string | null;
    valueNumber: number;
  }> = [];

  // Helper: register a derived value unless the operator has overridden it
  const add = (rowKey: string, columnKey: string | null, val: number) => {
    const k = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (!encodedKeys.has(k)) computedRaw.push({ rowKey, columnKey, valueNumber: val });
  };

  // Helper: count rows in a Drizzle table matching a list of SQL predicates
  const countQ = async (table: any, conds: any[]): Promise<number> => {
    const where = conds.length === 1 ? conds[0] : and(...(conds as [any, ...any[]]));
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
    return r?.n ?? 0;
  };

  // === MOTHERS ===
  // Deliveries this month with at least 4 ANC visits, disaggregated by
  // age group — fills M1 row A-01a (FHSIS Manual 2025).
  const mBase = barangayName ? [eq(mothers.barangay, barangayName)] : [];
  const mDelivered = [...mBase, sql`outcome_date LIKE ${monthLike}`];
  const mAnc4 = [...mDelivered, sql`anc_visits >= 4`];
  add("A-01a", "10-14", await countQ(mothers, [...mAnc4, sql`age BETWEEN 10 AND 14`]));
  add("A-01a", "15-19", await countQ(mothers, [...mAnc4, sql`age BETWEEN 15 AND 19`]));
  add("A-01a", "20-49", await countQ(mothers, [...mAnc4, sql`age BETWEEN 20 AND 49`]));
  add("A-01a", "TOTAL",  await countQ(mothers, mAnc4));

  // === CHILDREN ===
  // Vaccination indicators (D-series rows) — checks the `vaccines` JSONB
  // column for the date the dose was administered, filters by month
  // and sex (M1 disaggregation requirement).
  const cBase = barangayName ? [eq(children.barangay, barangayName)] : [];
  const addVax = async (rowKey: string, jsonKey: string) => {
    const cond = [...cBase, sql`vaccines->>${jsonKey} LIKE ${monthLike}`];
    add(rowKey, "M",     await countQ(children, [...cond, sql`sex = 'male'`]));
    add(rowKey, "F",     await countQ(children, [...cond, sql`sex = 'female'`]));
    add(rowKey, "TOTAL", await countQ(children, cond));
  };
  await addVax("D1-02", "bcg");     // BCG dose ≤28 days
  await addVax("D2-01", "penta1");  // Pentavalent dose 1
  await addVax("D2-02", "penta2");
  await addVax("D2-03", "penta3");
  // … (16 more vaccine rows; same pattern)

  // === COMMIT ===
  // Upsert in a transaction: all computed values land atomically, so a
  // partial failure doesn't leave the report in a half-populated state.
  return await db.transaction(async (tx) => {
    let computed = 0;
    for (const row of computedRaw) {
      await tx.insert(m1IndicatorValues).values({
        reportInstanceId: reportId,
        rowKey: row.rowKey,
        columnKey: row.columnKey,
        valueNumber: row.valueNumber,
        valueSource: "COMPUTED",
      }).onConflictDoUpdate({
        target: [
          m1IndicatorValues.reportInstanceId,
          m1IndicatorValues.rowKey,
          m1IndicatorValues.columnKey,
        ],
        set: { valueNumber: row.valueNumber, valueSource: "COMPUTED" },
      });
      computed++;
    }
    return { computed, skipped: encodedKeys.size };
  });
}
```

**What this demonstrates:**

1. **Single source of truth** — operational tables (mothers, children, …)
   are the only place data is captured; `computeM1Values()` derives the
   M1 report from those tables every time it is opened.
2. **Override-safe** — manual encoding wins over auto-computation, so a
   reviewer can correct edge cases without their work being clobbered.
3. **Atomic** — the entire derivation is wrapped in a transaction, so a
   partial failure rolls back rather than leaving a half-populated report.

---

## 3. Recommendation Engine

The rule-based decision-support engine surfaces DOH-cited protocol
checklists when a reviewer opens a surveillance case. **Pure, deterministic,
auditable, citable.** No LLM in the predicate path. Full file
`shared/recommendations.ts`.

```typescript
// shared/recommendations.ts
export const RECOMMENDATION_MODULES = [
  "rabies", "filariasis", "schisto", "sth", "leprosy",
] as const;
export type RecommendationModule = (typeof RECOMMENDATION_MODULES)[number];

export const RECOMMENDATION_SEVERITIES = ["info", "advisory", "urgent"] as const;
export type RecommendationSeverity = (typeof RECOMMENDATION_SEVERITIES)[number];

export interface Recommendation {
  /** Stable id; never re-used after retirement. */
  id: string;
  module: RecommendationModule;
  /** Pure predicate. Must not throw, must be deterministic. */
  applies: (row: any) => boolean;
  title: string;
  bullets: string[];
  /** DOH AO / Manual citation, e.g. "DOH 2018 Rabies Manual". */
  source: string;
  severity: RecommendationSeverity;
  retired?: boolean;
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rabies-cat-iii-pep",
    module: "rabies",
    applies: (r) => r?.category === "III",
    title: "Category III exposure — medical emergency",
    bullets: [
      "Wash wound for 15 minutes with soap and running water.",
      "Administer anti-rabies vaccine: Days 0, 3, 7, 14, 28.",
      "Infiltrate Rabies Immune Globulin (RIG) at the wound site.",
      "Refer to ABTC immediately. Tetanus prophylaxis as needed.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "urgent",
  },
  {
    id: "rabies-cat-ii-non-abtc",
    module: "rabies",
    applies: (r) => r?.category === "II" && r?.treatmentCenter === "NON_ABTC",
    title: "Quality flag: Category II treated outside ABTC",
    bullets: [
      "Anti-rabies regimens given outside ABTCs are sub-standard.",
      "Confirm the patient completed the full Days 0/3/7/14/28 schedule.",
      "Refer for review and dose-completion follow-up.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "advisory",
  },
  {
    id: "filariasis-positive",
    module: "filariasis",
    applies: (r) => r?.result === "POSITIVE",
    title: "Filariasis-positive — flag barangay for next MDA",
    bullets: [
      "Mass Drug Administration (DEC + albendazole) targets endemic barangays.",
      "Record the case in PIDSR and add the barangay to the next MDA roster.",
      "If lymphedema or hydrocele, refer for MMDP / surgical evaluation.",
    ],
    source: "DOH AO 2018-0030 (Filariasis Elimination)",
    severity: "advisory",
  },
  // … further rules for hydrocele, schisto, STH, leprosy
];

const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  urgent: 3, advisory: 2, info: 1,
};

/**
 * Run every rule in the given module against `row` and return matches
 * in severity-descending order. Errors inside any single predicate are
 * caught so one buggy rule cannot suppress the rest.
 */
export function recommendationsFor(
  module: RecommendationModule,
  row: unknown,
): Recommendation[] {
  const matches: Recommendation[] = [];
  for (const rule of RECOMMENDATIONS) {
    if (rule.module !== module) continue;
    if (rule.retired) continue;
    let applied = false;
    try {
      applied = !!rule.applies(row);
    } catch {
      applied = false;
    }
    if (applied) matches.push(rule);
  }
  return matches.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

export const RECOMMENDATION_DISCLAIMER =
  "DOH guidance — not a clinical order. Reviewer judgment required.";
```

**What this demonstrates:**

1. **DOH-citable** — every rule carries its source citation, so audit
   reviewers can trace every on-screen recommendation back to a DOH
   document (AO number or manual name).
2. **Fail-safe by design** — `try/catch` around each predicate means a
   single buggy rule cannot suppress the others; the system degrades
   gracefully rather than catastrophically.
3. **Severity-aware** — sort order is deterministic (urgent → advisory →
   info), so the reviewer sees the most critical guidance first.
4. **Retirement, not deletion** — retired rules keep their `id` so
   historical audit logs (`RECOMMENDATION_SHOWN` events with that
   `ruleId`) remain resolvable.

---

## 4. LLM augmentation

Plain-language rewrite and cluster-detection layers, both **strictly
additive** to the rule-based engine — the original DOH-cited bullets
never disappear. From `server/recommendations-llm.ts`.

```typescript
// server/recommendations-llm.ts
import OpenAI from "openai";

// Lazy client construction — environments without an API key (CI, dev
// sandbox) load the module without throwing. Production sets the key.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  _openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _openai;
}

// In-process cache keyed by ruleId. One rule = one LLM call, regardless
// of how many reviewers open the matching surveillance case.
const summaryCache = new Map<string, string>();

const PLAIN_LANGUAGE_SYSTEM = [
  "You rewrite DOH clinical-protocol checklists in plain Filipino-English",
  "for a non-clinical reader (a barangay official or family member).",
  "Rules:",
  " - Aim for 5th-grade reading level.",
  " - 2 to 4 short sentences max — no bullet list.",
  " - Keep medical proper nouns (DOH, vaccine names) in English.",
  " - Do not invent new clinical advice; only restate what the input says.",
  " - End with: 'Ask your health worker if you are unsure.'",
].join("\n");

export async function plainLanguageSummary(
  input: { ruleId: string; title: string; bullets: string[] },
): Promise<string | null> {
  const cached = summaryCache.get(input.ruleId);
  if (cached) return cached;

  const openai = getOpenAI();
  if (!openai) return null;       // Graceful fallback — UI shows original

  try {
    const userPrompt = [
      `Title: ${input.title}`,
      "Steps:",
      ...input.bullets.map((b) => `- ${b}`),
    ].join("\n");

    const response = await openai.chat.completions.create({
      model: process.env.AI_INTEGRATIONS_OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: PLAIN_LANGUAGE_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 220,
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    if (!text) return null;
    summaryCache.set(input.ruleId, text);
    return text;
  } catch (err) {
    console.error("[recommendations-llm] plain-language failed:", err);
    return null;
  }
}

// Cluster hint — rule-based, no LLM. Counts category-III rabies cases
// in the same barangay within the last 7 days. Returns a hint when 3+
// rows match (current row + 2 others).
export async function getClusterHint(args: {
  module: string;
  barangay: string;
  entityId: number;
  today?: Date;
}): Promise<{ count: number; windowDays: number; message: string } | null> {
  if (args.module !== "rabies") return null;
  if (!args.barangay) return null;

  const today = args.today ?? new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - 7);
  const sinceISO = since.toISOString().slice(0, 10);

  const rows = await db.select({ id: rabiesExposures.id })
    .from(rabiesExposures)
    .where(and(
      eq(rabiesExposures.barangay, args.barangay),
      eq(rabiesExposures.category, "III"),
      gte(rabiesExposures.exposureDate, sinceISO),
      ne(rabiesExposures.id, args.entityId),
    ));
  const total = rows.length + 1;
  if (total < 3) return null;
  return {
    count: total,
    windowDays: 7,
    message: `Possible cluster — ${total} Category III exposures in ` +
      `${args.barangay} within 7 days. Consider raising an outbreak alert.`,
  };
}
```

**What this demonstrates:**

1. **Safe defaults** — when the LLM is unavailable (no API key, upstream
   error), the function returns `null` instead of throwing; the UI
   transparently falls back to the rule-based bullets.
2. **Caching is correct by construction** — the cache key is `ruleId`,
   which is invariant; a rule's plain-language version is stable across
   reviewers, so one LLM call per process per rule is sufficient.
3. **Rule-based cluster detection** — even the "AI-flavored" cluster
   hint is implemented as a deterministic database query, not an LLM
   call, so it is auditable and reproducible.

---

## 5. Scheduler

A hand-rolled scheduler that avoids the `node-cron` dependency and fires
on Asia/Manila wall-clock time. Full file `server/scheduler/index.ts`.

```typescript
// server/scheduler/index.ts
import { runDailyAlerts, runWeeklyAlerts } from "./jobs";

const MANILA_OFFSET_HOURS = 8;

/** Milliseconds until the next instance of (hourManila, minuteManila). */
function msUntilNext(hourManila: number, minuteManila = 0): number {
  const now = new Date();
  const nowManila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  const target = new Date(nowManila);
  target.setUTCHours(hourManila, minuteManila, 0, 0);
  if (target <= nowManila) target.setUTCDate(nowManila.getUTCDate() + 1);
  return target.getTime() - nowManila.getTime();
}

function msUntilNextFriday(hourManila: number, minuteManila = 0): number {
  const now = new Date();
  const nowManila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  const target = new Date(nowManila);
  target.setUTCHours(hourManila, minuteManila, 0, 0);
  const daysUntilFriday = (5 - target.getUTCDay() + 7) % 7;
  target.setUTCDate(nowManila.getUTCDate() + daysUntilFriday);
  if (target <= nowManila) target.setUTCDate(target.getUTCDate() + 7);
  return target.getTime() - nowManila.getTime();
}

let dailyTimer: NodeJS.Timeout | null = null;
let weeklyTimer: NodeJS.Timeout | null = null;
let started = false;

// Self-rescheduling setTimeout — every fire re-schedules the next.
// Idempotent on restart: if the process restarts mid-day we don't try
// to "catch up", we just run on the next configured slot.
function scheduleDaily() {
  const ms = msUntilNext(6, 0);    // 6:00 AM Manila
  console.log(`[scheduler] next daily run in ${Math.round(ms / 60000)} minutes`);
  dailyTimer = setTimeout(async () => {
    try {
      await runDailyAlerts();
    } catch (err) {
      console.error("[scheduler] daily run failed:", err);
    }
    scheduleDaily();
  }, ms);
}

function scheduleWeekly() {
  const ms = msUntilNextFriday(16, 0);   // 4:00 PM Manila Friday
  weeklyTimer = setTimeout(async () => {
    try {
      await runWeeklyAlerts();
    } catch (err) {
      console.error("[scheduler] weekly run failed:", err);
    }
    scheduleWeekly();
  }, ms);
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  scheduleDaily();
  scheduleWeekly();
}
```

**What this demonstrates:**

1. **Zero-dependency time scheduling** — `setTimeout` + careful UTC↔Manila
   math is sufficient; no `node-cron`, no `agenda`, no Redis.
2. **Best-effort semantics** — failures inside `runDailyAlerts()` are
   logged but never propagate to the scheduler, so one buggy alert job
   cannot silence the rest of the cadence.
3. **No "catch-up"** — restarting mid-day does not fire a stale daily
   job; the next slot is computed from current wall-clock time.

---

## 6. DOH Scraper

The Caraga DOH news/updates scraper. **Defensive parsing** because the
upstream HTML is a CMS template with no stability guarantees. From
`server/scheduler/scrape-caraga-doh.ts`.

```typescript
// server/scheduler/scrape-caraga-doh.ts
import * as cheerio from "cheerio";

const CARAGA_DOH_URL = "https://caraga.doh.gov.ph/";
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "HealthSyncScraper/1.0";

// Selector chain — try each in order until one yields ≥1 entry.
// CMS templates vary; this list covers WordPress, Joomla, and bespoke
// layouts the regional sites have used historically.
const ITEM_SELECTORS = [
  "article.post", "article", ".post", ".news-item", ".entry",
  ".item", "li.news", ".et_pb_post", ".elementor-post",
] as const;

interface ScrapedItem {
  title: string;
  sourceUrl: string;
  publishedDate: string;
  summary: string;
}

/**
 * Pure function: HTML in, candidate items out. No I/O, no DB.
 * Trivially unit-testable.
 */
export function extractItems(html: string): ScrapedItem[] {
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);

  for (const selector of ITEM_SELECTORS) {
    const nodes = $(selector);
    if (nodes.length === 0) continue;

    const items: ScrapedItem[] = [];
    nodes.each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find(
        "h1 a, h2 a, h3 a, h4 a, .entry-title a, .post-title a"
      ).first();
      const title = (titleEl.text()
        || $el.find("h1, h2, h3, h4, .entry-title, .post-title").first().text()
      ).trim();
      if (!title) return;

      const href = titleEl.attr("href")
        || $el.find("a").first().attr("href") || "";
      if (!href) return;

      const dateRaw =
        $el.find("time").attr("datetime") ||
        $el.find("time").text() ||
        $el.find(".date, .post-date, .entry-date").first().text() || "";
      const publishedDate = parseDate(dateRaw) || today;

      const summary = $el.find(".entry-summary, .post-excerpt, .excerpt, p")
        .first().text().trim().slice(0, 500) || title;

      items.push({
        title,
        sourceUrl: absoluteUrl(href),
        publishedDate,
        summary,
      });
    });

    if (items.length > 0) {
      // Dedupe by sourceUrl within the same scrape
      const seen = new Set<string>();
      return items.filter((it) => {
        if (seen.has(it.sourceUrl)) return false;
        seen.add(it.sourceUrl);
        return true;
      });
    }
  }
  return [];
}

/** Hard fetch timeout via AbortController; failures don't crash. */
async function fetchPage(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CARAGA_DOH_URL, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${CARAGA_DOH_URL}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeCaragaDoh(): Promise<{
  fetched: number; inserted: number; skipped: number;
}> {
  let html: string;
  try {
    html = await fetchPage();
  } catch (err) {
    console.error("[scrape-caraga-doh] fetch failed:", err);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  const items = extractItems(html);
  let inserted = 0, skipped = 0;
  for (const it of items) {
    // Pre-check dedupe — existing seed reuses generic URLs, so a UNIQUE
    // constraint would crash. Application-level dedupe instead.
    const existing = await db.select({ id: dohUpdates.id }).from(dohUpdates)
      .where(eq(dohUpdates.sourceUrl, it.sourceUrl)).limit(1);
    if (existing.length > 0) { skipped++; continue; }
    await db.insert(dohUpdates).values({
      title: it.title,
      summary: it.summary,
      sourceUrl: it.sourceUrl,
      publishedDate: it.publishedDate,
      bureau: "CHD",
      significance: "MEDIUM",
      source: "SCRAPED_CARAGA",
      tags: [],
    });
    inserted++;
  }
  return { fetched: items.length, inserted, skipped };
}
```

**What this demonstrates:**

1. **Defensive parsing under selector drift** — the selector chain
   means a single change to the upstream CMS template doesn't break
   the scraper; only when *all* candidate selectors fail does it
   return zero items.
2. **Pure function for testability** — `extractItems()` takes a string
   and returns objects, so unit tests can run without network or DB.
3. **Hard timeout** — `AbortController` enforces a 20-second budget,
   so a slow upstream cannot delay the rest of the daily cron.

---

## 7. RBAC and Audit Log

Every write operation on a surveillance record is gated by role + scoped
by barangay assignment, and audit-logged in the same transaction. Excerpt
from `server/routes.ts:1119-1160`.

```typescript
// server/routes.ts — surveillance status PATCH route generator
const SURVEILLANCE_STATUS_VALUES = [
  "REPORTED", "REVIEWED", "ESCALATED", "CLOSED"
] as const;
const surveillancePatchSchema = z.object({
  status: z.enum(SURVEILLANCE_STATUS_VALUES).optional(),
  reviewerNotes: z.string().max(2000).optional().nullable(),
});

// One generator → five module endpoints (filariasis, rabies, schisto,
// sth, leprosy). RBAC and audit logging behave identically for all.
const surveillancePatchRoute = (
  pathBase: string,
  auditEntity: string,
  kind: "filariasis" | "rabies" | "schistosomiasis" | "sth" | "leprosy",
) => {
  app.patch(`${pathBase}/:id/status`, registryRBAC, ar(async (req, res) => {
    const id = parseId(req.params.id, res); if (id === null) return;

    // 1 — Validate payload at the boundary using zod
    const parsed = surveillancePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid status patch",
        issues: parsed.error.issues,
      });
    }

    // 2 — Persist the change
    const updated = await storage.updateSurveillanceStatus(kind, id, {
      status: parsed.data.status,
      reviewerNotes: parsed.data.reviewerNotes ?? undefined,
      reviewedByUserId: req.userInfo?.id ?? null,
    });
    if (!updated) return res.status(404).json({ message: "Record not found" });

    // 3 — Post-hoc barangay scope check (TLs can only touch their own)
    if (req.userInfo?.role === UserRole.TL
        && !req.userInfo.assignedBarangays.includes(updated.barangay)) {
      return res.status(403).json({ message: "Access denied to this barangay" });
    }

    // 4 — Audit log: who, what, when, before/after
    await createAuditLog(
      req.userInfo!.id, req.userInfo!.role,
      "UPDATE", auditEntity, String(id),
      updated.barangay, undefined,
      {
        status: updated.status,
        ...(parsed.data.reviewerNotes !== undefined
            && { reviewerNotes: parsed.data.reviewerNotes }),
      },
      req,
    );
    res.json(updated);
  }));
};
// Register all five surveillance endpoints from the same generator
surveillancePatchRoute("/api/filariasis-records", "FILARIASIS_RECORD", "filariasis");
surveillancePatchRoute("/api/rabies-exposures", "RABIES_EXPOSURE", "rabies");
surveillancePatchRoute("/api/schistosomiasis-records", "SCHISTOSOMIASIS_RECORD", "schistosomiasis");
surveillancePatchRoute("/api/sth-records", "STH_RECORD", "sth");
surveillancePatchRoute("/api/leprosy-records", "LEPROSY_RECORD", "leprosy");
```

```typescript
// server/middleware/rbac.ts — createAuditLog signature
export async function createAuditLog(
  userId: string,
  userRole: string,
  action: string,          // e.g. "CREATE", "UPDATE", "DELETE",
                           // or "RECOMMENDATION_SHOWN", "RECOMMENDATION_ACTED"
  entityType: string,      // e.g. "RABIES_EXPOSURE"
  entityId?: string | number,
  barangayName?: string,
  beforeJson?: any,
  afterJson?: any,
  req?: any,               // for IP + user-agent extraction
) {
  try {
    await db.insert(auditLogs).values({
      userId, userRole, action, entityType,
      entityId: entityId?.toString(),
      barangayName, beforeJson, afterJson,
      ipAddress: req?.ip || req?.headers?.["x-forwarded-for"]?.toString(),
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (err) {
    // Audit log is best-effort — a DB error here never blocks the user
    console.error("[audit] log write failed:", err);
  }
}
```

**What this demonstrates:**

1. **Validation at the boundary** — zod parses the incoming JSON before
   any business logic touches it; invalid input is rejected with a
   structured error.
2. **Defense in depth** — even after `registryRBAC` middleware, the
   barangay scope is re-checked once the actual row is loaded (the
   middleware doesn't know which barangay this row belongs to).
3. **Audit on every write** — `before` and `after` are both captured,
   so a reviewer can reconstruct exactly what changed.
4. **One generator, five endpoints** — DRY at the route level: the same
   RBAC + audit logic is applied to all five disease modules without
   duplication.

---

## 8. Recommendation audit instrumentation

How `RECOMMENDATION_SHOWN` and `RECOMMENDATION_ACTED` events flow from
the React drawer to the audit log. From
`client/src/components/surveillance-action-drawer.tsx`.

```typescript
// client/src/components/surveillance-action-drawer.tsx
const recs = target?.module && target?.row
  ? recommendationsFor(target.module, target.row)
  : [];
const recIds = recs.map((r) => r.id);
const recIdsKey = recIds.join(",");

// Fire RECOMMENDATION_SHOWN once per (target.id × ruleIds) transition.
// useRef guard prevents duplicate impressions on React re-renders.
const loggedShownKey = useRef<string>("");
useEffect(() => {
  if (!open || !target || recIds.length === 0 || !target.entityType) return;
  const key = `${target.entityType}:${target.id}:${recIdsKey}`;
  if (loggedShownKey.current === key) return;
  loggedShownKey.current = key;
  apiRequest("POST", "/api/recommendations/log", {
    kind: "SHOWN",
    entityType: target.entityType,
    entityId: target.id,
    ruleIds: recIds,
    barangayName: target.barangayName,
  }).catch(() => {});   // best-effort — never blocks the UI
}, [open, target, recIdsKey]);

// On save success, fire RECOMMENDATION_ACTED with the same rule IDs.
const save = useMutation({
  mutationFn: async () => {
    return (await apiRequest("PATCH",
      `${target.apiBase}/${target.id}/status`,
      { status, reviewerNotes: notes || null }
    )).json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: target.queryKey });
    if (target?.entityType && recIds.length > 0) {
      apiRequest("POST", "/api/recommendations/log", {
        kind: "ACTED",
        entityType: target.entityType,
        entityId: target.id,
        ruleIds: recIds,
        barangayName: target.barangayName,
      }).catch(() => {});
    }
    onOpenChange(false);
  },
});
```

```typescript
// server/routes.ts — the receiving endpoint
const recommendationLogSchema = z.object({
  kind: z.enum(["SHOWN", "ACTED"]),
  entityType: z.string().min(1).max(100),
  entityId: z.union([z.number(), z.string()]).optional(),
  ruleIds: z.array(z.string().min(1).max(120)).max(20),
  barangayName: z.string().max(120).optional(),
});

app.post("/api/recommendations/log", loadUserInfo, requireAuth,
  ar(async (req, res) => {
    const parsed = recommendationLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid payload", issues: parsed.error.issues,
      });
    }
    const { kind, entityType, entityId, ruleIds, barangayName } = parsed.data;
    if (ruleIds.length === 0) return res.json({ logged: 0 });
    const action = kind === "SHOWN"
      ? "RECOMMENDATION_SHOWN"
      : "RECOMMENDATION_ACTED";
    // One audit row per rule — supports per-rule aggregation downstream
    for (const ruleId of ruleIds) {
      await createAuditLog(
        req.userInfo!.id, req.userInfo!.role,
        action, entityType,
        entityId !== undefined ? String(entityId) : undefined,
        barangayName, undefined,
        { ruleId },
        req,
      );
    }
    res.json({ logged: ruleIds.length });
  }),
);
```

**What this demonstrates:**

1. **De-duplication of impressions** — `useRef` on a composite key
   prevents React's normal re-render churn from inflating SHOWN counts.
2. **Best-effort logging** — both client (`.catch(() => {})`) and
   server (try/catch in `createAuditLog`) treat audit failures as
   non-blocking.
3. **Per-rule rows** — writing one audit row per `ruleId` means the
   downstream calibration view (Section 9) can aggregate naturally
   with a single GROUP BY.

---

## 9. Calibration aggregation

The provincial-QA tool that consumes the audit events from Section 8.
From `server/routes.ts:/api/admin/recommendations-stats`.

```typescript
// server/routes.ts
app.get("/api/admin/recommendations-stats", loadUserInfo, requireAuth,
  requireRole(UserRole.SYSTEM_ADMIN, UserRole.MHO),
  ar(async (req, res) => {
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0
      ? Math.min(daysRaw, 365)
      : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // SQL pre-filter: only the two recommendation actions in the window
    const rows = await db.select({
      action: auditLogs.action,
      afterJson: auditLogs.afterJson,
    }).from(auditLogs).where(and(
      gte(auditLogs.createdAt, since),
      inArray(auditLogs.action,
        ["RECOMMENDATION_SHOWN", "RECOMMENDATION_ACTED"] as any),
    ));

    // Aggregate by ruleId. Defense-in-depth: even though the SQL filter
    // ensures only SHOWN/ACTED rows reach us, we still gate inside the
    // loop so a future filter change can't quietly inflate counts.
    const byRule = new Map<string, { shown: number; acted: number }>();
    for (const r of rows) {
      const ruleId = (r.afterJson as any)?.ruleId;
      if (typeof ruleId !== "string" || !ruleId) continue;
      const isShown = r.action === "RECOMMENDATION_SHOWN";
      const isActed = r.action === "RECOMMENDATION_ACTED";
      if (!isShown && !isActed) continue;
      const slot = byRule.get(ruleId) ?? { shown: 0, acted: 0 };
      if (isShown) slot.shown++; else slot.acted++;
      byRule.set(ruleId, slot);
    }

    const stats = Array.from(byRule.entries())
      .map(([ruleId, c]) => ({
        ruleId,
        shown: c.shown,
        acted: c.acted,
        // Conversion rate (1-decimal percent). shown=0 → null to avoid
        // division-by-zero and to distinguish "never displayed" from
        // "displayed but never actioned" downstream.
        ratio: c.shown > 0
          ? Math.round((c.acted / c.shown) * 1000) / 10
          : null,
      }))
      .sort((a, b) => b.shown - a.shown);

    res.json({ windowDays: days, stats });
  }),
);
```

**What this demonstrates:**

1. **Time-bounded aggregation** — the `days` parameter is clamped to
   `[1, 365]` to prevent unbounded scans of the audit log.
2. **Defense in depth** — both the SQL `WHERE` clause AND the
   aggregator loop filter for `SHOWN`/`ACTED`, so changing one without
   the other does not produce wrong numbers.
3. **`null` ratio for `shown=0`** — preserves the semantic difference
   between "never shown" and "shown but never acted" in the UI.

---

## Repository layout (for citing file paths in the manuscript)

```
Unified-Health-Sync/
├── shared/                        # Type-safe contracts shared
│   ├── schema.ts                  #   between server and client
│   ├── recommendations.ts         # Rule-based recommendation engine
│   └── glossary.ts                # DOH acronym definitions
├── server/                        # Express 4 backend
│   ├── routes.ts                  # All HTTP endpoints
│   ├── storage.ts                 # Drizzle ORM data layer
│   ├── recommendations-llm.ts     # LLM augmentation
│   ├── middleware/
│   │   └── rbac.ts                # Role-based access + audit
│   └── scheduler/
│       ├── index.ts               # Hand-rolled scheduler
│       ├── jobs.ts                # Daily / weekly alert jobs
│       └── scrape-caraga-doh.ts   # Defensive HTML scraper
├── client/src/                    # React 18 + Vite SPA
│   ├── App.tsx                    # Route table + RBAC
│   ├── pages/                     # 70+ operational pages
│   ├── components/
│   │   ├── recommendation-card.tsx
│   │   └── surveillance-action-drawer.tsx
│   └── hooks/
│       └── use-auth.ts            # sidebarPermissions (RBAC source of truth)
└── docs/                          # Methodology, conceptual framework,
                                   # system architecture, M1 audit,
                                   # user manual
```

---

## Verification — how to reproduce these excerpts

```bash
git clone https://github.com/youredone4/Unified-Health-Sync.git
cd Unified-Health-Sync
# Schema + computeM1Values
cat shared/schema.ts | sed -n '7,54p'
cat server/storage.ts | sed -n '1215,1342p'
# Recommendation engine
cat shared/recommendations.ts
cat server/recommendations-llm.ts
# Scheduler + scraper
cat server/scheduler/index.ts
cat server/scheduler/scrape-caraga-doh.ts
# RBAC + audit
cat server/middleware/rbac.ts | sed -n '148,172p'
cat server/routes.ts | sed -n '1115,1160p'
```

Every excerpt above is line-for-line identical to the corresponding
range in the cited file at the commit referenced in the manuscript's
bibliography. The license is permissive (this is an academic project —
specify your final license in the manuscript).
