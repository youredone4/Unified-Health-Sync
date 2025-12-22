import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { getDiseaseStatus, getDaysSinceReported, isOutbreakCondition, formatDate } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Eye, Activity, AlertTriangle, Siren } from "lucide-react";
import { useState, useEffect } from "react";

export default function DiseaseWorklist() {
  const [, navigate] = useLocation();
  const { data: cases = [], isLoading } = useQuery<DiseaseCase[]>({ queryKey: ['/api/disease-cases'] });
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('disease-tab') || 'new');

  useEffect(() => {
    localStorage.setItem('disease-tab', activeTab);
  }, [activeTab]);

  const casesWithStatus = cases.map(c => ({
    ...c,
    diseaseStatus: getDiseaseStatus(c),
    daysSince: getDaysSinceReported(c)
  }));

  const newCases = casesWithStatus.filter(c => c.diseaseStatus === 'new');
  const monitoringCases = casesWithStatus.filter(c => c.diseaseStatus === 'monitoring');
  const activeCases = casesWithStatus.filter(c => c.diseaseStatus !== 'closed');

  const outbreak = isOutbreakCondition(cases);

  const getFilteredCases = () => {
    if (activeTab === 'new') return newCases;
    if (activeTab === 'monitoring') return monitoringCases;
    return activeCases;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'New': return 'destructive';
      case 'Monitoring': return 'secondary';
      case 'Referred': return 'outline';
      default: return 'default';
    }
  };

  const renderRow = (c: typeof casesWithStatus[0]) => (
    <tr 
      key={c.id} 
      onClick={() => navigate(`/disease/${c.id}`)}
      className="border-b border-border/50 cursor-pointer hover-elevate"
      data-testid={`row-disease-${c.id}`}
    >
      <td className="py-3 px-3">
        <div>
          <p className="font-medium">{c.patientName}</p>
          <p className="text-xs text-muted-foreground">Age {c.age}</p>
        </div>
      </td>
      <td className="py-3 px-3">{c.barangay}</td>
      <td className="py-3 px-3">
        <Badge variant="outline" className="font-normal">{c.condition}</Badge>
      </td>
      <td className="py-3 px-3">{formatDate(c.dateReported)}</td>
      <td className="py-3 px-3 text-muted-foreground">{c.daysSince} day{c.daysSince !== 1 ? 's' : ''} ago</td>
      <td className="py-3 px-3">
        <Badge variant={getStatusVariant(c.status || 'New')}>{c.status}</Badge>
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
          <Siren className="w-6 h-6 text-orange-500" />
          Disease Surveillance
        </h1>
        <p className="text-muted-foreground">Track and manage communicable disease cases</p>
      </div>

      {outbreak.isOutbreak && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Outbreak Alert: {outbreak.condition}</p>
                <p className="text-sm text-muted-foreground">{outbreak.count} cases reported in the last 14 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="New Cases" value={newCases.length} icon={AlertCircle} variant="danger" />
        <KpiCard title="Monitoring" value={monitoringCases.length} icon={Eye} variant="warning" />
        <KpiCard title="Active Total" value={activeCases.length} icon={Activity} />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="new" data-testid="tab-new">New ({newCases.length})</TabsTrigger>
              <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoring ({monitoringCases.length})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All Active ({activeCases.length})</TabsTrigger>
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
                  <th className="text-left py-2 px-3">Condition</th>
                  <th className="text-left py-2 px-3">Date Reported</th>
                  <th className="text-left py-2 px-3">Duration</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredCases().length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No cases in this list
                    </td>
                  </tr>
                )}
                {getFilteredCases().map(renderRow)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
