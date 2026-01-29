import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { getNextVaccineStatus, isUnderweightRisk, getAgeInMonths } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Baby, Users, CheckCircle, AlertCircle, Scale, Plus, List, TrendingUp, Calendar, Syringe, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

function QuickActionCard({ 
  title, 
  subtitle, 
  icon: Icon, 
  onClick, 
  variant = "default" 
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
        variant === "primary" ? "border-blue-500/50" : ""
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
      data-testid={`quickaction-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          variant === "primary" ? "bg-blue-500/20" : "bg-muted"
        }`}>
          <Icon className={`w-5 h-5 ${
            variant === "primary" ? "text-blue-400" : "text-muted-foreground"
          }`} />
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

export default function ChildDashboard() {
  const [, navigate] = useLocation();
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const statuses = children.map(c => getNextVaccineStatus(c).status);
  const overdue = statuses.filter(s => s === 'overdue').length;
  const dueSoon = statuses.filter(s => s === 'due_soon').length;
  const upcoming = statuses.filter(s => s === 'upcoming').length;
  const completed = statuses.filter(s => s === 'completed').length;
  const underweight = children.filter(c => isUnderweightRisk(c)).length;

  const pieData = [
    { name: 'Overdue', value: overdue, color: 'hsl(0, 84%, 60%)' },
    { name: 'Due Soon', value: dueSoon, color: 'hsl(38, 92%, 50%)' },
    { name: 'Upcoming', value: upcoming, color: 'hsl(199, 89%, 48%)' },
    { name: 'Completed', value: completed, color: 'hsl(142, 76%, 36%)' }
  ].filter(d => d.value > 0);

  const ageGroups = useMemo(() => {
    const groups = { '0-6m': 0, '6-12m': 0, '1-2y': 0, '2-5y': 0, '5+y': 0 };
    children.forEach(c => {
      const months = getAgeInMonths(c.dob);
      if (months <= 6) groups['0-6m']++;
      else if (months <= 12) groups['6-12m']++;
      else if (months <= 24) groups['1-2y']++;
      else if (months <= 60) groups['2-5y']++;
      else groups['5+y']++;
    });
    return Object.entries(groups).map(([name, count]) => ({ name, count }));
  }, [children]);

  const barangayData = useMemo(() => {
    const byBarangay: Record<string, { overdue: number; dueSoon: number; upcoming: number; completed: number }> = {};
    children.forEach(c => {
      const status = getNextVaccineStatus(c).status;
      if (!byBarangay[c.barangay]) {
        byBarangay[c.barangay] = { overdue: 0, dueSoon: 0, upcoming: 0, completed: 0 };
      }
      if (status === 'overdue') byBarangay[c.barangay].overdue++;
      else if (status === 'due_soon') byBarangay[c.barangay].dueSoon++;
      else if (status === 'upcoming') byBarangay[c.barangay].upcoming++;
      else byBarangay[c.barangay].completed++;
    });
    return Object.entries(byBarangay)
      .map(([name, data]) => ({ name, ...data, total: data.overdue + data.dueSoon + data.upcoming + data.completed }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [children]);

  const coverageRate = children.length > 0 ? Math.round((completed / children.length) * 100) : 0;
  const overdueRate = children.length > 0 ? Math.round((overdue / children.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Baby className="w-6 h-6 text-blue-400" />
            Child Health Dashboard
          </h1>
          <p className="text-muted-foreground">Vaccination and growth overview</p>
        </div>
        <div className="flex gap-2">
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total Children" value={children.length} icon={Users} />
        <KpiCard title="Overdue" value={overdue} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon} icon={Baby} variant="warning" />
        <KpiCard title="Completed" value={completed} icon={CheckCircle} variant="success" />
        <KpiCard title="Underweight Risk" value={underweight} icon={Scale} variant={underweight > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard 
          title="View Worklist" 
          subtitle={`${overdue + dueSoon} children need vaccines`}
          icon={List}
          onClick={() => navigate('/child/worklist')}
          variant="primary"
        />
        <QuickActionCard 
          title="Add New Child" 
          subtitle="Register a new child"
          icon={Plus}
          onClick={() => navigate('/child/new')}
        />
        <QuickActionCard 
          title="Vaccination Schedule" 
          subtitle="View upcoming vaccines"
          icon={Calendar}
          onClick={() => navigate('/child/schedule')}
        />
        <QuickActionCard 
          title="Growth Monitoring" 
          subtitle={`${children.filter(c => (c.growth || []).length > 0).length} with measurements`}
          icon={TrendingUp}
          onClick={() => navigate('/growth-monitoring')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vaccination Status</CardTitle>
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No vaccination data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ageGroups}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Barangay Breakdown
            <Badge variant="outline" className="font-normal">Top 10</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {barangayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barangayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="overdue" stackId="a" fill="hsl(0, 84%, 60%)" name="Overdue" />
                <Bar dataKey="dueSoon" stackId="a" fill="hsl(38, 92%, 50%)" name="Due Soon" />
                <Bar dataKey="upcoming" stackId="a" fill="hsl(199, 89%, 48%)" name="Upcoming" />
                <Bar dataKey="completed" stackId="a" fill="hsl(142, 76%, 36%)" name="Completed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No barangay data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
