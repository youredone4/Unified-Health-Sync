/**
 * Plain-language glossary for medical / DOH jargon used across HealthSync.
 *
 * Single source of truth. Both the <Term> component (popup tip + inline
 * gloss) and the /glossary page read from this file. Adding a new term is
 * one line — keep entries short. If a term needs a paragraph, link out to
 * the source DOH document instead of inlining it.
 *
 * Sourcing: definitions paraphrase DOH documents and the M1 FHSIS Brgy
 * 2025 form. Where a definition is operationally important (e.g. Rabies
 * Category III dose schedule), cite the source so audits can verify.
 */

export interface GlossaryEntry {
  /** What the term means in one short sentence — used inline. */
  short: string;
  /** Optional longer paragraph — shown in the popup tip and on /glossary. */
  long?: string;
  /** Optional citation (DOH AO number, FHSIS section, etc). */
  source?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ─── DOH program acronyms ─────────────────────────────────────────────
  AEFI: {
    short: "Adverse Event Following Immunization",
    long: "Any unwanted medical occurrence after vaccination, whether or not it has a causal relationship with the vaccine. Reported via the AEFI surveillance system.",
    source: "DOH AO 2008-0007",
  },
  PIDSR: {
    short: "Philippine Integrated Disease Surveillance and Response",
    long: "The DOH framework for routine surveillance of notifiable diseases (Category I weekly, Category II monthly).",
    source: "DOH AO 2007-0036",
  },
  IMCI: {
    short: "Integrated Management of Childhood Illness",
    long: "WHO/UNICEF approach for assessing and treating common childhood illnesses (0-59 mos) at primary care.",
  },
  MNCHN: {
    short: "Maternal, Newborn, Child Health and Nutrition",
  },
  PhilPEN: {
    short: "Philippine Package of Essential NCD Interventions",
    long: "DOH risk-assessment + management package for non-communicable diseases at primary care (smoking, alcohol, activity, diet, BMI).",
    source: "DOH AO 2012-0029",
  },
  mhGAP: {
    short: "Mental Health Gap Action Programme",
    long: "WHO mental-health screening and intervention package adopted by DOH for primary care.",
  },
  CPAB: {
    short: "Children Protected At Birth",
    long: "Newborns whose mother received at least 2 doses of tetanus toxoid (Td) before delivery — protected from neonatal tetanus.",
  },
  WRA: {
    short: "Women of Reproductive Age",
    long: "Women aged 15–49. Used as the denominator for family-planning indicators.",
  },
  FHSIS: {
    short: "Field Health Services Information System",
    long: "DOH's monthly reporting system for primary-care health stations. The M1 form is its main barangay-level instrument.",
  },
  M1: {
    short: "FHSIS Form M1 (Barangay)",
    long: "Monthly summary of every routine health-program indicator reported by a barangay health station to the RHU.",
    source: "FHSIS Manual 2025",
  },

  // ─── Vaccines ─────────────────────────────────────────────────────────
  BCG: {
    short: "Bacille Calmette-Guérin (TB vaccine)",
    long: "Live attenuated vaccine against tuberculosis. Given at birth or up to 1 year. Splits in M1 by age-at-vaccination: D1-02a (≤28 days) vs D1-02b (29 days–1 year).",
  },
  Penta: {
    short: "Pentavalent vaccine — DPT + HiB + Hep-B",
    long: "Single combined dose against diphtheria, pertussis, tetanus, Haemophilus influenzae type b, and hepatitis B. 3-dose primary schedule (D2-01..03) plus a booster at 13–23 mo (D3-01).",
  },
  OPV: {
    short: "Oral Polio Vaccine",
  },
  IPV: {
    short: "Inactivated Polio Vaccine",
    long: "Injectable polio vaccine. IPV1 (D2-07) is part of the routine 0–12 mo schedule; IPV2 splits into routine (D2-08) and 13–23 mo catch-up (D3-04).",
  },
  MR: {
    short: "Measles–Rubella vaccine",
    long: "Combined measles + rubella vaccine. MR1 at ~9 mo (D2-09); MR2 at ~12–15 mo (D3-03).",
  },
  HPV: {
    short: "Human Papillomavirus vaccine",
    long: "Given to 9-year-old girls in 2 doses (D4-01, D4-02). Prevents cervical cancer.",
  },
  Td: {
    short: "Tetanus–Diphtheria booster",
    long: "Given to Grade 1 learners under the school-based program (D4-03), and to pregnant women (TT/Td schedule) for CPAB protection.",
  },

