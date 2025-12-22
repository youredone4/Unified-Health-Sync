import { useQuery } from "@tanstack/react-query";
import type { Mother } from "@shared/schema";
import { getTTStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, CheckCircle, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function PrenatalDashboard() {
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });

  const statuses = mothers.map(m => getTTStatus(m).status);
  const overdue = statuses.filter(s => s === 'overdue').length;
  const dueSoon = statuses.filter(s => s === 'due_soon').length;
  const upcoming = statuses.filter(s => s === 'upcoming').length;
  const completed = statuses.filter(s => s === 'completed').length;

  const pieData = [
    { name: 'Overdue', value: overdue, color: 'hsl(0, 84%, 60%)' },
    { name: 'Due Soon', value: dueSoon, color: 'hsl(38, 92%, 50%)' },
    { name: 'Upcoming', value: upcoming, color: 'hsl(199, 89%, 48%)' },
    { name: 'Completed', value: completed, color: 'hsl(142, 76%, 36%)' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Prenatal Dashboard</h1>
        <p className="text-muted-foreground">TT vaccination overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Mothers" value={mothers.length} icon={Users} />
        <KpiCard title="Overdue" value={overdue} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon} icon={Heart} variant="warning" />
        <KpiCard title="Completed" value={completed} icon={CheckCircle} variant="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TT Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
