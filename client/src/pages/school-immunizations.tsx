import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type SchoolImmunization,
  SCHOOL_VACCINES,
  type SchoolVaccine,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useAuth, permissions } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Save } from "lucide-react";
import { format } from "date-fns";

export default function SchoolImmunizationsPage() {
  const { selectedBarangay } = useBarangay();
  const { role } = useAuth();
  const canEnter = permissions.canEnterRecords(role);
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(
    () => [selectedBarangay ? `/api/school-immunizations?barangay=${encodeURIComponent(selectedBarangay)}` : "/api/school-immunizations"],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<SchoolImmunization[]>({ queryKey });

  const [learnerName, setLearnerName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<"M" | "F">("F");
  const [vaccine, setVaccine] = useState<SchoolVaccine>("HPV");
  const [doseNumber, setDoseNumber] = useState("1");
  const [vaccinationDate, setVaccinationDate] = useState(today);

  const reset = () => {
    setLearnerName("");
    setSchoolName("");
    setGradeLevel("");
    setDob("");
    setDoseNumber("1");
  };

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/school-immunizations", {
        learnerName,
        barangay: selectedBarangay,
        schoolName: schoolName || null,
        gradeLevel: gradeLevel ? Number(gradeLevel) : null,
        dob,
        sex,
        vaccine,
        doseNumber: Number(doseNumber),
        vaccinationDate,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vaccination recorded" });
      queryClient.invalidateQueries({ queryKey });
      reset();
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="school-imm-title">
          <GraduationCap className="w-5 h-5 text-primary" />
          School-based immunization
        </h1>
        <p className="text-sm text-muted-foreground">
          HPV (9-yo female) and Grade-1 Td. Feeds M1 Section D4.
        </p>
      </div>

      {canEnter && selectedBarangay && (
        <Card data-testid="card-school-imm-form">
            <CardHeader className="pb-2"><CardTitle className="text-base">Record vaccination</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Learner name</label>
                  <Input value={learnerName} onChange={(e) => setLearnerName(e.target.value)} data-testid="input-learner-name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">School (optional)</label>
                  <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} data-testid="input-school-name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Grade level</label>
                  <Input type="number" min="1" max="12" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} data-testid="input-grade" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">DOB</label>
                  <Input type="date" value={dob} max={today} onChange={(e) => setDob(e.target.value)} data-testid="input-dob" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Sex</label>
                  <Select value={sex} onValueChange={(v) => setSex(v as "M" | "F")}>
                    <SelectTrigger data-testid="select-sex"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="F">F</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vaccine</label>
                  <Select value={vaccine} onValueChange={(v) => setVaccine(v as SchoolVaccine)}>
                    <SelectTrigger data-testid="select-vaccine"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCHOOL_VACCINES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dose #</label>
                  <Input type="number" min="1" max="3" value={doseNumber} onChange={(e) => setDoseNumber(e.target.value)} data-testid="input-dose" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vaccination date</label>
                  <Input type="date" value={vaccinationDate} max={today} onChange={(e) => setVaccinationDate(e.target.value)} data-testid="input-vac-date" />
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <Button onClick={() => create.mutate()} disabled={!learnerName || !dob || create.isPending} className="gap-1" data-testid="button-save-school-imm">
                  <Save className="w-4 h-4" />
                  {create.isPending ? "Saving…" : "Save vaccination"}
                </Button>
              </div>
            </CardContent>
          </Card>
      )}

      <Card data-testid="card-school-imm-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {selectedBarangay ? `— ${selectedBarangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No school immunization records yet. Log HPV (9 yo F) and Grade-1 Td above; rows feed M1 Section D4.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!selectedBarangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Learner</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`school-imm-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.vaccinationDate}</TableCell>
                    {!selectedBarangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.learnerName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.vaccine}</Badge></TableCell>
                    <TableCell>{r.doseNumber}</TableCell>
                    <TableCell>{r.gradeLevel ?? "—"}</TableCell>
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
