# HealthSync — User Manual

A path-based reference for every operational module. No screenshots; routes
and step-by-step actions only. Open this file alongside the running app and
it should answer "where do I go and what do I click?" for any task.

Last verified against `main` HEAD (this session).

---

## Getting started

### Logging in

1. Open the app's URL.
2. Enter your username + password (or use the Replit Auth flow on Replit deploys).
3. After login, the home page auto-routes by role:
   - **TL** (Team Leader / Barangay Nurse) → `/today` (the personal worklist)
   - **MHO / SHA / SYSTEM_ADMIN** → `/dashboard` (municipal overview)
   - **MAYOR / HEALTH_COMMITTEE** → `/dashboard` (read-only)

### Role primer

Every module page enforces these roles. If you can't see a tab in the sidebar
or get "Access denied" on a route, your role doesn't have it.

| Role | Tier | Common access |
|---|---|---|
| `TL` | Operator | All clinical worklists for their assigned barangay; can record encounters; cannot see other barangays |
| `MHO` | Management | All barangays; review queue; report sign-off |
| `SHA` | Management | All barangays; same surface as MHO |
| `SYSTEM_ADMIN` | Admin | Everything plus User Management, Audit Logs, Settings |
| `MAYOR` | View-only | Dashboards, MGMT inbox, reports — read-only |
| `HEALTH_COMMITTEE` | View-only | Same as MAYOR |

Throughout this manual, "MGMT" means MHO + SHA + SYSTEM_ADMIN. Anything that
says "TL only" means a TL captures it; "MGMT only" means TL cannot.

### Switching barangay context (TL with multiple barangays)

1. Top of any page, click the barangay selector.
2. Pick a barangay; every list re-scopes.

---

## 1 · Daily operations

### Today (`/today`) — TL home

1. Land here automatically after login (TL).
2. Top section shows recent DOH updates (memos, advisories from `caraga.doh.gov.ph`).
3. Below: "Action queue" — the count of overdue / due-today items across all your modules (PNC visits, TB DOTS, immunization, etc).
4. Click any badge to jump straight to the worklist.

### Calendar (`/calendar`)

1. Sidebar → Calendar.
2. Top KPIs: Overdue / Due Soon / Upcoming events (vaccinations, ANC visits, TB doses).
3. Click any KPI tile to filter the list.
4. Click an event row to open the linked patient profile.

### Messages (`/messages`)

1. Sidebar → Messages.
2. SMS outbox + threads with patients (clinic reminders, PNC nudges).
3. New message: select recipient, compose, send.

---

## 2 · Maternal care (Mothers Hub)

The Mothers Hub at `/prenatal` has tabs: Prenatal · Prenatal Screenings · PNC · Birth Attendance · FP.

### Prenatal worklist (`/prenatal`)

1. Sidebar → Prenatal.
2. Default view = active mothers in your barangay.
3. Filter by status: All / Active / Delivered / Lost.
4. Click a row to open the mother profile.

### Add a new mother

1. From the worklist click **+ Add Mother** (top-right) **or** go to `/mother/new`.
2. Fill First Name / Last Name / Age / Barangay / LMP date / EDC date.
3. Optional: ANC visit count, TT doses, household phone.
4. Click **Save**.

### Mother profile (`/mother/:id`)

Shows demographics, ANC visits, TT doses, deliveries, and PNC card. Tabs along
the top jump to history, growth log (children), or notes.

- Edit demographics: top-right pencil icon → `/mother/:id/edit`.
- Log new ANC visit: "Visit history" card → **+ New Visit**.
- Schedule SMS reminder: tools menu → SMS reminder.

### Prenatal screenings worklist (`/prenatal-screenings`)

1. Sidebar → Prenatal Screenings.
2. Tracks Hep-B, Anemia, GDM, Iron/Folic, MMS, Calcium, Deworming per mother.
3. Click a row → drawer opens.
4. Tick boxes for completed screenings → Save.

### PNC worklist (`/pnc`)

1. Sidebar → PNC.
2. Lists postpartum mothers with PNC visit status (1st 24 h, 72 h, 7-day, 6-week).
3. Click a row → log new PNC visit, mark TRANS-IN / TRANS-OUT, complete 2/4 PNC schedule.

### Birth attendance worklist (`/birth-attendance`)

