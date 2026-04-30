import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Heart, Baby, UserCircle, Pill, Siren } from "lucide-react";
import { useAuth, permissions } from "@/hooks/use-auth";

const ITEMS = [
  { label: "Mother",       icon: Heart,      href: "/mother/new",  testId: "qa-mother" },
  { label: "Child",        icon: Baby,       href: "/child/new",   testId: "qa-child" },
  { label: "Senior",       icon: UserCircle, href: "/senior/new",  testId: "qa-senior" },
  { label: "TB patient",   icon: Pill,       href: "/tb/new",      testId: "qa-tb" },
  { label: "Disease case", icon: Siren,      href: "/disease/new", testId: "qa-disease" },
];

export function QuickAddBar() {
  const [, navigate] = useLocation();
  const { role } = useAuth();
  // Quick-add is for record encoding, which only TLs do. MGMT roles
  // see consolidated data and validate; they don't enter new rows.
  if (!permissions.canEnterRecords(role)) return null;
  return (
    <div
      className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4"
      data-testid="today-quick-add"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <Plus className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">Quick Add</span>
        </div>
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Button
              key={it.testId}
              variant="outline"
              size="lg"
              className="text-base font-semibold bg-background border-2 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => navigate(it.href)}
              data-testid={it.testId}
            >
              <Icon className="w-5 h-5 mr-2" /> {it.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
