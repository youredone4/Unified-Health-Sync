import { useQuery } from "@tanstack/react-query";
import type { Mother, Child, Senior, InventoryItem } from "@shared/schema";
import { getTTStatus, getNextVaccineStatus, getSeniorPickupStatus, isUnderweightRisk } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer } from "lucide-react";
import { useBarangay } from "@/contexts/barangay-context";

export default function ReportsPage() {
  const { scopedPath } = useBarangay();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath('/api/mothers')] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath('/api/children')] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath('/api/seniors')] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });

  const reports = [
    {
      title: 'TT Overdue Report',
      description: 'List of mothers with overdue TT vaccinations',
      count: mothers.filter(m => getTTStatus(m).status === 'overdue').length
    },
    {
      title: 'Vaccine Overdue Report',
      description: 'List of children with overdue vaccines',
      count: children.filter(c => getNextVaccineStatus(c).status === 'overdue').length
    },
    {
      title: 'Underweight Children Report',
      description: 'List of children flagged as underweight risk',
      count: children.filter(c => isUnderweightRisk(c)).length
    },
    {
      title: 'Senior Meds Pickup Report',
      description: 'Seniors with pending medication pickups',
      count: seniors.filter(s => getSeniorPickupStatus(s).status !== 'upcoming').length
    },
    {
      title: 'Stock-out Report',
      description: 'Barangays with zero stock on any item',
      count: inventory.filter(inv => {
        const v = inv.vaccines as any;
        return v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0);
      }).length
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <FileText className="w-6 h-6 text-blue-400" />
          Reports
        </h1>
        <p className="text-muted-foreground">Generate and export reports</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {reports.map((report, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="text-base">{report.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
              <p className="text-2xl font-bold mb-4">{report.count} items</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1" data-testid={`button-export-${idx}`}>
                  <Download className="w-3 h-3" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" className="gap-1" data-testid={`button-print-${idx}`}>
                  <Printer className="w-3 h-3" /> Print
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is a demo version. Export and print functionality would connect to a reporting service in production.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
