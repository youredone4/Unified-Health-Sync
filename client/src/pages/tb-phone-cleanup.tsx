import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TBPatient } from "@shared/schema";
import { isValidPhilippineMobile } from "@shared/phone";
import { useBarangay } from "@/contexts/barangay-context";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, CheckCircle2, ArrowLeft, Pencil } from "lucide-react";

/**
 * TB DOTS phone-cleanup worklist.
 *
 * Step 2 of the auto-SMS roadmap (docs/future-plans.md). Lists every TB
 * patient in scope whose phone number is missing or fails validation,
 * so the nurse can sweep through them in one sitting before the
 * scheduler ever fires reminders.
 *
 * Scope:
 *  - Team Leader → only patients in their assigned barangay (the server
 *    already scopes the /api/tb-patients endpoint).
 *  - MHO / SHA / Admin → all barangays.
 *
 * Discoverability: a banner on the TB worklist links here when the
 * count is non-zero. Direct URL: /tb/phone-cleanup.
 */
export default function TBPhoneCleanup() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { isTL } = useAuth();

  const { data: patients = [], isLoading } = useQuery<TBPatient[]>({
    queryKey: [scopedPath("/api/tb-patients")],
  });

  // Filter to flagged-only and sort by barangay then surname so an MHO
  // sweeping multiple barangays sees them grouped logically.
  const flagged = useMemo(
    () =>
      patients
        .filter((p) => !isValidPhilippineMobile(p.phone))
        .sort((a, b) => {
          const byBrgy = a.barangay.localeCompare(b.barangay);
          if (byBrgy !== 0) return byBrgy;
          return a.lastName.localeCompare(b.lastName);
        }),
    [patients],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/tb")}
          data-testid="button-back-to-tb"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden />
        </Button>
        <div>
          <h1
            className="text-2xl font-semibold flex items-center gap-2"
            data-testid="text-page-title"
          >
            <Phone className="w-5 h-5 text-amber-500" aria-hidden />
            Phone cleanup — TB DOTS
          </h1>
          <p className="text-sm text-muted-foreground">
            Patients listed here can't receive SMS reminders until their
            phone number is fixed. Click <span className="font-semibold">Edit</span>{" "}
            to update each profile.
          </p>
        </div>
      </div>

      {/* Empty state — all clean */}
      {flagged.length === 0 ? (
        <Card data-testid="card-empty">
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" aria-hidden />
            <p className="font-medium">
              All TB patients {isTL ? "in your barangay" : ""} have valid phone numbers.
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              No cleanup needed right now. New patients with missing or
              invalid numbers will appear here automatically as they're
              registered.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/tb")}
              data-testid="button-back-to-worklist"
            >
              Back to TB worklist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-flagged-list">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span data-testid="text-flagged-count">
                {flagged.length}
              </span>
              <span>
                {flagged.length === 1 ? "patient needs" : "patients need"} phone cleanup
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  {!isTL && <TableHead>Barangay</TableHead>}
                  <TableHead>Current phone</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagged.map((p) => {
                  const issue =
                    !p.phone || !p.phone.trim()
                      ? { label: "No phone on file", tone: "secondary" as const }
                      : { label: "Invalid format", tone: "destructive" as const };
                  return (
                    <TableRow
                      key={p.id}
                      data-testid={`cleanup-row-${p.id}`}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="font-medium">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.tbType} · {p.treatmentPhase}
                        </div>
                      </TableCell>
                      {!isTL && (
                        <TableCell className="text-xs">{p.barangay}</TableCell>
                      )}
                      <TableCell className="font-mono text-xs">
                        {p.phone ? (
                          <span className="text-muted-foreground line-through">
                            {p.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={issue.tone} className="text-xs">
                          {issue.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/tb/${p.id}/edit`)}
                          data-testid={`button-edit-${p.id}`}
                          className="gap-1"
                        >
                          <Pencil className="w-3 h-3" aria-hidden />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
