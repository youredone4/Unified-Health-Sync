/**
 * Cross-domain "linked encounters" lookup for a single patient.
 *
 * Given a patient identity (kind + id from mothers / children / seniors /
 * tb_patients), returns the count of records this patient appears in
 * across every linkable table. Powers the "Linked encounters" card on
 * mother / child / senior / TB profiles — closes the "capture once →
 * shows up everywhere" loop on the *read* side.
 *
 * Tables queried (the same 17 tables the A.2-A.5 phases wired with the
 * linked_person_type + linked_person_id discriminator, plus the two
 * tables that already had it: disease_cases, fp_service_records).
 *
 * Pure DB function; no I/O outside Drizzle. Returns zeros for any table
 * with no matches — never null/undefined per category — so the UI can
 * render the card unconditionally.
 */

import { db } from "./db";
import {
  oralHealthVisits, philpenAssessments, ncdScreenings, visionScreenings,
  cervicalCancerScreenings, mentalHealthScreenings,
  filariasisRecords, rabiesExposures, schistosomiasisRecords,
  sthRecords, leprosyRecords,
  aefiEvents, referralRecords, medicalCertificates, consults,
  diseaseCases, fpServiceRecords,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

export type PatientKind = "MOTHER" | "CHILD" | "SENIOR" | "TB_PATIENT";

export interface LinkedEncountersSummary {
  /** Total of every other-table count below; useful for the card header. */
  total: number;
  /** Group counts so the UI can pillar them. */
  surveillance: {
    filariasis: number;
    rabies: number;
    schistosomiasis: number;
    sth: number;
    leprosy: number;
  };
  screenings: {
    oralHealth: number;
    philpen: number;
    ncd: number;
    vision: number;
    cervical: number;
    mental: number;
  };
  misc: {
    aefi: number;
    referrals: number;
    medicalCertificates: number;
    consults: number;
    diseaseCases: number;
    fpServiceRecords: number;
  };
}

const ZERO: LinkedEncountersSummary = {
  total: 0,
  surveillance: { filariasis: 0, rabies: 0, schistosomiasis: 0, sth: 0, leprosy: 0 },
  screenings:   { oralHealth: 0, philpen: 0, ncd: 0, vision: 0, cervical: 0, mental: 0 },
  misc:         { aefi: 0, referrals: 0, medicalCertificates: 0, consults: 0, diseaseCases: 0, fpServiceRecords: 0 },
};

/**
 * `disease_cases` and `fp_service_records` predate the audit and use
 * mixed-case discriminator values ("Mother" / "MOTHER"). We normalize
 * by checking both styles. The newly-wired tables (A.2) all use the
 * uppercase canonical form so a single equality check suffices there.
 */
function countByLink(table: any, kind: PatientKind, id: number, useLegacyCasing = false) {
  if (useLegacyCasing) {
    // Legacy: "Mother" / "Child" / "Senior" (capital-first). The TB_PATIENT
    // kind doesn't apply here — those legacy tables predate TB linkage.
    const legacy = kind === "MOTHER" ? "Mother"
      : kind === "CHILD" ? "Child"
      : kind === "SENIOR" ? "Senior"
      : null;
    if (!legacy) return Promise.resolve(0);
    return db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(and(
        sql`linked_person_type IN (${kind}, ${legacy})`,
        eq(table.linkedPersonId, id),
      ))
      .then((r: any[]) => r[0]?.n ?? 0);
  }
  return db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(and(
      eq(table.linkedPersonType, kind),
      eq(table.linkedPersonId, id),
    ))
    .then((r: any[]) => r[0]?.n ?? 0);
}

export async function getLinkedEncounters(
  kind: PatientKind,
  id: number,
): Promise<LinkedEncountersSummary> {
  // Parallel-fetch all 17 counts to keep the profile-open latency tight.
  const [
    filariasis, rabies, schistosomiasis, sth, leprosy,
    oralHealth, philpen, ncd, vision, cervical, mental,
    aefi, referrals, medicalCerts, consultsCount,
    diseaseCasesCount, fpCount,
  ] = await Promise.all([
    countByLink(filariasisRecords,        kind, id),
    countByLink(rabiesExposures,          kind, id),
    countByLink(schistosomiasisRecords,   kind, id),
    countByLink(sthRecords,               kind, id),
    countByLink(leprosyRecords,           kind, id),
    countByLink(oralHealthVisits,         kind, id),
    countByLink(philpenAssessments,       kind, id),
    countByLink(ncdScreenings,            kind, id),
    countByLink(visionScreenings,         kind, id),
    countByLink(cervicalCancerScreenings, kind, id),
    countByLink(mentalHealthScreenings,   kind, id),
    countByLink(aefiEvents,               kind, id),
    countByLink(referralRecords,          kind, id),
    countByLink(medicalCertificates,      kind, id),
    countByLink(consults,                 kind, id, /* legacy */ true),
    countByLink(diseaseCases,             kind, id, /* legacy */ true),
    countByLink(fpServiceRecords,         kind, id, /* legacy */ true),
  ]);

  const summary: LinkedEncountersSummary = {
    total:
      filariasis + rabies + schistosomiasis + sth + leprosy +
      oralHealth + philpen + ncd + vision + cervical + mental +
      aefi + referrals + medicalCerts + consultsCount +
      diseaseCasesCount + fpCount,
    surveillance: { filariasis, rabies, schistosomiasis, sth, leprosy },
    screenings:   { oralHealth, philpen, ncd, vision, cervical, mental },
    misc:         {
      aefi, referrals, medicalCertificates: medicalCerts, consults: consultsCount,
      diseaseCases: diseaseCasesCount, fpServiceRecords: fpCount,
    },
  };
  return summary;
}

/** Exported empty result for tests / fallback rendering. */
export const EMPTY_LINKED_ENCOUNTERS: LinkedEncountersSummary = ZERO;
