import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getTTStatus, getNextVaccineStatus, getSeniorPickupStatus, isMedsReadyForPickup, getPrenatalCheckStatus, getWeightZScore, hasMissingGrowthCheck } from "@/lib/healthLogic";
import type { Mother, Child, Senior, InventoryItem } from "@shared/schema";
import { AlertCircle, Clock, Info } from "lucide-react";

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Notification {
  id: string;
  type: 'overdue' | 'due_soon' | 'info';
  message: string;
  category: string;
}

export default function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });

  const notifications: Notification[] = [];

  mothers.forEach((m) => {
    const tt = getTTStatus(m);
    if (tt.status === 'overdue') {
      notifications.push({ id: `m-tt-${m.id}`, type: 'overdue', message: `${m.firstName} ${m.lastName}: ${tt.nextShotLabel} overdue`, category: 'Prenatal' });
    } else if (tt.status === 'due_soon') {
      notifications.push({ id: `m-tt-${m.id}`, type: 'due_soon', message: `${m.firstName} ${m.lastName}: ${tt.nextShotLabel} due soon`, category: 'Prenatal' });
    }
    const pc = getPrenatalCheckStatus(m);
    if (pc.status === 'overdue') {
      notifications.push({ id: `m-pc-${m.id}`, type: 'overdue', message: `${m.firstName} ${m.lastName}: Prenatal check overdue`, category: 'Prenatal' });
    } else if (pc.status === 'due_soon') {
      notifications.push({ id: `m-pc-${m.id}`, type: 'due_soon', message: `${m.firstName} ${m.lastName}: Prenatal check due soon`, category: 'Prenatal' });
    }
  });

  children.forEach((c) => {
    const vax = getNextVaccineStatus(c);
    if (vax.status === 'overdue') {
      notifications.push({ id: `c-vax-${c.id}`, type: 'overdue', message: `${c.name}: ${vax.nextVaccineLabel} overdue`, category: 'Child Health' });
    } else if (vax.status === 'due_soon') {
      notifications.push({ id: `c-vax-${c.id}`, type: 'due_soon', message: `${c.name}: ${vax.nextVaccineLabel} due soon`, category: 'Child Health' });
    }
    const zsr = getWeightZScore(c);
    if (zsr && (zsr.category === 'SAM' || zsr.category === 'MAM')) {
      const label = zsr.category === 'SAM' ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)';
      notifications.push({ id: `c-uw-${c.id}`, type: 'overdue', message: `${c.name}: ${label}`, category: 'Nutrition' });
    }
    if (hasMissingGrowthCheck(c)) {
      notifications.push({ id: `c-gc-${c.id}`, type: 'due_soon', message: `${c.name}: Missing growth check (>60 days)`, category: 'Nutrition' });
    }
  });

  seniors.forEach((s) => {
    const pickup = getSeniorPickupStatus(s);
    if (pickup.status === 'overdue') {
      notifications.push({ id: `s-pk-${s.id}`, type: 'overdue', message: `${s.firstName} ${s.lastName}: Meds pickup overdue`, category: 'Senior Care' });
    } else if (pickup.status === 'due_soon') {
      notifications.push({ id: `s-pk-${s.id}`, type: 'due_soon', message: `${s.firstName} ${s.lastName}: Meds pickup due soon`, category: 'Senior Care' });
    }
    if (isMedsReadyForPickup(s)) {
      notifications.push({ id: `s-rdy-${s.id}`, type: 'info', message: `${s.firstName} ${s.lastName}: Meds ready for pickup`, category: 'Senior Care' });
    }
  });

  inventory.forEach((inv) => {
    const vaccines = inv.vaccines as any;
    if (vaccines) {
      if (vaccines.bcgQty === 0) notifications.push({ id: `inv-bcg-${inv.id}`, type: 'overdue', message: `${inv.barangay}: BCG out of stock`, category: 'Inventory' });
      if (vaccines.pentaQty === 0) notifications.push({ id: `inv-penta-${inv.id}`, type: 'overdue', message: `${inv.barangay}: Pentavalent out of stock`, category: 'Inventory' });
    }
  });

  notifications.sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, info: 2 };
    return order[a.type] - order[b.type];
  });

  const overdueCount = notifications.filter(n => n.type === 'overdue').length;
  const dueSoonCount = notifications.filter(n => n.type === 'due_soon').length;
  const infoCount = notifications.filter(n => n.type === 'info').length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex gap-2 my-4">
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" /> {overdueCount} Overdue
          </Badge>
          <Badge className="bg-orange-500/20 text-orange-400 gap-1">
            <Clock className="w-3 h-3" /> {dueSoonCount} Due Soon
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Info className="w-3 h-3" /> {infoCount} Info
          </Badge>
        </div>
        <div className="space-y-2 mt-4 max-h-[calc(100vh-200px)] overflow-auto">
          {notifications.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No notifications</p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-md border ${
                n.type === 'overdue' ? 'border-red-500/30 bg-red-500/10' :
                n.type === 'due_soon' ? 'border-orange-500/30 bg-orange-500/10' :
                'border-border bg-muted/50'
              }`}
              data-testid={`notification-${n.id}`}
            >
              <div className="flex items-start gap-2">
                {n.type === 'overdue' && <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />}
                {n.type === 'due_soon' && <Clock className="w-4 h-4 text-orange-400 mt-0.5" />}
                {n.type === 'info' && <Info className="w-4 h-4 text-muted-foreground mt-0.5" />}
                <div>
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{n.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
