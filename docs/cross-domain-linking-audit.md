# Cross-domain patient linking — audit + plan

Tracks how well the codebase honors **"capture once → shows up everywhere":**
when the same person appears across two domains (e.g., a mother who later
has a rabies exposure), is the second record linked to the first, or is
it a free-text duplicate?

Last updated: this PR landed the foundation (`/api/patients/search` + the
`<PatientSearchCombobox>` component). Per-table wiring continues in
follow-up PRs.

---

## Current state — three linking modes

### Mode 1 — Hard FK (cleanest, 10 tables)

| Domain | Links to | Status |
|---|---|---|
| Prenatal visits | mothers | ✅ FK |
| Postpartum visits | mothers | ✅ FK |
| Birth attendance records | mothers | ✅ FK |
| Prenatal screenings | mothers | ✅ FK |
| Child visits | children | ✅ FK |
| Sick child visits | children | ✅ FK |
| Vaccinations | children | ✅ FK |
| Nutrition follow-ups | children | ✅ FK |
| Senior visits | seniors | ✅ FK |
| TB dose logs | tb_patients | ✅ FK |

### Mode 2 — Optional discriminator (2 tables)

Schema already carries `linked_person_type` + `linked_person_id`. When the
operator chooses an existing patient at capture time, the FK is populated;
otherwise the name is stored as free text:

- `disease_cases` — discriminator: `MOTHER | CHILD | SENIOR`
- `fp_service_records` — discriminator: `MOTHER | GENERAL`

### Mode 3 — Free text only (15 tables — the gap this audit closes)

These domains record the patient by typed name. **Two records for the
same person across two of these tables = two unlinked strings.**

| Domain | Should link to |
|---|---|
| Oral health visits | mothers / children / seniors |
| PhilPEN assessments | mothers / seniors |
| NCD screenings | mothers / seniors |
| Vision screenings | seniors |
| Cervical cancer screenings | mothers (women 30-65) |
| Mental health screenings | mothers / seniors |
| Filariasis records | any |
| Rabies exposures | any |
| Schistosomiasis records | any |
| STH records | any |
| Leprosy records | any |
| AEFI events | children (via `vaccinationId` only — patient FK absent) |
| Referral records | any |
| Medical certificates | any |
| Consults | any |

---

## Decision — Option A (extend Mode 2 uniformly)

Two architectural paths were weighed in conversation:

- **Option A — Extend the optional-discriminator pattern.** Each free-text
  table gains nullable `linked_person_type` + `linked_person_id` columns.
  A reusable patient-search combobox suggests existing records at capture
  time; if matched, the FK is stored; if not (e.g. walk-in not yet
  registered), the name is preserved as text. Backward compatible. 2-3
  weeks solo dev across ~5 PRs.
- **Option B — Universal `patients` table.** All four core registries
  (mothers / children / seniors / tb_patients) become role-attachment
  tables pointing at a canonical patient row. Cleaner architecturally;
  6-10 weeks of work with a real de-duplication backfill.

**A was chosen** because:

- The first step of A (search endpoint + combobox component) is **also
  on B's critical path** — neither architecture's form UX works without
  it. Shipping A.1 first commits us to nothing.
- Each subsequent A PR is independently shippable and reversible.
- The capstone timeline allows incremental defensibility — every PR
  closes a measurable gap.
- If we later decide B is worth the rewrite, the combobox + the
  discriminator data are both consumable by it.

---

## Foundation shipped (this PR's deliverable)

### `GET /api/patients/search?q=<name>&limit=10`

- Server-side cross-registry search across mothers + children + seniors
  + tb_patients.
- TL role: results filtered to the user's assigned barangays (the same
  RBAC scope every other endpoint uses).
- Result shape:

  ```jsonc
  {
    "kind": "MOTHER" | "CHILD" | "SENIOR" | "TB_PATIENT",
    "id": 42,
    "displayName": "Maria Santos",
    "dob": "1990-04-15" | null,
    "sex": "F" | "M" | null,
    "barangay": "Brgy 1",
    "hint": "Age 28"          // subtitle for the UI
  }
  ```

- Ranking: exact full-name match > prefix > substring; tiebreak by kind
  order (mother → child → senior → tb_patient) then alphabetical.

### `<PatientSearchCombobox>` component

- 300 ms debounced input
- Result rows show: name + role chip (color-coded) + hint + barangay
- "Use as new patient: 'typed name'" fallback affordance at the bottom
  preserves free-text behavior for walk-ins not yet registered
- Returns a discriminated union to the parent form:

  ```ts
  type PatientLink =
    | { kind: PatientKind; id: number; displayName: string; barangay: string }
    | { kind: "FREE_TEXT"; displayName: string; barangay?: string };
  ```

- Forms map this to persisted shape:
  - `linked_person_type = kind === "FREE_TEXT" ? null : kind`
  - `linked_person_id   = kind === "FREE_TEXT" ? null : id`
  - `patient_name       = displayName` (always preserved for display)

---

## Phased rollout (subsequent PRs)

| Phase | Tables | Effort | Notes |
|---|---|---|---|
| A.2 schema | All 15 — add nullable `linked_person_type` + `linked_person_id`. Idempotent migration. | 1 day | One PR. |
| A.3 surveillance | rabies / filariasis / schisto / sth / leprosy | 3-4 days | Highest clinical value — cross-referencing surveillance with existing registries enables outbreak narratives like "Cat III rabies cluster concentrated in pregnant women in Brgy X". |
| A.4 screenings | NCD / PhilPEN / Vision / Cervical / Mental / Oral | 3-4 days | Each form swaps its name input for `<PatientSearchCombobox>`. |
| A.5 misc | AEFI / referrals / medical certs / consults | 2-3 days | Lower volume, similar pattern. |
| A.6 profile cross-linking | Mother / Child / Senior / TB profiles surface "this person also has: 2 rabies exposures, 1 PhilPEN, 0 cervical screenings, …" | 3-4 days | Read-only "linked encounters" card per profile, queries each free-text table for `linked_person_type = <profile kind>` AND `linked_person_id = <id>`. |

Total: 2-3 weeks solo, shippable per phase.

---

## What this audit does NOT do

- Doesn't merge accidentally-created duplicate patients across registries
  (e.g., the same woman registered as a mother AND a senior with slightly
  different name spellings). That's an admin-merge-tool job, not solved
  by linking at capture time.
- Doesn't enforce that a person can only exist once across all
  registries. A 32-year-old "Maria Santos" can still exist as both
  a mother (active pregnancy) and a senior (incorrectly registered) —
  the merge tool handles that.
- Doesn't backfill the existing free-text rows. Old rows stay as text
  forever; only newly captured rows can be linked. Backfilling the
  historical data would be a separate, audit-heavy PR per table.

---

## Verification (post-redeploy)

1. Existing forms continue to work (the combobox isn't slotted into any
   form by this PR — purely foundation).
2. Hit `GET /api/patients/search?q=ma` with TL credentials → returns up
   to 10 patients across registries, all from the TL's barangays only.
3. Hit the same endpoint with MHO credentials → returns matching
   patients across all barangays.
4. With a query like "Maria Santos" where one exists as a mother:
   exact match ranks first; partial matches follow.
5. Component-level smoke test (run after slotting into the first form
   in A.3): type 2 characters → debounced query fires; type 5 characters
   quickly → only one query lands per 300 ms window.

---

## Tracking

- Foundation PR: shipped (this PR).
- Next PR: A.2 schema migration on the 15 free-text tables.
- Each subsequent PR titled `feat(linking): <phase>` for easy filtering
  in the PR list.
