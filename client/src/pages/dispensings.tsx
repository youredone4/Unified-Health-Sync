import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pill, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";

// Pharmacy hub — Dispensings tab (Phase 2 architecture review).
//
// Read-only ledger over medication_dispensings. TLs see only their
// assigned barangay (enforced server-side). Each row links back to the
// source walk-in via the consultId so the user can jump from "what was
// dispensed?" to "during which encounter?". This is a discovery surface
// for an existing data table — no new schema, no writes.

interface Dispensing {
  id: number;
  consultId: number;
  medicineName: string;
  strength: string | null;
  unit: string | null;
  quantityDispensed: number;
  barangay: string;
  dispensedByUserId: string | null;
  dispensedAt: string;
  medicineInventoryId: number | null;
  notes: string | null;
}

export default function DispensingsPage() {
  const { isTL, user } = useAuth();
  const { selectedBarangay } = useBarangay();

  const effectiveBarangay = isTL
    ? (selectedBarangay || user?.assignedBarangays?.[0] || "")
    : (selectedBarangay || "");

  const queryKey = useMemo(
    () => ["/api/medication-dispensings", effectiveBarangay],
    [effectiveBarangay],
  );
  const { data: rows = [], isLoading, error, refetch } = useQuery<Dispensing[]>({
    queryKey,
    queryFn: async () => {
      const url = effectiveBarangay
        ? `/api/medication-dispensings?barangay=${encodeURIComponent(effectiveBarangay)}`
        : "/api/medication-dispensings";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load dispensings");
      return r.json();
    },
  });

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) =>
      d.medicineName.toLowerCase().includes(q) ||
      (d.strength ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalUnits = filtered.reduce((sum, d) => sum + (d.quantityDispensed || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Read-only ledger of medications dispensed during walk-in encounters.
            {effectiveBarangay ? ` Showing ${effectiveBarangay}.` : ""}
          </p>
        </div>
        <Input
          placeholder="Search by medicine…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="dispensings-search"
        />
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={search ? "No dispensings match that search" : "No dispensings logged yet"}
          description={
            search
              ? "Try a different medicine name or strength."
              : "Medications dispensed during walk-in encounters will appear here."
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="py-3 text-sm flex items-center gap-4 flex-wrap">
              <span><span className="font-semibold">{filtered.length}</span> rows</span>
              <span className="text-muted-foreground">
                Total dispensed: <span className="font-semibold">{totalUnits}</span> units
              </span>
            </CardContent>
          </Card>

          <ul className="space-y-2 list-none p-0" aria-label="Dispensings ledger">
            {filtered.map((d) => (
              <DispensingRow key={d.id} item={d} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DispensingRow({ item }: { item: Dispensing }) {
  const dt = new Date(item.dispensedAt);
  const dateStr = isNaN(dt.getTime()) ? item.dispensedAt : dt.toLocaleString();
  return (
    <li>
      <Card>
        <CardContent className="py-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill className="w-4 h-4 text-primary" aria-hidden />
                <span className="font-semibold">{item.medicineName}</span>
                {item.strength ? (
                  <Badge variant="outline" className="text-[10px]">{item.strength}</Badge>
                ) : null}
                <Badge variant="secondary" className="text-[10px]">
                  {item.quantityDispensed} {item.unit ?? "unit(s)"}
                </Badge>
                <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {dateStr}
                {item.dispensedByUserId ? ` · by ${item.dispensedByUserId}` : ""}
              </div>
              {item.notes ? (
                <div className="text-xs italic text-muted-foreground mt-1">{item.notes}</div>
              ) : null}
            </div>
            {/* Source walk-in deep link — the Dispensings ledger is a
                discovery surface back to the encounter that triggered it. */}
            <Link
              href={`/walk-in?consultId=${item.consultId}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 self-center"
              data-testid={`dispensing-walkin-${item.id}`}
            >
              Walk-in #{item.consultId}
              <ExternalLink className="w-3 h-3" aria-hidden />
            </Link>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
