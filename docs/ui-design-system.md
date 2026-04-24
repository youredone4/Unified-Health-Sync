# GeoHealthSync — UI Design System

_Canonical layout, interaction, and tokens spec for every UI change._ Subsequent UI PRs should cite the section(s) they implement. If a PR contradicts this doc, update the doc first.

**Audience:** developers writing pages/components and reviewers checking them. **Scope:** frontend only (React + Tailwind + Radix UI). Backend invariants are listed under **Integrity guardrails** at the end; simplifying UI does not loosen them.

---

## 1. Design principles

Five constraints every change must honour:

1. **Progressive disclosure.** Show the 5 things that matter up top; tuck the rest behind tabs, accordions, or "More…" controls. A user should be able to triage the screen without scrolling.
2. **One primary action per screen.** Every page answers "what now?" with exactly one prominent CTA. Secondary actions live in an overflow/menu. Two primaries of equal visual weight means we haven't decided yet.
3. **Consistent vocabulary & layout.** Same badge colors for Overdue / Due / Upcoming everywhere. Same profile skeleton for every patient type. Same CTA placement. Users learn the pattern once.
4. **Don't sacrifice invariants.** Simplicity is *layout and interaction flow*. RBAC, audit trails, required-field validation, TL barangay scoping, referral-consistency rules stay strict. A form that *looks* lighter should be hiding fields the role can't touch — never dropping a check. See §11.
5. **Single happy-path test.** Every proposed change is described from one concrete user: *"Maria the BHW on a 5-inch phone, 2nd-trimester mother is overdue for an ANC visit."* If you can't narrate the flow end-to-end, the design isn't done.

---

## 2. Information architecture — three zones

Top-level nav is split into three **zones of work**, not a flat list of modules:

| Zone | Purpose | Routes that live here |
|---|---|---|
| **Transactions** | Record / update / log | Mothers, Children, Seniors, TB DOTS, Disease Cases, Nutrition Follow-ups, FP Records, Consults, Nurse Visits, Inventory |
| **Dashboards** | At-a-glance decision making | Municipal Overview, Maternal, Senior Care, Disease Map, Stock Levels, Cross-barangay comparisons, alerts/overdue lists |
| **Reports** | Formal outputs to submit/export | M1 Brgy, Consolidated M1, Disease surveillance exports, future FHSIS/PhilHealth outputs |

**Role-based default landing page** (first page after login):

| Role | Lands on |
|---|---|
| BARANGAY / TL | Transactions › Today |
| MHO | Dashboards › Municipal Overview |
| SHA / SYSTEM_ADMIN | Their current home (or Dashboards) |

Pages that today mix all three modes (e.g. the M1 Report page contains encoding + summary + export) get **split** when touched — encoding goes to Transactions, consolidated read + export go to Reports.

---

## 3. Global shell

### Desktop (≥1024 px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ [logo] Placer Municipality              [ Search patients…]   [🔔] [Avatar ▾] │
├───────────────────┬────────────────────────────────────────────────────────────┤
│  TRANSACTIONS     │                                                            │
│   Mothers         │   Dashboards / Municipal Overview                          │
│   Children        │                                                            │
│   …               │   …page content…                                           │
│                   │                                                            │
│  DASHBOARDS       │                                                            │
│   ⭐ Municipal    │                                                            │
│   …               │                                                            │
│                   │                                                            │
│  REPORTS          │                                                            │
│   M1 Brgy         │                                                            │
│   …               │                                                            │
│                   │                                                            │
│  — Admin —        │                                                            │
│   Settings        │                                                            │
└───────────────────┴────────────────────────────────────────────────────────────┘
```

- Left sidebar groups by zone; zone labels are small-caps, non-interactive section headers.
- Top toolbar holds the logo, global search, notifications, avatar menu. Always visible.
- **⭐** on a nav item = user-pinned. Starred items sort to the top of their zone.
- "Admin" is a secondary group below the three zones, visually separated.

### Mobile (<1024 px)

- Sidebar collapses into a `☰` drawer.
- Top toolbar remains; global search opens a full-screen overlay when tapped.
- Zone headers become collapsed sections in the drawer.

---

## 4. Page patterns

### 4.1 Role landing page — "Today" (BHW / TL)

```
Good morning, <name> — <count> visits today       [ + Record Visit ]

┌─ Urgent ─────────────────────────────────────────────────┐
│ ● Rosa Mendoza    Senior    BP overdue 42 d    [Open][SMS]│
│ ● Juan Cruz       TB DOTS   3 missed doses     [Open][SMS]│
└──────────────────────────────────────────────────────────┘

