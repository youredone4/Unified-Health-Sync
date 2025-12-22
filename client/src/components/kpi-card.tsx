import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'success';
}

export default function KpiCard({ title, value, icon: Icon, variant = 'default' }: KpiCardProps) {
  const variantClasses = {
    default: 'border-border',
    danger: 'border-red-500/30 bg-red-500/5',
    warning: 'border-orange-500/30 bg-orange-500/5',
    success: 'border-green-500/30 bg-green-500/5'
  };

  const iconClasses = {
    default: 'text-muted-foreground',
    danger: 'text-red-400',
    warning: 'text-orange-400',
    success: 'text-green-400'
  };

  return (
    <Card className={variantClasses[variant]} data-testid={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${iconClasses[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}
