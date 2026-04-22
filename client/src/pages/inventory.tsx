import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { InventoryItem, MedicineInventoryItem } from "@shared/schema";
import { getStockStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, AlertCircle, CheckCircle, TrendingUp, Plus, Pill, BarChart2 } from "lucide-react";
import { formatDate } from "@/lib/healthLogic";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  type TooltipProps,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

type VaccineShape = {
  bcgQty: number;
  hepBQty: number;
  pentaQty: number;
  opvQty: number;
  mrQty: number;
};
type VaccineKey = keyof VaccineShape;

const VACCINE_OPTIONS: { key: VaccineKey; label: string }[] = [
  { key: "bcgQty", label: "BCG" },
  { key: "hepBQty", label: "HepB" },
  { key: "pentaQty", label: "Penta" },
  { key: "opvQty", label: "OPV" },
  { key: "mrQty", label: "MR" },
];

const LOW_STOCK = 10;
const OK_STOCK = 50;

function getBarColor(qty: number) {
  if (qty === 0) return "#ef4444";
  if (qty < LOW_STOCK) return "#f97316";
  if (qty < OK_STOCK) return "#eab308";
  return "#22c55e";
}

function getVaccineQty(vaccines: VaccineShape | null | undefined, key: VaccineKey): number {
  if (!vaccines) return 0;
  return vaccines[key] ?? 0;
}

function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const qty = typeof payload[0].value === "number" ? payload[0].value : 0;
  const status = qty === 0 ? "Stock-out" : qty < LOW_STOCK ? "Critical Low" : qty < OK_STOCK ? "Low" : "Adequate";
  const statusColor = qty === 0 ? "text-red-400" : qty < LOW_STOCK ? "text-orange-400" : qty < OK_STOCK ? "text-yellow-400" : "text-green-400";
  return (
    <div className="bg-card border border-border rounded p-2 text-sm shadow">
      <p className="font-medium mb-1">{label}</p>
      <p>Qty: <span className="font-bold">{qty}</span></p>
      <p>Status: <span className={`font-medium ${statusColor}`}>{status}</span></p>
    </div>
  );
}

export default function InventoryPage() {
  const [, navigate] = useLocation();
  const [selectedVaccine, setSelectedVaccine] = useState<VaccineKey>("bcgQty");
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const { data: medicines = [], isLoading: medLoading } = useQuery<MedicineInventoryItem[]>({ queryKey: ['/api/medicine-inventory'] });

  const stockOutBarangays = inventory.filter(inv => {
    const v = inv.vaccines as VaccineShape | null;
    const h = (inv.htnMeds || []) as Array<{ name: string; doseMg: number; qty: number }>;
    const vaccineStockout = v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0 || v.hepBQty === 0 || v.mrQty === 0);
    const htnStockout = h.some(med => med.qty === 0);
    return vaccineStockout || htnStockout;
  }).length;

  const lowStockBarangays = inventory.filter(inv => {
    const v = inv.vaccines as VaccineShape | null;
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
        <KpiCard title="Barangays with Stock-outs" value={stockOutBarangays} icon={AlertCircle} variant={stockOutBarangays > 0 ? 'danger' : 'default'} onClick={() => navigate('/inventory/stockouts')} />
        <KpiCard title="Low Stock Barangays" value={lowStockBarangays} icon={TrendingUp} variant={lowStockBarangays > 0 ? 'warning' : 'default'} onClick={() => navigate('/inventory/stockouts')} />
        <KpiCard title="Total Barangays" value={inventory.length} icon={CheckCircle} />
      </div>

      {/* Stock Trend Chart */}
      <Card data-testid="card-stock-trend-chart">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-green-400" />
            Vaccine Stock by Barangay
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Adequate (≥50)
              <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 ml-1" /> Low (10–49)
              <span className="inline-block w-3 h-3 rounded-sm bg-orange-400 ml-1" /> Critical (&lt;10)
              <span className="inline-block w-3 h-3 rounded-sm bg-red-500 ml-1" /> Stock-out
            </div>
            <Select value={selectedVaccine} onValueChange={setSelectedVaccine} data-testid="select-vaccine">
              <SelectTrigger className="w-28 h-8 text-xs" data-testid="select-trigger-vaccine">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VACCINE_OPTIONS.map(opt => (
                  <SelectItem key={opt.key} value={opt.key} data-testid={`select-option-${opt.key}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm" data-testid="text-chart-empty">
              No inventory data available. Add inventory records to see the chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280} data-testid="chart-vaccine-stock">
              <BarChart
                data={inventory.map(inv => ({
                  barangay: inv.barangay.replace(/\s*\(.*?\)/, ""),
                  qty: getVaccineQty(inv.vaccines as VaccineShape | null, selectedVaccine),
                }))}
                margin={{ top: 4, right: 12, left: 0, bottom: 60 }}
              >
                <XAxis
                  dataKey="barangay"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={LOW_STOCK} stroke="#f97316" strokeDasharray="4 2" label={{ value: "Low", fontSize: 10, fill: "#f97316" }} />
                <Bar dataKey="qty" name={VACCINE_OPTIONS.find(o => o.key === selectedVaccine)?.label ?? "Qty"} radius={[3, 3, 0, 0]}>
                  {inventory.map((inv, idx) => {
                    const qty = getVaccineQty(inv.vaccines as VaccineShape | null, selectedVaccine);
                    return <Cell key={idx} fill={getBarColor(qty)} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
                  const v = (inv.vaccines ?? {}) as VaccineShape;
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
