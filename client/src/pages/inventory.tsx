import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { InventoryItem, MedicineInventoryItem } from "@shared/schema";
import { getStockStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle, CheckCircle, TrendingUp, Plus, Pill } from "lucide-react";
import { formatDate } from "@/lib/healthLogic";

export default function InventoryPage() {
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const { data: medicines = [], isLoading: medLoading } = useQuery<MedicineInventoryItem[]>({ queryKey: ['/api/medicine-inventory'] });

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

  const isExpiringSoon = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 90;
  };

  const isExpired = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (isLoading || medLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Package className="w-6 h-6 text-green-400" />
            Inventory - Availability & Surplus
          </h1>
          <p className="text-muted-foreground">Vaccine, HTN meds, and medicine stock by barangay</p>
        </div>
        <Link href="/inventory/new">
          <Button data-testid="button-add-inventory">
            <Plus className="w-4 h-4 mr-2" />
            Add Inventory
          </Button>
        </Link>
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
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="text-no-vaccine-records">
                      No inventory records found. Use "Add Inventory" to add stock for a barangay.
                    </td>
                  </tr>
                ) : inventory.map(inv => {
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
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-8 text-muted-foreground" data-testid="text-no-htn-records">
                      No inventory records found. Use "Add Inventory" to add stock for a barangay.
                    </td>
                  </tr>
                ) : inventory.map(inv => {
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-400" />
            Medicine & Other Supply
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Medicine</th>
                  <th className="text-left py-2 px-3">Strength</th>
                  <th className="text-left py-2 px-3">Unit</th>
                  <th className="text-center py-2 px-3">Qty</th>
                  <th className="text-left py-2 px-3">Expiry</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground" data-testid="text-no-medicine-records">
                      No medicine records found. Use "Add Inventory" and select "Medicine / Other Supply" to add records.
                    </td>
                  </tr>
                ) : medicines.map(med => (
                  <tr key={med.id} className="border-b border-border/50" data-testid={`row-med-${med.id}`}>
                    <td className="py-3 px-3 font-medium">{med.barangay}</td>
                    <td className="py-3 px-3">{med.medicineName}</td>
                    <td className="py-3 px-3 text-muted-foreground">{med.strength || '—'}</td>
                    <td className="py-3 px-3 text-muted-foreground">{med.unit || '—'}</td>
                    <td className="text-center py-3 px-3">
                      <StatusBadge status={getStockStatus(med.qty, med.lowStockThreshold || 10, 200)} label={`${med.qty}`} />
                    </td>
                    <td className="py-3 px-3">
                      {med.expirationDate ? (
                        <Badge variant="outline" className={
                          isExpired(med.expirationDate)
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : isExpiringSoon(med.expirationDate)
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                            : "bg-green-500/20 text-green-400 border-green-500/30"
                        }>
                          {isExpired(med.expirationDate) ? "EXPIRED" : isExpiringSoon(med.expirationDate) ? "Expiring Soon" : ""} {formatDate(med.expirationDate)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {med.category ? (
                        <Badge variant="outline" className="text-xs">{med.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <Link href={`/inventory/medicine/${med.id}/edit`}>
                        <Button variant="ghost" size="sm" data-testid={`button-edit-med-${med.id}`}>Edit</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
