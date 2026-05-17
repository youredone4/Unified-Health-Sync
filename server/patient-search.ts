/**
 * Cross-registry patient search.
 *
 * Powers the <PatientSearchCombobox> used on every patient-capture form
 * across the app. Searches mothers + children + seniors + tb_patients in
 * one round-trip and returns a ranked, RBAC-scoped result set.
 *
 * Honors "capture once → shows up everywhere": a TL who already registered
 * "Maria Santos" as a mother sees her in the combobox when she later
 * appears in a rabies exposure / PhilPEN assessment / vision screening
 * form, so the record gets linked instead of creating a parallel string.
 */

import { db } from "./db";
import { mothers, children, seniors, tbPatients } from "@shared/schema";
import { sql } from "drizzle-orm";

export type PatientKind = "MOTHER" | "CHILD" | "SENIOR" | "TB_PATIENT";

export interface PatientSearchResult {
  kind: PatientKind;
  id: number;
  displayName: string;
  dob: string | null;
  sex: "M" | "F" | null;
  barangay: string;
  /** Subtitle used by the combobox — e.g. "Age 28" or "TB DOTS — Pulmonary". */
  hint: string;
}

export interface PatientSearchOptions {
  query: string;
  /** Hard cap; defaults to 10, hard ceiling 25. */
  limit?: number;
  /** When set, restricts results to these barangays (TL scope). */
  allowedBarangays?: readonly string[];
}

/**
 * Returns up to `limit` matches across all four patient registries.
 * Case-insensitive ILIKE on first/last/name fields. Trims and lowercases
 * the query; empty or whitespace-only queries return [].
 */
export async function searchPatients(opts: PatientSearchOptions): Promise<PatientSearchResult[]> {
  const q = (opts.query ?? "").trim();
  if (!q) return [];

  // Slightly liberal SQL: match any token of the query against firstName,
  // lastName, or the children.name single-field. The combobox UI debounces
  // input so we don't hammer the DB on every keystroke.
  const like = `%${q}%`;
  const cap = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const scope = opts.allowedBarangays && opts.allowedBarangays.length > 0
    ? opts.allowedBarangays
    : null;

  // Helper — barangay-scope predicate; null means "no scope, see all".
  // Drizzle's `inArray` would also work but raw SQL is more uniform here.
  const scopeClause = (col: string) =>
    scope === null
      ? sql`TRUE`
      : sql`${sql.raw(col)} IN ${sql.raw("(" + scope.map((b) => `'${b.replace(/'/g, "''")}'`).join(",") + ")")}`;

  // --- mothers (firstName + lastName) ---
  const motherRows = await db
    .select({
      id: mothers.id,
      firstName: mothers.firstName,
      lastName: mothers.lastName,
      age: mothers.age,
      barangay: mothers.barangay,
    })
    .from(mothers)
    .where(sql`(first_name ILIKE ${like} OR last_name ILIKE ${like}
                OR (first_name || ' ' || last_name) ILIKE ${like})
               AND ${scopeClause("barangay")}`)
    .limit(cap);

  // --- children (single `name` field) ---
  const childRows = await db
    .select({
      id: children.id,
      name: children.name,
      dob: children.dob,
      sex: children.sex,
      barangay: children.barangay,
    })
    .from(children)
    .where(sql`name ILIKE ${like} AND ${scopeClause("barangay")}`)
    .limit(cap);

  // --- seniors (firstName + lastName, DOB + sex available) ---
  const seniorRows = await db
    .select({
      id: seniors.id,
      firstName: seniors.firstName,
      lastName: seniors.lastName,
      dob: seniors.dob,
      sex: seniors.sex,
      age: seniors.age,
      barangay: seniors.barangay,
    })
    .from(seniors)
    .where(sql`(first_name ILIKE ${like} OR last_name ILIKE ${like}
                OR (first_name || ' ' || last_name) ILIKE ${like})
               AND ${scopeClause("barangay")}`)
    .limit(cap);

  // --- tb_patients (firstName + lastName, no DOB stored) ---
  const tbRows = await db
    .select({
      id: tbPatients.id,
      firstName: tbPatients.firstName,
      lastName: tbPatients.lastName,
      age: tbPatients.age,
      barangay: tbPatients.barangay,
      tbType: tbPatients.tbType,
      treatmentPhase: tbPatients.treatmentPhase,
    })
    .from(tbPatients)
    .where(sql`(first_name ILIKE ${like} OR last_name ILIKE ${like}
                OR (first_name || ' ' || last_name) ILIKE ${like})
               AND ${scopeClause("barangay")}`)
    .limit(cap);

  // Compose unified result shape.
  const results: PatientSearchResult[] = [
    ...motherRows.map<PatientSearchResult>((r) => ({
      kind: "MOTHER",
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      dob: null,
      sex: "F",
      barangay: r.barangay,
      hint: `Age ${r.age}`,
    })),
    ...childRows.map<PatientSearchResult>((r) => ({
      kind: "CHILD",
      id: r.id,
      displayName: r.name,
      dob: r.dob ?? null,
      sex: r.sex === "male" ? "M" : r.sex === "female" ? "F" : null,
      barangay: r.barangay,
      hint: r.dob ? `DOB ${r.dob}` : "Child",
    })),
    ...seniorRows.map<PatientSearchResult>((r) => ({
      kind: "SENIOR",
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      dob: r.dob ?? null,
      sex: (r.sex as "M" | "F" | null) ?? null,
      barangay: r.barangay,
      hint: `Senior · Age ${r.age}`,
    })),
    ...tbRows.map<PatientSearchResult>((r) => ({
      kind: "TB_PATIENT",
      id: r.id,
      displayName: `${r.firstName} ${r.lastName}`,
      dob: null,
      sex: null,
      barangay: r.barangay,
      hint: `TB DOTS · ${r.tbType ?? "Pulmonary"} · ${r.treatmentPhase ?? "Intensive"}`,
    })),
  ];

  // Rank: exact full-name matches first, then prefix, then everything else.
  // Tiebreak by kind ordering (mother > child > senior > tb) just to keep
  // the UI stable across reruns.
  const qLow = q.toLowerCase();
  const KIND_ORDER: Record<PatientKind, number> = {
    MOTHER: 0, CHILD: 1, SENIOR: 2, TB_PATIENT: 3,
  };
  const rank = (r: PatientSearchResult): number => {
    const name = r.displayName.toLowerCase();
    if (name === qLow) return 0;
    if (name.startsWith(qLow)) return 1;
    return 2;
  };
  results.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    return a.displayName.localeCompare(b.displayName);
  });

  return results.slice(0, cap);
}
