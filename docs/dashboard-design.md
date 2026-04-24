# Dashboard Design — Placer Unified Health Sync

This is the spec every Dashboard tab should cite. It translates the project's
dashboard design principles into concrete Placer decisions so every future
dashboard PR has an unambiguous target.

When in doubt between "looks nice" and "matches this doc" → this doc wins.

---

## 1. Purpose before layout

Every dashboard tab must start with two written answers. If they aren't
obvious, the tab doesn't ship.

1. **Primary user** — exactly one per tab.
2. **Core decisions** — 1 to 3 decisions the tab supports. Not "what to
   look at" — what to *do* based on what's shown.

Defaults for this app:

| Tab | Primary user | Core decisions |
|---|---|---|
| **Municipal** | MHO / SHA | "Which barangays need intervention this week?" · "Are we on track for this month's M1 submission?" · "Any cross-program outbreaks?" |
| **Maternal** | MHO | "Which barangays have the most overdue TT / ANC / PNC?" · "Is our ANC4+ coverage on target?" |
| **Child** | MHO | "Vaccination coverage by barangay — who's behind?" · "Any nutrition red flags?" |
| **Senior** | MHO | "HTN pickup compliance — who's slipping?" |
| **Nutrition** | MHO | "SAM/MAM caseload — which barangays are worsening?" |
| **Disease Map** | MHO | "Where are cases clustering?" |
| **Hotspots** | MHO / SHA | "Cross-program risk ranking — where should I send resources?" |

**Rule:** if a widget doesn't inform one of the listed decisions, remove it.

---

## 2. Information hierarchy (3 layers)

Every dashboard tab uses the same vertical order, no exceptions:

