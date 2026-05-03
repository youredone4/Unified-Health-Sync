import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CervicalCancerScreening } from "@shared/schema";
import {
  CERVICAL_SCREEN_METHODS, CARE_OUTCOMES,
  type CervicalScreenMethod, type CareOutcome,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ribbon, Save } from "lucide-react";
import { format } from "date-fns";

/**
 * Cervical cancer screening for women 30-65. Drives M1 G6-01..G6-05b.
 * Patients are implicitly female (the schema has no sex field).
 */
export default function CervicalCancerScreeningsPage() {
  const { selectedBarangay } = useBarangay();
  const { canEnterRecords } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [selectedBarangay
      ? `/api/cervical-cancer-screenings?barangay=${encodeURIComponent(selectedBarangay)}`
      : "/api/cervical-cancer-screenings"],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<CervicalCancerScreening[]>({ queryKey });

  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [screenDate, setScreenDate] = useState(today);
  const [screenMethod, setScreenMethod] = useState<CervicalScreenMethod | "">("");
  const [suspicious, setSuspicious] = useState(false);
  const [linkedToCare, setLinkedToCare] = useState(false);
  const [linkedOutcome, setLinkedOutcome] = useState<CareOutcome | "">("");
  const [precancerous, setPrecancerous] = useState(false);
  const [precancerousOutcome, setPrecancerousOutcome] = useState<CareOutcome | "">("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cervical-cancer-screenings", {
        patientName, barangay: selectedBarangay, dob, screenDate,
        screenMethod: screenMethod || null,
        suspicious,
        linkedToCare,
        linkedOutcome: linkedOutcome || null,
        precancerous,
        precancerousOutcome: precancerousOutcome || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setPatientName(""); setDob("");
      setScreenMethod(""); setSuspicious(false); setLinkedToCare(false); setLinkedOutcome("");
      setPrecancerous(false); setPrecancerousOutcome("");
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="cervical-title">
          <Ribbon className="w-5 h-5 text-primary" /> Cervical cancer screenings
        </h1>
        <p className="text-sm text-muted-foreground">
          Women 30-65: VIA / Pap / HPV screening, with linkage-to-care follow-up. Feeds M1 Section G6-01..G6-05b.
        </p>
      </div>

      {canEnterRecords && selectedBarangay && (
        <Card data-testid="card-cervical-form">
          <CardHeader className="pb-2"><CardTitle className="text-base">Record screening</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Patient name</label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} data-testid="input-cervical-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">DOB</label>
                <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-cervical-dob" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Screening date</label>
                <Input type="date" value={screenDate} max={today} onChange={(e) => setScreenDate(e.target.value)} data-testid="input-cervical-date" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Method</label>
                <Select value={screenMethod} onValueChange={(v) => setScreenMethod(v as CervicalScreenMethod)}>
                  <SelectTrigger data-testid="select-cervical-method"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {CERVICAL_SCREEN_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Suspicious result</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={suspicious} onCheckedChange={(v) => setSuspicious(!!v)} data-testid="check-cervical-suspicious" />
                  Found suspicious for cervical cancer
                </label>
                {suspicious && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={linkedToCare} onCheckedChange={(v) => setLinkedToCare(!!v)} data-testid="check-cervical-linked" />
                      Linked to care
                    </label>
                    {linkedToCare && (
                      <Select value={linkedOutcome} onValueChange={(v) => setLinkedOutcome(v as CareOutcome)}>
                        <SelectTrigger data-testid="select-cervical-outcome"><SelectValue placeholder="Outcome" /></SelectTrigger>
                        <SelectContent>
                          {CARE_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Precancerous lesion</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={precancerous} onCheckedChange={(v) => setPrecancerous(!!v)} data-testid="check-cervical-precancerous" />
                  Found precancerous
                </label>
                {precancerous && (
                  <Select value={precancerousOutcome} onValueChange={(v) => setPrecancerousOutcome(v as CareOutcome)}>
                    <SelectTrigger data-testid="select-cervical-precancer-outcome"><SelectValue placeholder="Outcome" /></SelectTrigger>
                    <SelectContent>
                      {CARE_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button onClick={() => create.mutate()} disabled={!patientName || !dob || create.isPending} className="gap-1" data-testid="button-save-cervical">
                <Save className="w-4 h-4" />
                {create.isPending ? "Saving…" : "Save screening"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-cervical-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {selectedBarangay ? `— ${selectedBarangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No cervical screenings yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedBarangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Suspicious</TableHead>
                  <TableHead>Precancerous</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`cervical-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.screenDate}</TableCell>
                    {!selectedBarangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell className="text-xs">{r.screenMethod ?? "—"}</TableCell>
                    <TableCell>{r.suspicious ? (r.linkedOutcome ?? "Yes") : "—"}</TableCell>
                    <TableCell>{r.precancerous ? (r.precancerousOutcome ?? "Yes") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
