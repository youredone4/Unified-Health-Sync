import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Baby, 
  Stethoscope, 
  Utensils, 
  Pill, 
  Package, 
  FileBarChart, 
  Map as MapIcon,
  Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/prenatal", label: "Prenatal", icon: Baby },
  { href: "/child-health", label: "Child Health", icon: Stethoscope },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/senior-care", label: "Senior Care", icon: Pill },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/map", label: "Facility Map", icon: MapIcon },
];

export function Sidebar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-2xl font-bold font-display text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
            G
          </div>
          GeoHealthSync
        </h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
          Barangay Health System
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href} className={`
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1"}
            `}>
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-foreground">Logged in as</p>
          <p className="text-xs text-muted-foreground">BHW Maricris</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="bg-card">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 border-r-border">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 h-screen fixed left-0 top-0">
        <NavContent />
      </div>
    </>
  );
}