```
┌── Filters row ──────────────────────────────────────────────────────────────┐
│  Month ▾   Barangay ▾   Programme ▾                    last updated …       │
├── L1 — Summary ─────────────────────────────────────────────────────────────┤
│  Alerts band (only when something's wrong)                                  │
│  KPI row (4-6 big numbers with trend arrows)                                │
├── L2 — Diagnostic ──────────────────────────────────────────────────────────┤
│  1-3 charts: trend over time + cross-barangay comparison                    │
├── L3 — Detail (drill-down) ─────────────────────────────────────────────────┤
│  Table / list — collapsed by default on mobile, expandable on demand        │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **L1 answers "what's happening?"** in <5 seconds, even without reading.
- **L2 answers "why is it happening?"**
- **L3 answers "what should I do next?"** (i.e. which specific patients /
  barangays / items to act on).

**Rule:** if a widget doesn't belong to L1, L2, or L3 — it doesn't ship.

---

## 3. Chart vocabulary

Use the right chart for the right job. This is the authoritative list; any
chart outside it needs a note in the PR explaining why.

| Goal | Chart | Notes |
|---|---|---|
| Trend over time | **Line chart** | X = time, Y = metric. One metric at a time unless two are directly comparable. |
| Comparison across categories | **Horizontal bar chart** | Bars sorted by value, labels always visible. Vertical bars only if categories are time-ordered. |
| Geographic distribution | **Choropleth** (per-barangay shaded map) or pin map | Used only on Municipal and Disease Map tabs. |
| Precise values / drill-down | **Table** | Sorted, filtered, paginated. Always the L3 shape. |
| Single KPI with status | **KPI card** (big number + comparison + trend arrow) | The L1 shape. Always includes a comparison. |
| Proportion of a whole | **Single horizontal bar ("bullet")** | Never pie charts. |

**Rule:** pie charts are banned. Donut charts are banned. 3-D is banned.
Gradients in data-carrying regions are banned.

**Position > color.** A reader's eye compares positions faster than hues. Put
the number the user cares about first, leftmost on a row, or tallest on a
chart.

---

## 4. Colour discipline

The Placer palette (Green primary, Gold secondary, Blue chart-2) is **brand
chrome**, not data. Data state uses a separate, fixed semantic palette:

| Semantic | Hue | Token | Use |
|---|---|---|---|
| Overdue / critical | Red | `--destructive` | KPI breach, overdue patients, stockouts |
| Due soon / warning | Amber | `hsl(45 92% 50%)` (same as accent) | Due-soon items, low-but-not-stockout stock |
| OK / on-target | Neutral | no special colour — bare text | Default state |
| Trending up (good) | Emerald | local `text-emerald-*` | Positive delta indicators |
| Trending down (bad) | Red | `--destructive` | Negative delta indicators |

- **Never** use Placer Green (`--primary`) to signal "data is good." That
  collides with brand chrome and makes everything look fine.
- Brand chrome (sidebar, primary buttons, page headers, active tab underline,
  chart-1 for the default series in a line chart) stays Placer Green.
- Gold (`--accent`) is for focus, hover, highlight — not "everything's fine."
- Blue (chart-2) is the comparison / secondary-series colour on multi-series
  charts.

**Rule:** max three hues carrying meaning on any one dashboard tab, plus
greyscale. Red and amber reserved for state.

---

## 5. Typography, density, scanning

- **KPI number** — 28-32 px, `font-semibold`, no label prefix.
- **KPI label** — 11-12 px `text-muted-foreground`, above the number.
- **KPI comparison** (vs. last month / target) — 12 px, right of or below the
  number, with trend arrow.
- **Card body text** — 14 px.
- **Chart axis labels** — 11 px `text-muted-foreground`.
- **Table body** — 13 px.

**Rule:** max 5-9 distinct elements per L1 + L2 combined. If the page needs
more, split into tabs or move the overflow to L3.

**Scannability checklist**:
- Does every KPI card have a comparison?
- Are numbers right-aligned in tables?
- Is the most-important metric top-left?
- Do statuses rely on red/amber or on labels alone — not on green "going
  good" colouring?

---

## 6. Interactivity

One filter bar, top of page:
- **Month / date range** (default: current month)
- **Barangay** (default: all; auto-pinned for TL)
- **Programme** where applicable

Drill-downs:
- Click a KPI card → scroll to / highlight the relevant L2 chart.
- Click a bar in an L2 chart → scroll to L3 table filtered to that category.
- Click a row in L3 table → open the patient / case profile.

**Rule:** no popovers carrying critical info. Tooltips only for exact values
on a hovered chart point — never for anything the user might need to *act* on.

---

## 7. Data freshness & missing data

- **BHW entry is daily, not real-time.** Don't show minute-level "updated X
  seconds ago" — it looks broken when the app is working as designed.
- **Freshness label convention**: "Data as of `<date>`" in the filters row,
  right-aligned. Only show time-of-day if the metric is genuinely real-time
  (none are, today).
- **Missing data shows as `—`**, not `0`. A zero means "we measured and it
  was zero"; a dash means "we don't know yet."
- **Empty state copy** — never "No data". Always "No <thing> this month"
  with a next step if there is one ("record a new case").

**Rule:** trust is a feature. When data is incomplete, say so in-line.

---

## 8. Context for every number

Bare numbers are meaningless. Every KPI card renders at least one of:

- vs. last month (`↑ 4 vs Mar`)
- vs. target / threshold (`67% / target 80%`)
- vs. municipal average (when a barangay is selected)

If the data doesn't yet support one of these (e.g. brand-new KPI), show
`— vs. last month` so the slot is visible and reserved.

**Rule:** data answers "so what?" or it doesn't ship.

---

## 9. Performance

Dashboards are read-heavy and run on weak networks in rural barangays.

- **Pre-aggregate on the server.** Dashboard endpoints return summary rows,
  not raw records. If a tab fetches >1000 rows to compute a single percentage,
  the endpoint is wrong.
- **Lazy-load L3.** The drill-down table loads on expand, not on mount.
- **Show skeletons on mount**, not spinners. Users should see layout
  immediately even before numbers arrive.
- **Cache at the React Query layer** with a 60-second stale time so tab
  switches don't re-hit the server.

**Rule:** speed is UX. A slow dashboard doesn't just feel slow — it's
*distrusted*.

---

## 10. Responsiveness

Three breakpoints:

- **Desktop (≥ 1024 px)** — full layout: filters + KPI row of 4-6 + 2-column
  charts + L3 table.
- **Tablet (640-1023 px)** — KPI row collapses to 2 across. Charts stack. L3
  stays in a horizontal scroll.
- **Mobile (< 640 px)** — KPI row becomes a vertical stack (L1 only by
  default). Charts collapse to accordion. L3 disappears unless explicitly
  expanded.

**Rule:** don't shrink — *restructure*. A desktop layout compressed to a
phone is useless.

---

## 11. Consistency — the DashboardShell contract

Every dashboard tab uses a shared primitive so layouts never diverge:

```tsx
<DashboardShell
  title="Municipal Overview"
  subtitle="April 2026 · All barangays"
  filters={{ month, barangay, programme }}
  lastUpdated="2026-04-24"
  alerts={[ ... ]}           // L1 — banner of at most 3 urgent cards; hides if empty
  kpis={[ ... ]}             // L1 — 4-6 KPI cards
  diagnostic={[ ... ]}       // L2 — 1-3 chart widgets
  detail={<DrillDownTable /> } // L3 — collapsed on mobile by default
