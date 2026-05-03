import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PhilpenAssessment } from "@shared/schema";
import { BMI_CATEGORIES, type BmiCategory } from "@shared/schema";
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
import { HeartPulse, Save } from "lucide-react";
import { format } from "date-fns";

/**
 * PhilPEN Risk Assessment — drives M1 Section G1-01..G1-01f.
 * Patterned after the oral-health page: inline form + table.
 */
export default function PhilpenAssessmentsPage() {
  const { selectedBarangay } = useBarangay();
  const { canEnterRecords } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [selectedBarangay
      ? `/api/philpen-assessments?barangay=${encodeURIComponent(selectedBarangay)}`
      : "/api/philpen-assessments"],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<PhilpenAssessment[]>({ queryKey });

  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [assessmentDate, setAssessmentDate] = useState(today);
  const [smoking, setSmoking] = useState(false);
  const [binge, setBinge] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const [unhealthy, setUnhealthy] = useState(false);
  const [bmi, setBmi] = useState<BmiCategory | "">("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/philpen-assessments", {
        patientName, barangay: selectedBarangay, dob, sex, assessmentDate,
        smokingHistory: smoking,
        bingeDrinker: binge,
        insufficientActivity: insufficient,
        unhealthyDiet: unhealthy,
        bmiCategory: bmi || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Assessment recorded" });
      queryClient.invalidateQueries({ queryKey });
      setPatientName(""); setDob("");
      setSmoking(false); setBinge(false); setInsufficient(false); setUnhealthy(false);
      setBmi("");
    },
    onError: (err: Error) =>
      toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="philpen-title">
          <HeartPulse className="w-5 h-5 text-primary" /> PhilPEN risk assessments
        </h1>
        <p className="text-sm text-muted-foreground">
          Adult risk-factor assessment (smoking, alcohol, activity, diet, BMI). Feeds M1 Section G1-01..G1-01f.
        </p>
      </div>

      {canEnterRecords && selectedBarangay && (
        <Card data-testid="card-philpen-form">
          <CardHeader className="pb-2"><CardTitle className="text-base">Record assessment</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Patient name</label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} data-testid="input-philpen-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">DOB</label>
                <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-philpen-dob" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sex</label>
                <Select value={sex} onValueChange={(v) => setSex(v as "M" | "F")}>
                  <SelectTrigger data-testid="select-philpen-sex"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Assessment date</label>
                <Input type="date" value={assessmentDate} max={today} onChange={(e) => setAssessmentDate(e.target.value)} data-testid="input-philpen-date" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">BMI category</label>
                <Select value={bmi} onValueChange={(v) => setBmi(v as BmiCategory)}>
                  <SelectTrigger data-testid="select-philpen-bmi"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {BMI_CATEGORIES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-3 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={smoking} onCheckedChange={(v) => setSmoking(!!v)} data-testid="check-philpen-smoking" /> History of smoking</label>
              <label className="flex items-center gap-2"><Checkbox checked={binge} onCheckedChange={(v) => setBinge(!!v)} data-testid="check-philpen-binge" /> Binge drinker</label>
              <label className="flex items-center gap-2"><Checkbox checked={insufficient} onCheckedChange={(v) => setInsufficient(!!v)} data-testid="check-philpen-activity" /> Insufficient activity</label>
              <label className="flex items-center gap-2"><Checkbox checked={unhealthy} onCheckedChange={(v) => setUnhealthy(!!v)} data-testid="check-philpen-diet" /> Unhealthy diet</label>
            </div>
            <div className="flex justify-end pt-3">
              <Button onClick={() => create.mutate()} disabled={!patientName || !dob || create.isPending} className="gap-1" data-testid="button-save-philpen">
                <Save className="w-4 h-4" />
                {create.isPending ? "Saving…" : "Save assessment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-philpen-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {selectedBarangay ? `— ${selectedBarangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No PhilPEN assessments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedBarangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Risks</TableHead>
                  <TableHead>BMI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const risks = [
                    r.smokingHistory && "smoking",
                    r.bingeDrinker && "binge",
                    r.insufficientActivity && "low-activity",
                    r.unhealthyDiet && "diet",
                  ].filter(Boolean).join(", ") || "—";
                  return (
                    <TableRow key={r.id} data-testid={`philpen-row-${r.id}`}>
                      <TableCell className="font-mono text-xs">{r.assessmentDate}</TableCell>
                      {!selectedBarangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                      <TableCell>{r.patientName}</TableCell>
                      <TableCell>{r.sex}</TableCell>
                      <TableCell className="text-xs">{risks}</TableCell>
                      <TableCell>{r.bmiCategory ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
