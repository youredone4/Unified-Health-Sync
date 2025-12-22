import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child, Mother } from "@shared/schema";
import { getNextVaccineStatus, getChildVisitStatus, formatDate } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, Baby, Users } from "lucide-react";
import { useState, useEffect } from "react";

export default function ChildWorklist() {
  const [, navigate] = useLocation();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('child-tab') || 'overdue');

  useEffect(() => {
    localStorage.setItem('child-tab', activeTab);
  }, [activeTab]);

  const getMother = (motherId: number | null) => mothers.find(m => m.id === motherId);

  const childrenWithStatus = children.map(c => ({
    ...c,
    vaxStatus: getNextVaccineStatus(c),
    visitStatus: getChildVisitStatus(c),
    mother: getMother(c.motherId)
  }));

  const overdue = childrenWithStatus.filter(c => c.vaxStatus.status === 'overdue' || c.visitStatus.status === 'overdue');
  const dueSoon = childrenWithStatus.filter(c => 
    (c.vaxStatus.status === 'due_soon' || c.visitStatus.status === 'due_soon') &&
    c.vaxStatus.status !== 'overdue' && c.visitStatus.status !== 'overdue'
  );

  const getFilteredChildren = () => {
    if (activeTab === 'overdue') return overdue;
    if (activeTab === 'due_soon') return dueSoon;
    return childrenWithStatus;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Baby className="w-6 h-6 text-blue-400" />
          Vaccination Schedule
        </h1>
        <p className="text-muted-foreground">Child health worklist - Vaccines and visits</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Overdue" value={overdue.length} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon.length} icon={Clock} variant="warning" />
        <KpiCard title="Total Children" value={children.length} icon={Users} />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="due_soon" data-testid="tab-due-soon">Due Soon ({dueSoon.length})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All ({children.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Child</th>
                  <th className="text-left py-2 px-3">Mother</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Next Vaccine</th>
                  <th className="text-left py-2 px-3">Next Visit</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredChildren().length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No items in this list
                    </td>
                  </tr>
                )}
                {getFilteredChildren().map(c => {
                  const worstStatus = c.vaxStatus.status === 'overdue' || c.visitStatus.status === 'overdue' ? 'overdue' :
                                      c.vaxStatus.status === 'due_soon' || c.visitStatus.status === 'due_soon' ? 'due_soon' : 'upcoming';
                  return (
                    <tr 
                      key={c.id}
                      onClick={() => navigate(`/child/${c.id}`)}
                      className="border-b border-border/50 cursor-pointer hover-elevate"
                      data-testid={`row-child-${c.id}`}
                    >
                      <td className="py-3 px-3 font-medium">{c.name}</td>
                      <td className="py-3 px-3">{c.mother ? `${c.mother.firstName} ${c.mother.lastName}` : '-'}</td>
                      <td className="py-3 px-3">{c.barangay}</td>
                      <td className="py-3 px-3">{c.vaxStatus.nextVaccineLabel}</td>
                      <td className="py-3 px-3">{formatDate(c.nextVisitDate)}</td>
                      <td className="py-3 px-3"><StatusBadge status={worstStatus} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
