/**
 * Client-side metadata for the PIMAM / OPT-Plus nutrition follow-up actions.
 * Codes are defined in shared/schema.ts; this file owns the UI presentation:
 * label, group, and whether a barangay health station (BHS) can authorize it.
 * Used by <NutritionFollowUpDialog> to render grouped checkbox lists.
 *
 * Sources: DOH AO 2015-0055 (PIMAM), NNC OPT-Plus Operations Manual 2022,
 *          PhilHealth Circular 2016-0001 (Z-Benefit for SAM).
 */
import type { NutritionAction, NutritionClassification } from "@shared/schema";

export type ActionGroup = "Clinical referral" | "Supplementation" | "Counselling" | "Monitoring" | "Social protection";

export interface ActionMeta {
  code: NutritionAction;
  label: string;
  group: ActionGroup;
  bhsCanDeliver: boolean;  // BHS/TL-authorized at barangay level
}

export const ACTION_METADATA: Record<NutritionAction, ActionMeta> = {
  REFER_RHU:              { code: "REFER_RHU",              label: "Refer to RHU / MHO",                           group: "Clinical referral",   bhsCanDeliver: true },
  REFER_HOSPITAL_SAM:     { code: "REFER_HOSPITAL_SAM",     label: "Refer to hospital (SAM w/ complications)",     group: "Clinical referral",   bhsCanDeliver: true },

  ENROLL_OTC:             { code: "ENROLL_OTC",             label: "Enroll in OTC (Outpatient Therapeutic Care)",  group: "Supplementation",     bhsCanDeliver: false },
  ENROLL_SFP:             { code: "ENROLL_SFP",             label: "Enroll in Supplementary Feeding (SFP)",        group: "Supplementation",     bhsCanDeliver: false },
  PROVIDE_RUTF:           { code: "PROVIDE_RUTF",           label: "Provide RUTF (therapeutic food)",              group: "Supplementation",     bhsCanDeliver: false },
  PROVIDE_RUSF:           { code: "PROVIDE_RUSF",           label: "Provide RUSF (supplementary food)",            group: "Supplementation",     bhsCanDeliver: false },
  VITAMIN_A:              { code: "VITAMIN_A",              label: "Vitamin A (Garantisadong Pambata)",            group: "Supplementation",     bhsCanDeliver: true },
  DEWORMING:              { code: "DEWORMING",              label: "Deworming (≥12 mo)",                           group: "Supplementation",     bhsCanDeliver: true },
  MNP_SUPPLEMENT:         { code: "MNP_SUPPLEMENT",         label: "Micronutrient Powder (6–23 mo)",               group: "Supplementation",     bhsCanDeliver: true },
  IRON_SUPPLEMENT:        { code: "IRON_SUPPLEMENT",        label: "Iron supplement",                              group: "Supplementation",     bhsCanDeliver: true },

  IYCF_COUNSELLING:       { code: "IYCF_COUNSELLING",       label: "IYCF counselling (Infant & Young Child Feeding)", group: "Counselling",      bhsCanDeliver: true },
  BREASTFEEDING_SUPPORT:  { code: "BREASTFEEDING_SUPPORT",  label: "Breastfeeding support (<6 mo)",                group: "Counselling",         bhsCanDeliver: true },
  NUTRITION_COUNSELLING:  { code: "NUTRITION_COUNSELLING",  label: "Nutrition counselling for caregiver",          group: "Counselling",         bhsCanDeliver: true },
  WASH_COUNSELLING:       { code: "WASH_COUNSELLING",       label: "WASH counselling (water / sanitation / hygiene)", group: "Counselling",      bhsCanDeliver: true },

  GROWTH_MONITORING:      { code: "GROWTH_MONITORING",      label: "Growth monitoring (OPT-Plus monthly weighing)", group: "Monitoring",          bhsCanDeliver: true },
  HOME_VISIT_MUAC:        { code: "HOME_VISIT_MUAC",        label: "Home visit + MUAC re-measurement",             group: "Monitoring",          bhsCanDeliver: true },
  IMMUNIZATION_CATCHUP:   { code: "IMMUNIZATION_CATCHUP",   label: "Immunization catch-up (EPI)",                  group: "Monitoring",          bhsCanDeliver: true },

  PANTAWID_4PS_REFERRAL:  { code: "PANTAWID_4PS_REFERRAL",  label: "Pantawid (4Ps) referral",                      group: "Social protection",   bhsCanDeliver: false },
  PHILHEALTH_ENROLLMENT:  { code: "PHILHEALTH_ENROLLMENT",  label: "PhilHealth Konsulta / Z-Benefit enrolment",    group: "Social protection",   bhsCanDeliver: false },
};

export const ACTION_GROUPS: ActionGroup[] = [
  "Clinical referral",
  "Supplementation",
  "Counselling",
  "Monitoring",
  "Social protection",
];