1. Sidebar → Birth Attendance.
2. Records who attended each delivery (physician/nurse/midwife) and delivery type (vaginal/cesarean/full-term/pre-term/fetal death).
3. Click row → fill attendant, delivery type, notes → Save.

### Family Planning registry (`/fp`)

1. Mothers Hub → FP tab.
2. Lists women of reproductive age (WRA) on a method.
3. Add new method record: **+ Add FP Record** → patient, method, start date, side-effects → Save.
4. Modern methods (pills/IUD/implants/condoms/sterilization) feed the M1 FP-00 indicator.

---

## 3 · Child health (Children Hub)

### Child worklist (`/child`)

1. Sidebar → Children.
2. Default view = children 0-59 mo in your barangay.
3. Filter by age band, immunization status, nutrition status.
4. Click row → child profile.

### Add a new child

1. Worklist → **+ Add Child** **or** `/child/new`.
2. Fill name, DOB, sex, mother (optional link), barangay, birth weight.
3. Save.

### Child profile (`/child/:id`)

- Vaccination card (BCG, Penta 1/2/3, OPV, IPV, MR, etc.).
- Growth log (weight-for-height, MUAC).
- Sick-child encounters.
- Vitamin A doses.

Add a vaccine: Vaccination card → click empty slot → date + lot → Save.

### Sick child worklist (`/sick-child`)

1. Sidebar → Sick Child.
2. IMCI-based; lists active sick-child cases under 5.
3. Click row → log danger signs, classification (pneumonia/diarrhea/fever), management plan.

### Nutrition Hub (`/nutrition`)

1. Sidebar → Nutrition.
2. Tabs: Worklist (active MAM/SAM cases) · Growth Monitoring (z-scores).
3. Click a child to record SFP enrollment, OTC intake, follow-up outcomes (cured / non-cured / defaulted).

---

## 4 · Senior care (Seniors Hub)

### Senior worklist (`/senior`)

1. Sidebar → Seniors.
2. Filters: blood-pressure status, medication-due, vision-screening status.
3. Click a row → senior profile.

### Senior profile (`/senior/:id`)

- BP log, medications, comorbidities.
- Vision screening status (links to `/vision-screenings`).
- PhilPEN assessment summary (links to `/philpen-assessments`).

### Add a new senior

1. Worklist → **+ Add Senior** or `/senior/new`.
2. Demographics + initial BP + medications → Save.

---

## 5 · TB DOTS Hub

### TB worklist (`/tb`)

1. Sidebar → TB DOTS.
2. Lists TB patients with status (Urgent / Overdue / Due today / Active / Completed).
3. Filter by phase (Intensive / Continuation), outcome (Ongoing / Completed / Transferred / LTFU).
4. Click row → TB profile.

### Register a new TB patient

1. Worklist → **+ New TB Patient** or `/tb/new`.
2. Demographics + barangay + treatment phase + start date + medication regimen.
3. Save → patient appears in worklist with status REPORTED.

### TB profile (`/tb/:id`)

- DOTS Schedule card: Next DOTS visit + treatment progress + days remaining.
- Dose log: each daily/weekly dose check-in.
- Status pills: visit overdue, missed doses, sputum check due.
- SMS reminder: tools → "Send DOTS reminder".

---

## 6 · Disease surveillance

### Disease cases worklist (`/disease`)

Generic disease-case tracker for any communicable case (fever/diarrhea/etc.).

1. Sidebar → Disease (under Disease Hub).
2. **+ New case** → patient + condition + date reported + notes → Save.
3. Click row → opens disease profile with status spine.

### Disease map (`/disease/map`) — MGMT only

1. Disease Hub → Map tab.
2. Heatmap of cases by barangay.
3. Filter by disease + window.

### Vertical disease programs (`/disease-surveillance`)

5 specialized registers in tabs at the top: Filariasis · Rabies · Schistosomiasis · STH · Leprosy.

Each works the same way:
1. Pick the tab.
2. Fill patient + program-specific fields (e.g. Rabies Category I/II/III + ABTC center; STH confirmed yes/no + residency; Leprosy new-case + confirmed).
3. Save.
4. Click any row → **Action drawer** opens (status: REPORTED → REVIEWED → ESCALATED → CLOSED, plus reviewer notes).

#### Recommendation cards (Phase 1 + 2)

When the action drawer opens for a row that matches a DOH rule, a card appears
above the Status form with:

