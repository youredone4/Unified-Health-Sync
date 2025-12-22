import { Layout } from "@/components/Layout";
import { KPICard } from "@/components/KPICard";
import { useInventory } from "@/hooks/use-inventory";
import { Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Inventory() {
  const { data: inventory, isLoading } = useInventory();

  const lowStockCount = inventory?.filter(i => i.status === 'Low Stock').length || 0;
  const outOfStockCount = inventory?.filter(i => i.status === 'Out of Stock').length || 0;

  return (
    <Layout title="Inventory" subtitle="Medicine & Supply Stock Monitoring">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard 
          title="Out of Stock" 
          value={outOfStockCount} 
          color="destructive"
          icon={<AlertTriangle className="w-6 h-6" />} 
        />
        <KPICard 
          title="Low Stock" 
          value={lowStockCount} 
          color="warning"
          icon={<AlertTriangle className="w-6 h-6" />} 
        />
        <KPICard 
          title="Available Items" 
          value={(inventory?.length || 0) - lowStockCount - outOfStockCount} 
          color="success"
          icon={<Package className="w-6 h-6" />} 
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-4">Item Name</th>
                <th className="p-4">Quantity</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading inventory...</td></tr>
              ) : inventory?.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium text-foreground">{item.item}</td>
                  <td className="p-4 font-mono text-lg">{item.quantity}</td>
                  <td className="p-4">
                    <Badge variant={
                      item.status === 'Out of Stock' ? 'destructive' : 
                      item.status === 'Low Stock' ? 'default' : 'secondary'
                    } className={
                      item.status === 'Low Stock' ? 'bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/80 text-white' : 
                      item.status === 'Available' ? 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/80 text-white' : ''
                    }>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">{item.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
