import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: "default" | "destructive" | "warning" | "success";
}

export function KPICard({ title, value, icon, color = "default" }: KPICardProps) {
  const colorStyles = {
    default: "text-foreground",
    destructive: "text-destructive",
    warning: "text-[hsl(var(--warning))]",
    success: "text-[hsl(var(--success))]",
  };

  const bgStyles = {
    default: "bg-card",
    destructive: "bg-destructive/10 border-destructive/20",
    warning: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20",
    success: "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/20",
  };

  return (
    <Card className={cn("border shadow-sm", bgStyles[color])}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {title}
          </p>
          <div className={cn("text-4xl font-bold font-display", colorStyles[color])}>
            {value}
          </div>
        </div>
        <div className={cn("p-4 rounded-xl bg-background/50 backdrop-blur-sm", colorStyles[color])}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
