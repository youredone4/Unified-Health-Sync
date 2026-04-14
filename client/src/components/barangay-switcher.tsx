import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

export default function BarangaySwitcher() {
  const { isTL, assignedBarangays } = useAuth();
  const { selectedBarangay, setSelectedBarangay } = useBarangay();

  if (!isTL || assignedBarangays.length === 0) return null;

  if (assignedBarangays.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-barangay-label">
        <MapPin className="w-3.5 h-3.5" />
        <span>{assignedBarangays[0]}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="barangay-switcher">
      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedBarangay ?? assignedBarangays[0]} onValueChange={setSelectedBarangay}>
        <SelectTrigger className="h-7 text-xs w-[140px] border-primary/40" data-testid="select-barangay-switch">
          <SelectValue placeholder="Select barangay" />
        </SelectTrigger>
        <SelectContent>
          {assignedBarangays.map(b => (
            <SelectItem key={b} value={b} data-testid={`option-barangay-${b}`}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
