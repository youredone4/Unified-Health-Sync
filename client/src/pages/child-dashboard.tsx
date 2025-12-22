import { useQuery } from "@tanstack/react-query";
import type { Child } from "@shared/schema";
import { getNextVaccineStatus, isUnderweightRisk } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Baby, Users, CheckCircle, AlertCircle, Scale } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function ChildDashboard() {
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const statuses = children.map(c => getNextVaccineStatus(c).status);
  const overdue = statuses.filter(s => s === 'overdue').length;
  const dueSoon = statuses.filter(s => s === 'due_soon').length;
  const upcoming = statuses.filter(s => s === 'upcoming').length;
  const completed = statuses.filter(s => s === 'completed').length;
  const underweight = children.filter(c => isUnderweightRisk(c)).length;

  const pieData = [
    { name: 'Overdue', value: overdue, color: 'hsl(0, 84%, 60%)' },
    { name: 'Due Soon', value: dueSoon, color: 'hsl(38, 92%, 50%)' },
    { name: 'Upcoming', value: upcoming, color: 'hsl(199, 89%, 48%)' },
    { name: 'Completed', value: completed, color: 'hsl(142, 76%, 36%)' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Child Health Dashboard</h1>
        <p className="text-muted-foreground">Vaccination and growth overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Total Children" value={children.length} icon={Users} />
        <KpiCard title="Overdue" value={overdue} icon={AlertCircle} variant="danger" />
        <KpiCard title="Due Soon" value={dueSoon} icon={Baby} variant="warning" />
        <KpiCard title="Completed" value={completed} icon={CheckCircle} variant="success" />
        <KpiCard title="Underweight Risk" value={underweight} icon={Scale} variant={underweight > 0 ? 'warning' : 'default'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccination Status Distribution</CardTitle>
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
