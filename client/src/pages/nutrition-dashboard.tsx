import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child, NutritionFollowUp } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getWeightZScore, hasMissingGrowthCheck, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Users, AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { DashboardShell, FilterBar, type KpiSpec, type AlertSpec } from "@/components/dashboard-shell";

/** Nutrition dashboard — WHO Z-score overview + PIMAM follow-up outcomes. */
export default function NutritionDashboard() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: followUps = [] } = useQuery<NutritionFollowUp[]>({
    queryKey: [scopedPath("/api/nutrition-followups")],
  });

  const enriched = useMemo(
    () =>
      children.map((c) => ({
        child: c,
        zResult: getWeightZScore(c),
        missingGrowth: hasMissingGrowthCheck(c),
      })),
    [children],
  );

  const stats = useMemo(() => {
    const sam = enriched.filter((e) => e.zResult?.category === "sam").length;
    const mam = enriched.filter((e) => e.zResult?.category === "mam").length;
    const missing = enriched.filter((e) => e.missingGrowth).length;
    const healthy = enriched.filter((e) => e.zResult?.category === "normal" && !e.missingGrowth).length;
    return { sam, mam, missing, healthy };
  }, [enriched]);

  const alerts: AlertSpec[] = [];
  if (stats.sam > 0) {
    alerts.push({
      severity: "critical",
      message: `${stats.sam} child${stats.sam === 1 ? "" : "ren"} with Severe Acute Malnutrition (SAM) — refer to OTC / hospital.`,
      cta: { label: "Open follow-ups", path: "/nutrition" },
      testId: "alert-sam",
    });
  }
  if (stats.mam > 0) {
    alerts.push({
      severity: "warning",
      message: `${stats.mam} child${stats.mam === 1 ? "" : "ren"} with Moderate Acute Malnutrition (MAM) — enrol in SFP.`,
      cta: { label: "Open follow-ups", path: "/nutrition" },
      testId: "alert-mam",
    });
  }
  if (stats.missing > 0) {
    alerts.push({
      severity: "warning",
      message: `${stats.missing} child${stats.missing === 1 ? "" : "ren"} missing growth check this month.`,
      cta: { label: "Growth monitoring", path: "/nutrition/growth" },
      testId: "alert-missing-growth",
    });
  }

  const kpis: KpiSpec[] = [
    {
      label: "Total children",
      value: children.length,
      icon: Users,
      onClick: () => navigate("/child?status=all"),
      testId: "kpi-total",
    },
    {
      label: "SAM",
      value: stats.sam,
      comparison: "severe acute malnutrition",
      severity: stats.sam > 0 ? "critical" : "normal",
      trend: stats.sam > 0 ? "up-bad" : "flat",
      icon: AlertCircle,
      onClick: () => navigate("/nutrition"),
      testId: "kpi-sam",
    },
    {
      label: "MAM",
      value: stats.mam,
      comparison: "moderate acute malnutrition",
      severity: stats.mam > 0 ? "warning" : "normal",
      icon: Scale,
      onClick: () => navigate("/nutrition"),
      testId: "kpi-mam",
    },
    {
      label: "Missing check",
      value: stats.missing,
      severity: stats.missing > 0 ? "warning" : "normal",
      icon: Clock,
      onClick: () => navigate("/nutrition/growth"),
      testId: "kpi-missing",
    },
    {
      label: "Healthy",
      value: stats.healthy,
      icon: CheckCircle,
      onClick: () => navigate("/child?status=all"),
      testId: "kpi-healthy",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const diagnostic = <PimamOutcomes followUps={followUps} />;

  return (
    <DashboardShell
      title="Nutrition Dashboard"
      subtitle="WHO Weight-for-Age Z-score + PIMAM follow-up outcomes"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      kpis={kpis}
      diagnostic={diagnostic}
    />
  );
}

// ─── PIMAM / OPT-Plus follow-up metrics ──────────────────────────────────

function PimamOutcomes({ followUps }: { followUps: NutritionFollowUp[] }) {
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyStr = ninetyDaysAgo.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const latestByChild = new Map<number, NutritionFollowUp>();
  for (const f of [...followUps].sort((a, b) => b.followUpDate.localeCompare(a.followUpDate))) {
    if (!latestByChild.has(f.childId)) latestByChild.set(f.childId, f);
  }
  const latestList = Array.from(latestByChild.values());

  const recentClosed = followUps.filter((f) => !!f.outcome && f.followUpDate >= ninetyStr);
  const cured = recentClosed.filter((f) => f.outcome === "CURED").length;
  const defaulted = recentClosed.filter((f) => f.outcome === "DEFAULTED").length;
  const totalClosed = recentClosed.length;
  const cureRate = totalClosed > 0 ? Math.round((cured / totalClosed) * 100) : null;
  const defaulterRate = totalClosed > 0 ? Math.round((defaulted / totalClosed) * 100) : null;

  const firstByChild = new Map<number, NutritionFollowUp>();
  for (const f of [...followUps].sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))) {
    if (!firstByChild.has(f.childId)) firstByChild.set(f.childId, f);
  }
  const newAdmissions = Array.from(firstByChild.values()).filter((f) => f.followUpDate >= monthStart).length;
  const activeCases = latestList.filter((f) => !f.outcome).length;

  const perBarangay = new Map<string, number>();
  for (const f of latestList) {
    if (f.outcome) continue;
    perBarangay.set(f.barangay, (perBarangay.get(f.barangay) ?? 0) + 1);
  }
  const barangaySorted = Array.from(perBarangay.entries()).sort(([, a], [, b]) => b - a);

  return (
    <Card data-testid="pimam-kpis-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          PIMAM follow-up outcomes
          <span className="text-xs font-normal text-muted-foreground">
            (last 90 days · PPAN indicators)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Active cases" value={activeCases} />
          <Tile label="New admissions (this month)" value={newAdmissions} />
          <Tile
            label="Cure rate (90 d)"
            value={cureRate !== null ? `${cureRate}%` : "—"}
            sub={cureRate !== null ? `${cured}/${totalClosed} closed` : "no closed cases yet"}
            tone={cureRate !== null && cureRate >= 75 ? "good" : cureRate !== null && cureRate < 50 ? "warn" : "neutral"}
          />
          <Tile
            label="Defaulter rate (90 d)"
            value={defaulterRate !== null ? `${defaulterRate}%` : "—"}
            sub={defaulterRate !== null ? `${defaulted}/${totalClosed} closed` : "no closed cases yet"}
            tone={defaulterRate !== null && defaulterRate > 15 ? "warn" : "neutral"}
          />
        </div>

        {barangaySorted.length > 0 && activeCases > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Active cases by barangay
            </p>
            <div className="space-y-1.5">
              {barangaySorted.slice(0, 10).map(([brgy, count]) => {
                const pct = Math.round((count / activeCases) * 100);
                return (
                  <div key={brgy} className="flex items-center gap-3 text-sm">
                    <span className="w-32 truncate flex-shrink-0">{brgy}</span>
                    <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalClosed === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No PIMAM cases have been closed yet — cure/defaulter rates become meaningful once follow-ups are marked
            CURED or DEFAULTED.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-orange-600 dark:text-orange-400"
        : "text-foreground";
  return (
    <div className="border rounded-md p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
