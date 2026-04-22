import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InventoryItem, MedicineInventoryItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, MapPin, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import KpiCard from "@/components/kpi-card";
import TablePager from "@/components/table-pager";

interface StockIssue {
  barangay: string;
  item: string;
  qty: number;
  status: 'out' | 'low';
  source: 'vaccine' | 'medicine';
}

type FilterKey = 'out' | 'low' | 'barangay' | null;

export default function StockoutsPage() {
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const { data: medicines = [] } = useQuery<MedicineInventoryItem[]>({ queryKey: ['/api/medicine-inventory'] });
  const [activeFilter, setActiveFilter] = useState<FilterKey>(null);
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [outPage, setOutPage] = useState(1);
  const [outPageSize, setOutPageSize] = useState(10);
  const [lowPage, setLowPage] = useState(1);
  const [lowPageSize, setLowPageSize] = useState(10);

  const issues: StockIssue[] = [];

  inventory.forEach(inv => {
    const v = (inv.vaccines || {}) as any;
    const h = (inv.htnMeds || []) as Array<{ name: string; doseMg: number; qty: number }>;

    if (v.bcgQty === 0) issues.push({ barangay: inv.barangay, item: 'BCG', qty: 0, status: 'out', source: 'vaccine' });
    else if (v.bcgQty < 10) issues.push({ barangay: inv.barangay, item: 'BCG', qty: v.bcgQty, status: 'low', source: 'vaccine' });

    if (v.pentaQty === 0) issues.push({ barangay: inv.barangay, item: 'Pentavalent', qty: 0, status: 'out', source: 'vaccine' });
    else if (v.pentaQty < 10) issues.push({ barangay: inv.barangay, item: 'Pentavalent', qty: v.pentaQty, status: 'low', source: 'vaccine' });

    if (v.opvQty === 0) issues.push({ barangay: inv.barangay, item: 'OPV', qty: 0, status: 'out', source: 'vaccine' });
    else if (v.opvQty < 10) issues.push({ barangay: inv.barangay, item: 'OPV', qty: v.opvQty, status: 'low', source: 'vaccine' });

    if (v.hepBQty === 0) issues.push({ barangay: inv.barangay, item: 'Hepatitis B', qty: 0, status: 'out', source: 'vaccine' });
    else if (v.hepBQty < 10) issues.push({ barangay: inv.barangay, item: 'Hepatitis B', qty: v.hepBQty, status: 'low', source: 'vaccine' });

    if (v.mrQty === 0) issues.push({ barangay: inv.barangay, item: 'MR', qty: 0, status: 'out', source: 'vaccine' });
    else if (v.mrQty < 10) issues.push({ barangay: inv.barangay, item: 'MR', qty: v.mrQty, status: 'low', source: 'vaccine' });

    h.forEach(med => {
      if (med.qty === 0) issues.push({ barangay: inv.barangay, item: `${med.name} ${med.doseMg}mg`, qty: 0, status: 'out', source: 'vaccine' });
      else if (med.qty < 20) issues.push({ barangay: inv.barangay, item: `${med.name} ${med.doseMg}mg`, qty: med.qty, status: 'low', source: 'vaccine' });
    });
  });

  medicines.forEach(med => {
    const threshold = med.lowStockThreshold ?? 10;
    const label = `${med.medicineName}${med.strength ? ` ${med.strength}` : ''}${med.unit ? ` (${med.unit})` : ''}`;
    if (med.qty === 0) issues.push({ barangay: med.barangay, item: label, qty: 0, status: 'out', source: 'medicine' });
    else if (med.qty < threshold) issues.push({ barangay: med.barangay, item: label, qty: med.qty, status: 'low', source: 'medicine' });
  });

  const outOfStock = issues.filter(i => i.status === 'out');
  const lowStock = issues.filter(i => i.status === 'low');

  const affectedBarangays = new Set(issues.map(i => i.barangay));
  const affectedBarangayList = Array.from(affectedBarangays).sort();

  const applyFilters = (list: StockIssue[]): StockIssue[] => {
    const q = search.trim().toLowerCase();
    return list.filter(i => {
      if (barangayFilter !== "all" && i.barangay !== barangayFilter) return false;
      if (q && !i.item.toLowerCase().includes(q) && !i.barangay.toLowerCase().includes(q)) return false;
      return true;
    });
  };

  const filteredOut = useMemo(() => applyFilters(outOfStock), [outOfStock, barangayFilter, search]);
  const filteredLow = useMemo(() => applyFilters(lowStock), [lowStock, barangayFilter, search]);

  useEffect(() => { setOutPage(1); }, [barangayFilter, search, outPageSize]);
  useEffect(() => { setLowPage(1); }, [barangayFilter, search, lowPageSize]);

  const pagedOut = useMemo(
    () => filteredOut.slice((outPage - 1) * outPageSize, outPage * outPageSize),
    [filteredOut, outPage, outPageSize],
  );
  const pagedLow = useMemo(
    () => filteredLow.slice((lowPage - 1) * lowPageSize, lowPage * lowPageSize),
    [filteredLow, lowPage, lowPageSize],
  );

  const handleCardClick = (filter: FilterKey) => {
    setActiveFilter(prev => prev === filter ? null : filter);
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
        <p className="text-muted-foreground">Items that need attention (vaccines and medicines)</p>
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

      <div className="flex flex-wrap gap-2">
        <Select value={barangayFilter} onValueChange={setBarangayFilter}>
          <SelectTrigger className="h-8 w-[200px]" data-testid="stockouts-filter-barangay">
            <SelectValue placeholder="All barangays" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All barangays</SelectItem>
            {affectedBarangayList.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item or barangay"
            className="h-8 w-[260px] pl-8"
            data-testid="stockouts-search"
          />
        </div>
      </div>

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
              Out of Stock ({filteredOut.length}{filteredOut.length !== outOfStock.length ? ` of ${outOfStock.length}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOut.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                {outOfStock.length === 0 ? "No stock-outs" : "No stock-outs match the current filters"}
              </p>
            )}
            <div className="space-y-2">
              {pagedOut.map((issue, idx) => (
                <div key={`${issue.barangay}-${issue.item}-${idx}`} className="flex items-center justify-between p-3 rounded-md bg-red-500/10 border border-red-500/20" data-testid={`stockout-${issue.barangay}-${issue.item}`}>
                  <div>
                    <p className="font-medium">{issue.item}</p>
                    <p className="text-sm text-muted-foreground">{issue.barangay}{issue.source === 'medicine' && <span className="ml-1 text-blue-400">(medicine)</span>}</p>
                  </div>
                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">OUT</Badge>
                </div>
              ))}
            </div>
            {filteredOut.length > 0 && (
              <TablePager
                page={outPage}
                pageSize={outPageSize}
                total={filteredOut.length}
                onPageChange={setOutPage}
                onPageSizeChange={setOutPageSize}
                label="items"
              />
            )}
          </CardContent>
        </Card>
      )}

      {showLow && (
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-400">
              <Package className="w-4 h-4" />
              Low Stock ({filteredLow.length}{filteredLow.length !== lowStock.length ? ` of ${lowStock.length}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLow.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                {lowStock.length === 0 ? "No low stock items" : "No low-stock items match the current filters"}
              </p>
            )}
            <div className="space-y-2">
              {pagedLow.map((issue, idx) => (
                <div key={`${issue.barangay}-${issue.item}-${idx}`} className="flex items-center justify-between p-3 rounded-md bg-orange-500/10 border border-orange-500/20" data-testid={`lowstock-${issue.barangay}-${issue.item}`}>
                  <div>
                    <p className="font-medium">{issue.item}</p>
                    <p className="text-sm text-muted-foreground">{issue.barangay}{issue.source === 'medicine' && <span className="ml-1 text-blue-400">(medicine)</span>}</p>
                  </div>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">{issue.qty} left</Badge>
                </div>
              ))}
            </div>
            {filteredLow.length > 0 && (
              <TablePager
                page={lowPage}
                pageSize={lowPageSize}
                total={filteredLow.length}
                onPageChange={setLowPage}
                onPageSizeChange={setLowPageSize}
                label="items"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
