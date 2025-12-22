import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TBPatient } from "@shared/schema";
import { getTBDotsVisitStatus, getTBOverallStatus, getTBMissedDoseRisk, formatDate, getTreatmentProgress } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, Users, AlertTriangle, Pill } from "lucide-react";
import { useState, useEffect } from "react";

export default function TBWorklist() {
  const [, navigate] = useLocation();
  const { data: patients = [], isLoading } = useQuery<TBPatient[]>({ queryKey: ['/api/tb-patients'] });
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('tb-tab') || 'overdue');

  useEffect(() => {
    localStorage.setItem('tb-tab', activeTab);
  }, [activeTab]);

  const patientsWithStatus = patients.map(p => ({
    ...p,
    visitStatus: getTBDotsVisitStatus(p),
    overallStatus: getTBOverallStatus(p),
    atRisk: getTBMissedDoseRisk(p),
    progress: getTreatmentProgress(p)
  }));

  const overdue = patientsWithStatus.filter(p => p.visitStatus.status === 'overdue');
  const dueToday = patientsWithStatus.filter(p => p.visitStatus.status === 'due_today');
  const atRisk = patientsWithStatus.filter(p => p.atRisk || p.referralToRHU);
  const activePatients = patientsWithStatus.filter(p => p.outcomeStatus === 'Ongoing');

  const getFilteredPatients = () => {
    if (activeTab === 'overdue') return overdue;
    if (activeTab === 'due_today') return dueToday;
    if (activeTab === 'at_risk') return atRisk;
    return activePatients;
  };

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'overdue':
      case 'at_risk': return 'destructive';
      case 'due_today':
      case 'due_soon': return 'secondary';
      default: return 'outline';
    }
  };

  const renderRow = (p: typeof patientsWithStatus[0]) => (
    <tr 
      key={p.id} 
      onClick={() => navigate(`/tb/${p.id}`)}
      className="border-b border-border/50 cursor-pointer hover-elevate"
      data-testid={`row-tb-${p.id}`}
    >
      <td className="py-3 px-3">
        <div>
          <p className="font-medium">{p.firstName} {p.lastName}</p>
          <p className="text-xs text-muted-foreground">{p.phone}</p>
        </div>
      </td>
      <td className="py-3 px-3">{p.barangay}</td>
      <td className="py-3 px-3">
        <Badge variant="outline">{p.treatmentPhase}</Badge>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <Progress value={p.progress} className="w-16 h-2" />
          <span className="text-xs text-muted-foreground">{Math.round(p.progress)}%</span>
        </div>
      </td>
      <td className="py-3 px-3">{formatDate(p.nextDotsVisitDate)}</td>
      <td className="py-3 px-3">
        {(p.missedDosesCount || 0) > 0 && (
          <span className={`text-sm ${(p.missedDosesCount || 0) >= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {p.missedDosesCount} missed
          </span>
        )}
      </td>
      <td className="py-3 px-3">
        <Badge variant={getStatusVariant(p.overallStatus)}>
          {p.overallStatus === 'due_today' ? 'Due Today' : 
           p.overallStatus === 'at_risk' ? 'At Risk' :
           p.overallStatus === 'overdue' ? 'Overdue' :
           p.overallStatus === 'due_soon' ? 'Due Soon' : 'On Track'}
        </Badge>
      </td>
    </tr>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Pill className="w-6 h-6 text-purple-500" />
          TB DOTS Worklist
        </h1>
        <p className="text-muted-foreground">Directly Observed Treatment, Short-course (DOTS) monitoring</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="Missed Visit" value={overdue.length} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Today" value={dueToday.length} icon={Clock} variant="warning" />
        <KpiCard title="At Risk" value={atRisk.length} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Active Patients" value={activePatients.length} icon={Users} />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Missed ({overdue.length})</TabsTrigger>
              <TabsTrigger value="due_today" data-testid="tab-due-today">Due Today ({dueToday.length})</TabsTrigger>
              <TabsTrigger value="at_risk" data-testid="tab-at-risk">At Risk ({atRisk.length})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All Active ({activePatients.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Patient</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Phase</th>
                  <th className="text-left py-2 px-3">Progress</th>
                  <th className="text-left py-2 px-3">Next DOTS</th>
                  <th className="text-left py-2 px-3">Missed Doses</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredPatients().length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No patients in this list
                    </td>
                  </tr>
                )}
                {getFilteredPatients().map(renderRow)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
