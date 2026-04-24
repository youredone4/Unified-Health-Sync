import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export interface WorklistItem {
  id: string;
  name: string;
  reason: string;
  profileHref: string;
  barangay?: string;
  badge?: string;
  severity?: "danger" | "warning" | "info";
}

interface ProgramWorklistProps {
  title: string;
  icon: React.ElementType;
  items: WorklistItem[];
  emptyMessage?: string;
  maxItems?: number;
  testId: string;
}

export function ProgramWorklist({
  title,
  icon: Icon,
  items,
  emptyMessage = "Nothing due today",
  maxItems = 10,
  testId,
}: ProgramWorklistProps) {
  const [, navigate] = useLocation();
  const visible = items.slice(0, maxItems);
  const overflow = items.length - visible.length;

  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">{emptyMessage}</p>
        ) : (
          visible.map((item) => {
            const sevClass =
              item.severity === "danger"
                ? "bg-destructive/15 text-destructive"
                : item.severity === "warning"
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-muted text-muted-foreground";
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(item.profileHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(item.profileHref);
                }}
                className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40 cursor-pointer hover-elevate"
                data-testid={`${testId}-item-${item.id}`}
              >
                <div className={`w-2 h-2 rounded-full ${sevClass}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    {item.badge && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.reason}
                    {item.barangay ? ` · ${item.barangay}` : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            );
          })
        )}
        {overflow > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            Showing {visible.length} of {items.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
