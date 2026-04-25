import { db } from "../db";
import {
  mothers, children, tbPatients, fpServiceRecords, deathEvents,
  ncdScreenings, postpartumVisits,
} from "@shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { ReportDefinition, ReportRow } from "./types";

/**
 * LGU Health Scorecard — annual cross-program rollup.
 *
 * Mirrors the headline pillars of the DOH LGU Health Scorecard (DM
 * 2025-0550 for CY2025), drawn from operational tables already in the
 * system. Indicators with DOH-published targets show a Target column
 * and a Status pill (✓ on-target / — near / ⚠ off-target).
 *
 * This is intentionally a SUBSET of the full DOH scorecard — only the
 * pillars we have data for. Pillars that need modules we haven't built
 * (HRH ratios, financial benchmarks, infrastructure scoring) are out
 * of scope for v1.
 */

interface KpiRow {
  pillar: string;
  indicator: string;
  numerator: number;
  denominator: number | null; // null = absolute count, no rate
  target?: number; // 0–100; rate-based target
  source: string;
}

const STATUS = (rate: number, target: number): string => {
  if (rate >= target) return "✓";
  if (rate >= target * 0.9) return "—";
  return "⚠";
};

export const lguScorecard: ReportDefinition = {
  slug: "lgu-health-scorecard",
  title: "LGU Health Scorecard",
  description:
    "Annual cross-program rollup mirroring the DOH LGU Health Scorecard headline pillars. Targets per DM 2025-0550.",
  cadence: "annual",
  category: "performance",
  source: "DOH DM 2025-0550 (LGU HSC CY2025)",
  async fetch({ fromDate, toDate, barangay }) {
    const where = (table: any, dateCol: any) => {
      const c: any[] = [gte(dateCol, fromDate), lte(dateCol, toDate)];
      if (barangay) c.push(eq(table.barangay, barangay));
      return and(...c);
    };

    // ── MNCHN denominator: live births this year ─────────────────────
    const liveBirthRows = await db.select().from(mothers).where(and(
      barangay ? eq(mothers.barangay, barangay) : sql`1=1`,
      eq(mothers.outcome, "live_birth"),
      gte(mothers.outcomeDate, fromDate),
      lte(mothers.outcomeDate, toDate),
    ));
    const liveBirths = liveBirthRows.length;

    // ANC4+: mothers with anc_visits ≥ 4 who delivered this year
    const anc4 = liveBirthRows.filter((m) => (m.ancVisits ?? 0) >= 4).length;

    // Skilled Birth Attendance
    const sba = liveBirthRows.filter((m) =>
      ["physician", "nurse", "midwife"].includes(m.deliveryAttendant ?? ""),
    ).length;

    // Facility-based delivery
    const facilityDel = liveBirthRows.filter((m) =>
      ["hospital", "birthing_center"].includes(m.deliveryLocation ?? ""),
    ).length;

    // PNC (≥ 2 visits) — count of mothers in the live-birth cohort with ≥ 2 postpartum_visits
    const liveBirthIds = liveBirthRows.map((m) => m.id);
    let pnc2 = 0;
    if (liveBirthIds.length > 0) {
      const pncRows = await db.select().from(postpartumVisits);
      const visitsByMother: Record<number, number> = {};
      for (const v of pncRows) {
        if (!liveBirthIds.includes(v.motherId)) continue;
        visitsByMother[v.motherId] = (visitsByMother[v.motherId] ?? 0) + 1;
      }
      pnc2 = Object.values(visitsByMother).filter((c) => c >= 2).length;
    }

    // ── Child immunization (BCG, Penta-3, MCV-1) ─────────────────────
    const childRows = await db.select().from(children).where(
      barangay ? eq(children.barangay, barangay) : sql`1=1`,
    );
    const fullyImmunized = (vacs: any) => {
      if (!vacs) return false;
      return ["bcg", "penta1", "penta2", "penta3", "opv1", "opv2", "opv3", "mr1"].every((k) => vacs[k]);
    };
    let bcg = 0, penta3 = 0, mr1 = 0, fic = 0, eligible = 0;
    for (const c of childRows) {
      if (!c.dob) continue;
      const dobYr = new Date(c.dob).getFullYear();
      // Only count children whose 1st year of life overlaps with the report year
      if (dobYr < (Number(fromDate.slice(0, 4)) - 1) || dobYr > Number(toDate.slice(0, 4))) continue;
      eligible++;
      const v: any = c.vaccines ?? {};
      if (v.bcg) bcg++;
      if (v.penta3) penta3++;
      if (v.mr1) mr1++;
      if (fullyImmunized(v)) fic++;
    }

    // ── TB ──────────────────────────────────────────────────────────
    const tbRows = await db.select().from(tbPatients).where(
      barangay ? eq(tbPatients.barangay, barangay) : sql`1=1`,
    );
    const newTbThisYear = tbRows.filter((t) => t.treatmentStartDate >= fromDate && t.treatmentStartDate <= toDate).length;
    // 5a-style cohort: those started this year + already evaluated
    const completed = tbRows.filter((t) => t.treatmentStartDate >= fromDate && t.treatmentStartDate <= toDate && t.outcomeStatus === "Completed").length;

    // ── FP (CPR proxy) ──────────────────────────────────────────────
    const fpRows = await db.select().from(fpServiceRecords).where(
      barangay ? eq(fpServiceRecords.barangay, barangay) : sql`1=1`,
    );
    const cuFp = fpRows.filter((r) => r.fpStatus === "CURRENT_USER").length;

    // ── NCD (HTN diagnosed adults 20+) ──────────────────────────────
    const ncdRows = await db.select().from(ncdScreenings).where(where(ncdScreenings, ncdScreenings.screenDate));
    const htnDiagnosed = ncdRows.filter((r) => r.condition === "HTN" && r.diagnosed).length;
    const htnOnMeds = ncdRows.filter((r) => r.condition === "HTN" && r.diagnosed && r.medsProvided).length;

    // ── Mortality — IMR / U5MR / total deaths ───────────────────────
    const deRows = await db.select().from(deathEvents).where(where(deathEvents, deathEvents.dateOfDeath));
    let infant = 0, under5 = 0, neonatal = 0, maternal = 0;
    for (const r of deRows) {
      const ageDays = r.ageDays ?? null;
      const ageYrs = r.age ?? null;
      const ageMos = ageDays !== null ? Math.floor(ageDays / 30) : (ageYrs !== null ? ageYrs * 12 : null);
      if (ageMos !== null && ageMos < 12) infant++;
      if (ageMos !== null && ageMos < 60) under5++;
      if (ageDays !== null && ageDays <= 28) neonatal++;
      if (r.maternalDeathCause) maternal++;
    }

    // ── Build KPI rows ──────────────────────────────────────────────
    const kpis: KpiRow[] = [
      { pillar: "Maternal", indicator: "ANC4+ coverage", numerator: anc4, denominator: liveBirths, target: 80, source: "mothers.anc_visits" },
      { pillar: "Maternal", indicator: "Skilled Birth Attendance", numerator: sba, denominator: liveBirths, target: 90, source: "mothers.delivery_attendant" },
      { pillar: "Maternal", indicator: "Facility-based delivery", numerator: facilityDel, denominator: liveBirths, target: 80, source: "mothers.delivery_location" },
      { pillar: "Maternal", indicator: "PNC ≥ 2 visits coverage", numerator: pnc2, denominator: liveBirths, target: 80, source: "postpartum_visits" },
      { pillar: "Child", indicator: "BCG coverage (eligible cohort)", numerator: bcg, denominator: eligible, target: 95, source: "children.vaccines.bcg" },
      { pillar: "Child", indicator: "Penta-3 coverage", numerator: penta3, denominator: eligible, target: 90, source: "children.vaccines.penta3" },
      { pillar: "Child", indicator: "MCV-1 coverage", numerator: mr1, denominator: eligible, target: 95, source: "children.vaccines.mr1" },
      { pillar: "Child", indicator: "Fully Immunized Child (FIC)", numerator: fic, denominator: eligible, target: 95, source: "children.vaccines (composite)" },
      { pillar: "TB", indicator: "Newly registered TB patients", numerator: newTbThisYear, denominator: null, source: "tb_patients" },
      { pillar: "TB", indicator: "Treatment completion (this year cohort)", numerator: completed, denominator: newTbThisYear, target: 90, source: "tb_patients.outcomeStatus" },
      { pillar: "FP", indicator: "Current FP users (registered)", numerator: cuFp, denominator: null, source: "fp_service_records" },
      { pillar: "NCD", indicator: "HTN diagnoses (this year)", numerator: htnDiagnosed, denominator: null, source: "ncd_screenings" },
      { pillar: "NCD", indicator: "HTN — provided meds", numerator: htnOnMeds, denominator: htnDiagnosed, target: 80, source: "ncd_screenings" },
      { pillar: "Mortality", indicator: "Total deaths", numerator: deRows.length, denominator: null, source: "death_events" },
      { pillar: "Mortality", indicator: "Neonatal deaths (0–28d)", numerator: neonatal, denominator: null, source: "death_events.age_days" },
      { pillar: "Mortality", indicator: "Infant deaths (0–11mo)", numerator: infant, denominator: null, source: "death_events" },
      { pillar: "Mortality", indicator: "Under-5 deaths (0–59mo)", numerator: under5, denominator: null, source: "death_events" },
      { pillar: "Mortality", indicator: "Maternal deaths", numerator: maternal, denominator: null, source: "death_events.maternal_death_cause" },
    ];

    let currentPillar = "";
    const rows: ReportRow[] = [];
    for (const k of kpis) {
      if (k.pillar !== currentPillar) {
        rows.push({
          id: `pillar-${k.pillar}`,
          cells: { indicator: k.pillar, numerator: "", denominator: "", rate: "", target: "", status: "" },
          isTotal: true,
        });
        currentPillar = k.pillar;
      }
      const rate = k.denominator && k.denominator > 0 ? (k.numerator / k.denominator) * 100 : null;
      const rateStr = rate === null ? "—" : `${Math.round(rate * 10) / 10}%`;
      const targetStr = k.target ? `${k.target}%` : "—";
      const statusStr = rate !== null && k.target ? STATUS(rate, k.target) : "—";
      rows.push({
        id: `${k.pillar}-${k.indicator}`,
        cells: {
          indicator: k.indicator,
          numerator: k.numerator,
          denominator: k.denominator ?? "—",
          rate: rateStr,
          target: targetStr,
          status: statusStr,
        },
        indent: 1,
      });
    }

    return {
      columns: [
        { key: "indicator", label: "Indicator", align: "left" },
        { key: "numerator", label: "Num", align: "right" },
        { key: "denominator", label: "Denom", align: "right" },
        { key: "rate", label: "Rate", align: "right" },
        { key: "target", label: "Target", align: "right" },
        { key: "status", label: "Status", align: "center" },
      ],
      rows,
      meta: {
        sourceCount: liveBirths,
        notes: `Live-birth denominator: ${liveBirths}. Targets per DOH DM 2025-0550. Status: ✓ on-target, — within 10% of target, ⚠ off-target.`,
      },
    };
  },
};
