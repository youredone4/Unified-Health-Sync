import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  onClick?: () => void;
  active?: boolean;
}

export default function KpiCard({ title, value, icon: Icon, variant = 'default', onClick, active }: KpiCardProps) {
  const variantClasses = {
    default: 'border-border',
    danger: 'border-red-500/30 bg-red-500/5',
    warning: 'border-orange-500/30 bg-orange-500/5',
    success: 'border-green-500/30 bg-green-500/5'
  };

  const activeClasses = {
    default: 'ring-2 ring-foreground/40 border-foreground/40 bg-muted/60',
    danger: 'ring-2 ring-red-500/70 border-red-500/70 bg-red-500/15',
    warning: 'ring-2 ring-orange-500/70 border-orange-500/70 bg-orange-500/15',
    success: 'ring-2 ring-green-500/70 border-green-500/70 bg-green-500/15'
  };

  const iconClasses = {
    default: 'text-muted-foreground',
    danger: 'text-red-400',
    warning: 'text-orange-400',
    success: 'text-green-400'
  };

  const isClickable = !!onClick;

  return (
    <Card
      className={`transition-all duration-150 ${active ? activeClasses[variant] : variantClasses[variant]} ${isClickable ? 'cursor-pointer hover:opacity-90 select-none' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      data-testid={`kpi-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {isClickable && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {active ? 'Tap to clear filter' : 'Tap to filter'}
              </p>
            )}
          </div>
          <Icon className={`w-8 h-8 ${iconClasses[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}
