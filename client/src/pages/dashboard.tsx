import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from "@shared/schema";
import {
  getTTStatus,
  getNextVaccineStatus,
  getSeniorPickupStatus,
  isMedsReadyForPickup,
  isUnderweightRisk,
  isOutbreakCondition,
  getTBDotsVisitStatus,
  getTBMissedDoseRisk,
  TODAY_STR,
} from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Baby, Pill, Package, Siren, AlertTriangle, Users, Activity, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardShell, FilterBar, type KpiSpec, type AlertSpec } from "@/components/dashboard-shell";

const PLACER_BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong",
];

/**
 * Municipal Dashboard — Step 2 canary for the DashboardShell primitive.
 *
 * Follows docs/dashboard-design.md:
 *  §2 Three-layer hierarchy: L1 alerts + KPIs, L2 diagnostic charts,
 *     L3 detail table (top barangays).
 *  §3 Chart vocabulary: horizontal bar for comparison, progress bars for
 *     coverage. Pie chart removed (banned).
 *  §4 Colour: Placer Green for brand chrome only; red/amber for data state.
 *  §8 Every KPI shows a comparison placeholder ("— vs last month") since
 *     we don't yet persist historical snapshots. Slot stays reserved.
 *  §12 Three-questions smoke test:
 *     What's happening? → alerts + KPIs at the top.
 *     Why? → coverage + top-problem-barangays charts.
 *     What next? → L3 table with click-to-hotspots drill-down.
 */
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { selectedBarangay, scopedPath } = useBarangay();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });

  const stats = useMemo(() => {
    const totalMothers = mothers.length;
    const activeMothers = mothers.filter((m) => m.status === "active").length;
    const totalChildren = children.length;
    const totalSeniors = seniors.length;
    const totalTB = tbPatients.length;

    const ttOverdue = mothers.filter((m) => getTTStatus(m).status === "overdue").length;
    const ttDueSoon = mothers.filter((m) => getTTStatus(m).status === "due_soon").length;
    const vaccineOverdue = children.filter((c) => getNextVaccineStatus(c).status === "overdue").length;
    const vaccineDueSoon = children.filter((c) => getNextVaccineStatus(c).status === "due_soon").length;
    const underweightRisk = children.filter((c) => isUnderweightRisk(c)).length;
    const medsPickupPending = seniors.filter((s) => isMedsReadyForPickup(s)).length;
    const medsOverdue = seniors.filter((s) => getSeniorPickupStatus(s).status === "overdue").length;

    const stockOuts = inventory.filter((inv) => {
      const v = inv.vaccines as any;
      return v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0 || v.hepBQty === 0 || v.mrQty === 0);
    }).length;

    const outbreak = isOutbreakCondition(diseaseCases);
    const tbMissed = tbPatients.filter((p) => getTBDotsVisitStatus(p).status === "overdue").length;
    const tbAtRisk = tbPatients.filter((p) => getTBMissedDoseRisk(p)).length;

    const mothersWithTT = mothers.filter((m) => m.tt1Date).length;
    const mothersWithCompleteTT = mothers.filter((m) => m.tt5Date).length;
    const childrenFullyVaccinated = children.filter((c) => {
      const v = (c.vaccines as any) || {};
      return v.bcg && v.hepB && v.penta1 && v.penta2 && v.penta3 && v.opv1 && v.opv2 && v.opv3 && v.mr1;
    }).length;
    const seniorsCompliant = seniors.filter((s) => !isMedsReadyForPickup(s)).length;
    const tbOnTrack = tbPatients.filter((t) => !getTBMissedDoseRisk(t) && t.outcomeStatus === "Ongoing").length;

    return {
      totalMothers,
      activeMothers,
      totalChildren,
      totalSeniors,
      totalTB,
      ttOverdue,
      ttDueSoon,
      vaccineOverdue,
      vaccineDueSoon,
      underweightRisk,
      medsPickupPending,
      medsOverdue,
      stockOuts,
      outbreak,
      tbMissed,
      tbAtRisk,
      mothersWithTT,
      mothersWithCompleteTT,
      childrenFullyVaccinated,
      seniorsCompliant,
      tbOnTrack,
    };
  }, [mothers, children, seniors, inventory, diseaseCases, tbPatients]);

  // L2 — top-problem barangays (horizontal bar, sorted by severity).
  const barangayData = useMemo(() => {
    return PLACER_BARANGAYS.map((b) => {
      const ttO = mothers.filter((m) => m.barangay === b && getTTStatus(m).status === "overdue").length;
      const vaxO = children.filter((c) => c.barangay === b && getNextVaccineStatus(c).status === "overdue").length;
      const medsP = seniors.filter((s) => s.barangay === b && isMedsReadyForPickup(s)).length;
      const score = ttO * 3 + vaxO * 2 + medsP;
      return { name: b, overdue: ttO + vaxO + medsP, score, ttO, vaxO, medsP };
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [mothers, children, seniors]);

  // ── L1 Alerts ──────────────────────────────────────────────────────────
  const alerts: AlertSpec[] = [];
  if (stats.outbreak.isOutbreak) {
    alerts.push({
      severity: "critical",
      message: `Outbreak alert — ${stats.outbreak.condition}: ${stats.outbreak.count} cases reported in the last 14 days.`,
      cta: { label: "View map", path: "/dashboards/disease-map" },
      testId: "alert-outbreak",
    });
  }
  if (stats.stockOuts > 0) {
    alerts.push({
      severity: "critical",
      message: `${stats.stockOuts} barangay${stats.stockOuts === 1 ? "" : "s"} reporting vaccine stock-outs.`,
      cta: { label: "Inventory", path: "/inventory/stockouts" },
      testId: "alert-stockouts",
    });
  }
  if (stats.tbAtRisk > 0) {
    alerts.push({
      severity: "critical",
      message: `${stats.tbAtRisk} TB patient${stats.tbAtRisk === 1 ? " is" : "s are"} at risk of treatment failure.`,
      cta: { label: "Open TB DOTS", path: "/tb" },
      testId: "alert-tb-risk",
    });
  }
  if (stats.ttOverdue > 5) {
    alerts.push({
      severity: "warning",
      message: `${stats.ttOverdue} mothers with overdue TT vaccinations.`,
      cta: { label: "Open Mothers", path: "/prenatal" },
      testId: "alert-tt",
    });
  }
  if (stats.vaccineOverdue > 5) {
    alerts.push({
      severity: "warning",
      message: `${stats.vaccineOverdue} children with overdue immunisations.`,
      cta: { label: "Open Children", path: "/child" },
      testId: "alert-vax",
    });
  }
  if (stats.underweightRisk > 0) {
    alerts.push({
      severity: "warning",
      message: `${stats.underweightRisk} child${stats.underweightRisk === 1 ? "" : "ren"} flagged as underweight risk.`,
      cta: { label: "Open Nutrition", path: "/nutrition" },
      testId: "alert-underweight",
    });
  }

  // ── L1 KPIs ────────────────────────────────────────────────────────────
  const kpis: KpiSpec[] = [
    {
      label: "Active pregnancies",
      value: stats.activeMothers,
      comparison: `${stats.totalMothers} registered`,
      icon: Heart,
      onClick: () => navigate("/prenatal"),
      testId: "kpi-mothers",
    },
    {
      label: "Children under 5",
      value: stats.totalChildren,
      comparison: `${stats.childrenFullyVaccinated} fully vaccinated`,
      icon: Baby,
      onClick: () => navigate("/child"),
      testId: "kpi-children",
    },
    {
      label: "Senior citizens",
      value: stats.totalSeniors,
      comparison: `${stats.seniorsCompliant} med-compliant`,
      icon: Users,
      onClick: () => navigate("/senior"),
      testId: "kpi-seniors",
    },
    {
      label: "TB DOTS patients",
      value: stats.totalTB,
      comparison: `${stats.tbOnTrack} on track`,
      icon: Activity,
      onClick: () => navigate("/tb"),
      testId: "kpi-tb",
    },
    {
      label: "TT overdue",
      value: stats.ttOverdue,
      comparison: `${stats.ttDueSoon} due soon`,
      severity: stats.ttOverdue > 0 ? "critical" : "normal",
      trend: stats.ttOverdue > 0 ? "up-bad" : "flat",
      icon: AlertTriangle,
      onClick: () => navigate("/prenatal"),
      testId: "kpi-tt-overdue",
    },
    {
      label: "Stock-outs",
      value: stats.stockOuts,
      comparison: "barangays affected",
      severity: stats.stockOuts > 0 ? "critical" : "normal",
      icon: Package,
      onClick: () => navigate("/inventory/stockouts"),
      testId: "kpi-stockouts",
    },
  ];

  // ── L2 Diagnostic ─────────────────────────────────────────────────────
  const diagnostic = (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Programme coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CoverageRow label="TT (≥1 dose)" current={stats.mothersWithTT} total={stats.totalMothers} target={90} testId="coverage-tt" />
          <CoverageRow label="TT (all 5 doses)" current={stats.mothersWithCompleteTT} total={stats.totalMothers} target={80} testId="coverage-tt-complete" />
          <CoverageRow label="Child primary immunisation" current={stats.childrenFullyVaccinated} total={stats.totalChildren} target={95} testId="coverage-child" />
          <CoverageRow label="Senior medication compliance" current={stats.seniorsCompliant} total={stats.totalSeniors} target={85} testId="coverage-senior" />
          <CoverageRow label="TB treatment adherence" current={stats.tbOnTrack} total={stats.totalTB} target={90} testId="coverage-tb" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Siren className="w-4 h-4 text-primary" /> Top 10 problem barangays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barangayData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                width={110}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(value) => [value, "Overdue items"]}
              />
              <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  // ── L3 Detail ─────────────────────────────────────────────────────────
  const detail = (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Barangay risk summary</CardTitle>
        <Badge variant="outline" className="text-xs font-normal">
          Top 5 · click row for full analysis
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium">Barangay</th>
                <th className="text-right py-2 px-3 font-medium">TT</th>
                <th className="text-right py-2 px-3 font-medium">Vaccines</th>
                <th className="text-right py-2 px-3 font-medium">Meds</th>
                <th className="text-right py-2 px-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {barangayData.slice(0, 5).map((b) => (
                <tr
                  key={b.name}
                  className="border-b border-border/50 hover-elevate cursor-pointer"
                  onClick={() => navigate("/dashboards/hotspots")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate("/dashboards/hotspots");
                    }
                  }}
                  data-testid={`risk-row-${b.name}`}
                >
                  <td className="py-2 px-3 font-medium">{b.name}</td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <span className={b.ttO > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{b.ttO || "—"}</span>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <span className={b.vaxO > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{b.vaxO || "—"}</span>
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <span className={b.medsP > 0 ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}>
                      {b.medsP || "—"}
                    </span>
                  </td>
                  <td className="text-right py-2 px-3">
                    <RiskBadge score={b.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const scope = isTL
    ? selectedBarangay
      ? `Barangay ${selectedBarangay}`
      : "Barangay not assigned"
    : "Placer Municipality · 20 barangays";

  return (
    <DashboardShell
      title={isTL ? "Barangay Overview" : "Municipal Overview"}
      subtitle={scope}
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      kpis={kpis}
      diagnostic={diagnostic}
      detail={detail}
      detailToggleLabel="Show barangay risk summary"
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function CoverageRow({
  label,
  current,
  total,
  target,
  testId,
}: {
  label: string;
  current: number;
  total: number;
  target: number;
  testId?: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const met = pct >= target;
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`font-medium tabular-nums ${met ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`} data-testid={testId ? `${testId}-value` : undefined}>
          {total === 0 ? "—" : `${pct}%`}
          <span className="text-muted-foreground font-normal ml-1">
            {total === 0 ? "" : `(${current}/${total})`}
          </span>
        </span>
      </div>
      <div className="relative">
        <Progress value={pct} className="h-2" />
        <div
          className="absolute top-0 h-2 w-0.5 bg-foreground/40"
          style={{ left: `${target}%` }}
          title={`Target: ${target}%`}
          aria-hidden
        />
      </div>
      <p className="text-xs text-muted-foreground">Target: {target}%</p>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 8) {
    return (
      <Badge variant="outline" className="text-xs border-red-500/40 bg-red-500/10 text-destructive">
        HIGH
      </Badge>
    );
  }
  if (score >= 3) {
    return (
      <Badge variant="outline" className="text-xs border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400">
        MED
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      LOW
    </Badge>
  );
}