  // ─── Nutrition ────────────────────────────────────────────────────────
  MAM: {
    short: "Moderate Acute Malnutrition",
    long: "Weight-for-height z-score between –3 and –2, OR mid-upper-arm circumference (MUAC) 11.5–12.4 cm in children 6–59 mo. Treated via SFP.",
  },
  SAM: {
    short: "Severe Acute Malnutrition",
    long: "Weight-for-height z-score < –3 OR MUAC < 11.5 cm OR bilateral pitting edema. Requires OTC enrollment; complications need inpatient care.",
  },
  SFP: {
    short: "Supplementary Feeding Program",
    long: "Community-based ready-to-use food program for MAM children.",
  },
  OTC: {
    short: "Outpatient Therapeutic Care",
    long: "Outpatient SAM management with ready-to-use therapeutic food (RUTF).",
  },
  LBW: {
    short: "Low Birth Weight",
    long: "Birth weight < 2.5 kg. Triggers complete iron supplementation (E-02).",
  },

  // ─── Maternal / postpartum ────────────────────────────────────────────
  ANC: {
    short: "Antenatal Care",
    long: "Visits during pregnancy. M1 indicators target ≥4 ANC (A-01a) and ≥8 ANC (A-01b) per WHO 2016 guidance.",
  },
  PNC: {
    short: "Postnatal Care",
    long: "Visits after delivery. M1 Section C tracks completion of 2 PNC (C-01a) and 4 PNC (C-01b) per the DOH MNCHN AO 2008-0029 schedule (24h, 72h, 7d, 6w).",
  },
  GDM: {
    short: "Gestational Diabetes Mellitus",
    long: "Glucose intolerance first detected during pregnancy. Screened in 2nd trimester (A-09).",
  },
  MMS: {
    short: "Multiple Micronutrient Supplementation",
    long: "Daily prenatal supplement combining iron, folic acid, and 13 other vitamins/minerals. Replaced standalone iron+folic in many DOH programs.",
  },
  "TRANS-IN": {
    short: "Mother transferred IN from another LGU mid-pregnancy",
    long: "Counted in C-01b-b / C-01c-b. The receiving LGU records her PNC visits even though pregnancy was tracked elsewhere.",
  },
  "TRANS-OUT": {
    short: "Mother transferred OUT before completing 4 PNC",
    long: "With Movement of Verification (MOV). Counted in C-01c-c.",
  },

  // ─── Disease surveillance — Filariasis ────────────────────────────────
  Lymphedema: {
    short: "Tissue swelling from filariasis blockage",
    long: "Chronic limb swelling caused by adult filaria worms blocking lymphatic vessels. Drives M1 row DIS-FIL-03.",
  },
  Hydrocele: {
    short: "Scrotal swelling from filariasis",
    long: "Fluid accumulation in the scrotal sac caused by lymphatic damage. Drives M1 row DIS-FIL-04. Surgical referral indicated.",
  },

  // ─── Disease surveillance — Rabies ────────────────────────────────────
  "Rabies Category I": {
    short: "Touching/feeding animal, intact skin",
    long: "No risk. No PEP needed. Wash exposure if any.",
    source: "DOH 2018 Rabies Manual",
  },
  "Rabies Category II": {
    short: "Minor scratches/abrasions, no bleeding",
    long: "Vaccine only (no RIG). Anti-rabies vaccine on Days 0, 3, 7, 14, 28 OR per current schedule. ABTC referral.",
    source: "DOH 2018 Rabies Manual",
  },
  "Rabies Category III": {
    short: "Bites that broke skin, mucosa exposure, bat contact",
    long: "MEDICAL EMERGENCY. Vaccine + Rabies Immune Globulin (RIG) + immediate ABTC referral. Wound washing 15 min. Tetanus prophylaxis as needed.",
    source: "DOH 2018 Rabies Manual",
  },
  ABTC: {
    short: "Animal Bite Treatment Center",
    long: "DOH-accredited facility certified to provide post-exposure prophylaxis (vaccine + RIG). Non-ABTC treatment is sub-standard and a quality flag.",
  },
  RIG: {
    short: "Rabies Immune Globulin",
    long: "Passive antibody given alongside vaccine for Category III exposures. Infiltrated around the wound.",
  },
  PEP: {
    short: "Post-Exposure Prophylaxis",
    long: "Vaccine ± RIG given after a potential rabies exposure to prevent the disease.",
  },

