import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import type { TBPatient } from "@shared/schema";
import { formatDate, getTreatmentProgress } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

export default function TBRegistry() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: patients = [], isLoading } = useQuery<TBPatient[]>({ queryKey: [scopedPath('/api/tb-patients')] });
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");

  // `.filter(Boolean)` drops empty/null barangays — Radix Select throws if a
  // <SelectItem> receives value="".
  const barangays = Array.from(new Set(patients.map(p => p.barangay).filter(Boolean) as string[]));

  const filteredPatients = patients.filter(p => {
    const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesPhase = phaseFilter === 'all' || p.treatmentPhase === phaseFilter;
    const matchesBarangay = barangayFilter === 'all' || p.barangay === barangayFilter;
    return matchesSearch && matchesPhase && matchesBarangay;
  });

  const pagination = usePagination(filteredPatients);

  useEffect(() => { pagination.resetPage(); }, [search, phaseFilter, barangayFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardList className="w-6 h-6 text-purple-500" />
            TB Patient Registry
          </h1>
          <p className="text-muted-foreground">All TB DOTS patients</p>
        </div>
        <Link href="/tb/new">
          <Button data-testid="button-add-tb">
            <Plus className="w-4 h-4 mr-2" />
            Add New TB Patient
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-phase">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="Intensive">Intensive</SelectItem>
                <SelectItem value="Continuation">Continuation</SelectItem>
              </SelectContent>
            </Select>
            {!isTL && (
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-barangay">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {barangays.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Patient</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">TB Type</th>
                  <th className="text-left py-2 px-3">Phase</th>
                  <th className="text-left py-2 px-3">Progress</th>
                  <th className="text-left py-2 px-3">Missed</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No patients found
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(p => {
                  const progress = getTreatmentProgress(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/tb/${p.id}`)}
                      className="border-b border-border/50 cursor-pointer hover-elevate"
                      data-testid={`row-tb-${p.id}`}
                    >
                      <td className="py-3 px-3 font-medium">{p.firstName} {p.lastName}</td>
                      <td className="py-3 px-3">{p.age}</td>
                      <td className="py-3 px-3">{p.barangay}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline">{p.tbType}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={p.treatmentPhase === 'Intensive' ? 'secondary' : 'default'}>
                          {p.treatmentPhase}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="w-16 h-2" />
                          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={(p.missedDosesCount || 0) >= 3 ? 'text-destructive font-medium' : ''}>
                          {p.missedDosesCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={p.outcomeStatus === 'Ongoing' ? 'outline' : 'default'}>
                          {p.outcomeStatus}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>
    </div>
  );
}
