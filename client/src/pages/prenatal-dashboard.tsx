import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother } from "@shared/schema";
import { getTTStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Users, CheckCircle, AlertCircle, Plus, List,
  ArrowRight, TrendingUp, Baby, BookOpen,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

function QuickActionCard({
  title,
  subtitle,
  icon: Icon,
  onClick,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <Card
      className={`cursor-pointer hover-elevate active-elevate-2 transition-all ${
        variant === "primary" ? "border-primary/50" : ""
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`quickaction-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${variant === "primary" ? "bg-primary/20" : "bg-muted"}`}>
          <Icon className={`w-5 h-5 ${variant === "primary" ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function getTrimester(gaWeeks: number): "1st" | "2nd" | "3rd" {
  if (gaWeeks < 14) return "1st";
  if (gaWeeks < 28) return "2nd";
  return "3rd";
}

export default function PrenatalDashboard() {
  const [, navigate] = useLocation();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ["/api/mothers"] });

  const statuses = mothers.map((m) => getTTStatus(m).status);
  const overdue = statuses.filter((s) => s === "overdue").length;
  const dueSoon = statuses.filter((s) => s === "due_soon").length;
  const upcoming = statuses.filter((s) => s === "upcoming").length;
  const completed = statuses.filter((s) => s === "completed").length;

  const coverageRate = mothers.length > 0 ? Math.round((completed / mothers.length) * 100) : 0;
  const overdueRate = mothers.length > 0 ? Math.round((overdue / mothers.length) * 100) : 0;

  const pieData = [
    { name: "Overdue", value: overdue, color: "hsl(0, 84%, 60%)" },
    { name: "Due Soon", value: dueSoon, color: "hsl(38, 92%, 50%)" },
    { name: "Upcoming", value: upcoming, color: "hsl(199, 89%, 48%)" },
    { name: "Completed", value: completed, color: "hsl(142, 76%, 36%)" },
  ].filter((d) => d.value > 0);

  const trimesterData = useMemo(() => {
    const groups: Record<"1st" | "2nd" | "3rd", number> = { "1st": 0, "2nd": 0, "3rd": 0 };
    mothers.forEach((m) => {
      groups[getTrimester(m.gaWeeks)]++;
    });
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
      if (!byBarangay[m.barangay]) {
        byBarangay[m.barangay] = { overdue: 0, dueSoon: 0, upcoming: 0, completed: 0 };
      }
      if (status === "overdue") byBarangay[m.barangay].overdue++;
      else if (status === "due_soon") byBarangay[m.barangay].dueSoon++;
      else if (status === "upcoming") byBarangay[m.barangay].upcoming++;
      else byBarangay[m.barangay].completed++;
    });
    return Object.entries(byBarangay)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [mothers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Heart className="w-6 h-6 text-primary" />
            Prenatal Dashboard
          </h1>
          <p className="text-muted-foreground">TT vaccination and maternal care overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm" data-testid="badge-coverage-rate">
            <TrendingUp className="w-3 h-3 mr-1" />
            {coverageRate}% Complete
          </Badge>
          {overdueRate > 10 && (
            <Badge variant="destructive" className="text-sm" data-testid="badge-overdue-alert">
              <AlertCircle className="w-3 h-3 mr-1" />
              {overdueRate}% Overdue
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Mothers" value={mothers.length} icon={Users} />
        <KpiCard title="Overdue" value={overdue} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon} icon={Heart} variant="warning" />
        <KpiCard title="Completed" value={completed} icon={CheckCircle} variant="success" />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <QuickActionCard
          title="View Worklist"
          subtitle={`${overdue + dueSoon} mothers need attention`}
          icon={List}
          onClick={() => navigate("/prenatal")}
          variant="primary"
        />
        <QuickActionCard
          title="Add New Mother"
          subtitle="Register a new prenatal patient"
          icon={Plus}
          onClick={() => navigate("/mother/new")}
        />
        <QuickActionCard
          title="Mother Registry"
          subtitle={`${mothers.length} mothers on file`}
          icon={BookOpen}
          onClick={() => navigate("/prenatal/registry")}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TT Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trimester Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trimesterData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="count" name="Mothers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Barangay Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            TT Status by Barangay
            <Badge variant="outline" className="font-normal">Top 10</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {barangayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barangayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Legend />
                <Bar dataKey="overdue" stackId="a" fill="hsl(0, 84%, 60%)" name="Overdue" />
                <Bar dataKey="dueSoon" stackId="a" fill="hsl(38, 92%, 50%)" name="Due Soon" />
                <Bar dataKey="upcoming" stackId="a" fill="hsl(199, 89%, 48%)" name="Upcoming" />
                <Bar dataKey="completed" stackId="a" fill="hsl(142, 76%, 36%)" name="Completed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground">
              No barangay data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
