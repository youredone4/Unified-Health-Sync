import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getNextVaccineStatus, isUnderweightRisk, getAgeInMonths, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Baby, Users, CheckCircle, AlertCircle, Scale, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardShell, FilterBar, type KpiSpec, type AlertSpec } from "@/components/dashboard-shell";

/** Child Health dashboard — vaccination schedule + growth overview. */
export default function ChildDashboard() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });

  const stats = useMemo(() => {
    const statuses = children.map((c) => getNextVaccineStatus(c).status);
    const overdue = statuses.filter((s) => s === "overdue").length;
    const dueSoon = statuses.filter((s) => s === "due_soon").length;
    const upcoming = statuses.filter((s) => s === "upcoming").length;
    const completed = statuses.filter((s) => s === "completed").length;
    const underweight = children.filter((c) => isUnderweightRisk(c)).length;
    const coveragePct = children.length > 0 ? Math.round((completed / children.length) * 100) : 0;
    const overduePct = children.length > 0 ? Math.round((overdue / children.length) * 100) : 0;
    return { overdue, dueSoon, upcoming, completed, underweight, coveragePct, overduePct };
  }, [children]);

  const ageGroups = useMemo(() => {
    const groups = { "0-6m": 0, "6-12m": 0, "1-2y": 0, "2-5y": 0, "5+y": 0 };
    children.forEach((c) => {
      const months = getAgeInMonths(c.dob);
      if (months <= 6) groups["0-6m"]++;
      else if (months <= 12) groups["6-12m"]++;
      else if (months <= 24) groups["1-2y"]++;
      else if (months <= 60) groups["2-5y"]++;
      else groups["5+y"]++;
    });
    return Object.entries(groups).map(([name, count]) => ({ name, count }));
  }, [children]);

  const barangayData = useMemo(() => {
    const byBarangay: Record<string, { overdue: number; dueSoon: number; upcoming: number; completed: number }> = {};
    children.forEach((c) => {
      const status = getNextVaccineStatus(c).status;
      const key = c.barangay || "Unknown";
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
  }, [children]);

  const alerts: AlertSpec[] = [];
  if (stats.overduePct > 10) {
    alerts.push({
      severity: "critical",
      message: `${stats.overduePct}% of children have overdue vaccines (${stats.overdue} of ${children.length}).`,
      cta: { label: "Open Children", path: "/child" },
      testId: "alert-high-overdue",
    });
  }
  if (stats.underweight > 0) {
    alerts.push({
      severity: "warning",
      message: `${stats.underweight} child${stats.underweight === 1 ? "" : "ren"} flagged as underweight risk.`,
      cta: { label: "Nutrition follow-ups", path: "/nutrition" },
      testId: "alert-underweight",
    });
  }

  const kpis: KpiSpec[] = [
    {
      label: "Total children",
      value: children.length,
      comparison: `${stats.coveragePct}% fully vaccinated`,
      icon: Users,
      onClick: () => navigate("/child?status=all"),
      testId: "kpi-total-children",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      comparison: `${stats.overduePct}% of total`,
      severity: stats.overdue > 0 ? "critical" : "normal",
      trend: stats.overdue > 0 ? "up-bad" : "flat",
      icon: AlertCircle,
      onClick: () => navigate("/child?status=overdue"),
      testId: "kpi-overdue",
    },
    {
      label: "Due soon",
      value: stats.dueSoon,
      severity: stats.dueSoon > 0 ? "warning" : "normal",
      icon: Baby,
      onClick: () => navigate("/child?status=dueSoon"),
      testId: "kpi-due-soon",
    },
    {
      label: "Completed",
      value: stats.completed,
      comparison: `${stats.coveragePct}% of children`,
      icon: CheckCircle,
      onClick: () => navigate("/child?status=all"),
      testId: "kpi-completed",
    },
    {
      label: "Underweight risk",
      value: stats.underweight,
      severity: stats.underweight > 0 ? "warning" : "normal",
      icon: Scale,
      onClick: () => navigate("/nutrition"),
      testId: "kpi-underweight",
    },
  ];

  const diagnostic = (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Age distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageGroups} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" name="Children" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vaccine status by barangay · top 10</CardTitle>
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
              No children recorded this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardShell
      title="Child Health Dashboard"
      subtitle="Immunisation + growth monitoring"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      kpis={kpis}
      diagnostic={diagnostic}
    />
  );
}
