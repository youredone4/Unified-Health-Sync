import { Layout } from "@/components/Layout";
import { KPICard } from "@/components/KPICard";
import { useMothers } from "@/hooks/use-mothers";
import { useChildren } from "@/hooks/use-children";
import { useSeniors } from "@/hooks/use-seniors";
import { useInventory } from "@/hooks/use-inventory";
import { Activity, Users, AlertTriangle, Syringe, Pill, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Home() {
  const { data: mothers } = useMothers();
  const { data: children } = useChildren();
  const { data: seniors } = useSeniors();
  const { data: inventory } = useInventory();

  // Simple analytics logic
  const totalMothers = mothers?.length || 0;
  const activeMothers = mothers?.filter(m => m.status === 'active').length || 0;
  
  const totalChildren = children?.length || 0;
  // Count incomplete vaccines (demo logic)
  const dueVaccines = children?.filter(c => !c.vaccines?.penta3).length || 0;

  const totalSeniors = seniors?.length || 0;
  const medsReady = seniors?.filter(s => s.htnMedsReady && !s.pickedUp).length || 0;

  const lowStock = inventory?.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').length || 0;

  const chartData = [
    { name: 'Prenatal', value: activeMothers, color: '#60A5FA' },
    { name: 'Vaccine Due', value: dueVaccines, color: '#F87171' },
    { name: 'Meds Pickup', value: medsReady, color: '#34D399' },
    { name: 'Low Stock', value: lowStock, color: '#FBBF24' },
  ];

  return (
    <Layout title="Municipal Dashboard" subtitle="Overview of Barangay Health Station Status">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard 
          title="Active Prenatal" 
          value={activeMothers} 
          icon={<Activity className="w-6 h-6 text-primary" />} 
        />
        <KPICard 
          title="Vaccines Due" 
          value={dueVaccines} 
          color={dueVaccines > 0 ? "destructive" : "success"}
          icon={<Syringe className="w-6 h-6" />} 
        />
        <KPICard 
          title="Meds for Pickup" 
          value={medsReady} 
          color="success"
          icon={<Pill className="w-6 h-6" />} 
        />
        <KPICard 
          title="Low Stock Items" 
          value={lowStock} 
          color={lowStock > 0 ? "warning" : "default"}
          icon={<Package className="w-6 h-6" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">Health Priority Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fill: '#9CA3AF'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wide">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-destructive">Urgent Alert</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Measles outbreak reported in Brgy. San Jose. Check unvaccinated children immediately.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-4">
              <Users className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-primary">Meeting Reminder</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  BHW Monthly Assembly tomorrow at 9:00 AM, Municipal Hall.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
