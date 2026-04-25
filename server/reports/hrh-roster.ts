import { db } from "../db";
import { workforceMembers, HRH_PROFESSIONS, HRH_EMPLOYMENT_STATUSES } from "@shared/schema";
import { and, eq, isNull, lte, gte, or, sql } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * HRH Quarterly Roster — for DOH HHRDB / NHWSS quarterly inventory.
 * Counts active workforce members at the END of the quarter, broken
 * down by profession × employment status. Members separated before
 * the quarter end are excluded.
 *
 * Mirrors the headline structure of the NHWSS facility roster.
 */
export const hrhRoster: ReportDefinition = {
  slug: "hrh-quarterly-roster",
  title: "HRH Quarterly Roster (NHWSS)",
  description:
    "Active workforce members at quarter-end, by profession × employment status. For DOH HHRDB / NHWSS quarterly inventory.",
  cadence: "quarterly",
  category: "performance",
  source: "DOH HHRDB / NHWSS · RA 11223 §22-§25",
  async fetch({ toDate, barangay }) {
    const conds: any[] = [
      // Active = not separated, OR separated AFTER the quarter end.
      or(
        isNull(workforceMembers.dateSeparated),
        gte(workforceMembers.dateSeparated, toDate),
      ),
      // Hired on or before quarter end (or null hire date — count anyway).
      or(
        isNull(workforceMembers.dateHired),
        lte(workforceMembers.dateHired, toDate),
      ),
    ];
    if (barangay) conds.push(eq(workforceMembers.barangay, barangay));
    const rows = await db.select().from(workforceMembers).where(and(...conds));

    // Build: profession × employment-status grid.
    const tally: Record<string, Record<string, number>> = {};
    for (const p of HRH_PROFESSIONS) {
      tally[p] = Object.fromEntries(HRH_EMPLOYMENT_STATUSES.map((s) => [s, 0]));
      tally[p].TOTAL = 0;
    }
    let grand = 0;
    for (const m of rows) {
      tally[m.profession][m.employmentStatus]++;
      tally[m.profession].TOTAL++;
      grand++;
    }

    // Compute column totals.
    const colTotals: Record<string, number> = {};
    for (const s of HRH_EMPLOYMENT_STATUSES) colTotals[s] = 0;
    colTotals.TOTAL = 0;
    for (const p of HRH_PROFESSIONS) {
      for (const s of HRH_EMPLOYMENT_STATUSES) colTotals[s] += tally[p][s];
      colTotals.TOTAL += tally[p].TOTAL;
    }

    const SHORT_LABELS: Record<string, string> = {
      REGULAR: "Reg",
      CONTRACTUAL: "Ctr",
      JOB_ORDER: "JO",
      CONTRACT_OF_SERVICE: "COS",
      NDP: "NDP",
      DTTB: "DTTB",
      RHMPP: "RHMPP",
      RHMP: "RHMP",
      MTDP: "MTDP",
      VOLUNTEER: "Vol",
      OTHER: "Oth",
    };

    return {
      columns: [
        { key: "profession", label: "Profession", align: "left" },
        ...HRH_EMPLOYMENT_STATUSES.map((s) => ({ key: s, label: SHORT_LABELS[s] ?? s, align: "right" as const })),
        { key: "TOTAL", label: "TOTAL", align: "right" as const },
      ],
      rows: [
        ...HRH_PROFESSIONS.map((p) => ({
          id: p,
          cells: { profession: p, ...tally[p] },
        })),
        {
          id: "__total",
          cells: { profession: "TOTAL", ...colTotals },
          isTotal: true,
        },
      ],
      meta: {
        sourceCount: grand,
        notes: `${grand} active members at end of period${barangay ? ` in ${barangay}` : ""}`,
      },
    };
  },
};
