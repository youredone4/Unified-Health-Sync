/**
 * Scheduled-job logic for the operational-actions framework (Phase 3).
 *
 * Each function below scans operational tables and writes one or more
 * audit_logs rows with action="SYSTEM_ALERT" describing what it found.
 * MGMT users see these alerts in the Audit Logs page (Phase 1) and we
 * can later promote them to a dedicated notifications surface.
 *
 * Functions are pure: same DB → same alerts. They are also idempotent
 * day-over-day in the sense that re-running surfaces the same alerts;
 * dedup is the consumer's job.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  workforceMembers,
  inventory,
  tbPatients,
  m1ReportInstances,
  pidsrSubmissions,
  diseaseCases,
  auditLogs,
} from "@shared/schema";

const SYSTEM_USER_ID = "system-scheduler";
const SYSTEM_ROLE = "SYSTEM";

// Helper: convert YYYY-MM-DD strings to Date for arithmetic.
const today = () => new Date();
const todayIso = () => today().toISOString().slice(0, 10);
const daysFromNowIso = (days: number) => {
  const d = today();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

interface AlertFinding {
  entityType: string;
  entityId?: string;
  barangayName?: string | null;
  reason: string;
  details?: Record<string, unknown>;
}

async function writeAlerts(jobName: string, findings: AlertFinding[]) {
  if (findings.length === 0) {
    console.log(`[scheduler] ${jobName}: no findings`);
    return;
  }
  const rows = findings.map((f) => ({
    userId: SYSTEM_USER_ID,
    userRole: SYSTEM_ROLE,
    action: "SYSTEM_ALERT",
    entityType: f.entityType,
    entityId: f.entityId,
    barangayName: f.barangayName ?? null,
    afterJson: { jobName, reason: f.reason, ...(f.details ?? {}) },
  }));
  await db.insert(auditLogs).values(rows as any);
  console.log(`[scheduler] ${jobName}: ${findings.length} alert(s) recorded`);
}

/** PRC license expiry: alert at <30 days, hard-alert at expired. */
async function checkLicenseExpiry(): Promise<AlertFinding[]> {
  const todayStr = todayIso();
  const thirtyDaysOut = daysFromNowIso(30);
  const members = await db.select().from(workforceMembers);
  const findings: AlertFinding[] = [];
  for (const m of members) {
    if (!m.prcLicenseExpiry) continue;
    if (m.prcLicenseExpiry < todayStr) {
      findings.push({
        entityType: "WORKFORCE_MEMBER",
        entityId: String(m.id),
        barangayName: m.barangay,
        reason: `PRC license EXPIRED (${m.prcLicenseExpiry})`,
        details: { name: m.fullName, profession: m.profession },
      });
    } else if (m.prcLicenseExpiry < thirtyDaysOut) {
      findings.push({
        entityType: "WORKFORCE_MEMBER",
        entityId: String(m.id),
        barangayName: m.barangay,
        reason: `PRC license expires in <30 days (${m.prcLicenseExpiry})`,
        details: { name: m.fullName, profession: m.profession },
      });
    }
  }
  return findings;
}

/** Inventory: vaccines or HTN meds with qty 0 → stockout alert. */
async function checkStockouts(): Promise<AlertFinding[]> {
  const items = await db.select().from(inventory);
  const findings: AlertFinding[] = [];
  for (const i of items) {
    const v = i.vaccines as any;
    if (v) {
      const stockedOut = Object.entries(v).filter(([, qty]) => qty === 0).map(([k]) => k);
      if (stockedOut.length > 0) {
        findings.push({
          entityType: "INVENTORY",
          entityId: String(i.id),
          barangayName: i.barangay,
          reason: `Vaccine stockout: ${stockedOut.join(", ")}`,
          details: { items: stockedOut },
        });
      }
    }
    const meds = i.htnMeds as any[] | null;
    if (Array.isArray(meds)) {
      const out = meds.filter((m) => m.qty === 0);
      if (out.length > 0) {
        findings.push({
          entityType: "INVENTORY",
          entityId: String(i.id),
          barangayName: i.barangay,
          reason: `HTN meds stockout: ${out.map((m) => m.name).join(", ")}`,
          details: { items: out },
        });
      }
    }
  }
  return findings;
}

/** TB defaulter: nextSputumCheckDate is in the past for an Ongoing patient. */
async function checkTbDefaulters(): Promise<AlertFinding[]> {
  const todayStr = todayIso();
  const patients = await db
    .select()
    .from(tbPatients)
    .where(sql`outcome_status = 'Ongoing' AND next_sputum_check_date IS NOT NULL AND next_sputum_check_date < ${todayStr}`);
  return patients.map((p) => ({
    entityType: "TB_PATIENT",
    entityId: String(p.id),
    barangayName: p.barangay,
    reason: `TB sputum check overdue (due ${p.nextSputumCheckDate})`,
    details: { name: `${p.firstName} ${p.lastName}` },
  }));
}

