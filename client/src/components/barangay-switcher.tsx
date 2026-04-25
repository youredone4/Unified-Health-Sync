import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

/**
 * Barangay switcher in the app header.
 *
 * Only rendered for **TL users** — they see their assigned barangays
 * and can switch between them (or get a static label if they only have
 * one). MGMT roles (Admin / MHO / SHA) see consolidated data across
 * every barangay, so no switcher is needed.
 */
export default function BarangaySwitcher() {
  const { isTL, isAuthenticated, assignedBarangays } = useAuth();
  const { selectedBarangay, setSelectedBarangay } = useBarangay();

  if (!isAuthenticated || !isTL) return null;

  const options = assignedBarangays;
  if (options.length === 0) return null;

  // TL with exactly one assignment — keep the static-label affordance
  // so they don't see a confusing 1-item dropdown.
  if (isTL && options.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-barangay-label">
        <MapPin className="w-3.5 h-3.5" />
        <span>{options[0]}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="barangay-switcher">
      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedBarangay ?? options[0]} onValueChange={setSelectedBarangay}>
        <SelectTrigger className="h-7 text-xs w-[160px] border-primary/40" data-testid="select-barangay-switch">
          <SelectValue placeholder="Select barangay" />
        </SelectTrigger>
        <SelectContent>
          {options.map((b) => (
            <SelectItem key={b} value={b} data-testid={`option-barangay-${b}`}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
