import { db } from "../db";
import { coldChainLogs, COLD_CHAIN_MIN_C, COLD_CHAIN_MAX_C } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * Cold-chain compliance summary — daily AM+PM completeness rate plus
 * out-of-range and VVM-alert counts. DOH NIP/EPI Cold Chain Manual.
 */
export const coldChain: ReportDefinition = {
  slug: "cold-chain-compliance",
  title: "Cold-chain Compliance Summary",
  description: "Daily AM+PM logging rate, out-of-range readings, and VVM alerts. Source: cold_chain_logs.",
  cadence: "monthly",
  category: "program",
  source: "DOH NIP/EPI Cold Chain Manual",
  async fetch({ fromDate, toDate, barangay }) {
    const conds = [
      gte(coldChainLogs.readingDate, fromDate),
      lte(coldChainLogs.readingDate, toDate),
    ];
    if (barangay) conds.push(eq(coldChainLogs.barangay, barangay));
    const rows = await db.select().from(coldChainLogs).where(and(...conds));

    // Total expected days = inclusive range / 1 day
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const expectedReadings = days * 2; // AM + PM

    let amCount = 0, pmCount = 0, outOfRange = 0, vvmAlert = 0, vvmDiscard = 0;
    for (const r of rows) {
      if (r.readingPeriod === "AM") amCount++;
      else if (r.readingPeriod === "PM") pmCount++;
      if (r.tempCelsius < COLD_CHAIN_MIN_C || r.tempCelsius > COLD_CHAIN_MAX_C) outOfRange++;
      if (r.vvmStatus === "ALERT") vvmAlert++;
      if (r.vvmStatus === "DISCARD") vvmDiscard++;
    }
    const completeness = Math.round((rows.length / expectedReadings) * 100);

    return {
      columns: [
        { key: "indicator", label: "Indicator", align: "left" },
        { key: "value", label: "Value", align: "right" },
      ],
      rows: [
        { id: "expected", cells: { indicator: `Expected readings (${days} days × AM+PM)`, value: expectedReadings } },
        { id: "logged", cells: { indicator: "Total readings logged", value: rows.length } },
        { id: "am", cells: { indicator: "AM readings", value: amCount }, indent: 1 },
        { id: "pm", cells: { indicator: "PM readings", value: pmCount }, indent: 1 },
        { id: "completeness", cells: { indicator: "Completeness %", value: `${completeness}%` }, isTotal: true },
        { id: "oor", cells: { indicator: `Out-of-range readings (< ${COLD_CHAIN_MIN_C} °C or > ${COLD_CHAIN_MAX_C} °C)`, value: outOfRange } },
        { id: "vvm-alert", cells: { indicator: "VVM ALERT count", value: vvmAlert } },
        { id: "vvm-discard", cells: { indicator: "VVM DISCARD count", value: vvmDiscard } },
      ],
      meta: { sourceCount: rows.length, notes: `${days} day window` },
    };
  },
};
