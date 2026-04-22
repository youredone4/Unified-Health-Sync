import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

export default function DiseaseRegistry() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: cases = [], isLoading } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath('/api/disease-cases')] });
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  // Initialise barangay filter from the ?barangay= query param if present so
  // deep links from the outbreak map land on a pre-filtered registry view.
  const [barangayFilter, setBarangayFilter] = useState(() => {
    if (typeof window === "undefined") return "all";
    const param = new URLSearchParams(window.location.search).get("barangay");
    return param && param.trim() ? param : "all";
  });

  const conditions = Array.from(new Set(cases.map(c => c.condition)));
  const barangays = Array.from(new Set(cases.map(c => c.barangay)));

  const filteredCases = cases.filter(c => {
    const matchesSearch = (c.patientName ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCondition = conditionFilter === 'all' || c.condition === conditionFilter;
    const matchesBarangay = barangayFilter === 'all' || c.barangay === barangayFilter;
    return matchesSearch && matchesCondition && matchesBarangay;
  });

  const pagination = usePagination(filteredCases);

  useEffect(() => { pagination.resetPage(); }, [search, conditionFilter, barangayFilter]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'New': return 'destructive';
      case 'Monitoring': return 'secondary';
      case 'Referred': return 'outline';
      default: return 'default';
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardList className="w-6 h-6 text-orange-500" />
            Disease Case Registry
          </h1>
          <p className="text-muted-foreground">All reported disease cases</p>
        </div>
        <Link href="/disease/new">
          <Button data-testid="button-add-case">
            <Plus className="w-4 h-4 mr-2" />
            Add New Case
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
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-condition">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                {conditions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
                  <th className="text-left py-2 px-3">Condition</th>
                  <th className="text-left py-2 px-3">Date Reported</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No cases found
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/disease/${c.id}`)}
                    className="border-b border-border/50 cursor-pointer hover-elevate"
                    data-testid={`row-disease-${c.id}`}
                  >
                    <td className="py-3 px-3 font-medium">{c.patientName}</td>
                    <td className="py-3 px-3">{c.age}</td>
                    <td className="py-3 px-3">{c.barangay}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline">{c.condition}</Badge>
                    </td>
                    <td className="py-3 px-3">{formatDate(c.dateReported)}</td>
                    <td className="py-3 px-3">
                      <Badge variant={getStatusVariant(c.status || 'New')}>{c.status}</Badge>
                    </td>
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