  // ─── Disease surveillance — Schisto / STH / Leprosy ───────────────────
  Schistosomiasis: {
    short: "Parasitic disease from freshwater snail vector",
    long: "Endemic in 12 Philippine provinces. Confirmed cases trigger water-source investigation and praziquantel mass drug administration.",
  },
  STH: {
    short: "Soil-Transmitted Helminth (intestinal worm)",
    long: "Roundworm, hookworm, whipworm. Confirmed cases drive school deworming campaigns.",
  },
  Leprosy: {
    short: "Hansen's disease — chronic mycobacterial infection",
    long: "Confirmed cases require contact tracing of household members and supervised Multi-Drug Therapy (MDT).",
  },
  MDT: {
    short: "Multi-Drug Therapy (for leprosy)",
    long: "Combination antibiotic regimen (rifampicin + dapsone ± clofazimine) given over 6–12 months.",
  },

  // ─── Surveillance workflow statuses ───────────────────────────────────
  REPORTED: {
    short: "New record — not yet reviewed",
    long: "Default status when an operator logs a surveillance record. Awaiting clinical review.",
  },
  REVIEWED: {
    short: "Reviewed by clinical staff — no escalation needed",
    long: "Status set by an MHO/SHA/TL after looking at the record. No follow-up action queued.",
  },
  ESCALATED: {
    short: "Flagged for MHO action",
    long: "Reviewer determined the case needs municipal-level follow-up. Surfaces in the MGMT inbox.",
  },
  CLOSED: {
    short: "Case complete — no further action",
  },

  // ─── Roles ────────────────────────────────────────────────────────────
  MHO: {
    short: "Municipal Health Officer",
    long: "Senior physician overseeing the RHU. Signs off on M1 reports and acts on escalated cases.",
  },
  SHA: {
    short: "Sanitary Health Aide",
    long: "Field staff under the MHO; supports surveillance and program logistics.",
  },
  TL: {
    short: "Team Leader (Barangay Nurse)",
    long: "BHS-level nurse. Captures patient registry data and routine indicators.",
  },
  RHU: {
    short: "Rural Health Unit",
    long: "Municipal-level primary-care facility staffed by an MHO + nurses + midwives.",
  },
  BHS: {
    short: "Barangay Health Station",
    long: "Village-level primary-care outpost staffed by a Team Leader (nurse) + barangay health workers.",
  },
  LGU: {
    short: "Local Government Unit",
    long: "Province / city / municipality / barangay. Each level has health-program responsibility.",
  },

  // ─── Maternal additions (B2 surface) ──────────────────────────────────
  BEmONC: {
    short: "Basic Emergency Obstetric and Newborn Care",
    long: "Facility level certified to handle obstetric emergencies (antibiotics, oxytocics, anticonvulsants, manual placenta removal, basic newborn resuscitation).",
  },
  CEmONC: {
    short: "Comprehensive Emergency Obstetric and Newborn Care",
    long: "Facility level above BEmONC — adds cesarean delivery + blood transfusion capability.",
  },
  KMC: {
    short: "Kangaroo Mother Care",
    long: "Skin-to-skin contact between mother and low-birth-weight infant. Reduces neonatal mortality; recommended for stable LBW babies.",
  },
  EBF: {
    short: "Exclusive Breastfeeding",
    long: "Infant receives only breast milk for first 6 months — no water, formula, or other foods. Drives M1 row E-01.",
  },
  TT: {
    short: "Tetanus Toxoid (older name for Td)",
    long: "Vaccine schedule given to pregnant women (and women of reproductive age) to prevent neonatal tetanus.",
  },

  // ─── Child / IMCI additions ───────────────────────────────────────────
  ORS: {
    short: "Oral Rehydration Solution",
    long: "Sugar-salt solution for diarrhea management. Combined with zinc per IMCI protocol.",
  },
  MUAC: {
    short: "Mid-Upper-Arm Circumference",
    long: "Tape measurement of upper arm; <11.5 cm = SAM, 11.5–12.4 cm = MAM in children 6–59 mo.",
  },

