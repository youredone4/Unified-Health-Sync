import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { VisionScreening } from "@shared/schema";
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
import { Eye, Save } from "lucide-react";
import { format } from "date-fns";

/**
 * Vision screening for senior citizens (60+). Drives M1 G4-01..G4-03.
 */
export default function VisionScreeningsPage() {
  const { selectedBarangay } = useBarangay();
  const { canEnterRecords } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [selectedBarangay
      ? `/api/vision-screenings?barangay=${encodeURIComponent(selectedBarangay)}`
      : "/api/vision-screenings"],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<VisionScreening[]>({ queryKey });

  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [screenDate, setScreenDate] = useState(today);
  const [eyeDisease, setEyeDisease] = useState(false);
  const [referred, setReferred] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vision-screenings", {
        patientName, barangay: selectedBarangay, dob, sex, screenDate,
        eyeDiseaseFound: eyeDisease,
        referredToEyeCare: referred,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setPatientName(""); setDob("");
      setEyeDisease(false); setReferred(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="vision-title">
          <Eye className="w-5 h-5 text-primary" /> Vision screenings
        </h1>
        <p className="text-sm text-muted-foreground">
          Visual-acuity screening for senior citizens (60+). Feeds M1 Section G4-01..G4-03.
        </p>
      </div>

      {canEnterRecords && selectedBarangay && (
        <Card data-testid="card-vision-form">
          <CardHeader className="pb-2"><CardTitle className="text-base">Record screening</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Patient name</label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} data-testid="input-vision-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">DOB</label>
                <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-vision-dob" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sex</label>
                <Select value={sex} onValueChange={(v) => setSex(v as "M" | "F")}>
                  <SelectTrigger data-testid="select-vision-sex"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Screening date</label>
                <Input type="date" value={screenDate} max={today} onChange={(e) => setScreenDate(e.target.value)} data-testid="input-vision-date" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-3 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={eyeDisease} onCheckedChange={(v) => setEyeDisease(!!v)} data-testid="check-vision-disease" /> Eye disease found</label>
              <label className="flex items-center gap-2"><Checkbox checked={referred} onCheckedChange={(v) => setReferred(!!v)} data-testid="check-vision-referred" /> Referred to eye care</label>
            </div>
            <div className="flex justify-end pt-3">
              <Button onClick={() => create.mutate()} disabled={!patientName || !dob || create.isPending} className="gap-1" data-testid="button-save-vision">
                <Save className="w-4 h-4" />
                {create.isPending ? "Saving…" : "Save screening"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-vision-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {selectedBarangay ? `— ${selectedBarangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No vision screenings yet. They'll appear here when a TL logs a senior's visual-acuity check.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedBarangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Eye disease</TableHead>
                  <TableHead>Referred</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`vision-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.screenDate}</TableCell>
                    {!selectedBarangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell>{r.eyeDiseaseFound ? "Yes" : "—"}</TableCell>
                    <TableCell>{r.referredToEyeCare ? "Yes" : "—"}</TableCell>
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
