import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Senior } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getSeniorPickupStatus, isMedsReadyForPickup, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Users, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { DashboardShell, FilterBar, type KpiSpec, type AlertSpec } from "@/components/dashboard-shell";

function parseBP(bp: string | null): { systolic: number; diastolic: number } | null {
  if (!bp) return null;
  const match = bp.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  return { systolic: parseInt(match[1], 10), diastolic: parseInt(match[2], 10) };
}

/** Senior Care dashboard — HTN medication pickup + BP distribution. */
export default function SeniorDashboard() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });

  const stats = useMemo(() => {
    const statuses = seniors.map((s) => getSeniorPickupStatus(s).status);
    const overdue = statuses.filter((s) => s === "overdue").length;
    const dueSoon = statuses.filter((s) => s === "due_soon").length;
    const medsReady = seniors.filter((s) => isMedsReadyForPickup(s)).length;
    const highBP = seniors.filter((s) => {
      const bp = parseBP(s.lastBP);
      return !!bp && (bp.systolic >= 140 || bp.diastolic >= 90);
    }).length;
    const compliancePct = seniors.length > 0 ? Math.round(((seniors.length - overdue) / seniors.length) * 100) : 0;
    const overduePct = seniors.length > 0 ? Math.round((overdue / seniors.length) * 100) : 0;
    return { overdue, dueSoon, medsReady, highBP, compliancePct, overduePct };
  }, [seniors]);

  const bpDistribution = useMemo(() => {
    const groups = { Normal: 0, Elevated: 0, "Stage 1": 0, "Stage 2": 0, "No Reading": 0 };
    seniors.forEach((s) => {
      const bp = parseBP(s.lastBP);
      if (!bp) groups["No Reading"]++;
      else if (bp.systolic < 120 && bp.diastolic < 80) groups.Normal++;
      else if (bp.systolic < 130 && bp.diastolic < 80) groups.Elevated++;
      else if (bp.systolic < 140 || bp.diastolic < 90) groups["Stage 1"]++;
      else groups["Stage 2"]++;
    });
    return [
      { name: "Normal", count: groups.Normal, color: "hsl(var(--chart-1))" },
      { name: "Elevated", count: groups.Elevated, color: "hsl(var(--chart-2))" },
      { name: "Stage 1", count: groups["Stage 1"], color: "hsl(38 92% 50%)" },
      { name: "Stage 2", count: groups["Stage 2"], color: "hsl(var(--destructive))" },
    ].filter((d) => d.count > 0);
  }, [seniors]);

  const barangayData = useMemo(() => {
    const byBarangay: Record<string, { overdue: number; dueSoon: number; upcoming: number }> = {};
    seniors.forEach((s) => {
      const status = getSeniorPickupStatus(s).status;
      const key = s.barangay || "Unknown";
      if (!byBarangay[key]) byBarangay[key] = { overdue: 0, dueSoon: 0, upcoming: 0 };
      if (status === "overdue") byBarangay[key].overdue++;
      else if (status === "due_soon") byBarangay[key].dueSoon++;
      else byBarangay[key].upcoming++;
    });
    return Object.entries(byBarangay)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [seniors]);

  const alerts: AlertSpec[] = [];
  if (stats.overduePct > 10) {
    alerts.push({
      severity: "critical",
      message: `${stats.overduePct}% of seniors have overdue medication pickups (${stats.overdue} of ${seniors.length}).`,
      cta: { label: "Open Seniors", path: "/senior" },
      testId: "alert-high-overdue",
    });
  }
  if (stats.highBP > 0) {
    alerts.push({
      severity: "critical",
      message: `${stats.highBP} senior${stats.highBP === 1 ? " has" : "s have"} BP ≥ 140/90 at last reading.`,
      cta: { label: "Open list", path: "/senior?status=all" },
      testId: "alert-high-bp",
    });
  }

  const kpis: KpiSpec[] = [
    {
      label: "Total seniors",
      value: seniors.length,
      comparison: `${stats.compliancePct}% pickup-compliant`,
      icon: Users,
      onClick: () => navigate("/senior?status=all"),
      testId: "kpi-total-seniors",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      comparison: `${stats.overduePct}% of total`,
      severity: stats.overdue > 0 ? "critical" : "normal",
      trend: stats.overdue > 0 ? "up-bad" : "flat",
      icon: AlertCircle,
      onClick: () => navigate("/senior?status=overdue"),
      testId: "kpi-overdue",
    },
    {
      label: "Due soon",
      value: stats.dueSoon,
      severity: stats.dueSoon > 0 ? "warning" : "normal",
      icon: Pill,
      onClick: () => navigate("/senior?status=dueSoon"),
      testId: "kpi-due-soon",
    },
    {
      label: "Meds ready",
      value: stats.medsReady,
      icon: CheckCircle,
      onClick: () => navigate("/senior?status=ready"),
      testId: "kpi-meds-ready",
    },
    {
      label: "High BP",
      value: stats.highBP,
      comparison: "≥ 140/90 at last reading",
      severity: stats.highBP > 0 ? "critical" : "normal",
      icon: Activity,
      onClick: () => navigate("/senior?status=all"),
      testId: "kpi-high-bp",
    },
  ];

  const diagnostic = (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Blood pressure distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {bpDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bpDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="count" name="Seniors" radius={[4, 4, 0, 0]}>
                  {bpDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No BP readings on record
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pickup status by barangay · top 10</CardTitle>
        </CardHeader>
        <CardContent>
          {barangayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barangayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="overdue" stackId="a" fill="hsl(var(--destructive))" name="Overdue" />
                <Bar dataKey="dueSoon" stackId="a" fill="hsl(38 92% 50%)" name="Due Soon" />
                <Bar dataKey="upcoming" stackId="a" fill="hsl(var(--chart-1))" name="Upcoming" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
              No seniors recorded this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardShell
      title="Senior Care Dashboard"
      subtitle="HTN medication pickup + BP monitoring"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      kpis={kpis}
      diagnostic={diagnostic}
    />
  );
}
