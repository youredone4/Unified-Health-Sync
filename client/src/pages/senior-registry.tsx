import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import type { Senior } from "@shared/schema";
import { formatDate } from "@/lib/healthLogic";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, Plus, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import SeniorImportDialog from "@/components/senior-import-dialog";
import { useAuth, permissions } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

export default function SeniorRegistry() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: seniors = [], isLoading } = useQuery<Senior[]>({ queryKey: [scopedPath('/api/seniors')] });
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const canImport = user ? permissions.canImportReports(user.role) : false;

  const filtered = seniors.filter(s =>
    `${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (s.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filtered);

  useEffect(() => { pagination.resetPage(); }, [search]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Users className="w-6 h-6" />
            Senior Registry
          </h1>
          <p className="text-muted-foreground">All registered seniors</p>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-seniors">
              <Upload className="w-4 h-4 mr-2" />
              Import AMOS Log
            </Button>
          )}
          <Link href="/senior/new">
            <Button data-testid="button-add-senior">
              <Plus className="w-4 h-4 mr-2" />
              Add New Senior
            </Button>
          </Link>
        </div>
      </div>

      <SeniorImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or barangay..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Sex</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Phone</th>
                  <th className="text-left py-2 px-3">Last BP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">No seniors found</td>
                  </tr>
                )}
                {pagination.pagedItems.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/senior/${s.id}`)}
                    className="border-b border-border/50 cursor-pointer hover-elevate"
                    data-testid={`row-senior-${s.id}`}
                  >
                    <td className="py-3 px-3 font-medium">{s.firstName} {s.lastName}</td>
                    <td className="py-3 px-3">{s.age}</td>
                    <td className="py-3 px-3">{s.sex === "M" ? "Male" : s.sex === "F" ? "Female" : "-"}</td>
                    <td className="py-3 px-3">{s.barangay}</td>
                    <td className="py-3 px-3">{s.phone || '-'}</td>
                    <td className="py-3 px-3">{s.lastBP || '-'}</td>
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
