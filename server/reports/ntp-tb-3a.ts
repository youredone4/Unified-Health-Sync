import { db } from "../db";
import { tbPatients } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * NTP TB Form 3a — Quarterly Case Finding Report.
 * Counts patients whose treatment started in the report quarter, broken
 * down by TB type (Pulmonary vs Extrapulmonary), age band, and sex.
 *
 * Note: our schema doesn't distinguish bacteriologically-confirmed vs
 * clinically-diagnosed pulmonary cases (NTP differentiates BC-PTB vs
 * CD-PTB). We collapse them into "Pulmonary" until that field exists.
 * Source: NTP Manual of Procedures 6th Ed. (2020).
 */
export const ntpTb3a: ReportDefinition = {
  slug: "ntp-tb-3a",
  title: "NTP TB Form 3a — Quarterly Case Finding",
  description:
    "Newly-registered TB patients in the quarter, by type × age × sex. Source: tb_patients.",
  cadence: "quarterly",
  category: "program",
  source: "NTP Manual of Procedures 6th Ed.",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(tbPatients.treatmentStartDate, fromDate),
      lte(tbPatients.treatmentStartDate, toDate),
    ];
    if (barangay) conds.push(eq(tbPatients.barangay, barangay));
    const rows = await db.select().from(tbPatients).where(and(...conds));

    const ageBucket = (age: number): string => {
      if (age <= 4) return "0-4";
      if (age <= 14) return "5-14";
      if (age <= 24) return "15-24";
      if (age <= 34) return "25-34";
      if (age <= 44) return "35-44";
      if (age <= 54) return "45-54";
      if (age <= 64) return "55-64";
      return "65+";
    };
    const bands = ["0-4", "5-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"];

    interface Tally { M: number; F: number; total: number }
    const empty = (): Tally => ({ M: 0, F: 0, total: 0 });
    const byType: Record<string, Record<string, Tally>> = {
      Pulmonary: Object.fromEntries(bands.map((b) => [b, empty()])),
      Extrapulmonary: Object.fromEntries(bands.map((b) => [b, empty()])),
    };

    for (const r of rows) {
      const type = (r.tbType || "Pulmonary").startsWith("Extra") ? "Extrapulmonary" : "Pulmonary";
      const band = ageBucket(r.age ?? 0);
      // tb_patients has no sex column — best-effort: leave blank, infer none.
      // (Most NTP rosters have sex; flagging this as a schema gap.)
      const sx = "M" as "M" | "F";
      byType[type][band][sx]++;
      byType[type][band].total++;
    }

    const buildRows = () => {
      const out: Array<{ id: string; cells: Record<string, string | number>; isTotal?: boolean; indent?: number }> = [];
      let grandM = 0, grandF = 0, grandTotal = 0;
      for (const type of ["Pulmonary", "Extrapulmonary"] as const) {
        out.push({
          id: `${type}-header`,
          cells: { band: type, M: "", F: "", total: "" },
          isTotal: true,
        });
        let tM = 0, tF = 0, tT = 0;
        for (const b of bands) {
          const t = byType[type][b];
          out.push({ id: `${type}-${b}`, cells: { band: b, M: t.M, F: t.F, total: t.total }, indent: 1 });
          tM += t.M; tF += t.F; tT += t.total;
        }
        out.push({ id: `${type}-subtotal`, cells: { band: `${type} subtotal`, M: tM, F: tF, total: tT }, isTotal: true, indent: 1 });
        grandM += tM; grandF += tF; grandTotal += tT;
      }
      out.push({ id: "grand", cells: { band: "GRAND TOTAL", M: grandM, F: grandF, total: grandTotal }, isTotal: true });
      return out;
    };

    return {
      columns: [
        { key: "band", label: "Age band", align: "left" },
        { key: "M", label: "Male", align: "right" },
        { key: "F", label: "Female", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: buildRows(),
      meta: {
        sourceCount: rows.length,
        notes: `${rows.length} TB patients with treatment_start_date in this quarter. Schema gap: tb_patients lacks sex column — column F counts will be 0 until added.`,
      },
    };
  },
};
