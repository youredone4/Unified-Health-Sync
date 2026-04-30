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
  deathReviews,
  aefiEvents,
  auditLogs,
  fpServiceRecords,
  ncdScreenings,
  children,
  outbreaks,
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

// Auto-create or refresh an open outbreaks row for a (disease, barangay).
// The partial unique index outbreaks_open_unique_idx guarantees at most one
// non-CLOSED row per pair, so this becomes an upsert. Updates case_count and
// case_ids on every run so the lifecycle page always shows latest data.
async function upsertOpenOutbreak(args: {
  disease: string; barangay: string; caseCount: number; caseIds: number[]; windowDays?: number | null;
}) {
  await db.execute(sql`
    INSERT INTO outbreaks (disease, barangay, case_count, case_ids, window_days)
    VALUES (${args.disease}, ${args.barangay}, ${args.caseCount}, ${JSON.stringify(args.caseIds)}::jsonb, ${args.windowDays ?? null})
    ON CONFLICT (disease, barangay) WHERE status != 'CLOSED'
    DO UPDATE SET case_count = EXCLUDED.case_count,
                  case_ids   = EXCLUDED.case_ids,
                  window_days = EXCLUDED.window_days
  `);
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
        await upsertOpenOutbreak({ disease, barangay: c.barangay, caseCount: 1, caseIds: [c.id] });
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
      const caseIds = cases.map((c: any) => c.id as number);
      findings.push({
        entityType: "OUTBREAK_SUSPECTED",
        barangayName: barangay,
        reason: `Cluster: ${cases.length} ${rule.condition} cases in ${barangay} within ${rule.windowDays} days (threshold ${rule.threshold})`,
        details: {
          disease: rule.condition,
          caseCount: cases.length,
          windowDays: rule.windowDays,
          threshold: rule.threshold,
          caseIds,
        },
      });
      await upsertOpenOutbreak({
        disease: rule.condition, barangay, caseCount: cases.length, caseIds, windowDays: rule.windowDays,
      });
    }
  }
  return findings;
}

/**
 * Death-review deadlines (Phase 5).
 * - Open reviews where `due_date <= today + 7 days` and not yet REVIEWED/CLOSED
 *   → "deadline approaching" alert.
 * - Open reviews already past `due_date` → "overdue" alert.
 */
async function checkDeathReviewDeadlines(): Promise<AlertFinding[]> {
  const todayStr = todayIso();
  const sevenOut = daysFromNowIso(7);
  const open = await db
    .select()
    .from(deathReviews)
    .where(sql`status NOT IN ('REVIEWED', 'CLOSED')`);
  const findings: AlertFinding[] = [];
  for (const r of open) {
    if (r.dueDate < todayStr) {
      findings.push({
        entityType: "DEATH_REVIEW",
        entityId: String(r.id),
        barangayName: r.barangayName,
        reason: `${r.reviewType} review OVERDUE (due ${r.dueDate}, status ${r.status})`,
        details: { reviewType: r.reviewType, status: r.status, dueDate: r.dueDate, deathEventId: r.deathEventId },
      });
    } else if (r.dueDate <= sevenOut) {
      findings.push({
        entityType: "DEATH_REVIEW",
        entityId: String(r.id),
        barangayName: r.barangayName,
        reason: `${r.reviewType} review deadline in ≤7 days (due ${r.dueDate}, status ${r.status})`,
        details: { reviewType: r.reviewType, status: r.status, dueDate: r.dueDate, deathEventId: r.deathEventId },
      });
    }
  }
  return findings;
}

/**
 * AEFI report SLA (Phase 6).
 * - SERIOUS not reported to CHD within 24h of eventDate → CRITICAL.
 * - NON_SERIOUS not reported within 7d → REMINDER.
 * Stops alerting once reportedToChd flips true.
 */
async function checkAefiReportSlas(): Promise<AlertFinding[]> {
  const now = today();
  const oneDayAgo = new Date(now); oneDayAgo.setDate(now.getDate() - 1);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const oneDayAgoIso = oneDayAgo.toISOString().slice(0, 10);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);
  const open = await db
    .select()
    .from(aefiEvents)
    .where(sql`reported_to_chd = false`);
  const findings: AlertFinding[] = [];
  for (const e of open) {
    if (e.severity === "SERIOUS" && e.eventDate <= oneDayAgoIso) {
      findings.push({
        entityType: "AEFI_EVENT",
        entityId: String(e.id),
        barangayName: e.barangay,
        reason: `SERIOUS AEFI not reported to CHD within 24h (event ${e.eventDate})`,
        details: { vaccineGiven: e.vaccineGiven, eventDate: e.eventDate, severity: e.severity },
      });
    } else if (e.severity === "NON_SERIOUS" && e.eventDate <= sevenDaysAgoIso) {
      findings.push({
        entityType: "AEFI_EVENT",
        entityId: String(e.id),
        barangayName: e.barangay,
        reason: `NON-SERIOUS AEFI not reported to CHD within 7d (event ${e.eventDate})`,
        details: { vaccineGiven: e.vaccineGiven, eventDate: e.eventDate, severity: e.severity },
      });
    }
  }
  return findings;
}

// ─── Phase 8: defaulter detectors ────────────────────────────────────────────
// FP, immunization, and NCD follow-up gaps are surfaced as SYSTEM_ALERTs so
// they appear in the MGMT inbox (Phase 7) alongside referrals and AEFI signals.
// Resupply-cadence thresholds follow DOH/POPCOM guidance for FP and the EPI
// schedule for childhood immunization. NCD follow-up assumes the standard
// 3-month cycle for diagnosed + medicated patients.

