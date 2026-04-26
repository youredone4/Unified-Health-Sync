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

/** Run all daily 6 AM alerts. */
export async function runDailyAlerts(): Promise<{ jobName: string; count: number }[]> {
  const results: { jobName: string; count: number }[] = [];
  for (const [jobName, fn] of [
    ["license-expiry", checkLicenseExpiry],
    ["stockouts", checkStockouts],
    ["tb-defaulters", checkTbDefaulters],
    ["m1-deadlines", checkM1Deadlines],
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
