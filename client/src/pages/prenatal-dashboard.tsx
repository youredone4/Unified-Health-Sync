import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getTTStatus, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardShell, FilterBar, type KpiSpec, type AlertSpec } from "@/components/dashboard-shell";

function getTrimester(gaWeeks: number): "1st" | "2nd" | "3rd" {
  if (gaWeeks < 14) return "1st";
  if (gaWeeks < 28) return "2nd";
  return "3rd";
}

/** Maternal dashboard — TT vaccination + prenatal overview. */
export default function PrenatalDashboard() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });

  const stats = useMemo(() => {
    const statuses = mothers.map((m) => getTTStatus(m).status);
    const overdue = statuses.filter((s) => s === "overdue").length;
    const dueSoon = statuses.filter((s) => s === "due_soon").length;
    const upcoming = statuses.filter((s) => s === "upcoming").length;
    const completed = statuses.filter((s) => s === "completed").length;
    const coveragePct = mothers.length > 0 ? Math.round((completed / mothers.length) * 100) : 0;
    const overduePct = mothers.length > 0 ? Math.round((overdue / mothers.length) * 100) : 0;
    return { overdue, dueSoon, upcoming, completed, coveragePct, overduePct };
  }, [mothers]);

  const trimesterData = useMemo(() => {
    const groups: Record<"1st" | "2nd" | "3rd", number> = { "1st": 0, "2nd": 0, "3rd": 0 };
    mothers.forEach((m) => groups[getTrimester(m.gaWeeks)]++);
    return [
      { name: "1st (0–13 wks)", count: groups["1st"] },
      { name: "2nd (14–27 wks)", count: groups["2nd"] },
      { name: "3rd (28+ wks)", count: groups["3rd"] },
    ];
  }, [mothers]);

  const barangayData = useMemo(() => {
    const byBarangay: Record<string, { overdue: number; dueSoon: number; upcoming: number; completed: number }> = {};
    mothers.forEach((m) => {
      const status = getTTStatus(m).status;
      const key = m.barangay || "Unknown";
      if (!byBarangay[key]) byBarangay[key] = { overdue: 0, dueSoon: 0, upcoming: 0, completed: 0 };
      if (status === "overdue") byBarangay[key].overdue++;
      else if (status === "due_soon") byBarangay[key].dueSoon++;
      else if (status === "upcoming") byBarangay[key].upcoming++;
      else byBarangay[key].completed++;
    });
    return Object.entries(byBarangay)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [mothers]);

  const alerts: AlertSpec[] = [];
  if (stats.overduePct > 10) {
    alerts.push({
      severity: "critical",
      message: `${stats.overduePct}% of mothers have overdue TT vaccinations (${stats.overdue} of ${mothers.length}).`,
      cta: { label: "Open Mothers", path: "/prenatal" },
      testId: "alert-high-overdue",
    });
  }

  const kpis: KpiSpec[] = [
    {
      label: "Total mothers",
      value: mothers.length,
      comparison: `${stats.coveragePct}% with complete TT`,
      icon: Users,
      onClick: () => navigate("/prenatal?status=all"),
      testId: "kpi-total-mothers",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      comparison: `${stats.overduePct}% of total`,
      severity: stats.overdue > 0 ? "critical" : "normal",
      trend: stats.overdue > 0 ? "up-bad" : "flat",
      icon: AlertCircle,
      onClick: () => navigate("/prenatal?status=overdue"),
      testId: "kpi-overdue",
    },
    {
      label: "Due soon",
      value: stats.dueSoon,
      severity: stats.dueSoon > 0 ? "warning" : "normal",
      icon: Heart,
      onClick: () => navigate("/prenatal?status=dueSoon"),
      testId: "kpi-due-soon",
    },
    {
      label: "Completed",
      value: stats.completed,
      comparison: `${stats.coveragePct}% of mothers`,
      icon: CheckCircle,
      onClick: () => navigate("/prenatal?status=all"),
      testId: "kpi-completed",
    },
  ];

  const diagnostic = (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trimester distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trimesterData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" name="Mothers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">TT status by barangay · top 10</CardTitle>
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
                <Bar dataKey="upcoming" stackId="a" fill="hsl(var(--chart-2))" name="Upcoming" />
                <Bar dataKey="completed" stackId="a" fill="hsl(var(--chart-1))" name="Completed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
              No mothers recorded this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardShell
      title="Maternal Dashboard"
      subtitle="TT vaccination + prenatal care"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      kpis={kpis}
      diagnostic={diagnostic}
    />
  );
}
