import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth, permissions } from "@/hooks/use-auth";

const ITEMS = [
  { label: "Mother", href: "/mother/new", testId: "qa-mother" },
  { label: "Child", href: "/child/new", testId: "qa-child" },
  { label: "Senior", href: "/senior/new", testId: "qa-senior" },
  { label: "TB patient", href: "/tb/new", testId: "qa-tb" },
  { label: "Disease case", href: "/disease/new", testId: "qa-disease" },
];

export function QuickAddBar() {
  const [, navigate] = useLocation();
  const { role } = useAuth();
  // Quick-add is for record encoding, which only TLs do. MGMT roles
  // see consolidated data and validate; they don't enter new rows.
  if (!permissions.canEnterRecords(role)) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1" data-testid="today-quick-add">
      <span className="text-xs text-muted-foreground mr-1">Quick add:</span>
      {ITEMS.map((it) => (
        <Button
          key={it.testId}
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => navigate(it.href)}
          data-testid={it.testId}
        >
          <Plus className="w-3 h-3 mr-1" /> {it.label}
        </Button>
      ))}
    </div>
  );
}