/>
```

Components to be provided as part of the shell:

- `KpiCard` — big number, label, comparison, trend arrow, optional click-to-drill.
- `AlertCard` — 3-line alert with one CTA link.
- `LineTrend`, `BarCompare` — thin wrappers around Recharts with Placer
  palette pre-applied.
- `DrillDownTable` — skeleton row-click handler + right-aligned number columns.
- `FilterBar` — month / barangay / programme pickers with the "Data as of
  `<date>`" indicator on the right.

**Rule:** no bespoke chart styling inside a tab. If a tab needs a one-off
chart style, it's a new `DashboardShell` primitive.

---

## 12. Mental model — the three questions

Every dashboard tab passes this smoke test before shipping:

1. **What's happening?** → L1 KPIs + alerts answer in <5 seconds.
2. **Why is it happening?** → L2 charts answer in <20 seconds.
3. **What should I do next?** → L3 table + drill-down links point at the
   specific next action (a patient, a barangay, an indicator to fix).

If any answer requires the user to read instead of scan, the tab is wrong.

---

## 13. Rollout plan

This doc ships first (this PR).

Then:

1. **`DashboardShell` primitive + Municipal Dashboard rewrite** — one PR. Proves
   the pattern. Establishes the shell API above.
2. **Roll to the remaining 6 tabs** — Maternal, Child, Senior, Nutrition,
   Disease Map, Hotspots — each its own small PR following the shell.

Every subsequent dashboard PR description should include a checklist tied to
this doc:

- [ ] Primary user + core decisions stated in the PR description (§1).
- [ ] L1 / L2 / L3 hierarchy respected (§2).
- [ ] Every KPI has a comparison (§8).
- [ ] State colours used correctly — red/amber/green, never Placer brand
  chrome as data-state (§4).
- [ ] No banned charts (pie / donut / 3-D) (§3).
- [ ] Empty states and freshness labels present (§7).
- [ ] Mobile layout restructured, not shrunk (§10).
- [ ] Three-questions smoke test passed (§12).

---

## 14. Out of scope

Not covered by this doc (handled elsewhere or deliberately deferred):

- **User validation (§13 of the framework)** — lives outside the codebase;
  requires BHW/MHO sessions in Placer.
- **Full AI analytics reshape** — Health Analytics tab already has its own
  shape with the AI summaries. This doc governs the visual / interaction
  patterns around it, but not the narrative-generation pipeline.
- **Real-time push updates** — out of scope until there's a real-time data
  source. Until then all freshness is "Data as of `<date>`".
