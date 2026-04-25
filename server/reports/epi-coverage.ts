import { db } from "../db";
import { children } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * EPI Monthly Coverage — doses given this period.
 * children.vaccines is a JSON map of antigen → dose date string. We count
 * children whose dose date for the antigen falls in the period.
 */
const ANTIGENS: Array<{ key: string; label: string }> = [
  { key: "bcg", label: "BCG" },
  { key: "hepB", label: "Hep-B birth dose" },
  { key: "penta1", label: "Pentavalent 1" },
  { key: "penta2", label: "Pentavalent 2" },
  { key: "penta3", label: "Pentavalent 3" },
  { key: "opv1", label: "OPV 1" },
  { key: "opv2", label: "OPV 2" },
  { key: "opv3", label: "OPV 3" },
  { key: "ipv1", label: "IPV 1" },
  { key: "ipv2", label: "IPV 2" },
  { key: "mr1", label: "MCV-1 (MR)" },
  { key: "mr2", label: "MCV-2 (MR)" },
];

export const epiCoverage: ReportDefinition = {
  slug: "epi-coverage",
  title: "EPI Monthly Coverage",
  description: "Doses given this period by antigen and sex. Source: children.vaccines.",
  cadence: "monthly",
  category: "program",
  source: "DOH NIP — Booklets 1–10",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [];
    if (barangay) conds.push(eq(children.barangay, barangay));
    const rows = await db
      .select({
        sex: children.sex,
        vaccines: children.vaccines,
      })
      .from(children)
      .where(conds.length ? and(...conds) : undefined);

    type Tally = { M: number; F: number; total: number };
    const tally: Record<string, Tally> = Object.fromEntries(
      ANTIGENS.map((a) => [a.key, { M: 0, F: 0, total: 0 }]),
    );

    for (const r of rows) {
      const v = (r.vaccines || {}) as Record<string, string | null | undefined>;
      const sx = (r.sex || "").toLowerCase() === "female" ? "F" : "M";
      for (const a of ANTIGENS) {
        const d = v[a.key];
        if (!d) continue;
        if (d >= fromDate && d <= toDate) {
          tally[a.key][sx as "M" | "F"]++;
          tally[a.key].total++;
        }
      }
    }

    let totalDoses = 0;
    for (const a of ANTIGENS) totalDoses += tally[a.key].total;

    return {
      columns: [
        { key: "antigen", label: "Antigen", align: "left" },
        { key: "M", label: "Male", align: "right" },
        { key: "F", label: "Female", align: "right" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows: ANTIGENS.map((a) => ({
        id: a.key,
        cells: { antigen: a.label, ...tally[a.key] },
      })),
      meta: { sourceCount: totalDoses, notes: `Counted across ${rows.length} children records` },
    };
  },
};