- Title + DOH-cited bullets (e.g. "Category III — wash 15 min, vaccine D0/3/7/14/28, RIG, ABTC referral")
- Severity colour: **red urgent** / **amber advisory** / slate info
- DOH source citation
- "Show plain language" button → LLM-rewritten 2-4 sentence summary
- Cluster banner: red AlertOctagon if 3+ Cat III rabies in same barangay within 7 days
- Disclaimer footer: "DOH guidance — not a clinical order. Reviewer judgment required."

### PIDSR weekly submissions (`/pidsr`)

1. Sidebar → PIDSR (under Disease Hub).
2. Friday cutoff (4 PM Manila) — TL submits a weekly attestation per barangay.
3. **+ Submit this week** → tick zero-report diseases + add notes → Submit.
4. Missed weeks surface in MGMT Inbox.

### Outbreaks (`/outbreaks`)

Auto-created when cluster detection fires (3+ cases of a single disease in
one barangay within a window).

1. Sidebar → Outbreaks.
2. Filter by status: Suspected / Declared / Contained / Closed.
3. **MGMT only:** advance status → enter findings or containment actions or closure summary → Save.

---

## 7 · Immunization Hub (`/immunization`)

Tabs at the top: Cold Chain · School Immunization · AEFI.

### Cold Chain (`/immunization?tab=cold-chain`)

1. Hub → Cold Chain.
2. Daily fridge-temperature log per BHS / RHU.
3. **+ Log reading** → device + temp + time → Save.
4. Out-of-range readings auto-create alerts.

### School Immunizations (`/immunization?tab=school`)

1. Hub → School.
2. HPV doses (9-yo girls, 2 doses) + Grade-1 Td.
3. **+ Add encounter** → school + grade + vaccine + dose # → Save.

### AEFI (`/immunization?tab=aefi`)

1. Hub → AEFI.
2. Lists adverse events following immunization with severity tier (SERIOUS / NON_SERIOUS).
3. **+ Report AEFI** → patient + vaccine lot + symptom + onset → Save.
4. SERIOUS events have a 24-h CHD reporting SLA; NON_SERIOUS = 7 days.

---

## 8 · NCD & Lifestyle Screenings

### NCD screenings (`/ncd-screenings`)

Adult HTN + DM screening. Tabs: PhilPEN summary · HTN encounters.

1. Sidebar → NCD Screenings.
2. **+ Record encounter** → patient + BP + glucose + medication source (facility / out-of-pocket) → Save.

### PhilPEN risk assessment (`/philpen-assessments`)

1. Sidebar → PhilPEN.
2. Adult risk-factor capture: smoking, binge drinking, insufficient activity, unhealthy diet, BMI category.
3. **+ Record assessment** → tick risks + select BMI → Save.

### Vision screenings (`/vision-screenings`)

For seniors (60+).

1. Sidebar → Vision Screenings.
2. **+ Record screening** → patient + screening date + eye disease found ✓ + referred to eye care ✓ → Save.

### Cervical cancer screenings (`/cervical-cancer-screenings`)

1. Sidebar → Cervical Cancer.
2. Women 30-65: Pap / VIA result, suspicious flag, precancerous flag, treated, referred.

### Mental health screenings (`/mental-health-screenings`)

1. Sidebar → Mental Health.
2. mhGAP-based screening: tool + positive screen ✓.

### Oral health (`/oral-health`)

1. Sidebar → Oral Health.
2. First dental visit by age band + facility-based (yes/no) → feeds M1 ORAL section.

---

## 9 · Mortality Hub (`/mortality-hub`)

Tabs: Registry (TL captures) · Reviews (MGMT manages).

### Registry tab

1. Hub → Registry.
2. **+ Record death** → deceased name + DOD + age + sex + cause + maternal-cause (if applicable) + Fetal death ✓ + Live-born early neonatal ✓ → Save.
3. Maternal deaths auto-create an MDR review; perinatal/neonatal auto-create a PDR review.

### Reviews tab — MGMT only

1. Hub → Reviews.
2. Lists MDR / PDR reviews with status (Pending Notify → Notified → Review Scheduled → Reviewed → Closed) and a 30-day deadline counter.
3. Click a row → advance status, add committee findings + recommendations.

---

## 10 · Walk-in / Triage (`/walk-in`)

BHS triage queue.