/** M1 deadline: it's after the 5th of a month and last month's M1 isn't SUBMITTED_LOCKED. */
async function checkM1Deadlines(): Promise<AlertFinding[]> {
  const now = today();
  // Only fire after the 5th of a given month.
  if (now.getDate() <= 5) return [];
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetYear = lastMonth.getFullYear();
  const targetMonth = lastMonth.getMonth() + 1;
  const instances = await db
    .select()
    .from(m1ReportInstances)
    .where(sql`year = ${targetYear} AND month = ${targetMonth} AND status != 'SUBMITTED_LOCKED'`);
  return instances.map((r) => ({
    entityType: "M1_REPORT",
    entityId: String(r.id),
    barangayName: r.barangayName,
    reason: `M1 ${targetYear}-${String(targetMonth).padStart(2, "0")} not submitted by deadline (status=${r.status})`,
    details: { year: r.year, month: r.month, status: r.status },
  }));
}

/** Friday Cat-II PIDSR: reminder if no submission for the current ISO week. */
async function checkPidsrFridayCutoff(): Promise<AlertFinding[]> {
  // ISO-week boundary: get this week's Monday.
  const now = today();
  const day = now.getDay(); // 0=Sun, 5=Fri
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const submissions = await db
    .select()
    .from(pidsrSubmissions)
    .where(sql`week_start_date = ${weekStart} AND week_end_date = ${weekEndIso}`);
  const submittedBarangays = new Set(submissions.map((s) => s.barangay));
  // Pull every barangay from health_stations (BHS only). For simplicity here,
  // we count ANY barangay that doesn't have a submission this week. In a
  // full impl we'd cross-check against the active barangay catalog.
  const allBarangays = await db.execute(sql`SELECT DISTINCT name FROM barangays`);
  const list = ((allBarangays as any).rows ?? allBarangays ?? []) as Array<{ name: string }>;
  const findings: AlertFinding[] = [];
  for (const b of list) {
    if (!submittedBarangays.has(b.name)) {
      findings.push({
        entityType: "PIDSR_SUBMISSION",
        barangayName: b.name,
        reason: `Cat-II PIDSR not submitted this week (${weekStart} → ${weekEndIso})`,
        details: { weekStart, weekEnd: weekEndIso },
      });
    }
  }
  return findings;
}

/**
 * OUTBREAK DETECTOR (Phase 4 — operational-actions framework).
 *
 * Anchored on PIDSR / DOH Outbreak Response (RA 11332, AO 2020-0023).
 * Two flavors of rule:
 *   - SINGLE-CASE: any single confirmed case is automatically a signal
 *     (Cat-I diseases like AFP, cholera, anthrax, meningococcal, NT,
 *      rabies-human, diphtheria).
 *   - CLUSTER: ≥N cases of the condition in the same barangay within
 *     a rolling window (measles, dengue, ABD, HFMD, hepatitis A,
 *      typhoid, pertussis).
 *
 * Window thresholds match the most-cited Field Health Surveillance
 * Manual figures. Aggressive but operationally tractable for an LGU
 * MHO. Tune via the constants below if a province specifies different
 * values.
 */

// Cat-I single-case alerts: 1 case = automatic outbreak signal.
const SINGLE_CASE_DISEASES = [
  "AFP (Acute Flaccid Paralysis)",
  "Cholera suspected",
  "Anthrax",
  "Meningococcal Disease",
  "Neonatal Tetanus",
  "Rabies (human)",
  "Diphtheria",
] as const;
const SINGLE_CASE_LOOKBACK_DAYS = 14;

// Cluster thresholds: ≥threshold cases of `condition` in the same
// barangay within `windowDays`.
const CLUSTER_THRESHOLDS: Array<{ condition: string; windowDays: number; threshold: number }> = [
  { condition: "Measles / Rubella suspected", windowDays: 14, threshold: 2 },
  { condition: "Dengue suspected",            windowDays: 7,  threshold: 3 },
  { condition: "Acute Bloody Diarrhea",       windowDays: 7,  threshold: 3 },
  { condition: "HFMD outbreak",               windowDays: 7,  threshold: 5 },
  { condition: "Hepatitis A",                 windowDays: 28, threshold: 3 },
  { condition: "Typhoid Fever",               windowDays: 28, threshold: 3 },
  { condition: "Pertussis",                   windowDays: 14, threshold: 2 },
  { condition: "Diarrhea (non-bloody)",       windowDays: 7,  threshold: 5 },
];

