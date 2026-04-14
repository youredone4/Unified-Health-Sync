import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Senior } from "@shared/schema";
import { getSeniorPickupStatus, isMedsReadyForPickup, formatDate } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertCircle, Clock, Pill, Users, Check, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useBarangay } from "@/contexts/barangay-context";

export default function SeniorWorklist() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: seniors = [], isLoading } = useQuery<Senior[]>({ queryKey: [scopedPath('/api/seniors')] });
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('senior-tab') || 'overdue');
  const [search, setSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('senior-tab', activeTab);
  }, [activeTab]);

  const seniorsWithStatus = seniors.map(s => ({
    ...s,
    pickupStatus: getSeniorPickupStatus(s),
    medsReady: isMedsReadyForPickup(s)
  }));

  const overdue = seniorsWithStatus.filter(s => s.pickupStatus.status === 'overdue');
  const dueSoon = seniorsWithStatus.filter(s => s.pickupStatus.status === 'due_soon');
  const medsReady = seniorsWithStatus.filter(s => s.medsReady);

  const getBaseFilteredSeniors = () => {
    if (activeTab === 'overdue') return overdue;
    if (activeTab === 'due_soon') return dueSoon;
    if (activeTab === 'ready') return medsReady;
    return seniorsWithStatus;
  };

  const filteredSeniors = getBaseFilteredSeniors().filter(s =>
    search === '' ||
    `${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (s.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredSeniors);

  useEffect(() => { pagination.resetPage(); }, [activeTab, search]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Pill className="w-6 h-6 text-purple-400" />
          HTN Meds Pickup
        </h1>
        <p className="text-muted-foreground">Senior care worklist - Medication pickup</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="Overdue" value={overdue.length} icon={AlertCircle} variant="danger" active={activeTab === 'overdue'} onClick={() => setActiveTab(activeTab === 'overdue' ? 'all' : 'overdue')} />
        <KpiCard title="Due Soon" value={dueSoon.length} icon={Clock} variant="warning" active={activeTab === 'due_soon'} onClick={() => setActiveTab(activeTab === 'due_soon' ? 'all' : 'due_soon')} />
        <KpiCard title="Meds Ready" value={medsReady.length} icon={Check} variant="success" active={activeTab === 'ready'} onClick={() => setActiveTab(activeTab === 'ready' ? 'all' : 'ready')} />
        <KpiCard title="Total Seniors" value={seniors.length} icon={Users} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
      </div>

      <Card>
        <CardHeader className="pb-0 space-y-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overdue" data-testid="tab-overdue">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="due_soon" data-testid="tab-due-soon">Due Soon ({dueSoon.length})</TabsTrigger>
              <TabsTrigger value="ready" data-testid="tab-ready">Meds Ready ({medsReady.length})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All ({seniors.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search senior or barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Senior</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Meds Ready?</th>
                  <th className="text-left py-2 px-3">Next Pickup</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSeniors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No items in this list
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/senior/${s.id}`)}
                    className="border-b border-border/50 cursor-pointer hover-elevate"
                    data-testid={`row-senior-${s.id}`}
                  >
                    <td className="py-3 px-3">
                      <div>
                        <p className="font-medium">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground">{s.phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">{s.barangay}</td>
                    <td className="py-3 px-3">
                      {s.medsReady ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3">{formatDate(s.nextPickupDate)}</td>
                    <td className="py-3 px-3"><StatusBadge status={s.pickupStatus.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>
    </div>
  );
}
