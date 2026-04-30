/**
 * PhilHealth Konsulta integration — STUB.
 *
 * This module is the single seam between HealthSync and PhilHealth's
 * Konsulta API. It is intentionally stubbed today: until the LGU is
 * accredited and PhilHealth issues API credentials, every submission
 * call returns API_KEYS_REQUIRED and the row stays in the outbox.
 *
 * When credentials arrive:
 *   1. Set env vars (see required list in isConfigured below).
 *   2. Replace the body of submitMDR / submitEncounter with the real
 *      fetch-to-PhilHealth call. The shape of the inputs is locked
 *      by the call sites in routes.ts, so the swap is contained.
 *   3. Run the drain endpoint (POST /api/konsulta/submissions/drain)
 *      to retry every row currently in the queue.
 *
 * Reference: PhilHealth Circular 2020-0022 (Konsulta Implementing
 * Guidelines) and the Member Data Record / e-Konsulta encounter forms.
 */

import type { KonsultaEnrollment, KonsultaEncounter } from "@shared/schema";

export type PhilHealthResult<T = unknown> =
  | { ok: true;  ackRef: string; data?: T }
  | { ok: false; error: string;  retryable: boolean };

// Single source of truth for what env vars the live integration needs.
// Listed here so the /konsulta admin panel can show which are missing.
export const REQUIRED_ENV_VARS = [
  "PHILHEALTH_API_BASE_URL",
  "PHILHEALTH_API_KEY",
  "PHILHEALTH_PROVIDER_CODE",
] as const;

export function isConfigured(): boolean {
  return REQUIRED_ENV_VARS.every((k) => !!process.env[k] && String(process.env[k]).trim().length > 0);
}

export function missingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((k) => !process.env[k] || String(process.env[k]).trim().length === 0);
}

/**
 * Submit a Member Data Record (MDR) for an enrollment. The payload that
 * actually goes upstream is computed here so callers don't have to know
 * PhilHealth's wire format.
 */
export async function submitMDR(enrollment: KonsultaEnrollment): Promise<PhilHealthResult> {
  if (!isConfigured()) {
    return { ok: false, error: "API_KEYS_REQUIRED", retryable: true };
  }
  // STUB: replace with real fetch when credentials arrive.
  //
  //   const res = await fetch(
  //     `${process.env.PHILHEALTH_API_BASE_URL}/konsulta/mdr/enroll`,
  //     {
  //       method: "POST",
  //       headers: {
  //         "Authorization": `Bearer ${process.env.PHILHEALTH_API_KEY}`,
  //         "X-Provider-Code": process.env.PHILHEALTH_PROVIDER_CODE!,
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(buildMDRPayload(enrollment)),
  //     },
  //   );
  //   if (!res.ok) return { ok: false, error: await res.text(), retryable: res.status >= 500 };
  //   const data = await res.json();
  //   return { ok: true, ackRef: data.referenceNumber, data };
  return { ok: false, error: "NOT_IMPLEMENTED", retryable: false };
}

/**
 * Submit a Konsulta encounter (visit-level claim).
 */
export async function submitEncounter(encounter: KonsultaEncounter): Promise<PhilHealthResult> {
  if (!isConfigured()) {
    return { ok: false, error: "API_KEYS_REQUIRED", retryable: true };
  }
  return { ok: false, error: "NOT_IMPLEMENTED", retryable: false };
}

/**
 * Build the wire-format payload for an MDR submission. Exposed for the
 * outbox so we can snapshot what _would_ be sent into philhealth_
 * submissions.payload before the API is live.
 */
export function buildMDRPayload(e: KonsultaEnrollment): Record<string, unknown> {
  return {
    pin: e.pin,
    memberType: e.memberType,
    principalPin: e.principalPin,
    familyId: e.familyId,
    member: {
      firstName: e.firstName,
      middleName: e.middleName,
      lastName: e.lastName,
      suffix: e.suffix,
      dateOfBirth: e.dateOfBirth,
      sex: e.sex,
      civilStatus: e.civilStatus,
      mothersMaidenName: e.mothersMaidenName,
    },
    address: {
      addressLine: e.addressLine,
      barangay: e.barangay,
      municipality: e.municipality,
      province: e.province,
    },
    contributor: {
      category: e.contributorCategory,
      sponsorName: e.sponsorName,
      employer: e.employer,
    },
    enrollmentDate: e.enrollmentDate,
    validFrom: e.validFrom,
    validUntil: e.validUntil,
    providerCode: e.providerCode || process.env.PHILHEALTH_PROVIDER_CODE || null,
  };
}

export function buildEncounterPayload(enc: KonsultaEncounter): Record<string, unknown> {
  return {
    enrollmentId: enc.enrollmentId,
    encounterDate: enc.encounterDate,
    barangay: enc.barangay,
    serviceCodes: enc.serviceCodes ?? [],
    icd10Codes: enc.icd10Codes ?? [],
    diagnosis: enc.diagnosis,
    claimType: enc.claimType,
    providerCode: process.env.PHILHEALTH_PROVIDER_CODE || null,
  };
}