/**
 * Match a disease_case row against a target condition. Checks both the
 * primary `condition` field AND the `additional_conditions` JSON array
 * since a single case may be co-coded with multiple PIDSR conditions.
 */
function caseMatchesCondition(row: any, target: string): boolean {
  if (row.condition === target) return true;
  const extras = row.additionalConditions ?? row.additional_conditions ?? [];
  return Array.isArray(extras) && extras.includes(target);
}

/** Pull every disease case reported in the last `lookbackDays` days. */
async function getRecentCases(lookbackDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return await db
    .select()
    .from(diseaseCases)
    .where(sql`date_reported >= ${cutoffIso}`);
}

/** Single-case Cat-I alerts. One alert per case. */
async function checkSingleCaseDiseases(): Promise<AlertFinding[]> {
  const recent = await getRecentCases(SINGLE_CASE_LOOKBACK_DAYS);
  const findings: AlertFinding[] = [];
  for (const c of recent) {
    for (const disease of SINGLE_CASE_DISEASES) {
      if (caseMatchesCondition(c, disease)) {
        findings.push({
          entityType: "OUTBREAK_SUSPECTED",
          entityId: String(c.id),
          barangayName: c.barangay,
          reason: `Cat-I disease reported: ${disease} (case ${c.id})`,
          details: {
            disease,
            caseId: c.id,
            patientName: c.patientName,
            dateReported: c.dateReported,
            singleCase: true,
          },
        });
      }
    }
  }
  return findings;
}

/** Cluster threshold breaches. One alert per (condition × barangay) breach. */
async function checkClusterOutbreaks(): Promise<AlertFinding[]> {
  const findings: AlertFinding[] = [];
  // Pull a single batch of cases covering the longest window once,
  // then filter per rule. Cheaper than re-querying for each rule.
  const longestWindow = Math.max(...CLUSTER_THRESHOLDS.map((r) => r.windowDays));
  const recent = await getRecentCases(longestWindow);
  const todayMs = Date.now();
  for (const rule of CLUSTER_THRESHOLDS) {
    const windowMs = rule.windowDays * 86_400_000;
    // Group matching cases by barangay.
    const byBarangay = new Map<string, any[]>();
    for (const c of recent) {
      const reportedMs = new Date(c.dateReported).getTime();
      if (todayMs - reportedMs > windowMs) continue;
      if (!caseMatchesCondition(c, rule.condition)) continue;
      const list = byBarangay.get(c.barangay) ?? [];
      list.push(c);
      byBarangay.set(c.barangay, list);
    }
    for (const [barangay, cases] of Array.from(byBarangay.entries())) {
      if (cases.length < rule.threshold) continue;
      findings.push({
        entityType: "OUTBREAK_SUSPECTED",
        barangayName: barangay,
        reason: `Cluster: ${cases.length} ${rule.condition} cases in ${barangay} within ${rule.windowDays} days (threshold ${rule.threshold})`,
        details: {
          disease: rule.condition,
          caseCount: cases.length,
          windowDays: rule.windowDays,
          threshold: rule.threshold,
          caseIds: cases.map((c: any) => c.id),
        },
      });
    }
  }
  return findings;
}

/** Run all daily 6 AM alerts. */
export async function runDailyAlerts(): Promise<{ jobName: string; count: number }[]> {
  const results: { jobName: string; count: number }[] = [];
  for (const [jobName, fn] of [
    ["license-expiry", checkLicenseExpiry],
    ["stockouts", checkStockouts],
    ["tb-defaulters", checkTbDefaulters],
    ["m1-deadlines", checkM1Deadlines],
    ["outbreak-single-case", checkSingleCaseDiseases],
    ["outbreak-cluster", checkClusterOutbreaks],
  ] as const) {
    try {
      const findings = await fn();
      await writeAlerts(jobName, findings);
      results.push({ jobName, count: findings.length });
    } catch (err) {
      console.error(`[scheduler] ${jobName} failed:`, err);
      results.push({ jobName, count: -1 });
    }
  }
  return results;
}

/** Run the Friday-only weekly check. */
export async function runWeeklyAlerts(): Promise<{ jobName: string; count: number }[]> {
  try {
    const findings = await checkPidsrFridayCutoff();
    await writeAlerts("pidsr-friday-cutoff", findings);
    return [{ jobName: "pidsr-friday-cutoff", count: findings.length }];
  } catch (err) {
    console.error(`[scheduler] pidsr-friday-cutoff failed:`, err);
    return [{ jobName: "pidsr-friday-cutoff", count: -1 }];
  }
}
