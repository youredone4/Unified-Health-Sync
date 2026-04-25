import { db } from "../db";
import { ncdScreenings } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * NCD Treatment (Section G2 / G3-reserved).
 * HTN/DM screenings + meds-source split, age-banded.
 */
export const ncdTreatment: ReportDefinition = {
  slug: "ncd-treatment",
  title: "NCD Treatment Monthly",
  description:
    "Hypertension and diabetes diagnoses + medication source (facility / out-of-pocket). Source: ncd_screenings.",
  cadence: "monthly",
  category: "program",
  source: "DOH NCD Program; PhilPEN MoO",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(ncdScreenings.screenDate, fromDate),
      lte(ncdScreenings.screenDate, toDate),
    ];
    if (barangay) conds.push(eq(ncdScreenings.barangay, barangay));
    const rows = await db.select().from(ncdScreenings).where(and(...conds));

    const ageOf = (dob: string, ref: string): number => {
      const d = new Date(dob), r = new Date(ref);
      if (isNaN(d.getTime()) || isNaN(r.getTime())) return -1;
      let y = r.getFullYear() - d.getFullYear();
      const md = r.getMonth() - d.getMonth();
      if (md < 0 || (md === 0 && r.getDate() < d.getDate())) y--;
      return y;
    };

    interface Group { adultsM: number; adultsF: number; seniorsM: number; seniorsF: number; total: number }
    const empty = (): Group => ({ adultsM: 0, adultsF: 0, seniorsM: 0, seniorsF: 0, total: 0 });
    const tally = {
      htnScreened: empty(),
      htnDiagnosed: empty(),
      htnMedsFacility: empty(),
      htnMedsOOP: empty(),
      dmScreened: empty(),
      dmDiagnosed: empty(),
      dmMedsFacility: empty(),
      dmMedsOOP: empty(),
    };

    const incr = (g: Group, age: number, sex: string) => {
      const senior = age >= 60;
      const sx = sex === "F" ? "F" : "M";
      if (senior) {
        if (sx === "F") g.seniorsF++; else g.seniorsM++;
      } else if (age >= 20 && age <= 59) {
        if (sx === "F") g.adultsF++; else g.adultsM++;
      } else return;
      g.total++;
    };

    for (const r of rows) {
      const age = ageOf(r.dob, r.screenDate);
      if (age < 20) continue;
      const isHTN = r.condition === "HTN";
      const isDM = r.condition === "DM";

      if (isHTN) {
        incr(tally.htnScreened, age, r.sex);
        if (r.diagnosed) incr(tally.htnDiagnosed, age, r.sex);
        if (r.medsProvided && r.medsSource === "FACILITY") incr(tally.htnMedsFacility, age, r.sex);
        if (r.medsProvided && r.medsSource === "OUT_OF_POCKET") incr(tally.htnMedsOOP, age, r.sex);
      }
      if (isDM) {
        incr(tally.dmScreened, age, r.sex);
        if (r.diagnosed) incr(tally.dmDiagnosed, age, r.sex);
        if (r.medsProvided && r.medsSource === "FACILITY") incr(tally.dmMedsFacility, age, r.sex);
        if (r.medsProvided && r.medsSource === "OUT_OF_POCKET") incr(tally.dmMedsOOP, age, r.sex);
      }
    }

    const indicators: Array<{ key: keyof typeof tally; label: string; indent?: number }> = [
      { key: "htnScreened", label: "HTN — Screened" },
      { key: "htnDiagnosed", label: "Diagnosed", indent: 1 },
      { key: "htnMedsFacility", label: "Meds — Facility (100%)", indent: 1 },
      { key: "htnMedsOOP", label: "Meds — Out of pocket", indent: 1 },
      { key: "dmScreened", label: "DM — Screened" },
      { key: "dmDiagnosed", label: "Diagnosed", indent: 1 },
      { key: "dmMedsFacility", label: "Meds — Facility (100%)", indent: 1 },
      { key: "dmMedsOOP", label: "Meds — Out of pocket", indent: 1 },
    ];

    return {
      columns: [
        { key: "indicator", label: "Indicator", align: "left" },
        { key: "adultsM", label: "20–59 M", align: "right" },
        { key: "adultsF", label: "20–59 F", align: "right" },
        { key: "seniorsM", label: "60+ M", align: "right" },
        { key: "seniorsF", label: "60+ F", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: indicators.map((i) => ({
        id: i.key,
        cells: { indicator: i.label, ...tally[i.key] },
        indent: i.indent,
      })),
      meta: { sourceCount: rows.length, notes: `${rows.length} ncd_screenings rows in the period` },
    };
  },
};