const FP_RESUPPLY_DAYS: Record<string, number> = {
  DMPA:        90,   // injectable, every 12 weeks
  PILLS_POP:   35,   // monthly
  PILLS_COC:   35,
  IMPLANT:     400,  // annual check
  IUD_INTERVAL:400,
  IUD_PP:      400,
};

/** FP missed visit: CURRENT_USER on a resupply method whose latest record is past the cadence. */
async function checkFpMissedVisits(): Promise<AlertFinding[]> {
  const records = await db
    .select()
    .from(fpServiceRecords)
    .where(sql`fp_status = 'CURRENT_USER'`);
  // Reduce to latest record per (patientName, barangay, fpMethod)
  const latest = new Map<string, typeof records[number]>();
  for (const r of records) {
    const key = `${r.patientName}|${r.barangay}|${r.fpMethod}`;
    const prev = latest.get(key);
    if (!prev || r.dateStarted > prev.dateStarted) latest.set(key, r);
  }
  const todayMs = today().getTime();
  const findings: AlertFinding[] = [];
  for (const r of Array.from(latest.values())) {
    const threshold = FP_RESUPPLY_DAYS[r.fpMethod];
    if (!threshold) continue;
    const last = new Date(r.dateStarted).getTime();
    if (Number.isNaN(last)) continue;
    const ageDays = Math.floor((todayMs - last) / (1000 * 60 * 60 * 24));
    if (ageDays > threshold) {
      findings.push({
        entityType: "FP_DEFAULTER",
        entityId: String(r.id),
        barangayName: r.barangay,
        reason: `FP resupply overdue — ${r.fpMethod} (last visit ${r.dateStarted}, ${ageDays}d ago)`,
        details: { patientName: r.patientName, fpMethod: r.fpMethod, lastVisit: r.dateStarted, ageDays },
      });
    }
  }
  return findings;
}

/** Immunization missed dose: child past the EPI age for a dose with no record of it. */
// Each milestone: vaccine key on the children.vaccines jsonb, age in months at
// which the dose is due, with a 30-day grace period before we alert.
const EPI_MILESTONES: { key: string; ageMonths: number; label: string }[] = [
  { key: "bcg",    ageMonths: 1,  label: "BCG" },
  { key: "penta1", ageMonths: 3,  label: "Penta-1" },
  { key: "penta2", ageMonths: 4,  label: "Penta-2" },
  { key: "penta3", ageMonths: 5,  label: "Penta-3" },
  { key: "opv1",   ageMonths: 3,  label: "OPV-1" },
  { key: "opv2",   ageMonths: 4,  label: "OPV-2" },
  { key: "opv3",   ageMonths: 5,  label: "OPV-3" },
  { key: "mr1",    ageMonths: 10, label: "MR-1" },
  { key: "mr2",    ageMonths: 13, label: "MR-2" },
];

async function checkImmunizationMissedDoses(): Promise<AlertFinding[]> {
  const kids = await db.select().from(children);
  const now = today();
  const findings: AlertFinding[] = [];
  for (const c of kids) {
    if (!c.dob) continue;
    const dob = new Date(c.dob);
    if (Number.isNaN(dob.getTime())) continue;
    const ageMonths = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (ageMonths > 24) continue; // EPI primary series done by 24m
    const v = (c.vaccines ?? {}) as Record<string, string | undefined>;
    const missing: string[] = [];
    for (const m of EPI_MILESTONES) {
      if (ageMonths >= m.ageMonths && !v[m.key]) missing.push(m.label);
    }
    if (missing.length > 0) {
      findings.push({
        entityType: "EPI_DEFAULTER",
        entityId: String(c.id),
        barangayName: c.barangay,
        reason: `Immunization overdue — missing ${missing.join(", ")} (age ${ageMonths}m)`,
        details: { childName: c.name, ageMonths, missing },
      });
    }
  }
  return findings;
}

/** NCD missed follow-up: diagnosed + medicated patient with no visit in >100d. */
async function checkNcdMissedFollowUps(): Promise<AlertFinding[]> {
  const records = await db
    .select()
    .from(ncdScreenings)
    .where(sql`diagnosed = true AND meds_provided = true`);
  const latest = new Map<string, typeof records[number]>();
  for (const r of records) {
    const key = `${r.patientName}|${r.barangay}|${r.condition}`;
    const prev = latest.get(key);
    if (!prev || r.screenDate > prev.screenDate) latest.set(key, r);
  }
  const todayMs = today().getTime();
  const findings: AlertFinding[] = [];
  for (const r of Array.from(latest.values())) {
    const last = new Date(r.screenDate).getTime();
    if (Number.isNaN(last)) continue;
    const ageDays = Math.floor((todayMs - last) / (1000 * 60 * 60 * 24));
    if (ageDays > 100) {
      findings.push({
        entityType: "NCD_DEFAULTER",
        entityId: String(r.id),
        barangayName: r.barangay,
        reason: `NCD follow-up overdue — ${r.condition} (last visit ${r.screenDate}, ${ageDays}d ago)`,
        details: { patientName: r.patientName, condition: r.condition, lastVisit: r.screenDate, ageDays },
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
    ["death-review-deadlines", checkDeathReviewDeadlines],
    ["aefi-report-slas", checkAefiReportSlas],
    ["fp-missed-visit", checkFpMissedVisits],
    ["immunization-missed-dose", checkImmunizationMissedDoses],
    ["ncd-missed-follow-up", checkNcdMissedFollowUps],
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
