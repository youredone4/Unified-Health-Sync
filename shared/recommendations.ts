/**
 * Rule-based recommendation engine — Phase 1.
 *
 * Maps surveillance row criteria to DOH-grounded action checklists.
 * Rules are deterministic, pure, and citable. No LLM is consulted.
 *
 * Design decisions captured in docs/ai-recommendations-design.md:
 *   - Every rule has a DOH source citation.
 *   - severity ∈ {info, advisory, urgent} drives card colour.
 *   - The card always shows the disclaimer footer:
 *     "DOH guidance — reviewer judgment required."
 *   - Predicates must be pure: no Date.now(), no I/O, no throwing.
 *
 * Adding a rule = one PR. Retiring a rule = mark `retired: true`
 * (don't delete) so audit history still resolves the id.
 */

export const RECOMMENDATION_MODULES = [
  "rabies",
  "filariasis",
  "schisto",
  "sth",
  "leprosy",
] as const;
export type RecommendationModule = (typeof RECOMMENDATION_MODULES)[number];

export const RECOMMENDATION_SEVERITIES = ["info", "advisory", "urgent"] as const;
export type RecommendationSeverity = (typeof RECOMMENDATION_SEVERITIES)[number];

export interface Recommendation {
  /** Stable id; never re-used after retirement. e.g. "rabies-cat-iii-pep". */
  id: string;
  module: RecommendationModule;
  /** Pure predicate. Must not throw, must be deterministic. */
  applies: (row: any) => boolean;
  title: string;
  bullets: string[];
  /** DOH AO / Manual citation, e.g. "DOH 2018 Rabies Manual". */
  source: string;
  sourceUrl?: string;
  severity: RecommendationSeverity;
  /** Set true to keep id resolvable in audit logs but hide from UI. */
  retired?: boolean;
}

/**
 * The rule registry. Order doesn't matter — the consumer sorts by severity.
 *
 * Every rule's predicate runs on whatever shape the caller passes; type
 * unsafety inside `applies` is intentional so we can mix shapes from 5
 * different surveillance tables without a sprawling discriminated union.
 * The `module` discriminator gates which predicates ever see a given row.
 */
export const RECOMMENDATIONS: Recommendation[] = [
  // ── Rabies ──────────────────────────────────────────────────────────
  {
    id: "rabies-cat-iii-pep",
    module: "rabies",
    applies: (r) => r?.category === "III",
    title: "Category III exposure — medical emergency",
    bullets: [
      "Wash wound for 15 minutes with soap and running water.",
      "Administer anti-rabies vaccine: Days 0, 3, 7, 14, 28.",
      "Infiltrate Rabies Immune Globulin (RIG) at the wound site.",
      "Refer to ABTC immediately. Tetanus prophylaxis as needed.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "urgent",
  },
  {
    id: "rabies-cat-ii-non-abtc",
    module: "rabies",
    applies: (r) => r?.category === "II" && r?.treatmentCenter === "NON_ABTC",
    title: "Quality flag: Category II treated outside ABTC",
    bullets: [
      "Anti-rabies regimens given outside ABTCs are sub-standard.",
      "Confirm the patient completed the full Days 0/3/7/14/28 schedule.",
      "Refer for review and dose-completion follow-up.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "advisory",
  },

  // ── Filariasis ──────────────────────────────────────────────────────
  {
    id: "filariasis-positive",
    module: "filariasis",
    applies: (r) => r?.result === "POSITIVE",
    title: "Filariasis-positive — flag barangay for next MDA",
    bullets: [
      "Mass Drug Administration (DEC + albendazole) targets endemic barangays.",
      "Record the case in PIDSR and add the barangay to the next MDA roster.",
      "If lymphedema or hydrocele, refer for MMDP / surgical evaluation.",
    ],
    source: "DOH AO 2018-0030 (Filariasis Elimination)",
    severity: "advisory",
  },
  {
    id: "filariasis-hydrocele",
    module: "filariasis",
    applies: (r) => r?.manifestation === "HYDROCELE",
    title: "Hydrocele — surgical referral indicated",
    bullets: [
      "Hydrocele requires surgical management at a referral facility.",
      "Document MMDP morbidity-management plan.",
      "Coordinate with provincial-level surgical service.",
    ],
    source: "DOH AO 2018-0030",
    severity: "advisory",
  },

  // ── Schistosomiasis ────────────────────────────────────────────────
  {
    id: "schisto-confirmed",
    module: "schisto",
    applies: (r) => r?.confirmed === true,
    title: "Schistosomiasis confirmed — water-source investigation",
    bullets: [
      "Initiate praziquantel treatment per protocol.",
      "Trigger water-source survey for the patient's barangay.",
      "Add barangay to next snail-control activity.",
    ],
    source: "DOH AO 2017-0028 (Schistosomiasis Elimination)",
    severity: "advisory",
  },

  // ── Soil-Transmitted Helminth ──────────────────────────────────────
  {
    id: "sth-confirmed",
    module: "sth",
    applies: (r) => r?.confirmed === true,
    title: "STH confirmed — schedule school deworming",
    bullets: [
      "Add the patient's barangay to the next deworming round (Jul / Jan).",
      "Coordinate with the school health team for school-aged contacts.",
      "If non-resident, route a copy to the home-LGU.",
    ],
    source: "DOH AO 2015-0030 (STH Control)",
    severity: "advisory",
  },

  // ── Leprosy ────────────────────────────────────────────────────────
  {
    id: "leprosy-new-case",
    module: "leprosy",
    applies: (r) => r?.newCase === true,
    title: "New leprosy case — start contact tracing + MDT",
    bullets: [
      "Begin Multi-Drug Therapy (MDT) per WHO/DOH protocol.",
      "Trace household contacts; screen for early signs.",
      "Schedule disability assessment at registration.",
    ],
    source: "DOH AO 2017-0020 (Leprosy Control)",
    severity: "advisory",
  },
];

const SEVERITY_RANK: Record<RecommendationSeverity, number> = {
  urgent: 3,
  advisory: 2,
  info: 1,
};

/**
 * Run every rule in the given module against `row` and return matches in
 * severity-descending order. Errors inside any single predicate are caught
 * so one buggy rule can't suppress the rest.
 */
export function recommendationsFor(
  module: RecommendationModule,
  row: unknown,
): Recommendation[] {
  const matches: Recommendation[] = [];
  for (const rule of RECOMMENDATIONS) {
    if (rule.module !== module) continue;
    if (rule.retired) continue;
    let applied = false;
    try {
      applied = !!rule.applies(row);
    } catch {
      applied = false;
    }
    if (applied) matches.push(rule);
  }
  return matches.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

/** Disclaimer rendered as a footer on every recommendation card. */
export const RECOMMENDATION_DISCLAIMER =
  "DOH guidance — not a clinical order. Reviewer judgment required.";
