import { db } from "../db";
import { oralHealthVisits } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * Oral Health Monthly — first-visit dental tracking by age band, with
 * facility / non-facility split. Section ORAL.
 */
export const oralHealth: ReportDefinition = {
  slug: "oral-health-monthly",
  title: "Oral Health Monthly",
  description: "First-visit dental tracking by age band, facility vs. non-facility. Source: oral_health_visits.",
  cadence: "monthly",
  category: "program",
  source: "DOH National Oral Health Program",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(oralHealthVisits.visitDate, fromDate),
      lte(oralHealthVisits.visitDate, toDate),
      eq(oralHealthVisits.isFirstVisit, true),
    ];
    if (barangay) conds.push(eq(oralHealthVisits.barangay, barangay));
    const rows = await db.select().from(oralHealthVisits).where(and(...conds));

    interface Tile { facility: number; nonFacility: number; total: number }
    const empty = (): Tile => ({ facility: 0, nonFacility: 0, total: 0 });
    const tally = {
      "0-11mo": empty(),
      "1-4y": empty(),
      "5-9y": empty(),
      "10-19y": empty(),
      "20-59y": empty(),
      "60+y": empty(),
      pregnant: empty(),
    };

    for (const r of rows) {
      const dob = new Date(r.dob);
      const ref = new Date(r.visitDate);
      if (isNaN(dob.getTime()) || isNaN(ref.getTime())) continue;
      const ageMos = (ref.getFullYear() - dob.getFullYear()) * 12 + (ref.getMonth() - dob.getMonth());
      const ageYrs = Math.floor(ageMos / 12);
      let band: keyof typeof tally | null = null;
      if (ageMos >= 0 && ageMos <= 11) band = "0-11mo";
      else if (ageYrs >= 1 && ageYrs <= 4) band = "1-4y";
      else if (ageYrs >= 5 && ageYrs <= 9) band = "5-9y";
      else if (ageYrs >= 10 && ageYrs <= 19) band = "10-19y";
      else if (ageYrs >= 20 && ageYrs <= 59) band = "20-59y";
      else if (ageYrs >= 60) band = "60+y";
      if (band) {
        if (r.facilityBased) tally[band].facility++;
        else tally[band].nonFacility++;
        tally[band].total++;
      }
      if (r.isPregnant) {
        if (r.facilityBased) tally.pregnant.facility++;
        else tally.pregnant.nonFacility++;
        tally.pregnant.total++;
      }
    }

    const orderedBands: Array<{ key: keyof typeof tally; label: string }> = [
      { key: "0-11mo", label: "Infants 0–11 mos" },
      { key: "1-4y", label: "Children 1–4 yo" },
      { key: "5-9y", label: "Children 5–9 yo" },
      { key: "10-19y", label: "Adolescents 10–19 yo" },
      { key: "20-59y", label: "Adults 20–59 yo" },
      { key: "60+y", label: "Senior Citizens 60+" },
      { key: "pregnant", label: "Pregnant women" },
    ];

    return {
      columns: [
        { key: "band", label: "Age band", align: "left" },
        { key: "facility", label: "Facility-based", align: "right" },
        { key: "nonFacility", label: "Non-facility", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: orderedBands.map((b) => ({
        id: b.key,
        cells: { band: b.label, ...tally[b.key] },
      })),
      meta: { sourceCount: rows.length, notes: `${rows.length} first-visit records in the period` },
    };
  },
};
