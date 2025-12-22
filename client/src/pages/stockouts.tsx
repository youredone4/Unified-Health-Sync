import { useQuery } from "@tanstack/react-query";
import type { InventoryItem } from "@shared/schema";
import { getStockStatus } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockIssue {
  barangay: string;
  item: string;
  qty: number;
  status: 'out' | 'low';
}

export default function StockoutsPage() {
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Stock-outs & Low Stock
        </h1>
        <p className="text-muted-foreground">Items that need attention</p>
      </div>

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
    </div>
  );
}