1. Sidebar → Triage / Walk-in.
2. Tabs: All encounters · Awaiting MD review.
3. **+ New Triage** → patient name + vitals (BP, HR, RR, temp, SpO₂) + IMCI danger signs (children) or adult danger signs.
4. App auto-suggests acuity (EMERGENT / URGENT / NON_URGENT). Override if needed.
5. Set disposition: dispense from stock / refer to RHU / admit. Save.
6. EMERGENT or escalated rows auto-route to MGMT inbox.

---

## 11 · Referrals (`/referrals`)

1. Sidebar → Referrals.
2. **TL view:** "My referrals OUT" — patients you sent to RHU/hospital.
3. **MGMT view:** "Referrals IN" — incoming from BHS-level TLs.
4. MGMT acknowledges → records outcome (RECEIVED → COMPLETED).

---

## 12 · Konsulta (PhilHealth) (`/konsulta`)

1. Sidebar → Konsulta.
2. Status banner shows whether `PHILHEALTH_KONSULTA_API_KEY` is configured.
3. **+ Enroll member** → PhilHealth PIN (12 digits) + contributor category (Direct Formal / Direct Informal / Indirect Indigent / Sponsored / Lifetime) → Save.
4. Once API keys arrive, queued enrollments drain to PhilHealth.

---

## 13 · Inventory & Pharmacy

The **Inventory Hub** has tabs: Inventory · Stockouts · Dispensings · Restock Requests.

### Inventory dashboard (`/inventory`)

1. Sidebar → Inventory.
2. KPIs: Stockout Barangays · Low Stock Barangays · Expiring soon.
3. Filter rows by stock status: stockout / critical / low / adequate.
4. **+ Add Inventory** → item + lot + expiry + quantity → Save.

### Stockouts (`/inventory/stockouts`) — MGMT only

1. Inventory Hub → Stockouts.
2. Two columns: vaccines below threshold · medicines below threshold.
3. Filter by barangay; search by item name.

### Dispensings (`/inventory/dispensings`)

1. Inventory Hub → Dispensings.
2. Log a dispense: select item + patient + qty → Save (decrements stock).
3. TL sees only their barangay; MGMT sees all.

### Restock requests (`/restock-requests`)

1. Inventory Hub → Restock Requests.
2. **TL:** **+ New Request** → item + qty + reason → Save (status PENDING).
3. **MGMT:** click row → mark FULFILLED / REJECTED with notes.

---

## 14 · Reports (`/reports`)

Lists all DOH-mandated reports grouped by category (FHSIS Family / Program-Specific / Surveillance / LGU Performance / Administration).

1. Sidebar → Reports.
2. Click any tile to open the report detail.

### M1 Brgy Report (`/reports/m1`)

Monthly FHSIS summary.

1. Sidebar → Reports → M1 Brgy.
2. Pick barangay + month + year (TL is locked to their barangay).
3. If no report exists for the period, click **Create Report**.
4. Sections (FP, A, B, C, D1-D4, E, F, G1, G2, G4, H, I) auto-populate from operational data via `computeM1Values`.
5. **MGMT** can edit any cell as a manual override; TL cannot.
6. **Submit** (TL) → locks the report; **Approve** (MHO) → finalizes for the period.
7. **Download PDF** → exports formatted FHSIS PDF.
8. **Import M1 Data** (MGMT) → bulk paste from Excel.

### AI Reporting (`/reports/ai`) — MGMT only

1. Reports Hub → AI.
2. Stats grid: high-risk mothers, high-risk children, critical-BP seniors, new disease cases, TB missed-dose patients, at-risk barangays.
3. Generate narrative summary on demand.

---

## 15 · Dashboards (`/dashboards`)

Sub-tabs: Maternal · Child · Senior · Nutrition · Disease Map · Hotspots.

1. Sidebar → Dashboards.
2. Top filter bar: data-as-of date.
3. Each tab shows KPIs + trend charts + barangay risk summary panel.
4. **Hotspots** + **Disease Map** are MGMT-only.

---

## 16 · DOH Updates (`/updates`) and Glossary (`/glossary`)

### DOH Updates

1. Sidebar → DOH Updates (or the card on `/today` for TLs).
2. Updates are mixed: manually curated + auto-scraped from `caraga.doh.gov.ph` daily at 6 AM Manila.
3. Filter by bureau (HFDB / DPCB / CHD / HHRDB / OTHER).
4. Click an update → opens source URL in new tab.

### Glossary