  // ─── NCD / Senior additions ───────────────────────────────────────────
  HTN: {
    short: "Hypertension",
    long: "Sustained BP ≥140/90 mmHg in adults. Drives PhilPEN identification + medication management (G2-01..04).",
  },
  DM: {
    short: "Diabetes Mellitus",
    long: "Chronic condition where blood glucose is poorly regulated. Type 2 most common in adult NCD screening.",
  },
  VIA: {
    short: "Visual Inspection with Acetic Acid",
    long: "Cervical cancer screening method — vinegar applied to cervix; abnormal areas turn white. Used as primary screen in resource-limited settings.",
  },
  Pap: {
    short: "Papanicolaou (Pap) smear",
    long: "Cytology-based cervical cancer screening. Cells scraped from cervix examined under microscope.",
  },

  // ─── Disease / TB additions ───────────────────────────────────────────
  DOT: {
    short: "Directly Observed Therapy",
    long: "TB treatment supervised by a health worker who watches the patient swallow each dose. Prevents resistance from missed doses.",
  },
  "MDR-TB": {
    short: "Multi-Drug-Resistant Tuberculosis",
    long: "TB resistant to at least isoniazid + rifampicin. Requires longer regimen at a specialized treatment center.",
  },
  "XDR-TB": {
    short: "Extensively Drug-Resistant Tuberculosis",
    long: "MDR-TB plus resistance to fluoroquinolones AND at least one injectable second-line drug. Very limited treatment options.",
  },
  "Cat I": {
    short: "PIDSR Category I — weekly-reportable diseases",
    long: "Notifiable diseases requiring immediate / weekly reporting (e.g., AFP, measles, neonatal tetanus, rabies).",
    source: "DOH AO 2007-0036",
  },
  "Cat II": {
    short: "PIDSR Category II — monthly-reportable diseases",
    long: "Endemic / chronic diseases reported monthly (e.g., dengue, leptospirosis, typhoid).",
    source: "DOH AO 2007-0036",
  },

  // ─── Outbreak / surveillance status ───────────────────────────────────
  SUSPECTED: {
    short: "Outbreak under investigation — not yet confirmed",
    long: "Cluster threshold met; lab confirmation or epidemiologic link still pending.",
  },
  DECLARED: {
    short: "Outbreak confirmed — response active",
    long: "Outbreak meets case definition; Rapid Response Team mobilized.",
  },
  CONTAINED: {
    short: "Outbreak controlled — monitoring continues",
    long: "Transmission interrupted; surveillance maintained for 2× incubation period before closure.",
  },

  // ─── Mortality / death-review additions ───────────────────────────────
  MDR: {
    short: "Maternal Death Review",
    long: "Mandatory facility-based or community-based audit of every maternal death within 90 days. Identifies system gaps to prevent recurrence.",
    source: "DOH AO 2008-0029",
  },
  CDR: {
    short: "Child Death Review",
    long: "Audit of under-5 deaths to identify clinical or system contributors and corrective actions.",
  },
  PDR: {
    short: "Perinatal Death Review",
    long: "Audit of fetal deaths + early-neonatal deaths (≤6 days). Captures intrapartum and obstetric system issues.",
  },

  // ─── Triage / walk-in ─────────────────────────────────────────────────
  EMERGENT: {
    short: "Triage tier 1 — life-threatening, see immediately",
    long: "Patient requires resuscitation or immediate physician evaluation. RHU triggers escalation if not seen within 1 hour.",
  },
  URGENT: {
    short: "Triage tier 2 — needs prompt evaluation",
    long: "Stable but with concerning symptoms; should be seen within the same shift.",
  },
  NON_URGENT: {
    short: "Triage tier 3 — routine consultation",
  },

  // ─── Operational ──────────────────────────────────────────────────────
  FEFO: {
    short: "First-Expiry-First-Out",
    long: "Inventory rule for expirable stock — issue items closest to expiry before newer stock.",
  },
  Konsulta: {
    short: "PhilHealth Konsulta primary-care benefit package",
    long: "PhilHealth-financed outpatient package: consultations, basic labs, medicines for hypertension/diabetes/asthma.",
  },
  TRIM: {
    short: "Treatment Information Management (FHSIS)",
  },
};

/** Look up a term — returns null if not in glossary. */
export function lookupTerm(term: string): GlossaryEntry | null {
  return GLOSSARY[term] ?? null;
}

/** All terms sorted alphabetically — for the /glossary page. */
export function allTerms(): Array<{ term: string; entry: GlossaryEntry }> {
  return Object.entries(GLOSSARY)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([term, entry]) => ({ term, entry }));
}
