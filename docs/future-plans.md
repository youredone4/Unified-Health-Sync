# Future plans

Capabilities we discussed but deliberately deferred. Each entry records:
- **What** — short description
- **Why deferred** — the decision rationale
- **When to revisit** — the trigger that justifies coming back
- **Where to start** — the first step when revisited

Order is rough priority, not strict.

---

## Offline capability

**What.** The system today requires a live internet connection for every
interaction. A barangay nurse loses connection → save fails, app may go
blank. Real BHS deployments in rural Caraga see intermittent connectivity.
The goal: capture encounters offline, sync when the connection returns.

**Levels of offline (pick a target when revisited):**

| Level | Capability | Engineering cost |
|---|---|---|
| 0 | Current state — needs internet for every interaction | — |
| 1 | App shell + recent reads cached. Browse offline; writes still need internet. | ~2 weeks |
| 2 | Queued writes synced when connection returns. Last-write-wins for conflicts. | ~6-8 weeks |
| 3 | Local-first multi-device sync with CRDT merge | 3-6+ months |

**Why deferred.** Adds significant complexity (~30% more code surface),
introduces schema changes (`clientId`, `updatedAt`, `syncStatus` on every
operational table), doubles the testing matrix (online + offline path),
and requires conflict-resolution policy decisions before any code lands.
Not justifiable at the current single-deployment scale, where the
operator can usually find some WiFi within a day.

**When to revisit.**
- A clinic reports actual data loss from connection drops, OR
- The deployment expands to more than one barangay where intermittent
  signal is the norm, OR
- The capstone defense pivots to require it (panel feedback)

**Where to start.** Ship Level 1 first — Service Worker + Workbox + persisted
React Query cache + offline detection banner. That alone makes the app
*feel* reliable even when WiFi flickers, and is achievable in ~2 weeks.

For Level 2 (the real destination), the architecture decisions to make
*before* writing sync code:

1. **One device per TL, or many?** Conflict rarity hinges on this.
2. **Append-only or last-write-wins for clinical data?** Vaccine doses
   and dose logs probably want append-only; demographics can be
   last-write-wins.
3. **JWT or session cookie?** True offline auth needs JWT with a long TTL.
4. **Maximum offline duration before forced re-login?** Sets the JWT TTL.
5. **Sync engine: Dexie + custom sync, RxDB, PowerSync, or ElectricSQL?**
   Recommendation: Dexie + custom sync for full control and capstone
   defensibility; the others trade engineering effort for vendor
   dependency.

**What will never work fully offline (be honest in the manuscript):**
- LLM plain-language summaries (needs OpenAI; rule-based bullets remain visible)
- Cluster hint (needs a database scan over all barangays)
- SMS sending (queued locally, sent server-side after sync)
- DOH news scraper (server-side, irrelevant to TL offline use)
- MGMT inbox real-time view (MHO sees TL data after sync, not during)

**Reference.** The full architectural discussion lives in this session's
transcript (around the "How can we make the system offline capable?"
prompt). Re-read before scoping.

---

## Draft referral letter generator

**What.** When a reviewer clicks "Refer to ABTC" on a Cat III rabies row
(or any escalation), the LLM generates a draft referral letter using the
row data + a DOH template. The reviewer edits and saves before sending.