┌─ Today's visits (6) ─────────────────────────────────────┐
│  9:00  Maria Tan       Prenatal check        ›            │
│ 10:00  Pedro Lim       DOTS dose             ›            │
│  …                                                        │
└──────────────────────────────────────────────────────────┘

Quick add:   [+ Mother]  [+ Child]  [+ Senior]  [+ Disease case]
```

Structure:
- Greeting + summary count, one primary CTA on the right (Record Visit).
- **Urgent list first** (critical-first layout; never hidden behind scroll).
- Today's scheduled visits sorted by time.
- Quick-add row for new records at the bottom.

### 4.2 Unified patient profile (canonical skeleton)

Applies to Mother, Child, Senior, TB patient, and any future patient-type profile.

**Desktop:**

```
‹ Back to <List>

<Patient name>                     [ + <Primary action> ▾  More ⋯ ]
<meta line: age · sex · barangay · phone>

● <status banner 1>   ● <status banner 2>

┌─ At a glance ──────────────────────────────────────────────┐
│  <primary datum 1>    <primary datum 2>                     │
│  <primary datum 3>    <primary datum 4>                     │
│  ⚠ Allergies  …       ⚠ Conditions  …                       │
└────────────────────────────────────────────────────────────┘

┌──────────┬──────────────┬─────────────┬─────────────┬──────────────┐
│ Overview │ Demographics │ Medical Hx  │ Screenings  │ Family & Care│
└──────────┴──────────────┴─────────────┴─────────────┴──────────────┘

(selected tab content)

Next suggested actions:  <action 1>  ·  <action 2>
```

**Mobile:** same header, tabs collapse into accordions.

```
At a glance
  Last BP   120/80  Apr 23
  ⚠ Allergies: PCN
  ⚠ Conditions: HTN

▸ Demographics
▸ Medical history
▾ Screenings
    · PhilPEN   Jan '26
    · Vision    2025
▸ Family & care

Recent activity
  Apr 23  Nurse visit
  Dec 15  Med pickup
```

**Canonical tab set** (hide a tab if it has no content for that patient type):

| Tab | Contents |
|---|---|
| **Overview** | Recent activity timeline + suggested next actions |
| **Demographics** | Address, civil status, education, occupation, PhilHealth, OSCA/4Ps, IDs |
| **Medical history** | Conditions + diagnosis dates, allergies, past consults/encounters |
| **Screenings** | BP/BG trends, PhilPEN, immunizations, geriatric assessment, age-specific cancer screening |
| **Family & care** | Linked relationships (mother↔child), caregiver, emergency contact |

Rules:
- **Allergies, active conditions, current medications, and status banners live above the tabs** — never inside them. EHR research flags "clinician missed the allergy because it was on a tab" as a recurring harm.
- Default tab is **Overview**.
- Max 5 tabs. If a patient type needs more, merge or move to a sub-section.
- Never horizontal-scroll the tab strip on desktop; if it overflows, a tab is superfluous.

### 4.3 Dashboard page

```
Dashboards / <Name>            <Period> ▾    <Scope> ▾    ⭐

┌─ Alerts (<n>) ──────────────────────────────────────┐
│ ⚠  <alert 1>                      [Open worklist]   │
│ ⚠  <alert 2>                      [Open inventory]  │
└─────────────────────────────────────────────────────┘

┌─ KPIs ─────────────┬──────────┬──────────┬──────────┐
│  <metric 1>        │ <m 2>    │ <m 3>    │ <m 4>    │
│  <value>           │ <v>      │ <v>      │ <v>      │
│  <delta vs prev>   │ [spark]  │ [spark]  │ [spark]  │
└────────────────────┴──────────┴──────────┴──────────┘

┌─ <visual: map/chart> ─────────┬─ <visual: chart> ──┐
│                                │                    │
└───────────────────────────────┴────────────────────┘