1. Sidebar → Glossary (or click any underlined acronym anywhere in the app).
2. Alphabetized list of every DOH acronym used in the app (FHSIS, M1, MDR, PDR, IMCI, PhilPEN, mhGAP, ABTC, RIG, SAM, MAM, etc.) with one-line definitions and DOH source citations.

**Important:** Glossary popups across the app open on **click**, not hover. Click the underlined term to see the definition.

---

## 17 · MGMT Inbox (`/mgmt-inbox`) — MGMT only

Single queue for everything that needs MGMT attention.

1. Sidebar → MGMT Inbox.
2. Filter by source: AEFI · Outbreaks · Death Reviews · PIDSR Friday cutoff · TB defaulters · Stockouts · Cluster alerts.
3. Search box for patient/barangay.
4. Click a row → opens the originating module's drawer or profile.
5. Pagination for >10 items.

---

## 18 · Workforce (`/workforce`) — MGMT only

1. Sidebar → Workforce.
2. List of registered health workers (BHWs, midwives, nurses) with license expiry status.
3. Click a row → Workforce Detail (`/workforce/:id`) — license, deployment history, training records.

---

## 19 · Certificates (`/certificates`) and Campaigns (`/campaigns`)

### Certificates

1. Sidebar → Certificates.
2. Issue certificates: medical certificate, immunization card, sanitary inspection.
3. **+ New Certificate** → template + recipient + details → Save → print/PDF.

### Campaigns

1. Sidebar → Campaigns.
2. Schedule outreach campaigns (deworming, vaccination drives, MDA).
3. **+ New Campaign** → barangay(s) + date + target population + materials → Save.

---

## 20 · Household water records (`/household-water`)

1. Sidebar → Household Water.
2. Records household water-supply level (Level I / II / III) + safely-managed flag.
3. Feeds M1 WATER section.

---

## 21 · Account (`/account`)

1. Top-right user menu → Account.
2. Update display name, email, password.
3. View your assigned barangay(s) and role.

---

## 22 · Admin Hub

### User Management (`/admin/users`) — SYSTEM_ADMIN only

1. Sidebar → Admin → Users.
2. List of all users with role + assigned barangays + active/disabled.
3. **+ Create User** → username + password + role + barangay assignments → Save.
4. Click row to edit / disable / reset password.

### Audit Logs (`/admin/audit`) — SYSTEM_ADMIN only

1. Sidebar → Admin → Audit Logs.
2. Filters: action (CREATE / UPDATE / DELETE / LOGIN / VIEW / GENERATE_REPORT / IMPORT / RECOMMENDATION_SHOWN / RECOMMENDATION_ACTED) · entity type · barangay.
3. Hard cap of 500 newest rows.
4. Click any row → expand to see beforeJson + afterJson + IP + user agent.

### Recommendation Calibration (`/admin/recommendations`) — SYSTEM_ADMIN + MHO

1. Sidebar → Admin → Rec. Calibration.
2. Window selector (30 / 90 / 180 / 365 days).
3. Table grouped by ruleId showing: human title · severity badge · shown count · acted count · conversion % · DOH source.
4. Use to spot never-actioned rules (need rewriting) and high-conversion rules (cite confidently).

### Settings (`/settings`) — MGMT

1. Sidebar → Admin → Settings.
2. Municipality settings (name, code, RHU contact).
3. Per-barangay settings (BHS name, midwife assignments).
4. Schedule rules (alert thresholds, scheduler manual trigger).

---

## Quick task index

| Task | Where to go |
|---|---|
| Register a new mother | `/mother/new` or `/prenatal` → + Add Mother |
| Log a PNC visit | `/pnc` → click row |
| Add a vaccine to a child | `/child/:id` → vaccination card → click empty slot |
| Record a Cat III rabies exposure | `/disease-surveillance` → Rabies tab → fill + Save |
| Submit weekly PIDSR | `/pidsr` → + Submit this week |
| Create a TB patient | `/tb/new` |
| Log daily DOTS dose | `/tb/:id` → dose log → tick today |
| Record a death | `/mortality-hub` → Registry → + Record death |
| Capture a walk-in triage | `/walk-in` → + New Triage |
| Record a referral OUT | `/referrals` (TL) → + New Referral on a patient profile |
| Generate this month's M1 | `/reports/m1` → pick period → Submit (TL) → Approve (MHO) |
| Check MGMT inbox | `/mgmt-inbox` |
| See which rules fire most | `/admin/recommendations` |
| View raw audit trail | `/admin/audit` |
| Find a DOH acronym definition | Click the underlined term, OR `/glossary` |
| Trigger DOH scraper now | `POST /api/admin/scrape-doh-updates` (SYSTEM_ADMIN) |
| Manually run scheduler | `POST /api/admin/run-scheduler-now` (SYSTEM_ADMIN) |

