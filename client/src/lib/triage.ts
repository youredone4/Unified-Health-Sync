/**
 * Triage rule engine — single source of truth for the vital-sign + danger-
 * sign rules that auto-suggest a 3-level acuity (EMERGENT / URGENT /
 * NON_URGENT). The nurse can override with a reason; this just computes
 * the suggestion + the supporting "reasons" so the UI can show what fired.
 *
 * Reference: DOH MOP for Public Health Nursing, IMCI Manual (Philippines),
 * AdminEm primary-care triage references. Thresholds are intentionally
 * conservative — we'd rather over-flag than miss the 5% of walk-ins who
 * are actually sick.
 */

export type Acuity = "EMERGENT" | "URGENT" | "NON_URGENT";

export interface VitalsInput {
  bloodPressure?: string | null;   // "120/80"
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  weightKg?: number | null;
}

export interface TriageInput {
  ageYears: number;
  ageMonths: number;
  sex: "M" | "F";
  vitals: VitalsInput;
  imciDangerSigns?: string[];
  adultDangerSigns?: string[];
  pregnancyStatus?: string | null;
  chiefComplaint?: string;
}

export interface TriageResult {
  suggestedAcuity: Acuity;
  reasons: string[];          // human-readable reasons for the suggestion
  isPediatric: boolean;       // age < 5 years
  showPregnancyScreen: boolean;
  bmi: number | null;
  bmiCategory: BmiCategory | null;
}

export type BmiCategory = "UNDERWEIGHT" | "NORMAL" | "OVERWEIGHT" | "OBESE";

// Parses "120/80" or "120 / 80" or "120/80 mmHg" → { sys, dia }; returns
// null if either component is unparseable.
export function parseBp(bp?: string | null): { sys: number; dia: number } | null {
  if (!bp) return null;
  const m = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
}

export function computeBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number | null): BmiCategory | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return "UNDERWEIGHT";
  if (bmi < 25)   return "NORMAL";
  if (bmi < 30)   return "OVERWEIGHT";
  return "OBESE";
}

