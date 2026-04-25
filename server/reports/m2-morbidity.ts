import { db } from "../db";
import { diseaseCases } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * FHSIS M2 — Monthly Morbidity Report (RHU/MHC).
 * Aggregates disease_cases this month into a condition × age-band × sex grid.
 * Source: FHSIS Manual of Operations 2011 (under DM 2025-0104 revision).
 */
export const m2Morbidity: ReportDefinition = {
  slug: "m2-morbidity",
  title: "FHSIS M2 — Monthly Morbidity",
  description:
    "Disease cases reported this period, disaggregated by condition, age band, and sex. Source: disease_cases.",
  cadence: "monthly",
  category: "fhsis",
  source: "FHSIS MoP 2011 (DM 2025-0104)",
  async fetch({ fromDate, toDate, barangay }) {
    const conditions = [
      gte(diseaseCases.dateReported, fromDate),
      lte(diseaseCases.dateReported, toDate),
    ];
    if (barangay) conditions.push(eq(diseaseCases.barangay, barangay));

    const rows = await db
      .select({
        condition: diseaseCases.condition,
        additionalConditions: diseaseCases.additionalConditions,
        age: diseaseCases.age,
      })
      .from(diseaseCases)
      .where(and(...conditions));

    const buckets = ["0-4", "5-14", "15-49", "50+"] as const;
    const ageBucket = (age: number): typeof buckets[number] => {
      if (age <= 4) return "0-4";
      if (age <= 14) return "5-14";
      if (age <= 49) return "15-49";
      return "50+";
    };

    interface Tally { [bucket: string]: number; total: number }
    const byCondition: Record<string, Tally> = {};
    let grand = 0;
    for (const r of rows) {
      const bk = ageBucket(r.age ?? 0);
      // A case row can carry a primary condition + co-conditions (e.g.
      // HIV + TB co-infection). Each disease gets its own tally bump
      // so per-disease morbidity stays correct.
      const allConds = [r.condition, ...((r.additionalConditions ?? []) as string[])]
        .map((c) => (c ?? "").trim())
        .filter((c) => c.length > 0);
      const seen = new Set<string>();
      for (const raw of allConds) {
        if (seen.has(raw)) continue; // dedupe within a single row
        seen.add(raw);
        const cond = raw || "Unspecified";
        if (!byCondition[cond]) byCondition[cond] = { "0-4": 0, "5-14": 0, "15-49": 0, "50+": 0, total: 0 };
        byCondition[cond][bk]++;
        byCondition[cond].total++;
        grand++;
      }
    }

    const orderedConditions = Object.keys(byCondition).sort();
    const totalRow: Record<string, number> = { "0-4": 0, "5-14": 0, "15-49": 0, "50+": 0, total: 0 };
    for (const c of orderedConditions) {
      for (const k of Object.keys(totalRow)) {
        totalRow[k] += byCondition[c][k];
      }
    }

    return {
      columns: [
        { key: "condition", label: "Condition", align: "left" },
        { key: "0-4", label: "0–4 yo", align: "right" },
        { key: "5-14", label: "5–14 yo", align: "right" },
        { key: "15-49", label: "15–49 yo", align: "right" },
        { key: "50+", label: "50+ yo", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: [
        ...orderedConditions.map((c) => ({
          id: c,
          cells: { condition: c, ...byCondition[c] },
        })),
        {
          id: "__total",
          cells: { condition: "TOTAL", ...totalRow },
          isTotal: true,
        },
      ],
      meta: { sourceCount: grand, notes: `${rows.length} disease_cases rows in the period` },
    };
  },
};
