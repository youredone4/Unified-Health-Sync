import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { OralHealthVisit } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Smile, Save } from "lucide-react";
import { format } from "date-fns";

export default function OralHealthPage() {
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [`/api/oral-health-visits?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<OralHealthVisit[]>({ queryKey, enabled: !!selectedBarangay });

  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [visitDate, setVisitDate] = useState(today);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [facilityBased, setFacilityBased] = useState(true);
  const [isPregnant, setIsPregnant] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/oral-health-visits", {
        patientName, barangay: selectedBarangay, dob, sex, visitDate,
        isFirstVisit, facilityBased, isPregnant,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Visit recorded" });
      queryClient.invalidateQueries({ queryKey });
      setPatientName("");
      setDob("");
      setIsPregnant(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="oral-health-title">
          <Smile className="w-5 h-5 text-primary" /> Oral health visits
        </h1>
        <p className="text-sm text-muted-foreground">First-visit dental tracking. Feeds M1 Section ORAL.</p>
      </div>
      {!selectedBarangay ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Select a barangay to record oral health visits.
        </CardContent></Card>
      ) : (
        <>
          <Card data-testid="card-oral-form">
            <CardHeader className="pb-2"><CardTitle className="text-base">Record visit</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Patient name</label>
                  <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} data-testid="input-oral-name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">DOB</label>
                  <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-oral-dob" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Sex</label>
                  <Select value={sex} onValueChange={(v) => setSex(v as "M" | "F")}>
                    <SelectTrigger data-testid="select-oral-sex"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Visit date</label>
                  <Input type="date" value={visitDate} max={today} onChange={(e) => setVisitDate(e.target.value)} data-testid="input-oral-date" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-3 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={isFirstVisit} onCheckedChange={(v) => setIsFirstVisit(!!v)} data-testid="check-first-visit" /> First visit</label>
                <label className="flex items-center gap-2"><Checkbox checked={facilityBased} onCheckedChange={(v) => setFacilityBased(!!v)} data-testid="check-facility" /> Facility-based</label>
                <label className="flex items-center gap-2"><Checkbox checked={isPregnant} onCheckedChange={(v) => setIsPregnant(!!v)} data-testid="check-pregnant" /> Pregnant (counts under ORAL-06)</label>
              </div>
              <div className="flex justify-end pt-3">
                <Button onClick={() => create.mutate()} disabled={!patientName || !dob || create.isPending} className="gap-1" data-testid="button-save-oral">
                  <Save className="w-4 h-4" />
                  {create.isPending ? "Saving…" : "Save visit"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-oral-history">
            <CardHeader className="pb-2"><CardTitle className="text-base">Records — {selectedBarangay}</CardTitle></CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No oral health visits yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>First?</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Pregnant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} data-testid={`oral-row-${r.id}`}>
                        <TableCell className="font-mono text-xs">{r.visitDate}</TableCell>
                        <TableCell>{r.patientName}</TableCell>
                        <TableCell>{r.sex}</TableCell>
                        <TableCell>{r.isFirstVisit ? <Badge variant="outline">1st</Badge> : "—"}</TableCell>
                        <TableCell>{r.facilityBased ? "Facility" : "Outreach"}</TableCell>
                        <TableCell>{r.isPregnant ? "Yes" : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
