import { db } from "../db";
import { deathEvents } from "@shared/schema";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * Mortality Report (FHSIS Section H) — deaths by age band + maternal cause +
 * residency. Builds on the death_events extensions from Phase 6.
 */
export const mortality: ReportDefinition = {
  slug: "mortality-section-h",
  title: "Mortality (FHSIS Section H)",
  description:
    "Deaths this period by age band (neonatal / infant / under-5) + maternal-cause + residency. Source: death_events.",
  cadence: "monthly",
  category: "fhsis",
  source: "FHSIS MoP — Section H",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(deathEvents.dateOfDeath, fromDate),
      lte(deathEvents.dateOfDeath, toDate),
    ];
    if (barangay) conds.push(eq(deathEvents.barangay, barangay));
    const rows = await db.select().from(deathEvents).where(and(...conds));

    let h08 = rows.length;
    let h04 = 0, h05 = 0, h06 = 0;
    let h03Total = 0, h03DirectR = 0, h03DirectNR = 0, h03IndirectR = 0, h03IndirectNR = 0;
    let perinatal = 0, earlyNeonatal = 0;

    for (const r of rows) {
      const ageDays = r.ageDays ?? null;
      const ageYrs = r.age ?? null;
      const ageMos = ageDays !== null ? Math.floor(ageDays / 30) : (ageYrs !== null ? ageYrs * 12 : null);
      if (ageMos !== null && ageMos < 60) h04++;
      if (ageMos !== null && ageMos < 12) h05++;
      if (ageDays !== null && ageDays <= 28) h06++;
      if (r.maternalDeathCause) {
        h03Total++;
        if (r.maternalDeathCause === "DIRECT" && r.residency === "RESIDENT") h03DirectR++;
        if (r.maternalDeathCause === "DIRECT" && r.residency === "NON_RESIDENT") h03DirectNR++;
        if (r.maternalDeathCause === "INDIRECT" && r.residency === "RESIDENT") h03IndirectR++;
        if (r.maternalDeathCause === "INDIRECT" && r.residency === "NON_RESIDENT") h03IndirectNR++;
      }
      if (r.isFetalDeath) perinatal++;
      else if (r.isLiveBornEarlyNeonatal && ageDays !== null && ageDays <= 6) {
        perinatal++;
        earlyNeonatal++;
      }
    }

    return {
      columns: [
        { key: "rowKey", label: "Row", align: "left" },
        { key: "label", label: "Indicator", align: "left" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows: [
        { id: "h-03", cells: { rowKey: "H-03", label: "Total maternal deaths", value: h03Total } },
        { id: "h-03a-r", cells: { rowKey: "H-03a-R", label: "Direct cause — Resident", value: h03DirectR }, indent: 1 },
        { id: "h-03a-nr", cells: { rowKey: "H-03a-NR", label: "Direct cause — Non-resident", value: h03DirectNR }, indent: 1 },
        { id: "h-03b-r", cells: { rowKey: "H-03b-R", label: "Indirect cause — Resident", value: h03IndirectR }, indent: 1 },
        { id: "h-03b-nr", cells: { rowKey: "H-03b-NR", label: "Indirect cause — Non-resident", value: h03IndirectNR }, indent: 1 },
        { id: "h-04", cells: { rowKey: "H-04", label: "Under-5 mortality (0–59 mos)", value: h04 } },
        { id: "h-05", cells: { rowKey: "H-05", label: "Infant mortality (0–11 mos & 29 days)", value: h05 } },
        { id: "h-06", cells: { rowKey: "H-06", label: "Neonatal mortality (0–28 days)", value: h06 } },
        { id: "h-07", cells: { rowKey: "H-07", label: "Total perinatal mortality", value: perinatal } },
        { id: "h-07b", cells: { rowKey: "H-07b", label: "Early neonatal death (0–6 days)", value: earlyNeonatal }, indent: 1 },
        { id: "h-08", cells: { rowKey: "H-08", label: "Total deaths (all causes / age groups)", value: h08 }, isTotal: true },
      ],
      meta: { sourceCount: rows.length, notes: `${rows.length} death_events rows in the period` },
    };
  },
};