---

## Common workflows end-to-end

### A · Capture a maternal record from booking → delivery → PNC

1. New mother walks in. Open `/mother/new` → fill demographics + LMP + EDC + initial ANC visit count.
2. Each ANC visit: `/mother/:id` → Visit history → + New Visit (records ANC date + BP + weight + fetal heart tone).
3. Optional screenings: `/prenatal-screenings` → click mother → tick Hep-B / Anemia / GDM / etc.
4. Delivery happens: `/birth-attendance` → + new birth → attendant + delivery type → Save.
5. Mother now appears in `/pnc` with PNC visit schedule. Tick visits as completed.

### B · Triage a sick patient

1. `/walk-in` → + New Triage → vitals + danger signs.
2. Acuity auto-suggested. Save.
3. If EMERGENT: encounter automatically appears in MGMT Inbox; print/show the recommendation card if TB or rabies indicators present.
4. If dispensing meds from stock: Disposition = "Dispensed from stock" → opens dispense form.
5. If referring: Disposition = "Referred to RHU" → creates a referral row in `/referrals`.

### C · Manage a Cat III rabies exposure (with recommendation engine)

1. `/disease-surveillance` → Rabies tab → + new exposure → patient + Cat III + treatment center + complete-doses ✓.
2. Save → row appears with status REPORTED.
3. Click row → action drawer opens.
4. **Red urgent recommendation card** appears at top with the DOH 2018 Manual checklist.
5. If 3+ Cat III in same barangay within 7 days, a **red cluster banner** appears above the bullets.
6. Optional: click "Show plain language" → 5th-grade Filipino-English rewrite for a mayor / family member.
7. Set Status → REVIEWED (you took action) → Save. Audit log records `RECOMMENDATION_ACTED` for the rule id.

### D · Monthly M1 cycle

1. End of month, TL opens `/reports/m1` → barangay auto-locks to theirs → pick the just-finished month.
2. If no report exists for the period, click Create.
3. Review the auto-computed values; edit cells flagged "needs review".
4. Click **Submit** → locks the TL's view.
5. MHO opens `/reports/m1` → picks the same period → reviews each barangay → clicks **Approve** per barangay.
6. **Download PDF** for archive.

---

## Background jobs (no manual action needed; here for reference)

- **Daily 6 AM Manila** — alerts: license expiry, stockouts, TB defaulters, M1 deadlines, outbreak detection, AEFI SLAs, FP missed visits, immunization missed doses, NCD missed follow-ups, cervical follow-ups, mhGAP follow-ups. Plus the DOH-updates scraper.
- **Friday 4 PM Manila** — PIDSR Friday cutoff check (any barangay with no submission for the week appears in MGMT Inbox).
- **Manual trigger** — `POST /api/admin/run-scheduler-now` runs the daily + weekly suite immediately (SYSTEM_ADMIN only).

---

## Troubleshooting quick-hits

| Symptom | Likely cause | Where to check |
|---|---|---|
| "Access denied" on a route | Role doesn't include this path | Account page → confirm your role |
| Glossary popup doesn't appear on hover | It's click-triggered, not hover | Click the underlined term |
| Recommendation cards aren't showing on Cat III rabies | Built bundle is stale (PR not deployed yet) | Check `/admin/audit` filter dropdown for `RECOMMENDATION_SHOWN` option; absent = stale build |
| DOH Updates card empty | Scraper hasn't run yet, or all entries filtered out | `POST /api/admin/scrape-doh-updates` to trigger manually |
| M1 cells all blank | No operational data captured for the period | Capture at least one mother / child / senior / disease case in the period and re-open the report |
| TB row shows "DOTS visit overdue" | Patient missed scheduled DOTS visit | Open the profile → Send DOTS reminder via SMS, then update next visit date |
| Outbreak appeared spontaneously | Cluster detection auto-creates outbreaks when 3+ cases in window | `/outbreaks` → Suspected → MGMT advances status as response progresses |
