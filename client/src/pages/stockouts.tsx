import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InventoryItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import KpiCard from "@/components/kpi-card";

interface StockIssue {
  barangay: string;
  item: string;
  qty: number;
  status: 'out' | 'low';
}

type FilterKey = 'out' | 'low' | 'barangay' | null;

export default function StockoutsPage() {
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const [activeFilter, setActiveFilter] = useState<FilterKey>(null);

  const issues: StockIssue[] = [];

  inventory.forEach(inv => {
    const v = (inv.vaccines || {}) as any;
    const h = (inv.htnMeds || []) as Array<{ name: string; doseMg: number; qty: number }>;

    if (v.bcgQty === 0) issues.push({ barangay: inv.barangay, item: 'BCG', qty: 0, status: 'out' });
    else if (v.bcgQty < 10) issues.push({ barangay: inv.barangay, item: 'BCG', qty: v.bcgQty, status: 'low' });

    if (v.pentaQty === 0) issues.push({ barangay: inv.barangay, item: 'Pentavalent', qty: 0, status: 'out' });
    else if (v.pentaQty < 10) issues.push({ barangay: inv.barangay, item: 'Pentavalent', qty: v.pentaQty, status: 'low' });

    if (v.opvQty === 0) issues.push({ barangay: inv.barangay, item: 'OPV', qty: 0, status: 'out' });
    else if (v.opvQty < 10) issues.push({ barangay: inv.barangay, item: 'OPV', qty: v.opvQty, status: 'low' });

    if (v.hepBQty === 0) issues.push({ barangay: inv.barangay, item: 'Hepatitis B', qty: 0, status: 'out' });
    else if (v.hepBQty < 10) issues.push({ barangay: inv.barangay, item: 'Hepatitis B', qty: v.hepBQty, status: 'low' });

    if (v.mrQty === 0) issues.push({ barangay: inv.barangay, item: 'MR', qty: 0, status: 'out' });
    else if (v.mrQty < 10) issues.push({ barangay: inv.barangay, item: 'MR', qty: v.mrQty, status: 'low' });

    h.forEach(med => {
      if (med.qty === 0) issues.push({ barangay: inv.barangay, item: `${med.name} ${med.doseMg}mg`, qty: 0, status: 'out' });
      else if (med.qty < 20) issues.push({ barangay: inv.barangay, item: `${med.name} ${med.doseMg}mg`, qty: med.qty, status: 'low' });
    });
  });

  const outOfStock = issues.filter(i => i.status === 'out');
  const lowStock = issues.filter(i => i.status === 'low');

  const affectedBarangays = new Set(issues.map(i => i.barangay));
  const affectedBarangayList = Array.from(affectedBarangays).sort();

  const handleCardClick = (filter: FilterKey) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  const getFilteredIssues = () => {
    if (activeFilter === 'out') return outOfStock;
    if (activeFilter === 'low') return lowStock;
    if (activeFilter === 'barangay') return issues;
    return issues;
  };

  const showOut = !activeFilter || activeFilter === 'out';
  const showLow = !activeFilter || activeFilter === 'low';
  const showBarangay = activeFilter === 'barangay';

  const filterLabel = activeFilter === 'out'
    ? `Stock-outs (${outOfStock.length})`
    : activeFilter === 'low'
    ? `Low Stock (${lowStock.length})`
    : activeFilter === 'barangay'
    ? `Affected Barangays (${affectedBarangays.size})`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Stock-outs & Low Stock
        </h1>
        <p className="text-muted-foreground">Items that need attention</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          title="Stock-outs"
          value={outOfStock.length}
          icon={AlertTriangle}
          variant="danger"
          onClick={() => handleCardClick('out')}
          active={activeFilter === 'out'}
        />
        <KpiCard
          title="Low Stock"
          value={lowStock.length}
          icon={Package}
          variant="warning"
          onClick={() => handleCardClick('low')}
          active={activeFilter === 'low'}
        />
        <KpiCard
          title="Total Barangays"
          value={affectedBarangays.size}
          icon={MapPin}
          onClick={() => handleCardClick('barangay')}
          active={activeFilter === 'barangay'}
        />
      </div>

      {filterLabel && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing: <span className="font-semibold text-foreground">{filterLabel}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveFilter(null)}
            className="h-7 text-xs gap-1"
            data-testid="button-clear-filter"
          >
            <X className="w-3 h-3" />
            Show all
          </Button>
        </div>
      )}

      {showBarangay && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Affected Barangays ({affectedBarangays.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {affectedBarangayList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No affected barangays</p>
            ) : (
              <div className="space-y-2">
                {affectedBarangayList.map(barangay => {
                  const barangayIssues = issues.filter(i => i.barangay === barangay);
                  const outCount = barangayIssues.filter(i => i.status === 'out').length;
                  const lowCount = barangayIssues.filter(i => i.status === 'low').length;
                  return (
                    <div key={barangay} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border" data-testid={`barangay-row-${barangay}`}>
                      <p className="font-medium">{barangay}</p>
                      <div className="flex gap-2">
                        {outCount > 0 && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">{outCount} out</Badge>}
                        {lowCount > 0 && <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">{lowCount} low</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showOut && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <Package className="w-4 h-4" />
              Out of Stock ({outOfStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outOfStock.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No stock-outs</p>
            )}
            <div className="space-y-2">
              {outOfStock.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-red-500/10 border border-red-500/20" data-testid={`stockout-${issue.barangay}-${issue.item}`}>
                  <div>
                    <p className="font-medium">{issue.item}</p>
                    <p className="text-sm text-muted-foreground">{issue.barangay}</p>
                  </div>
                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">OUT</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showLow && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-400">
              <Package className="w-4 h-4" />
              Low Stock ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No low stock items</p>
            )}
            <div className="space-y-2">
              {lowStock.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-orange-500/10 border border-orange-500/20" data-testid={`lowstock-${issue.barangay}-${issue.item}`}>
                  <div>
                    <p className="font-medium">{issue.item}</p>
                    <p className="text-sm text-muted-foreground">{issue.barangay}</p>
                  </div>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">{issue.qty} left</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
