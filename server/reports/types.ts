/**
 * Reports Hub — shared types and registry.
 *
 * A "report" here is a reusable aggregator that turns operational rows
 * (disease_cases, fp_service_records, children.vaccines, etc.) into a
 * tabular DOH-mandated format. Each report module exports a single
 * `ReportDefinition`. The registry below collects them so the API can
 * list available reports and dispatch by slug.
 */

import type { Express } from "express";

export type ReportCadence = "weekly" | "monthly" | "quarterly" | "annual";
export type ReportCategory = "fhsis" | "program" | "surveillance" | "performance";

export interface ReportParams {
  /** YYYY-MM-DD range start (inclusive). */
  fromDate: string;
  /** YYYY-MM-DD range end (inclusive). */
  toDate: string;
  /** Period label (e.g. "March 2026"). */
  periodLabel: string;
  /** TL-scoping: barangay name. undefined = all (only allowed for non-TL). */
  barangay?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  /** "left" / "center" / "right" alignment for table rendering. */
  align?: "left" | "center" | "right";
}

export interface ReportRow {
  /** Stable identifier. Optional but useful for the renderer. */
  id?: string;
  /** Map of column key → cell value. Numeric values render right-aligned. */
  cells: Record<string, string | number | null>;
  /** Mark this row as a TOTAL/subtotal so the renderer can bold it. */
  isTotal?: boolean;
  /** Indent level for sub-rows (0 = top, 1+ = nested). */
  indent?: number;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Free-form footer info (source-record count, last-computed timestamp). */
  meta: { sourceCount?: number; notes?: string };
}

export interface ReportDefinition {
  slug: string;
  title: string;
  description: string;
  cadence: ReportCadence;
  category: ReportCategory;
  /** Source DOH issuance / form code, displayed on the detail header. */
  source?: string;
  fetch: (params: ReportParams) => Promise<ReportResult>;
}

/** Lazy registry — populated by buildReportRegistry(). */
const REGISTRY = new Map<string, ReportDefinition>();

export function registerReport(def: ReportDefinition) {
  if (REGISTRY.has(def.slug)) {
    throw new Error(`Duplicate report slug: ${def.slug}`);
  }
  REGISTRY.set(def.slug, def);
}

export function getReport(slug: string): ReportDefinition | undefined {
  return REGISTRY.get(slug);
}

export function listReports(): ReportDefinition[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Computes a YYYY-MM-DD inclusive range for the given month/year.
 * Used by report routes that accept ?month= &year= as the calling convention.
 */
export function monthRange(month: number, year: number): { fromDate: string; toDate: string; periodLabel: string } {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return {
    fromDate: `${year}-${m}-01`,
    toDate: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    periodLabel,
  };
}

/**
 * Computes a YYYY-MM-DD inclusive range for the given calendar quarter.
 * Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.
 */
export function quarterRange(quarter: number, year: number): { fromDate: string; toDate: string; periodLabel: string } {
  if (quarter < 1 || quarter > 4) throw new Error(`Invalid quarter: ${quarter}`);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    fromDate: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    toDate: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    periodLabel: `Q${quarter} ${year}`,
  };
}

/**
 * Computes a YYYY-MM-DD inclusive range covering the full calendar year.
 */
export function annualRange(year: number): { fromDate: string; toDate: string; periodLabel: string } {
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    periodLabel: `${year}`,
  };
}

// Marker type so the routes module can pass `app` in once if needed in future.
export type ReportApp = Express;
