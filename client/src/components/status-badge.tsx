import { Badge } from "@/components/ui/badge";
import type { StatusType, StockStatus } from "@/lib/healthLogic";

interface StatusBadgeProps {
  status: StatusType | StockStatus;
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const labels: Record<string, string> = {
    overdue: 'OVERDUE',
    due_soon: 'DUE SOON',
    upcoming: 'UPCOMING',
    completed: 'COMPLETED',
    available: 'AVAILABLE',
    out: 'OUT OF STOCK',
    low: 'LOW STOCK',
    surplus: 'SURPLUS'
  };

  const classes: Record<string, string> = {
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    out: 'bg-red-500/20 text-red-400 border-red-500/30',
    due_soon: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    low: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    available: 'bg-green-500/20 text-green-400 border-green-500/30',
    surplus: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  };

  return (
    <Badge variant="outline" className={classes[status] || ''} data-testid={`status-${status}`}>
      {label || labels[status] || status}
    </Badge>
  );
}
