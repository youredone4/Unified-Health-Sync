import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother, PostpartumVisit } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, ArrowRight } from "lucide-react";

interface DueRow {
  mother: Mother;
  visits: PostpartumVisit[];
  dueCheckpoints: string[];
}

export function PncPanel() {
  const [, navigate] = useLocation();
  const { selectedBarangay } = useBarangay();

  const { data: rows = [], isLoading } = useQuery<DueRow[]>({
    queryKey: [`/api/postpartum-visits/today?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    enabled: !!selectedBarangay,
  });

  return (
    <Card data-testid="card-pnc-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className={`w-4 h-4 ${rows.length > 0 ? "text-destructive" : "text-primary"}`} />
          PNC follow-ups
          {rows.length > 0 && (
            <Badge variant="outline" className="text-xs ml-auto">
              {rows.length} due
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!selectedBarangay ? (
          <p className="text-xs text-muted-foreground">Select a barangay to see today's checkpoints.</p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Checking…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No PNC checkpoints due in the window.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {rows.slice(0, 5).map((r) => (
              <button
                key={r.mother.id}
                type="button"
                onClick={() => navigate(`/mother/${r.mother.id}`)}
                className="flex items-center gap-2 text-left text-xs rounded-md border px-2 py-1.5 hover-elevate"
                data-testid={`pnc-row-${r.mother.id}`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-destructive shrink-0" />
                <span className="font-medium truncate flex-1">
                  {r.mother.firstName} {r.mother.lastName}
                </span>
                <span className="text-muted-foreground">
                  {r.dueCheckpoints.join(", ")}
                </span>
              </button>
            ))}
            {rows.length > 5 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{rows.length - 5} more in mother worklist
              </p>
            )}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1 w-full"
          onClick={() => navigate("/prenatal")}
          data-testid="button-open-pnc"
        >
          Open mothers worklist <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
