import { db } from "../db";
import { m1IndicatorCatalog, m1IndicatorValues, m1ReportInstances, m1TemplateVersions } from "@shared/schema";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * M1 Date-Range Export.
 *
 * Sums m1_indicator_values across every M1 report instance whose
 * (year, month) falls inside the picked YYYY-MM-DD range. Output is
 * one row per (rowKey, columnKey) with the cumulative value, joined
 * to the M1 catalog so each row carries the section + label + group
 * for readable export.
 *
 * Use case: MGMT exports a 12-month aggregate for FHSIS quarterly /
 * annual rollups, or arbitrary ranges (e.g. epidemic-period totals).
 */
export const m1DateRangeExport: ReportDefinition = {
  slug: "m1-date-range-export",
  title: "M1 Date-Range Export",
  description:
    "Aggregates monthly M1 indicator values across an arbitrary date range. " +
    "Picks all report instances whose month + year fall within the picked from/to dates.",
  cadence: "custom",
  category: "fhsis",
  source: "FHSIS M1 Brgy (cumulative)",
  async fetch({ fromDate, toDate, barangay }) {
    const startYM = fromDate.slice(0, 7); // YYYY-MM
    const endYM = toDate.slice(0, 7);

    // 1) Find report instances that overlap the [fromDate, toDate]
    //    range — match by year/month tuple ≥ start month and ≤ end month.
    const fromYear = Number(fromDate.slice(0, 4));
    const fromMonth = Number(fromDate.slice(5, 7));
    const toYear = Number(toDate.slice(0, 4));
    const toMonth = Number(toDate.slice(5, 7));

    const instanceConds: any[] = [];
    if (barangay) instanceConds.push(eq(m1ReportInstances.barangayName, barangay));
    // (year > fromYear) OR (year == fromYear AND month >= fromMonth)
    // AND (year < toYear) OR (year == toYear AND month <= toMonth)
    instanceConds.push(sql`(
      (${m1ReportInstances.year} > ${fromYear}
        OR (${m1ReportInstances.year} = ${fromYear} AND ${m1ReportInstances.month} >= ${fromMonth}))
      AND
      (${m1ReportInstances.year} < ${toYear}
        OR (${m1ReportInstances.year} = ${toYear} AND ${m1ReportInstances.month} <= ${toMonth}))
    )`);

    const instances = await db.select({
      id: m1ReportInstances.id,
      barangayName: m1ReportInstances.barangayName,
      month: m1ReportInstances.month,
      year: m1ReportInstances.year,
    })
      .from(m1ReportInstances)
      .where(and(...instanceConds));

    if (instances.length === 0) {
      return {
        columns: [
          { key: "section", label: "Section", align: "left" },
          { key: "rowKey", label: "Row", align: "left" },
          { key: "label", label: "Indicator", align: "left" },
          { key: "columnKey", label: "Column", align: "left" },
          { key: "total", label: "TOTAL", align: "right" },
        ],
        rows: [],
        meta: {
          sourceCount: 0,
          notes: `No M1 report instances found between ${startYM} and ${endYM}${barangay ? ` for ${barangay}` : ""}.`,
        },
      };
    }

    // 2) Pull every indicator value across those instances and sum
    //    per (rowKey, columnKey).
    const ids = instances.map((i) => i.id);
    const values = await db.select().from(m1IndicatorValues)
      .where(inArray(m1IndicatorValues.reportInstanceId, ids));

    const totals: Record<string, number> = {};
    for (const v of values) {
      const key = `${v.rowKey}|${v.columnKey ?? ""}`;
      const n = v.valueNumber ?? 0;
      totals[key] = (totals[key] ?? 0) + n;
    }

    // 3) Join to catalog so we have section/label/group for readability.
    const [activeTpl] = await db.select().from(m1TemplateVersions).where(eq(m1TemplateVersions.isActive, true)).limit(1);
    const catalogRows = activeTpl
      ? await db.select().from(m1IndicatorCatalog)
          .where(eq(m1IndicatorCatalog.templateVersionId, activeTpl.id))
          .orderBy(m1IndicatorCatalog.pageNumber, m1IndicatorCatalog.rowOrder)
      : [];
    const catalogByRowKey: Record<string, typeof catalogRows[number]> = {};
    for (const c of catalogRows) catalogByRowKey[c.rowKey] = c;

    // 4) Emit one row per indicator/column with a non-zero total. Catalog
    //    iteration order keeps section + page + rowOrder grouping intact.
    const rows: Array<{ id: string; cells: Record<string, string | number>; isTotal?: boolean; indent?: number }> = [];
    let lastSection = "";
    for (const c of catalogRows) {
      // Each catalog row has one or more column keys per its columnSpec.
      const cols = (c.columnSpec as any)?.columns ?? ["VALUE"];
      const sectionHeaderEmitted = lastSection !== c.sectionCode;
      let anyEmitted = false;
      for (const colKey of cols) {
        const total = totals[`${c.rowKey}|${colKey}`];
        if (total === undefined) continue;
        if (sectionHeaderEmitted && !anyEmitted) {
          rows.push({
            id: `__section-${c.sectionCode}`,
            cells: { section: c.sectionCode, rowKey: "", label: "", columnKey: "", total: "" },
            isTotal: true,
          });
          lastSection = c.sectionCode;
        }
        rows.push({
          id: `${c.rowKey}|${colKey}`,
          cells: {
            section: c.sectionCode,
            rowKey: c.rowKey,
            label: c.officialLabel,
            columnKey: colKey,
            total,
          },
          indent: c.indentLevel ?? 0,
        });
        anyEmitted = true;
      }
    }

    return {
      columns: [
        { key: "section", label: "Section", align: "left" },
        { key: "rowKey", label: "Row", align: "left" },
        { key: "label", label: "Indicator", align: "left" },
        { key: "columnKey", label: "Column", align: "left" },
        { key: "total", label: "TOTAL", align: "right" },
      ],
      rows,
      meta: {
        sourceCount: instances.length,
        notes:
          `${instances.length} M1 report instance${instances.length === 1 ? "" : "s"} aggregated ` +
          `(${startYM} to ${endYM})${barangay ? ` for ${barangay}` : ""}.`,
      },
    };
  },
};
