# Design proposal — AI-assisted recommended course of action

**Status:** draft for review (no code yet).
**Author:** Claude.
**Audience:** the 3 surveillance / clinical surfaces that already have a row-action drawer (disease-surveillance, mortality, mgmt-inbox).
**Goal:** when an operator opens a row, surface a **DOH-grounded recommended next step** so a non-clinical decision-maker can act without translating jargon, and a clinical user gets a checklist they don't have to memorize.

---

## Why this is not "AI-first"

The user's framing was "AI-driven recommendation." The honest answer for a clinical-surveillance system in a rural LGU:

- **Rule-based first.** DOH protocols are deterministic checklists (e.g., Rabies Cat III → vaccine + RIG + ABTC referral, dose schedule Days 0/3/7/14/28). A rule engine that maps row criteria → DOH guideline is **safer, auditable, citable, and offline-capable**. An LLM is the wrong tool for "if patient was bitten and category=III, recommend X" — a `match` statement is.
- **LLM-augmented second.** Once the rule engine is solid, an LLM layer can summarize the recommendation in plain language for a mayor, generate a draft referral letter, or pull in a follow-up question — but **always alongside** the rule-based citation, never replacing it.
- **Disclaimer always.** Every recommendation card carries "DOH guidance — not a clinical order. Reviewer judgment required." This is non-negotiable.

---

## What the recommendation card looks like

When a user opens an action drawer (or visits a row detail), if any rule fires, a card slots above the existing form:

```
┌─────────────────────────────────────────────────┐
│  💡  Recommended action — DOH 2018 Rabies Manual│
│                                                 │
│  Category III exposure: medical emergency.      │
│  • Wash wound 15 min                            │
│  • Anti-rabies vaccine (Days 0,3,7,14,28)       │
│  • Rabies Immune Globulin (RIG) infiltration    │
│  • Refer to ABTC                                │
│                                                 │
│  [Mark Reviewed]  [Escalate to MHO]  [Source ↗] │
│                                                 │
│  ⓘ Guidance only — reviewer judgment required.  │
└─────────────────────────────────────────────────┘
```

Buttons map to the existing surveillance workflow (status transitions). The recommendation **doesn't add new actions** — it tells the reviewer which existing action is most aligned with DOH guidance.

---

## Phase 1 — rule engine (this proposal's scope)

A new `shared/recommendations.ts` defines rules as plain TypeScript:

```ts
interface Recommendation {
  id: string;                // e.g. "rabies-cat-iii-pep"
  module: "rabies" | "filariasis" | "schisto" | "sth" | "leprosy" | "mortality";
  // Pure predicate over the row — must not throw, must be deterministic.
  applies: (row: any) => boolean;
  title: string;
  bullets: string[];
  source: string;            // DOH AO / Manual citation
  sourceUrl?: string;
  severity: "info" | "advisory" | "urgent";
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rabies-cat-iii-pep",
    module: "rabies",
    applies: (r) => r.category === "III",
    title: "Category III exposure — medical emergency",
    bullets: [
      "Wash wound for 15 minutes with soap and running water.",
      "Administer anti-rabies vaccine, schedule Days 0, 3, 7, 14, 28.",
      "Infiltrate Rabies Immune Globulin (RIG) at the wound site.",
      "Refer to ABTC immediately. Tetanus prophylaxis as needed.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "urgent",
  },
  {
    id: "rabies-cat-ii-non-abtc",
    module: "rabies",
    applies: (r) => r.category === "II" && r.treatmentCenter === "NON_ABTC",
    title: "Quality flag: Category II treated outside ABTC",
    bullets: [
      "Anti-rabies regimens given outside ABTCs are sub-standard.",
      "Confirm the patient completed the full Days 0/3/7/14/28 schedule.",
      "Refer for review and dose-completion follow-up.",
    ],
    source: "DOH 2018 Rabies Manual",
    severity: "advisory",
  },
  {
    id: "filariasis-positive",
    module: "filariasis",
    applies: (r) => r.result === "POSITIVE",
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
    applies: (r) => r.manifestation === "HYDROCELE",
    title: "Hydrocele — surgical referral indicated",
    bullets: [
      "Hydrocele requires surgical management at a referral facility.",
      "Document MMDP morbidity-management plan.",
      "Coordinate with provincial-level surgical service.",
    ],
    source: "DOH AO 2018-0030",
    severity: "advisory",
  },
  {
    id: "schisto-confirmed",
    module: "schisto",
    applies: (r) => r.confirmed === true,
    title: "Schistosomiasis confirmed — water-source investigation",
    bullets: [
      "Initiate praziquantel treatment per protocol.",
      "Trigger water-source survey for the patient's barangay.",
      "Add barangay to next snail-control activity.",
    ],
    source: "DOH AO 2017-0028 (Schistosomiasis Elimination)",
    severity: "advisory",
  },
  {
    id: "sth-confirmed",
    module: "sth",
    applies: (r) => r.confirmed === true,
    title: "STH confirmed — schedule school deworming",
    bullets: [
      "Add the patient's barangay to the next deworming round (Jul / Jan).",
      "Coordinate with the school health team for school-aged contacts.",
      "If non-resident, route a copy to the home-LGU.",
    ],
    source: "DOH AO 2015-0030 (STH Control)",
    severity: "advisory",
  },
  {
    id: "leprosy-new-case",
    module: "leprosy",
    applies: (r) => r.newCase === true,
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

/** Run every applicable rule against a row; return ordered by severity. */
export function recommendationsFor(module: Recommendation["module"], row: unknown): Recommendation[] {
  return RECOMMENDATIONS
    .filter((r) => r.module === module && r.applies(row))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
```

