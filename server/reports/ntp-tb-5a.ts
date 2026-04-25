import { db } from "../db";
import { tbPatients } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * NTP TB Form 5a — Quarterly Treatment Outcome Report.
 *
 * Cohort definition: patients whose treatment_start_date falls in the
 * picked quarter. The report shows their CURRENT outcome distribution.
 *
 * In NTP MoP 6th Ed., 5a is normally evaluated 12-15 months after
 * registration so the cohort has had time to complete the standard
 * 6-month regimen. We don't enforce that — the report just queries the
 * picked quarter. The user picks an old quarter for a meaningful 5a.
 *
 * Outcome mapping (our outcomeStatus → NTP outcome):
 *   Completed → Treatment Success (combines Cured + Treatment Completed)
 *   Transferred → Transferred Out
 *   LTFU → Lost to Follow-up
 *   Ongoing → Still on treatment (cohort hasn't matured yet)
 *   (We don't track Cured vs Completed separately, nor Treatment Failed
 *    or Died — flagged below as schema gaps.)
 */
export const ntpTb5a: ReportDefinition = {
  slug: "ntp-tb-5a",
  title: "NTP TB Form 5a — Quarterly Treatment Outcome",
  description:
    "Treatment outcome distribution for the cohort registered in the picked quarter. Source: tb_patients.",
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

    let success = 0;
    let transferred = 0;
    let ltfu = 0;
    let ongoing = 0;
    let unevaluated = 0;
    for (const r of rows) {
      switch (r.outcomeStatus) {
        case "Completed":
          success++;
          break;
        case "Transferred":
          transferred++;
          break;
        case "LTFU":
          ltfu++;
          break;
        case "Ongoing":
          ongoing++;
          break;
        default:
          unevaluated++;
      }
    }

    const total = rows.length;
    const pct = (n: number) => (total === 0 ? "" : `${Math.round((n / total) * 1000) / 10}%`);

    return {
      columns: [
        { key: "outcome", label: "Outcome", align: "left" },
        { key: "n", label: "Cases", align: "right" },
        { key: "pct", label: "% of cohort", align: "right" },
      ],
      rows: [
        { id: "success", cells: { outcome: "Treatment Success (Cured + Completed)", n: success, pct: pct(success) } },
        { id: "transferred", cells: { outcome: "Transferred Out", n: transferred, pct: pct(transferred) } },
        { id: "ltfu", cells: { outcome: "Lost to Follow-up", n: ltfu, pct: pct(ltfu) } },
        { id: "ongoing", cells: { outcome: "Still on Treatment", n: ongoing, pct: pct(ongoing) } },
        { id: "unevaluated", cells: { outcome: "Not Evaluated / Other", n: unevaluated, pct: pct(unevaluated) } },
        { id: "total", cells: { outcome: "Cohort size", n: total, pct: total === 0 ? "" : "100.0%" }, isTotal: true },
      ],
      meta: {
        sourceCount: total,
        notes:
          total === 0
            ? "No TB patients registered in the picked quarter. NTP 5a is normally evaluated 12-15 months after the cohort start — pick an older quarter."
            : `${total} TB patients registered in this quarter. Schema gaps: outcomeStatus does not separate Cured from Completed, and there's no Failed/Died category — those map under "Other" if added.`,
      },
    };
  },
};