**Why deferred.** Needs template fields per disease, an edit/save flow,
per-disease wording, and integration with a real referral-letter print
or SMS pipeline. The recommendation engine Phase 2 (PR #207) shipped
plain-language summaries instead, which cover the most common
"explain this to the family" use case.

**When to revisit.** When operators report writing the same referral
letters by hand repeatedly.

**Where to start.** Pick one disease (Cat III rabies). Build a single
template, a single edit/save flow. Generalize only after one disease's
flow is proven in production.

---

## Cluster hint for other modules

**What.** Phase 2 of the recommendation engine added a cluster hint for
rabies (3+ Cat III in same barangay within 7 days). Same pattern could
extend to schistosomiasis (same water source / same barangay) and STH
(same school cohort).

**Why deferred.** Honest assessment:
- Schisto + STH have clean barangay-window predicates — these would work.
- Leprosy is contact-tracing, not time-window clustering — a different
  data model.
- Filariasis has multi-year latency — a 7-day window doesn't fit.

So only ~2 of the 5 modules benefit, and the operational signal hasn't
shown up yet.

**When to revisit.** When MGMT inbox shows repeated same-barangay
schisto or STH cases that should have been flagged as a potential
cluster.

**Where to start.** Extend `getClusterHint()` in `server/recommendations-llm.ts`
to dispatch by module. Two new branches: schisto (same-barangay 14-day
window) and STH (same-barangay 30-day window). Same response shape.

---

## Real auto-submit to DOH (PIDSR)

**What.** The PIDSR Cat-II weekly attestation is currently recorded
internally; the actual submission to DOH Caraga is still a manual step
someone in the RHU performs (email / DOH portal upload).

**Why deferred.** DOH does not publish a documented public REST API for
PIDSR Cat-II submission. The transmission channels in use today are
email and the EpiSurveillance system; both require a relationship with
DOH IT, not a wire-format integration we can build unilaterally.

**When to revisit.** When DOH publishes (or licenses) a real submission
API, OR when an email-based auto-submit (with attachment) is acceptable
to the RHU.

**Where to start.** Email-based path: server generates the weekly PIDSR
report as a PDF (existing `jsPDF`-like generator can be adapted),
attaches it to a templated email, sends via an SMTP provider. Schedule
on Friday 4 PM Manila tick alongside the existing cutoff check.

---

## RECOMMENDATION_SHOWN / ACTED reporting view enhancements

**What.** `/admin/recommendations` (PR #208) already shows the
per-rule shown/acted counts. Future enhancements:
- Time-series chart (shown-vs-acted per week)
- Export to CSV for provincial QA
- Per-barangay breakdown to spot training gaps

**Why deferred.** The MVP table already answers "which rules need
rewriting?" The enhancements are nice-to-have once enough audit data
has accumulated.

**When to revisit.** After ~6 months of audit data; once there's enough
volume for trends to be visible.

**Where to start.** Add a `?groupBy=barangay` query parameter to
`GET /api/admin/recommendations-stats`, surface it as a second tab on
the calibration page.

---

## Migration off Replit

**What.** Move the deployment off Replit (where the Deploy pipeline has
been flaky — see `docs/where-i-left-off.md` for the staleness incident)
onto a more predictable host.

**Why deferred.** Functional now; cost of migration outweighs benefit at
single-deployment scale.

**When to revisit.**
- Replit pricing changes unfavorably, OR
- A real cutover deadline appears (production for a clinic with SLA)

**Where to start.** Render or Fly.io. The auth replacement (Replit Auth
→ passport-local) is the one real engineering cost. Details in
`docs/where-i-left-off.md` → "Bigger decisions on the table" section.

---

## Mobile-native shell (Capacitor / React Native)

**What.** Wrap the existing React SPA in Capacitor (or rewrite in React
Native) so it installs as a native app on Android phones — Android being
the dominant device class for barangay-level deployment.

**Why deferred.** The web app is already mobile-responsive. Native shell
buys:
- Home-screen icon
- Push notifications (for MGMT alerts)
- Camera access (for ID photos at registration)
- Better offline UX once Level 2 ships

Without offline (Level 2) it's mostly cosmetic. Pairing the two efforts
together makes more sense than shipping the shell first.

**When to revisit.** Same time as offline Level 2 — both unlock together.

**Where to start.** Capacitor is the lower-effort path (wraps the
existing React app); React Native is the bigger commitment (rewrite).
Recommendation: Capacitor first, plus a strict mobile-responsive audit
of every page before shipping.

---

## Generic data-export tool for research

**What.** Today every export is a per-page CSV/PDF. A capstone or
research collaborator wanting structured data has no clean path beyond
asking the System Administrator.

**Why deferred.** Premature; no research collaborator has asked yet.

**When to revisit.** First time someone outside the development team
asks for a research-grade data dump.

**Where to start.** A `/admin/exports` page (SYSTEM_ADMIN only) that
generates per-table CSV exports with proper de-identification
(strip name, phone, address; keep age, sex, barangay, dates, clinical
fields). Audit-logged.

---

## Adding new deferred items

When deferring something during a session, append a new section here
with the same five fields (**What / Why deferred / When to revisit /
Where to start / + any references**). Keep the rationale honest — future
you (or the next developer) will thank present you for naming the
real reason something was skipped.
