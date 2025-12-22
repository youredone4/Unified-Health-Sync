import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, Heart, Users } from "lucide-react";
import { useState, useEffect } from "react";

export default function PrenatalWorklist() {
  const [, navigate] = useLocation();
  const { data: mothers = [], isLoading } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('prenatal-tab') || 'overdue');

  useEffect(() => {
    localStorage.setItem('prenatal-tab', activeTab);
  }, [activeTab]);

  const mothersWithStatus = mothers.map(m => ({
    ...m,
    ttStatus: getTTStatus(m),
    pcStatus: getPrenatalCheckStatus(m)
  }));

  const overdue = mothersWithStatus.filter(m => m.ttStatus.status === 'overdue' || m.pcStatus.status === 'overdue');
  const dueSoon = mothersWithStatus.filter(m => 
    (m.ttStatus.status === 'due_soon' || m.pcStatus.status === 'due_soon') &&
    m.ttStatus.status !== 'overdue' && m.pcStatus.status !== 'overdue'
  );

  const getFilteredMothers = () => {
    if (activeTab === 'overdue') return overdue;
    if (activeTab === 'due_soon') return dueSoon;
    return mothersWithStatus;
  };

  const renderRow = (m: typeof mothersWithStatus[0]) => {
    const neededActions = [];
    if (m.ttStatus.status !== 'completed') neededActions.push(m.ttStatus.nextShotLabel);
    if (m.nextPrenatalCheckDate) neededActions.push('Prenatal Check');

    const worstStatus = m.ttStatus.status === 'overdue' || m.pcStatus.status === 'overdue' ? 'overdue' :
                        m.ttStatus.status === 'due_soon' || m.pcStatus.status === 'due_soon' ? 'due_soon' : 'upcoming';

    return (
      <tr 
        key={m.id} 
        onClick={() => navigate(`/mother/${m.id}`)}
        className="border-b border-border/50 cursor-pointer hover-elevate"
        data-testid={`row-mother-${m.id}`}
      >
        <td className="py-3 px-3">
          <div>
            <p className="font-medium">{m.firstName} {m.lastName}</p>
            <p className="text-xs text-muted-foreground">{m.phone}</p>
          </div>
        </td>
        <td className="py-3 px-3">{m.barangay}</td>
        <td className="py-3 px-3">
          <p className="text-sm">{neededActions.join(', ') || 'None'}</p>
        </td>
        <td className="py-3 px-3">
          {m.ttStatus.dueDate ? formatDate(m.ttStatus.dueDate) : formatDate(m.nextPrenatalCheckDate)}
        </td>
        <td className="py-3 px-3">
          <StatusBadge status={worstStatus} />
        </td>
      </tr>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Heart className="w-6 h-6 text-red-400" />
          TT Reminders
        </h1>
        <p className="text-muted-foreground">Prenatal worklist - Tetanus shots and check-ups</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Overdue" value={overdue.length} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon.length} icon={Clock} variant="warning" />
        <KpiCard title="Total Mothers" value={mothers.length} icon={Users} />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="due_soon" data-testid="tab-due-soon">Due Soon ({dueSoon.length})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All ({mothers.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Mother</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">What is Needed</th>
                  <th className="text-left py-2 px-3">Due Date</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredMothers().length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No items in this list
                    </td>
                  </tr>
                )}
                {getFilteredMothers().map(renderRow)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
