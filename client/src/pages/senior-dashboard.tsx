import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Senior } from "@shared/schema";
import { getSeniorPickupStatus, isMedsReadyForPickup } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, Users, CheckCircle, AlertCircle, Plus, List, Heart, ArrowRight, Activity, TrendingUp } from "lucide-react";
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
        variant === "primary" ? "border-green-500/50" : ""
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
          variant === "primary" ? "bg-green-500/20" : "bg-muted"
        }`}>
          <Icon className={`w-5 h-5 ${
            variant === "primary" ? "text-green-400" : "text-muted-foreground"
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

export default function SeniorDashboard() {
  const [, navigate] = useLocation();
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });

  const statuses = seniors.map(s => getSeniorPickupStatus(s).status);
  const overdue = statuses.filter(s => s === 'overdue').length;
  const dueSoon = statuses.filter(s => s === 'due_soon').length;
  const upcoming = statuses.filter(s => s === 'upcoming').length;
  const medsReady = seniors.filter(s => isMedsReadyForPickup(s)).length;
  
  const parseBP = (bp: string | null): { systolic: number; diastolic: number } | null => {
    if (!bp) return null;
    const match = bp.match(/(\d+)\/(\d+)/);
    if (!match) return null;
    return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) };
  };
  
  const highBP = seniors.filter(s => {
    const bp = parseBP(s.lastBP);
    if (!bp) return false;
    return bp.systolic >= 140 || bp.diastolic >= 90;
  }).length;

  const pieData = [
    { name: 'Overdue', value: overdue, color: 'hsl(0, 84%, 60%)' },
    { name: 'Due Soon', value: dueSoon, color: 'hsl(38, 92%, 50%)' },
    { name: 'Upcoming', value: upcoming, color: 'hsl(199, 89%, 48%)' }
  ].filter(d => d.value > 0);

  const barangayData = useMemo(() => {
    const byBarangay: Record<string, { overdue: number; dueSoon: number; upcoming: number }> = {};
    seniors.forEach(s => {
      const status = getSeniorPickupStatus(s).status;
      if (!byBarangay[s.barangay]) {
        byBarangay[s.barangay] = { overdue: 0, dueSoon: 0, upcoming: 0 };
      }
      if (status === 'overdue') byBarangay[s.barangay].overdue++;
      else if (status === 'due_soon') byBarangay[s.barangay].dueSoon++;
      else byBarangay[s.barangay].upcoming++;
    });
    return Object.entries(byBarangay)
      .map(([name, data]) => ({ name, ...data, total: data.overdue + data.dueSoon + data.upcoming }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [seniors]);

  const bpDistribution = useMemo(() => {
    const groups = { 'Normal': 0, 'Elevated': 0, 'Stage 1': 0, 'Stage 2': 0, 'No Reading': 0 };
    seniors.forEach(s => {
      const bp = parseBP(s.lastBP);
      if (!bp) {
        groups['No Reading']++;
      } else if (bp.systolic < 120 && bp.diastolic < 80) {
        groups['Normal']++;
      } else if (bp.systolic < 130 && bp.diastolic < 80) {
        groups['Elevated']++;
      } else if (bp.systolic < 140 || bp.diastolic < 90) {
        groups['Stage 1']++;
      } else {
        groups['Stage 2']++;
      }
    });
    return [
      { name: 'Normal', count: groups['Normal'], color: 'hsl(142, 76%, 36%)' },
      { name: 'Elevated', count: groups['Elevated'], color: 'hsl(199, 89%, 48%)' },
      { name: 'Stage 1', count: groups['Stage 1'], color: 'hsl(38, 92%, 50%)' },
      { name: 'Stage 2', count: groups['Stage 2'], color: 'hsl(0, 84%, 60%)' }
    ].filter(d => d.count > 0);
  }, [seniors]);

  const complianceRate = seniors.length > 0 ? Math.round(((seniors.length - overdue) / seniors.length) * 100) : 0;
  const overdueRate = seniors.length > 0 ? Math.round((overdue / seniors.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Heart className="w-6 h-6 text-green-400" />
            Senior Care Dashboard
          </h1>
          <p className="text-muted-foreground">HTN medication pickup overview</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-sm" data-testid="badge-compliance-rate">
            <TrendingUp className="w-3 h-3 mr-1" />
            {complianceRate}% Compliant
          </Badge>
          {highBP > 0 && (
            <Badge variant="destructive" className="text-sm" data-testid="badge-high-bp-alert">
              <Activity className="w-3 h-3 mr-1" />
              {highBP} High BP
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total Seniors" value={seniors.length} icon={Users} />
        <KpiCard title="Overdue" value={overdue} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon} icon={Pill} variant="warning" />
        <KpiCard title="Meds Ready" value={medsReady} icon={CheckCircle} variant="success" />
        <KpiCard title="High BP" value={highBP} icon={Activity} variant={highBP > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard 
          title="View Worklist" 
          subtitle={`${overdue + dueSoon} need medication pickup`}
          icon={List}
          onClick={() => navigate('/senior/worklist')}
          variant="primary"
        />
        <QuickActionCard 
          title="Add New Senior" 
          subtitle="Register a new senior"
          icon={Plus}
          onClick={() => navigate('/senior/new')}
        />
        <QuickActionCard 
          title="View Registry" 
          subtitle={`${seniors.length} seniors registered`}
          icon={Users}
          onClick={() => navigate('/senior/registry')}
        />
        <QuickActionCard 
          title="Pickup Calendar" 
          subtitle="View scheduled pickups"
          icon={Pill}
          onClick={() => navigate('/pickup-schedule')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medication Pickup Status</CardTitle>
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
                No pickup data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blood Pressure Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {bpDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bpDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {bpDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No blood pressure data available
              </div>
            )}
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
                <Bar dataKey="upcoming" stackId="a" fill="hsl(199, 89%, 48%)" name="Upcoming" radius={[0, 4, 4, 0]} />
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