A `<RecommendationCard recommendation={r} />` component slots into the action drawer above the status form.

---

## Phase 2 — LLM augmentation (separate proposal)

Once Phase 1 is solid in production, optional Phase 2:

- **Plain-language summary** for viewers: take the rule-based recommendation, ask Claude to rewrite the bullets in 5th-grade Filipino-English. Cache per (rule_id, locale). Cited source remains visible.
- **Draft referral letter generator**: when the reviewer clicks "Refer to ABTC", an LLM generates a draft letter using the row data + DOH template. Reviewer edits before sending.
- **Anomaly hint**: scan recent surveillance rows for the barangay; if 3+ Cat III rabies in 7 days, append "⚠ Possible cluster — consider outbreak alert."

Phase 2 always carries the same disclaimer + always renders alongside the rule-based citation. **Never the only signal.**

---

## What this proposal is NOT

- ❌ A diagnostic AI. The recommendation is "if you have THIS row, here's the protocol checklist for THAT row" — not "is this rabies?"
- ❌ An autonomous actor. Every recommended action requires a human click. Status transitions still go through the existing PATCH endpoints.
- ❌ Replacement for clinical judgment. The disclaimer is mandatory and always visible.
- ❌ Customizable by operators. Rules live in code, change via PR, audit-logged. LGUs cannot soften DOH guidance via the UI.

---

## Audit trail

Every time a recommendation is **shown** (impression), and every time the user takes a status-transition action **after** seeing one, we log:

```
audit_logs:
  action      = "RECOMMENDATION_SHOWN" | "RECOMMENDATION_ACTED"
  entityType  = "RABIES_EXPOSURE" (etc.)
  entityId    = row id
  afterJson   = { rule_id, severity, source }
```

This gives you:
- "How often is the system right?" (compare shown vs acted-on rates)
- "Which DOH guidance is being followed?" (rule-id frequency)
- "Are we citing the right manual?" (provincial-level QA)

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| A rule's `applies()` predicate is wrong → false guidance | Predicates are pure functions; reviewable in PR; unit-testable. |
| DOH updates the protocol → stale guidance | Each rule has a `source` citation. Annual review cadence. New rule via PR; old rule retired (not edited) so audit trail stays intact. |
| Operators ignore the disclaimer | Disclaimer is rendered as a visible footer on every card, not a tooltip. |
| LLM hallucinates a recommendation | Phase 1 has no LLM. Phase 2 always renders alongside the rule-based source. LLM never authors a new bullet without the rule-based version present. |
| Showing recommendations to TLs implies "do exactly this" | Severity colors: `info` (gray), `advisory` (amber), `urgent` (red). Buttons map to existing workflow only — no new write endpoints. |

---

## What I need from you

1. **Approve the rule list above** — anything missing? Any wording you'd revise? Any additional disease-program rules you want covered (e.g., GDM-positive maternal cases, SAM-with-complications)?
2. **Approve the disclaimer language** — "DOH guidance — reviewer judgment required" or stronger?
3. **Approve the surface** — recommendation card slotted into the existing action drawer, OR a dedicated `/recommendations` review queue, OR both?
4. **Approve Phase 1 scope** — ship the rule engine + 3 disease modules first (rabies, filariasis, schisto) and add the others later, OR all 5 modules in one go?

Once those four answers are in, I can scope Phase 1 as a single PR or split it across the modules. No code until you sign off.