┌─ <tabular comparison> ──────────────────────────────┐
└─────────────────────────────────────────────────────┘
```

Rules:
- **Alerts first**, above the fold. If the dashboard were printed in black and white, the user should still know what's urgent.
- KPIs use trend sparklines, not decorative full-size charts.
- Period + scope filters live in the header row, not scattered per-widget.
- **Starrable** — user can pin the dashboard so it lands at the top of their Dashboards zone.

### 4.4 Form / transaction page

- Required fields first, grouped by purpose. Optional fields behind a "More" collapse.
- **Pre-fill everything the system already knows**: barangay (from user context or patient), recorded-by (from session), dates (default to today), ages (compute from DOB).
- Save button is the primary CTA; disabled until required fields pass client-side validation; loading state during mutation.
- Optimistic UI with rollback on error (see §8).
- Inline error messages next to the offending field — never a top-of-form wall of errors.

---

## 5. Design tokens

All colors are HSL CSS vars so the theming pipeline (`client/src/contexts/theme-context.tsx`) can re-inject them at runtime.

### 5.1 Color — Placer Brand (default)

| Role | Token | HSL | Hex |
|---|---|---|---|
| Primary (Green) | `--primary`, `--ring`, `--chart-1`, `--sidebar-primary` | `142 60% 38%` | ~#26A047 |
| Accent / Secondary (Gold) | `--accent`, `--secondary` | `45 92% 50%` | ~#F5C518 |
| Chart-2 (Blue) | `--chart-2` | `210 75% 45%` | ~#1E74C9 |
| Destructive | `--destructive` | `0 84% 60%` | ~#EA3D3D |
| Muted | `--muted`, `--muted-foreground` | derived from primary hue | — |

Gold is **never** used for body text on white (contrast fails WCAG AA). Gold on dark foreground (`40 90% 15%`) passes. For text-on-gold, always use the paired `--accent-foreground`.

### 5.2 Canonical status vocabulary

Four statuses. Four colors. One meaning. Used across all worklists, profiles, and dashboards:

| Status | Label | Color (HSL) | When to use |
|---|---|---|---|
| **Overdue** | `Overdue` | `0 84% 55%` (red) | Past the deadline — requires action |
| **Due now** | `Due today` / `Due soon` | `38 92% 50%` (amber) | ≤3 days window |
| **Upcoming** | `In <n> d` | `142 50% 40%` (muted green) | >3 days out |
| **Completed** | `Completed` / `Done` | `142 60% 38%` (primary green) | Terminal state |

Extensions (permitted only when orthogonal to the four above):
- `Missed dose` — variant of Overdue for TB DOTS (same red).
- `At risk` — use amber, annotate with reason.
- Never invent a fifth color for a fifth status — reuse the closest of the four.

### 5.3 Spacing — 8-point grid

Padding / margin / gap values in multiples of **4 px** (Tailwind `p-1`, `p-2`, `p-3`, `p-4`, `p-6`, `p-8`). Forbidden values: 5, 7, 9, 10, 11, 13, 14, 15 px — they fight the vertical rhythm.

Canonical scale:
- `4 px` — between icon and label inside a button
- `8 px` — between related form fields
- `12 px` — between form groups
- `16 px` — between cards within a section
- `24 px` — between sections on a page
- `32 px` — page top/bottom breathing room

### 5.4 Typography

- Body: **16 px min** on mobile, 15 px acceptable on desktop only if line-height ≥1.5.
- Font: Inter (`--font-sans`).
- Headings: `text-2xl` page title, `text-xl` section, `text-base font-semibold` card title.
- Numeric readouts (vitals, counts, dates): tabular-nums so they line up in tables.

### 5.5 Tap targets

- **Minimum 44×44 px** for anything tappable on mobile. Tailwind `h-11 min-w-[44px]` or equivalent.
- Rows in a list are themselves tap targets — no tiny chevron-only hit zones.

---

## 6. Accessibility

- **Contrast ≥ 4.5:1** for body text, **≥ 3:1** for large text (≥18 px) and UI components. Test every color pair against WCAG AA before adopting.
- **Keyboard navigation** — every interactive element focusable in document order, visible focus ring using `--ring`.
- **Screen reader labels** on icon-only buttons (`aria-label`).
- **Language** — UI strings must support future localization (no string concatenation for sentences; use ICU / template placeholders). Priority languages for Placer: English → Bisaya → Tagalog.
- **Plain-language first-run helpers** — one-line helper text under acronyms (TB DOTS, M1 Brgy, PhilPEN, FHSIS) for new users. Dismissible, remembered in local storage.
- **No colour-only signals** — every Overdue badge has both the red color and the word "Overdue".

---

## 7. Mobile-first behaviours

BHWs work in the field on low-end Android devices with flaky 2G/3G.

| Desktop pattern | Mobile adaptation |
|---|---|
| Left sidebar | Drawer via `☰` |
| Top toolbar with inline search | Toolbar kept; tap search → full-screen overlay |
| Tabs | Accordion sections, one expanded by default |
| Wide table | Card list (one card per row, primary datum prominent) |
| Multi-column form | Single column stack |
| Hover-revealed action | Always-visible icon button, right-aligned |

**Breakpoint rule:** design at 360 px first. Scale up. Never the other way.

---

## 8. Data integrity & state

- **Optimistic UI with rollback.** On mutation, update the cache immediately; on error, rollback + toast. Pattern already used for TB referrals — reuse.
- **Scoped query invalidation.** After a write, invalidate only the queries that depend on the changed data — don't blow the whole cache.
- **Cache-Control: no-store** for patient-detail fetches — prevents stale 304 after PUT.
- **Idempotent writes** where possible (e.g. "mark as picked up" is safe to click twice).
- **Offline queue** (future) — writes attempted while offline should queue and retry on reconnect rather than failing silently.

---

## 9. Icons

- Library: **Lucide** only (already in use). No mixing with Heroicons, Font Awesome, or emoji-as-icons.
- Icon + label together wherever the icon alone is ambiguous.
- Same icon = same concept across the app (e.g. `Heart` always means cardiovascular; never reused for "favorite").

---

## 10. Review checklist (use on every UI PR)

When opening a UI PR, confirm:

- [ ] Which section(s) of this doc does it implement? (cite by number)
- [ ] Happy path narrated from one user persona
- [ ] One primary CTA on each touched screen
- [ ] Canonical status vocabulary used (§5.2); no new status colors
- [ ] 8-pt grid respected (§5.3)
- [ ] Body text ≥16 px on mobile (§5.4)
- [ ] Tap targets ≥44×44 px on mobile (§5.5)
- [ ] Contrast check run on every new color pair (§6)
- [ ] Icon-only buttons have `aria-label` (§6)
- [ ] Loading and error states designed, not just the happy path
- [ ] Optimistic UI + rollback if the change is a mutation (§8)
- [ ] Mobile view sketched (§7)
- [ ] Invariants preserved — RBAC, audit, validations untouched (§11)

---

## 11. Integrity guardrails (what does NOT loosen)

Simplifying UI never relaxes these. If you find yourself tempted to skip one in the name of "smoother UX", stop and ask.

- **RBAC.** Every write path goes through the same `requireRole` / `nurseVisitWriteRBAC` / `registryRBAC` middleware it does today. Hiding a button from a role is fine; the backend still rejects if someone hits the endpoint directly.
- **Audit logging.** Every sensitive mutation (delete, role change, record reopen, bulk import) writes an audit row. No "UX shortcut" endpoint that skips audit.
- **Required-field validation.** Zod schemas at the API boundary stay as strict as today. A simpler form means the UI hides fields, auto-fills them from context, or defers them to a second step — it does not mean the backend accepts incomplete data.
- **Barangay scoping for TL.** TLs only see and write to their assigned barangays. Never widened by UI changes.
- **Referral-consistency rules.** E.g. TB's `referralToRHU` + `referredRhuId` validation. Simplification of that flow already happened (one-click flag), but the backend still validates if `referredRhuId` is set it must be a verified DOTS RHU.
- **Optimistic UI is client-side.** On server error, UI always rolls back to the server's truth. Never present the optimistic state as confirmed.

---

## 12. Sources / further reading

- [DHIS2 Design System — Design for use](https://developers.dhis2.org/design-system/principles/design-for-use/)
- [DHIS2 Design System — Layout, spacing, stacking](https://developers.dhis2.org/design-system/principles/layout/)
- [NIST GCR 15-996 — Technical Basis for User Interface Design of Health IT](https://nvlpubs.nist.gov/nistpubs/gcr/2015/NIST.GCR.15-996.pdf)
- [EHR Interface Design Principles, UX, and Usability Challenges — Fuselab](https://fuselabcreative.com/ehr-interface-design-principles-ux-and-usability-challenges/)
- [Healthcare UX Design Guide — Fuselab 2026](https://fuselabcreative.com/healthcare-ux-design-best-practices-guide/)
- [Digital health for Barangay Health Workers — Quezon, Philippines baseline](https://chwcentral.org/wp-content/uploads/Digital-health-for-Barangay-Health-Workers-_-a-mixed-methods-baseline-assessment-in-Quezon-Philippines.pdf)
- [WCAG 2.2 AA — Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)

---

_Changelog: initial version. Future edits should bump a minor version number and record the rationale._
