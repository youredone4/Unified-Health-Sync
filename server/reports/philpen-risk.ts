import { db } from "../db";
import { philpenAssessments } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * PhilPEN Risk Profile (Section G1).
 * Adults 20-59 yo assessed using PhilPEN, broken down by risk factor × sex.
 */
export const philpenRisk: ReportDefinition = {
  slug: "philpen-risk-profile",
  title: "PhilPEN Risk Profile",
  description:
    "Adults 20–59 yo assessed using PhilPEN this period, broken down by risk factor × sex. Source: philpen_assessments.",
  cadence: "monthly",
  category: "program",
  source: "DOH PhilPEN MoO; AO 2012-0029 / 2020-0044",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(philpenAssessments.assessmentDate, fromDate),
      lte(philpenAssessments.assessmentDate, toDate),
    ];
    if (barangay) conds.push(eq(philpenAssessments.barangay, barangay));
    const rows = await db.select().from(philpenAssessments).where(and(...conds));

    const ageOf = (dob: string, ref: string): number => {
      const d = new Date(dob), r = new Date(ref);
      if (isNaN(d.getTime()) || isNaN(r.getTime())) return -1;
      let y = r.getFullYear() - d.getFullYear();
      const md = r.getMonth() - d.getMonth();
      if (md < 0 || (md === 0 && r.getDate() < d.getDate())) y--;
      return y;
    };

    type Tally = { M: number; F: number; total: number };
    const factors: Array<{ key: string; label: string; predicate: (r: typeof rows[number]) => boolean }> = [
      { key: "assessed", label: "Total assessed", predicate: () => true },
      { key: "smoking", label: "Smoking history", predicate: (r) => !!r.smokingHistory },
      { key: "binge", label: "Binge drinker", predicate: (r) => !!r.bingeDrinker },
      { key: "inactive", label: "Insufficient activity", predicate: (r) => !!r.insufficientActivity },
      { key: "diet", label: "Unhealthy diet", predicate: (r) => !!r.unhealthyDiet },
      { key: "overweight", label: "Overweight", predicate: (r) => r.bmiCategory === "OVERWEIGHT" },
      { key: "obese", label: "Obese", predicate: (r) => r.bmiCategory === "OBESE" },
    ];
    const tally: Record<string, Tally> = Object.fromEntries(factors.map((f) => [f.key, { M: 0, F: 0, total: 0 }]));

    let inAgeRange = 0;
    for (const r of rows) {
      const age = ageOf(r.dob, r.assessmentDate);
      if (age < 20 || age > 59) continue;
      inAgeRange++;
      const sx = r.sex === "F" ? "F" : "M";
      for (const f of factors) {
        if (!f.predicate(r)) continue;
        tally[f.key][sx as "M" | "F"]++;
        tally[f.key].total++;
      }
    }

    return {
      columns: [
        { key: "factor", label: "Indicator", align: "left" },
        { key: "M", label: "Male", align: "right" },
        { key: "F", label: "Female", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: factors.map((f) => ({
        id: f.key,
        cells: { factor: f.label, ...tally[f.key] },
        isTotal: f.key === "assessed",
      })),
      meta: {
        sourceCount: inAgeRange,
        notes: `${inAgeRange} of ${rows.length} assessments fell in the 20–59 age range`,
      },
    };
  },
};
