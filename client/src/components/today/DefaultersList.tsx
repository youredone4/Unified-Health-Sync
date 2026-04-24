import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle, MessageCircle } from "lucide-react";
import type { WorklistItem } from "./ProgramWorklist";

interface DefaultersListProps {
  items: WorklistItem[];
  maxItems?: number;
}

export function DefaultersList({ items, maxItems = 15 }: DefaultersListProps) {
  const [, navigate] = useLocation();
  const visible = items.slice(0, maxItems);
  const overflow = items.length - visible.length;

  return (
    <Card data-testid="card-defaulters">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Defaulters to chase
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">
            No defaulters across programs. Nice work.
          </p>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40"
              data-testid={`defaulter-${item.id}`}
            >
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
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Send SMS reminder (coming soon)"
                disabled
                data-testid={`defaulter-sms-${item.id}`}
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => navigate(item.profileHref)}
                data-testid={`defaulter-open-${item.id}`}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ))
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
