import { useQuery } from "@tanstack/react-query";
import type { InventoryItem } from "@shared/schema";
import { getStockStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

export default function InventoryPage() {
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });

  const stockOutBarangays = inventory.filter(inv => {
    const v = inv.vaccines as any;
    const h = (inv.htnMeds || []) as Array<{ name: string; doseMg: number; qty: number }>;
    const vaccineStockout = v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0 || v.hepBQty === 0 || v.mrQty === 0);
    const htnStockout = h.some(med => med.qty === 0);
    return vaccineStockout || htnStockout;
  }).length;

  const lowStockBarangays = inventory.filter(inv => {
    const v = inv.vaccines as any;
    return v && (v.bcgQty < 10 || v.pentaQty < 10 || v.opvQty < 10 || v.hepBQty < 10 || v.mrQty < 10);
  }).length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Package className="w-6 h-6 text-green-400" />
          Inventory - Availability & Surplus
        </h1>
        <p className="text-muted-foreground">Vaccine and HTN meds stock by barangay</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Barangays with Stock-outs" value={stockOutBarangays} icon={AlertCircle} variant={stockOutBarangays > 0 ? 'danger' : 'default'} />
        <KpiCard title="Low Stock Barangays" value={lowStockBarangays} icon={TrendingUp} variant={lowStockBarangays > 0 ? 'warning' : 'default'} />
        <KpiCard title="Total Barangays" value={inventory.length} icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccine Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-center py-2 px-3">BCG</th>
                  <th className="text-center py-2 px-3">Penta</th>
                  <th className="text-center py-2 px-3">OPV</th>
                  <th className="text-center py-2 px-3">HepB</th>
                  <th className="text-center py-2 px-3">MR</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(inv => {
                  const v = (inv.vaccines || {}) as any;
                  return (
                    <tr key={inv.id} className="border-b border-border/50" data-testid={`row-inv-${inv.id}`}>
                      <td className="py-3 px-3 font-medium">{inv.barangay}</td>
                      <td className="text-center py-3 px-3">
                        <StatusBadge status={getStockStatus(v.bcgQty || 0, 10, 50)} label={`${v.bcgQty || 0}`} />
                      </td>
                      <td className="text-center py-3 px-3">
                        <StatusBadge status={getStockStatus(v.pentaQty || 0, 10, 50)} label={`${v.pentaQty || 0}`} />
                      </td>
                      <td className="text-center py-3 px-3">
                        <StatusBadge status={getStockStatus(v.opvQty || 0, 10, 50)} label={`${v.opvQty || 0}`} />
                      </td>
                      <td className="text-center py-3 px-3">
                        <StatusBadge status={getStockStatus(v.hepBQty || 0, 10, 50)} label={`${v.hepBQty || 0}`} />
                      </td>
                      <td className="text-center py-3 px-3">
                        <StatusBadge status={getStockStatus(v.mrQty || 0, 10, 50)} label={`${v.mrQty || 0}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">HTN Medication Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Medications</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(inv => {
                  const h = (inv.htnMeds || []) as Array<{ name: string; doseMg: number; qty: number }>;
                  return (
                    <tr key={inv.id} className="border-b border-border/50">
                      <td className="py-3 px-3 font-medium">{inv.barangay}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-2">
                          {h.length === 0 && <span className="text-muted-foreground">None</span>}
                          {h.map((med, idx) => (
                            <StatusBadge 
                              key={idx} 
                              status={getStockStatus(med.qty, 20, 100)} 
                              label={`${med.name} ${med.doseMg}mg: ${med.qty}`} 
                            />
                          ))}
                        </div>
                      </td>
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
