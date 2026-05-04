# HealthSync — End-to-end use case

**Setting:** Municipality of San Isidro, Surigao del Norte (Caraga / Region 13).
**Period:** one calendar month (April 2026), the natural M1 reporting cycle.
**Population:** 12 barangays · 1 RHU · ~9,400 residents.

This document walks a realistic month through HealthSync from every operator's
perspective — Team Leader nurses at the BHS, Sanitary Health Aides + the MHO at
the RHU, the Mayor, the Sangguniang Bayan Health Committee, and the System
Admin. It shows how routine encounters become indicators, how indicators become
decisions, and how decisions feed back into the next month's work.

---

## Cast of actors

| Role | Person | Where | What they care about |
|---|---|---|---|
| **TL** (Team Leader nurse) | Nurse Joy | BHS in Brgy. Pacifico | Capturing every mother / child / senior visit accurately and on time. |
| **TL** | Nurse Marvin | BHS in Brgy. Honrado | Same; covers a barangay with a recent rabies cluster. |
| **MHO** (Municipal Health Officer) | Dr. Cuyno | San Isidro RHU | Reviews escalations, signs the M1 report, runs MDR / death reviews. |
| **SHA** (Sanitary Health Aide) | Mr. Lumayno | San Isidro RHU | Surveillance + sanitation + outbreak field response. |
| **MAYOR** | Mayor Ribargoso | Municipal Hall | Quarterly oversight; cares about indicator trends and barangay equity. |
| **HEALTH_COMMITTEE** | Councilor Tan | Sangguniang Bayan | Same view as Mayor; reads M1 + dashboards before Council sessions. |
| **SYSTEM_ADMIN** | IT Officer | RHU back-office | User management, audit, DOH update curation. |

All roles are real RBAC roles defined in `shared/models/auth.ts:UserRole`.

---

## Day 1 — Monday, April 7

### 06:30 · Nurse Joy opens HealthSync at the Brgy. Pacifico BHS