export function ageFromDob(dob: string | null | undefined, today = new Date()): { years: number; months: number } {
  if (!dob) return { years: 0, months: 0 };
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return { years: 0, months: 0 };
  const years = today.getFullYear() - d.getFullYear() - (
    (today.getMonth() < d.getMonth()) ||
    (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())
      ? 1 : 0
  );
  const months =
    (today.getFullYear() - d.getFullYear()) * 12 +
    (today.getMonth() - d.getMonth()) -
    (today.getDate() < d.getDate() ? 1 : 0);
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

/**
 * Run the rules. Order matters: any EMERGENT fact short-circuits.
 */
export function computeTriage(input: TriageInput): TriageResult {
  const reasons: string[] = [];
  const { ageYears, ageMonths, vitals } = input;
  const isPediatric = ageYears < 5;
  const isUnder2Months = ageMonths < 2;
  const bp = parseBp(vitals.bloodPressure);
  const bmi = null; // height typically not captured at triage; computed by UI when available
  const bmiCat: BmiCategory | null = null;

  // Pregnancy widget triggers — displayed by UI; doesn't itself escalate
  // unless combined with vitals/signs below.
  const showPregnancyScreen =
    input.sex === "F" && ageYears >= 10 && ageYears <= 49 &&
    /(abdom|pelvic|fever|bleed|spot|miscar|labor|contraction)/i.test(input.chiefComplaint ?? "");

  // ── Tier 1: any one fact → EMERGENT ─────────────────────────────────────
  if ((input.adultDangerSigns ?? []).length > 0 && !isPediatric) {
    reasons.push(`Adult danger sign: ${input.adultDangerSigns!.join(", ")}`);
  }
  if ((input.imciDangerSigns ?? []).length > 0 && isPediatric) {
    reasons.push(`IMCI danger sign: ${input.imciDangerSigns!.join(", ")}`);
  }
  if (vitals.spo2 != null && vitals.spo2 < 90) {
    reasons.push(`SpO₂ ${vitals.spo2}% (< 90)`);
  }
  if (bp) {
    if (bp.sys < 90)                    reasons.push(`BP systolic ${bp.sys} (< 90)`);
    if (bp.sys > 180 || bp.dia > 110)   reasons.push(`BP ${bp.sys}/${bp.dia} (hypertensive emergency)`);
  }
  if (vitals.temperatureC != null) {
    if (vitals.temperatureC >= 40)      reasons.push(`Temp ${vitals.temperatureC}°C (≥ 40)`);
    if (vitals.temperatureC <  35)      reasons.push(`Temp ${vitals.temperatureC}°C (< 35, hypothermia)`);
  }

  // Pediatric-specific vital extremes (under-5)
  if (isPediatric) {
    if (vitals.respiratoryRate != null) {
      // Fast breathing thresholds per IMCI: <2mo ≥60, 2-12mo ≥50, 12-59mo ≥40
      const rr = vitals.respiratoryRate;
      if (isUnder2Months && rr >= 60)          reasons.push(`RR ${rr} (fast breathing, under 2mo)`);
      else if (ageMonths < 12 && rr >= 50)     reasons.push(`RR ${rr} (fast breathing, 2–11mo)`);
      else if (ageYears < 5 && rr >= 40)       reasons.push(`RR ${rr} (fast breathing, 1–4y)`);
    }
    if (vitals.temperatureC != null && vitals.temperatureC >= 38.5) {
      reasons.push(`Temp ${vitals.temperatureC}°C (febrile child)`);
    }
  } else {
    // Adult RR / HR thresholds
    if (vitals.respiratoryRate != null) {
      if (vitals.respiratoryRate > 30) reasons.push(`RR ${vitals.respiratoryRate} (> 30)`);
      if (vitals.respiratoryRate < 8)  reasons.push(`RR ${vitals.respiratoryRate} (< 8)`);
    }
    if (vitals.heartRate != null) {
      if (vitals.heartRate > 130) reasons.push(`HR ${vitals.heartRate} (> 130)`);
      if (vitals.heartRate < 50)  reasons.push(`HR ${vitals.heartRate} (< 50)`);
    }
    // Shock index = HR/SBP — > 0.9 suggests compensated shock
    if (vitals.heartRate != null && bp && bp.sys > 0) {
      const si = vitals.heartRate / bp.sys;
      if (si > 0.9) reasons.push(`Shock index ${si.toFixed(2)} (> 0.9)`);
    }
  }

  if (reasons.length > 0) {
    return { suggestedAcuity: "EMERGENT", reasons, isPediatric, showPregnancyScreen, bmi, bmiCategory: bmiCat };
  }

  // ── Tier 2: URGENT (warning thresholds) ─────────────────────────────────
  if (bp) {
    if (bp.sys >= 160 || bp.dia >= 100) reasons.push(`BP ${bp.sys}/${bp.dia} (stage-2 HTN)`);
  }
  if (vitals.temperatureC != null && vitals.temperatureC >= 38.5 && !isPediatric) {
    reasons.push(`Temp ${vitals.temperatureC}°C (febrile)`);
  }
  if (vitals.spo2 != null && vitals.spo2 >= 90 && vitals.spo2 < 95) {
    reasons.push(`SpO₂ ${vitals.spo2}% (90–94)`);
  }
  // Pregnancy widget visible AND elevated BP → urgent (pre-eclampsia screen)
  if (showPregnancyScreen && bp && (bp.sys >= 140 || bp.dia >= 90)) {
    reasons.push(`Possible pregnancy + BP ${bp.sys}/${bp.dia} (pre-eclampsia screen)`);
  }
  if ((input.imciDangerSigns ?? []).length === 0 && isPediatric) {
    // Any IMCI main symptom present → URGENT (so MD sees the child)
    if ((input as any).imciMainSymptoms?.length > 0) {
      reasons.push(`Pediatric main symptom present`);
    }
  }
  // Pain score 7+ → URGENT
  // (The wizard reads pain into a separate path; left as a hook here.)

  if (reasons.length > 0) {
    return { suggestedAcuity: "URGENT", reasons, isPediatric, showPregnancyScreen, bmi, bmiCategory: bmiCat };
  }

  // ── Tier 3: NON_URGENT default ──────────────────────────────────────────
  return {
    suggestedAcuity: "NON_URGENT",
    reasons: ["No vital or sign abnormalities detected"],
    isPediatric,
    showPregnancyScreen,
    bmi,
    bmiCategory: bmiCat,
  };
}

// Pain-scale picker — UI selects the scale based on age.
export type PainScaleKind = "FLACC" | "WONG_BAKER" | "NRS";
export function painScaleFor(ageYears: number): PainScaleKind {
  if (ageYears < 3) return "FLACC";
  if (ageYears < 8) return "WONG_BAKER";
  return "NRS";
}

// Human-readable labels — used by both the wizard form and the row display.
export const ACUITY_LABEL: Record<Acuity, string> = {
  EMERGENT:   "Emergent",
  URGENT:     "Urgent",
  NON_URGENT: "Non-urgent",
};

export const ACUITY_DESCRIPTION: Record<Acuity, string> = {
  EMERGENT:   "Immediate. Notify MD now and consider transfer.",
  URGENT:     "See within 30 minutes. Reorder queue.",
  NON_URGENT: "Routine queue.",
};
