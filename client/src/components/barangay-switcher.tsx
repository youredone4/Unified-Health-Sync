import { useQuery } from "@tanstack/react-query";
import type { Barangay } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

/**
 * Barangay switcher in the app header.
 *
 * - **TL users**: shows their assigned barangays. If they only have one,
 *   it's rendered as a static label (no need to switch).
 * - **MGMT users (Admin / MHO / SHA)**: shows every barangay in the
 *   municipality so they can scope barangay-bound pages (Cold-chain,
 *   NCD Screenings, Oral Health, School Imm, Disease Programs,
 *   Mortality, Household Water, etc.) without those pages permanently
 *   showing "Select a barangay…".
 */
export default function BarangaySwitcher() {
  const { isTL, isAuthenticated, assignedBarangays } = useAuth();
  const { selectedBarangay, setSelectedBarangay } = useBarangay();

  // MGMT roles need the full barangay list; TL gets their assigned set
  // from auth context already.
  const { data: allBarangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
    enabled: isAuthenticated && !isTL,
  });

  if (!isAuthenticated) return null;

  const options: string[] = isTL
    ? assignedBarangays
    : allBarangays.map((b) => b.name).sort();

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