Joy logs in on a hand-me-down Android phone with a flaky 3G connection. Because
HealthSync uses **route-based code-splitting** (PR #177), the initial bundle is
only **143 KB gzipped** — the app is interactive in under a second on her
network, not the previous 5–15 seconds.

The router lands her on `/today`. She sees:

- A one-time onboarding banner: *"Tap any **?** icon to see a plain-language
  definition. Full list at /glossary."* (PR #182). She dismisses it.
- The **DOH Updates** card (PR #181) with three recent significant memos
  pulled from `caraga.doh.gov.ph/issuances` — this morning the top item is
  *"AO 2024-0024: Updated Rabies PEP Schedule"*. She'll need this later.
- The day's worklist priorities: 3 mothers due for **PNC** (PR #164), 2 children
  due for **Penta 3** boosters, 1 senior overdue for HTN meds pickup.

### 07:15 · A new mother walks in

A 19-year-old from Brgy. Pacifico arrives for her first ANC visit. Joy taps
**Patients** → **+ New Mother**, fills the registration: name, age, barangay,
LMP, gravida, contact number. The new mother appears on Joy's
`/prenatal` worklist with status `Upcoming`.

Joy then opens the **Prenatal Screenings** tab (PR #166), clicks **Log
screening** for this mother, and records:
- Hep-B screened ✅ — negative
- Anemia screened ✅ — Hgb 12.4 g/dL
- GDM screened — not yet (deferred to 2nd trimester)
- Iron / folic acid given ✅
- Calcium ✅

The form has fieldset groups so Joy never sees an unnecessary field. Each
screening flag explicitly references the M1 row it feeds (e.g., *"feeds A-08
counts <11"* next to the Hgb input). Save → toast → row updates on the worklist.

Behind the scenes, `computeM1Values` (run every time a report is opened) will
later count this row toward A-05, A-07, A-10, A-12 in this month's M1 form.

### 09:00 · A child needs Penta 3

A 6-month-old boy is booked. Joy opens his profile, navigates to the immunization
tab, ticks off Penta 3 with today's date. He's now done with the primary series
(Penta 1/2/3, OPV 1/2/3, IPV 1, MR 1). The compute pass writes:
- D2-03 (Penta 3) M = +1
- D2-08 (IPV 2 within 1y of birth) M = +1 (PR #172)
- D2-09 (MR 1) M = +1 (PR #170)

Joy doesn't see those rowKeys — she sees a check next to each vaccine.

### 10:30 · A toddler comes in with diarrhea

Across town, Nurse Marvin in Brgy. Honrado has a 14-month-old with acute
diarrhea. He logs the IMCI consult on `/sick-child` (PR #169): visit date,
acute diarrhea ✅, Vit-A given (sick-visit dose) ✅, notes "ORS + zinc per
IMCI." This row will feed **F-02** (Vit-A 12-59mo) and **F-03** (acute diarrhea
0-59mo) on this month's M1.

---

## Day 4 — Thursday · A rabies emergency

Marvin's BHS has a major incident: a 7-year-old boy was bitten by an unvaccinated
dog while playing barefoot in the front yard. Two deep puncture wounds on the
calf, bleeding visibly.

Marvin opens **Disease Surveillance → Rabies** and logs a new exposure:
- Patient: `Boy Cruz, age 7, M`
- Exposure date: today
- **Category: III** (deep wound, broken skin)
- Treatment center: ABTC (district hospital, 18 km away)
- Complete doses: not yet (will track over 28 days)

When the row saves, the **Rabies Category badge** turns red because Cat III is
classified as `destructive` (PR #179). Tapping the badge opens a popup tip:

> **Rabies Category III** — Bites that broke skin, mucosa exposure, bat contact.
> *Source: DOH 2018 Rabies Manual.*

Marvin clicks the row to open the **action drawer** (PR #176):
- Status: **REPORTED → ESCALATED**
- Reviewer notes: *"Pasok sa ABTC referral, di pa makaalis kasi walang sundo.
  May humihiling ng ambulansya."*
- Save.

The MGMT inbox (`/mgmt-inbox`) in San Isidro RHU now shows a new
**Surveillance** item: *"Escalated — Rabies exposure. Boy Cruz · Pasok sa ABTC
referral…"* — the **Surveillance** filter chip count goes from 2 to 3.

### 14:00 · Dr. Cuyno (MHO) acts on the inbox

Dr. Cuyno is on a chassis-rocking jeepney heading back from a barangay outreach.
Her phone pings — she opens HealthSync directly to `/mgmt-inbox`. She sorts by
**Surveillance** → sees Marvin's escalated row at the top.

She clicks through to `/disease-surveillance` (the inbox link does this), opens
the row again, reads Marvin's note. She knows the family. She calls Marvin
directly, arranges the municipal ambulance, and updates the row:
- Status: **ESCALATED → REVIEWED**
- Reviewer notes appended: *"Ambulance dispatched 14:30. RIG + first dose
  expected on arrival. Will follow up Days 3, 7, 14, 28."*

Audit log entries get written for every status transition — Dr. Cuyno's user
ID, role, timestamp, both `before` and `after` JSON of the row.

---

## Day 11 — Thursday · Postpartum visit

Joy's mother from Day 1 isn't due for ANC for another 3 weeks. Instead, today's
PNC worklist (`/pnc`, PR #164) shows another mother — Jane Velasco — at her **24h
postpartum** checkpoint. Jane delivered yesterday at the BHS.

The **PNC card** shows what's due: a "Due 24 hrs" badge on Jane's row. Joy
clicks **Log visit**:
- Checkpoint: 24H
- Visit date: today
- BP: 110/70
- Exclusive breastfeeding ✅
- Iron supplementation given ✅
- FP counseling given ✅

Save. The row's "Due 24 hrs" badge disappears; the next checkpoint (72H) becomes
the new due indicator. **C-01a** rolls forward.

### Births today

Joy also records a delivery. She opens **Birth Attendance** (PR #165) on the
mother who delivered yesterday, picks her from the recently-delivered list, and
fills:
- Delivery date: yesterday (pre-filled from `outcome_date`)
- Delivery type: VAGINAL
- Term: FULL_TERM
- Notes: "Healthy baby. Mother stable, no postpartum hemorrhage."

This single row feeds **B-04** (total deliveries by type), **B-04a**
(vaginal/full-term), and confirms **B-03c** (midwife-attended). The row is
batch-fetched alongside the rest of Joy's visible mothers (PR #168) — one HTTP
round trip per page paint, not 11.

---

## Day 14 — Sunday · A maternal death

Tragedy in Brgy. Honrado: a 27-year-old mother dies at home from postpartum
hemorrhage on Day 6 postpartum. Marvin records the event on `/mortality`:
- Deceased: name, age 27, F, barangay
- Date of death: today
- Cause: postpartum hemorrhage
- **Maternal death cause: DIRECT** (drives **H-03a**)
- Residency: RESIDENT (drives **H-03a-R**)
- Linked person: Mother (linked to her existing mother record)

Saving the row triggers a **Death Review** entry to land in `/mgmt-inbox` for
Dr. Cuyno (existing pre-session feature). The MGMT inbox count goes up.

The Glossary popup beside "DIRECT" shows the plain-language meaning if anyone in
the family or community asks: *"Maternal death from obstetric complications…"*

---

## Day 18 — Monday · MDR review

Per **DOH AO 2008-0029**, every maternal death requires a **Maternal Death
Review (MDR)** within 90 days. The DOH Update card shipped this morning had a
direct reminder: *"AO 2024-0019: Maternal Death Review (MDR) Cadence — reaffirms
MDR within 90 days of every maternal death."*

Dr. Cuyno opens the death-events review queue in `/mgmt-inbox`, marks the
review status PENDING_NOTIFY → NOTIFIED, schedules the case conference for
Thursday. The audit log captures the transition.

When the review concludes, Dr. Cuyno closes it CLOSED with the panel's
recommendations (community-based BEmONC drill, rapid-transport protocol gap
identified). The recommendations don't auto-deploy — they ship as a memo to the
Sangguniang Bayan.

---

## Day 21 — Thursday · Outbreak suspicion

Marvin notices that the Disease Surveillance Filariasis tab in his barangay's
view shows three POSITIVE results in two weeks — unusual. The DOH-cited
*"Filariasis-positive — flag barangay for next MDA"* recommendation will fire
once the AI rule engine ships (still in design — PR #180), but for now Marvin
escalates the cluster manually:

He opens an outbreak record (`/outbreaks`), files a SUSPECTED entry tagged
*"Filariasis cluster — Brgy. Honrado",* note: *"3 POSITIVE in 14 days, no
new mass-drug administration this year."*

The MGMT inbox now shows a SUSPECTED outbreak. SHA Mr. Lumayno is dispatched
that afternoon for the field investigation.

---

## Day 25 — Monday · NCD walk-in clinic

The RHU runs an NCD screening day. Joy and three other TLs help. Throughout the
day they file PhilPEN (PR #175):
- 22 adults assessed
- 11 with smoking history
- 9 binge drinkers
- 14 with insufficient activity
- 18 unhealthy diet
- 4 obese

These rows feed **G1-01..G1-01f** automatically. The MHO can already see the
real-time tally on `/dashboards/maternal` because of the sub-route reusing the
same compute.

A subset of those 22 are flagged hypertensive on **NCD Screenings** (`/ncd-screenings`):
- 6 confirmed HTN
- 5 given antihypertensive meds
- 4 of those got meds from RHU stock; 1 paid out-of-pocket

These map to **G2-01, G2-02, G2-02a (facility), G2-02b (out-of-pocket)**. The
G2-03 / G2-04 senior aggregates use the looser BP-date / meds-date proxy noted
in the M1 audit doc — refinement pending.

---

## Day 28 — Thursday · Mayor's quarterly review

Mayor Ribargoso opens HealthSync from City Hall. She lands on `/dashboards`
(her role-default landing). Three things happen at once:

1. The **DOH Updates card** (PR #182) shows the same morning as everyone else —
   she sees the AO 2024-0019 MDR reaffirmation and *"DC 2024-0210: BHS Facility
   Standards Update"*.
2. The **Municipal Overview** dashboard shows the month's rolling KPIs:
   ANC coverage, immunization completeness, NCD screening volume, mortality
   counts, surveillance escalation rates.
3. Because she has the **MAYOR** role, her **Show definitions inline** toggle
   (PR #178) defaults to **ON**: every M1 indicator label on the dashboard
   reads `MAM (Moderate Acute Malnutrition)` instead of just `MAM`. She can
   read the screen the same way Dr. Cuyno does.

The dashboards show one barangay (Brgy. Honrado) trending red on rabies + the
filariasis cluster. She flags it for the next Sangguniang Bayan session.

Councilor Tan, the Health Committee chair, gets the same view from her phone.
She scans `/glossary` (PR #182) before the session to refresh on what
"DIS-FIL-04" + "MAM" mean before her colleagues ask.

---

## Day 30 — Saturday · M1 cycle

The April reporting period closes today. Joy generates the M1 Report for Brgy.
Pacifico (`/reports/m1`):

- Pages 1–3 of the FHSIS M1 Brgy form auto-fill from `computeM1Values` —
  **192 rowKeys** are pre-populated. Joy doesn't hand-fill any of FP-01..12,
  A-01a..A-13, all of B/C/D/E/F/G/H/I/W. The form opens in **VIEW** mode
  showing today's snapshot.
- Joy switches to **ENCODE** mode for the ~18 remaining gap rows
  (denominators, age-band sub-rows in DIS-SCH/STH/LEP, schema-extension
  indicators). The audit doc enumerates exactly which are gaps.
- She submits to RHU (status `READY_FOR_REVIEW`).

Dr. Cuyno reviews the 12 incoming barangay submissions on her dashboard,
spot-checks numbers against her own notes, signs off. The 12 reports
consolidate into a single **municipal-level M1**.

Audit log: every row's `valueSource` (COMPUTED / ENCODED / CONSOLIDATED) is
preserved so reviewers know which numbers came from automation and which were
hand-typed.

---

## Day 30, evening · System admin housekeeping

The RHU's IT Officer logs in on `/admin`. He:

- Reviews the **audit logs** for any anomalous activity (every status
  transition, every record creation, by user + role + IP + timestamp).
- Adds a new TL account for an incoming nurse at Brgy. Sapao; assigns barangays.
- Curates **DOH Updates** — the doh_updates table is seeded by code today, but
  he's preparing to be the human-in-the-loop for the future Caraga scraper
  (per `docs/ai-recommendations-design.md` Phase 1).
- Approves a pending KYC request from the new nurse.

---

## What happens next month

The April M1 report shows Brgy. Honrado is below target on three indicators:
PNC completion (C-01b), filariasis follow-up (DIS-FIL-04), and rabies dose
completion (DIS-RAB-05).

Mayor Ribargoso allocates additional outreach budget to Honrado at the May
Sangguniang Bayan session. Marvin gets two extra outreach days. The September
M1 cycle will tell whether the intervention worked — and the audit trail
preserved by HealthSync will show exactly which actions led to which outcome.

---

## Modules touched in this single-month walkthrough

- **Mothers**: registration → ANC → prenatal screenings → delivery → PNC →
  birth attendance → mortality.
- **Children**: vaccinations → sick-child IMCI → nutrition card.
- **Seniors**: HTN screening → NCD meds source.
- **NCD**: PhilPEN risk assessment → cervical cancer (not exercised here but
  available) → mental health (not exercised) → vision screening (not exercised).
- **Disease Surveillance**: rabies → filariasis → schistosomiasis (covered) →
  STH (covered) → leprosy (covered).
- **Outbreaks**: cluster detection → SUSPECTED status → field response.
- **Mortality**: maternal death → MDR review → CDR / PDR (covered).
- **Reports**: M1 (cycle-ending), real-time dashboards (every day).
- **MGMT Inbox**: pending referrals + escalated surveillance + AEFI + MD review +
  death review queues — one stop for everything that needs MHO attention.
- **DOH Updates**: morning brief on every login.
- **Glossary**: any jargon, anywhere, one click away.
- **Audit log**: every state transition + every record write, by user + role +
  timestamp.

That's the system, end to end, in one month of San Isidro routine.