export const CLASSIFICATION_LABELS: Record<NutritionClassification, string> = {
  SAM_COMPLICATED:      "SAM with complications",
  SAM_UNCOMPLICATED:    "SAM (no complications)",
  MAM:                  "Moderate Acute Malnutrition (MAM)",
  SEVERELY_UNDERWEIGHT: "Severely underweight (WAZ < −3)",
  UNDERWEIGHT:          "Underweight (WAZ < −2)",
  NORMAL_RECOVERED:     "Normal / Recovered",
  DEFAULTER:            "Defaulter (missed visits)",
};

export const CLASSIFICATION_COLORS: Record<NutritionClassification, string> = {
  SAM_COMPLICATED:      "bg-red-600/20 text-red-500 border-red-600/40",
  SAM_UNCOMPLICATED:    "bg-red-500/20 text-red-400 border-red-500/30",
  MAM:                  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SEVERELY_UNDERWEIGHT: "bg-red-500/20 text-red-400 border-red-500/30",
  UNDERWEIGHT:          "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  NORMAL_RECOVERED:     "bg-green-500/20 text-green-500 border-green-500/30",
  DEFAULTER:            "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

/**
 * Protocol-driven defaults per classification.
 * Returns:
 *   - actions: action codes pre-checked for this classification
 *   - nextFollowUpDays: recommended days until next follow-up
 *   - nextStepText: human-readable suggested next-step string
 * Source: PIMAM Manual of Operations + NNC OPT-Plus Guidelines.
 */
export function protocolDefaults(classification: NutritionClassification): {
  actions: NutritionAction[];
  nextFollowUpDays: number;
  nextStepText: string;
} {
  switch (classification) {
    case "SAM_COMPLICATED":
      return {
        actions: ["REFER_HOSPITAL_SAM", "PHILHEALTH_ENROLLMENT"],
        nextFollowUpDays: 1,
        nextStepText: "Refer immediately (same day) to inpatient therapeutic centre.",
      };
    case "SAM_UNCOMPLICATED":
      return {
        actions: ["REFER_RHU", "ENROLL_OTC", "PROVIDE_RUTF", "VITAMIN_A", "DEWORMING", "IYCF_COUNSELLING"],
        nextFollowUpDays: 7,
        nextStepText: "Weekly OTC follow-up for 8–12 weeks until cured.",
      };
    case "MAM":
      return {
        actions: ["ENROLL_SFP", "PROVIDE_RUSF", "IYCF_COUNSELLING", "MNP_SUPPLEMENT"],
        nextFollowUpDays: 14,
        nextStepText: "Re-measure every 2 weeks; continue SFP for up to 3 months.",
      };
    case "SEVERELY_UNDERWEIGHT":
      return {
        actions: ["REFER_RHU", "GROWTH_MONITORING", "NUTRITION_COUNSELLING", "VITAMIN_A", "DEWORMING", "HOME_VISIT_MUAC"],
        nextFollowUpDays: 14,
        nextStepText: "Assess for SAM at RHU; bi-weekly growth monitoring until WAZ ≥ −2.",
      };
    case "UNDERWEIGHT":
      return {
        actions: ["GROWTH_MONITORING", "NUTRITION_COUNSELLING", "HOME_VISIT_MUAC", "VITAMIN_A", "DEWORMING"],
        nextFollowUpDays: 30,
        nextStepText: "Monthly re-weigh (OPT-Plus); caregiver nutrition counselling.",
      };
    case "DEFAULTER":
      return {
        actions: ["HOME_VISIT_MUAC", "NUTRITION_COUNSELLING"],
        nextFollowUpDays: 7,
        nextStepText: "Home visit within 7 days; MUAC re-measurement and re-enrolment.",
      };
    case "NORMAL_RECOVERED":
      return {
        actions: ["GROWTH_MONITORING"],
        nextFollowUpDays: 90,
        nextStepText: "Routine quarterly growth-monitoring promotion (GMP).",
      };
  }
}

/**
 * Suggest a classification from a WAZ category computed by getWeightZScore().
 * Conservative: treats "sam" from getWeightZScore as SAM_UNCOMPLICATED by
 * default; the operator up-grades to SAM_COMPLICATED if danger signs present.
 */
export function suggestClassification(
  zCategory: "sam" | "mam" | "normal" | null | undefined,
  zScore: number | null | undefined,
): NutritionClassification {
  if (zCategory === "sam") {
    return zScore !== null && zScore !== undefined && zScore < -3 ? "SAM_UNCOMPLICATED" : "SEVERELY_UNDERWEIGHT";
  }
  if (zCategory === "mam") return "MAM";
  if (zScore !== null && zScore !== undefined && zScore < -2) return "UNDERWEIGHT";
  return "NORMAL_RECOVERED";
}
