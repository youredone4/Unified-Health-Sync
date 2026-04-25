import { db } from "../db";
import { fpServiceRecords, FP_METHODS, FP_STATUSES, FP_METHOD_ROW_KEY } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * DOH FP Form 1 — Monthly FP Service Report.
 * Per the PH Family Planning Handbook 2023 + FHSIS FP grid.
 * Method × age × CU/NA, like the M1 FP rows.
 */
export const fpForm1: ReportDefinition = {
  slug: "fp-form-1",
  title: "FP Form 1 — Monthly FP Service",
  description: "Family Planning current users + new acceptors by method × age band. Source: fp_service_records.",
  cadence: "monthly",
  category: "program",
  source: "PH Family Planning Handbook 2023",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(fpServiceRecords.dateStarted, fromDate),
      lte(fpServiceRecords.dateStarted, toDate),
    ];
    if (barangay) conds.push(eq(fpServiceRecords.barangay, barangay));

    const rows = await db
      .select({
        fpMethod: fpServiceRecords.fpMethod,
        fpStatus: fpServiceRecords.fpStatus,
        dob: fpServiceRecords.dob,
      })
      .from(fpServiceRecords)
      .where(and(...conds));

    const endOfMonth = new Date(toDate);
    const ageOf = (dob: string | null): "10-14" | "15-19" | "20-49" | null => {
      if (!dob) return null;
      const d = new Date(dob);
      if (isNaN(d.getTime())) return null;
      let age = endOfMonth.getUTCFullYear() - d.getUTCFullYear();
      const m = endOfMonth.getUTCMonth() - d.getUTCMonth();
      if (m < 0 || (m === 0 && endOfMonth.getUTCDate() < d.getUTCDate())) age--;
      if (age >= 10 && age <= 14) return "10-14";
      if (age >= 15 && age <= 19) return "15-19";
      if (age >= 20 && age <= 49) return "20-49";
      return null;
    };

    interface Tally { CU: { "10-14": number; "15-19": number; "20-49": number }; NA: { "10-14": number; "15-19": number; "20-49": number } }
    const tally: Record<string, Tally> = {};
    for (const m of FP_METHODS) {
      tally[m] = {
        CU: { "10-14": 0, "15-19": 0, "20-49": 0 },
        NA: { "10-14": 0, "15-19": 0, "20-49": 0 },
      };
    }
    let total = 0;
    for (const r of rows) {
      const bk = ageOf(r.dob);
      if (!bk) continue;
      const prefix = r.fpStatus === "CURRENT_USER" ? "CU" : r.fpStatus === "NEW_ACCEPTOR" ? "NA" : null;
      if (!prefix) continue;
      if (!tally[r.fpMethod]) continue;
      tally[r.fpMethod][prefix][bk]++;
      total++;
    }

    return {
      columns: [
        { key: "method", label: "Method", align: "left" },
        { key: "rowKey", label: "M1 row", align: "left" },
        { key: "cu_10_14", label: "CU 10–14", align: "right" },
        { key: "cu_15_19", label: "CU 15–19", align: "right" },
        { key: "cu_20_49", label: "CU 20–49", align: "right" },
        { key: "cu_total", label: "CU TOTAL", align: "right" },
        { key: "na_10_14", label: "NA 10–14", align: "right" },
        { key: "na_15_19", label: "NA 15–19", align: "right" },
        { key: "na_20_49", label: "NA 20–49", align: "right" },
        { key: "na_total", label: "NA TOTAL", align: "right" },
      ],
      rows: FP_METHODS.map((m) => {
        const t = tally[m];
        const cuTotal = t.CU["10-14"] + t.CU["15-19"] + t.CU["20-49"];
        const naTotal = t.NA["10-14"] + t.NA["15-19"] + t.NA["20-49"];
        return {
          id: m,
          cells: {
            method: m,
            rowKey: (FP_METHOD_ROW_KEY as Record<string, string | null>)[m] ?? "",
            cu_10_14: t.CU["10-14"],
            cu_15_19: t.CU["15-19"],
            cu_20_49: t.CU["20-49"],
            cu_total: cuTotal,
            na_10_14: t.NA["10-14"],
            na_15_19: t.NA["15-19"],
            na_20_49: t.NA["20-49"],
            na_total: naTotal,
          },
        };
      }),
      meta: { sourceCount: total, notes: `${rows.length} fp_service_records rows in the period` },
    };
  },
};
