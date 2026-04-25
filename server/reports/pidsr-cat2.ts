import { db } from "../db";
import { diseaseCases } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * PIDSR Cat-II Weekly Notifiable Disease Report (WNDR) line list.
 * Submitted Friday cutoff per RA 11332 + PIDSR MoP 2nd Ed. 2014.
 * This is a *line list* (one row per case), not an aggregator.
 */
export const pidsrCat2: ReportDefinition = {
  slug: "pidsr-cat2-wndr",
  title: "PIDSR Cat-II Weekly (WNDR)",
  description:
    "Line list of Cat-II notifiable disease cases for the week. Submitted to MESU/PESU each Friday. Source: disease_cases.",
  cadence: "weekly",
  category: "surveillance",
  source: "RA 11332 / PIDSR MoP 2nd Ed.",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(diseaseCases.dateReported, fromDate),
      lte(diseaseCases.dateReported, toDate),
    ];
    if (barangay) conds.push(eq(diseaseCases.barangay, barangay));
    const rows = await db.select().from(diseaseCases).where(and(...conds));

    return {
      columns: [
        { key: "dateReported", label: "Date reported", align: "left" },
        { key: "patientName", label: "Patient", align: "left" },
        { key: "age", label: "Age", align: "right" },
        { key: "barangay", label: "Barangay", align: "left" },
        { key: "condition", label: "Condition", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "notes", label: "Notes", align: "left" },
      ],
      rows: rows.map((r) => ({
        id: String(r.id),
        cells: {
          dateReported: r.dateReported,
          patientName: r.patientName,
          age: r.age ?? "",
          barangay: r.barangay,
          condition: r.condition,
          status: r.status ?? "",
          notes: r.notes ?? "",
        },
      })),
      meta: { sourceCount: rows.length, notes: `${rows.length} cases in the week` },
    };
  },
};
