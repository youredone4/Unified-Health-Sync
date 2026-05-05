import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MentalHealthScreening } from "@shared/schema";
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
import { Brain, Save } from "lucide-react";
import { format } from "date-fns";

/**
 * mhGAP mental health screening — drives M1 Section G8-01.
 */
export default function MentalHealthScreeningsPage() {
  const { selectedBarangay } = useBarangay();
  const { canEnterRecords } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [selectedBarangay
      ? `/api/mental-health-screenings?barangay=${encodeURIComponent(selectedBarangay)}`
      : "/api/mental-health-screenings"],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<MentalHealthScreening[]>({ queryKey });

  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [screenDate, setScreenDate] = useState(today);
  const [tool, setTool] = useState("mhGAP");
  const [positive, setPositive] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mental-health-screenings", {
        patientName, barangay: selectedBarangay, dob, sex, screenDate,
        tool, positive,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setPatientName(""); setDob("");
      setPositive(false);
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="mh-title">
          <Brain className="w-5 h-5 text-primary" /> Mental health screenings
        </h1>
        <p className="text-sm text-muted-foreground">
          mhGAP-based mental health screening. Feeds M1 Section G8-01.
        </p>
      </div>

      {canEnterRecords && selectedBarangay && (
        <Card data-testid="card-mh-form">
          <CardHeader className="pb-2"><CardTitle className="text-base">Record screening</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Patient name</label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} data-testid="input-mh-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">DOB</label>
                <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-mh-dob" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sex</label>
                <Select value={sex} onValueChange={(v) => setSex(v as "M" | "F")}>
                  <SelectTrigger data-testid="select-mh-sex"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Screening date</label>
                <Input type="date" value={screenDate} max={today} onChange={(e) => setScreenDate(e.target.value)} data-testid="input-mh-date" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tool</label>
                <Input value={tool} onChange={(e) => setTool(e.target.value)} data-testid="input-mh-tool" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-3 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={positive} onCheckedChange={(v) => setPositive(!!v)} data-testid="check-mh-positive" /> Positive screen</label>
            </div>
            <div className="flex justify-end pt-3">
              <Button onClick={() => create.mutate()} disabled={!patientName || !dob || create.isPending} className="gap-1" data-testid="button-save-mh">
                <Save className="w-4 h-4" />
                {create.isPending ? "Saving…" : "Save screening"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-mh-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {selectedBarangay ? `— ${selectedBarangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No mental health screenings yet. Log a mhGAP screening above; rows feed M1 Section G8.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedBarangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Positive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`mh-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.screenDate}</TableCell>
                    {!selectedBarangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell className="text-xs">{r.tool ?? "—"}</TableCell>
                    <TableCell>{r.positive ? "Yes" : "—"}</TableCell>
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
