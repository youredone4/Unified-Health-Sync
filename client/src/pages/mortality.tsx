import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type DeathEvent,
  MATERNAL_DEATH_CAUSES, type MaternalDeathCause,
  DEATH_RESIDENCIES, type DeathResidency,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skull, Save } from "lucide-react";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

export default function MortalityPage() {
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();

  const queryKey = useMemo(
    () => [`/api/death-events?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<DeathEvent[]>({ queryKey, enabled: !!selectedBarangay });

  const [deceasedName, setDeceasedName] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [age, setAge] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [dateOfDeath, setDateOfDeath] = useState(today());
  const [causeOfDeath, setCauseOfDeath] = useState("");
  const [maternalCause, setMaternalCause] = useState<MaternalDeathCause | "">("");
  const [residency, setResidency] = useState<DeathResidency | "">("");
  const [isFetalDeath, setIsFetalDeath] = useState(false);
  const [earlyNeonatal, setEarlyNeonatal] = useState(false);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setDeceasedName(""); setAge(""); setAgeDays(""); setCauseOfDeath("");
    setMaternalCause(""); setResidency(""); setIsFetalDeath(false);
    setEarlyNeonatal(false); setNotes("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/death-events", {
        deceasedName, sex, barangay: selectedBarangay,
        age: age ? Number(age) : null,
        ageDays: ageDays ? Number(ageDays) : null,
        dateOfDeath, causeOfDeath: causeOfDeath || null,
        maternalDeathCause: maternalCause || null,
        residency: residency || null,
        isFetalDeath, isLiveBornEarlyNeonatal: earlyNeonatal,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Death event recorded" });
      queryClient.invalidateQueries({ queryKey });
      reset();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="mortality-title">
          <Skull className="w-5 h-5 text-primary" /> Mortality registry
        </h1>
        <p className="text-sm text-muted-foreground">Feeds M1 Section H (mortality / natality).</p>
      </div>

      {!selectedBarangay ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Select a barangay to record deaths.
        </CardContent></Card>
      ) : (
        <>
          <Card data-testid="card-mortality-form">
            <CardHeader className="pb-2"><CardTitle className="text-base">Record death event</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Deceased name</label>
                  <Input value={deceasedName} onChange={(e) => setDeceasedName(e.target.value)} data-testid="input-name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date of death</label>
                  <Input type="date" value={dateOfDeath} max={today()} onChange={(e) => setDateOfDeath(e.target.value)} data-testid="input-date" />
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
                  <label className="text-xs text-muted-foreground">Age (years)</label>
                  <Input type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} data-testid="input-age-yrs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Age (days, neonatal/perinatal)</label>
                  <Input type="number" min="0" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} data-testid="input-age-days" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cause of death</label>
                  <Input value={causeOfDeath} onChange={(e) => setCauseOfDeath(e.target.value)} data-testid="input-cause" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                <Select value={maternalCause} onValueChange={(v) => setMaternalCause(v as MaternalDeathCause)}>
                  <SelectTrigger data-testid="select-maternal-cause"><SelectValue placeholder="Maternal death cause (if applicable)" /></SelectTrigger>
                  <SelectContent>{MATERNAL_DEATH_CAUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={residency} onValueChange={(v) => setResidency(v as DeathResidency)}>
                  <SelectTrigger data-testid="select-residency"><SelectValue placeholder="Residency" /></SelectTrigger>
                  <SelectContent>{DEATH_RESIDENCIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-3 pt-3 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={isFetalDeath} onCheckedChange={(v) => setIsFetalDeath(!!v)} data-testid="check-fetal" /> Fetal death (perinatal)</label>
                <label className="flex items-center gap-2"><Checkbox checked={earlyNeonatal} onCheckedChange={(v) => setEarlyNeonatal(!!v)} data-testid="check-early-neonatal" /> Live-born, early neonatal (≤6d)</label>
              </div>
              <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="mt-3" data-testid="input-notes" />
              <div className="flex justify-end pt-3">
                <Button onClick={() => create.mutate()} disabled={!deceasedName || create.isPending} className="gap-1" data-testid="button-save-death">
                  <Save className="w-4 h-4" />
                  {create.isPending ? "Saving…" : "Save death event"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-mortality-history">
            <CardHeader className="pb-2"><CardTitle className="text-base">Records — {selectedBarangay}</CardTitle></CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No death events recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Cause</TableHead>
                      <TableHead>Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} data-testid={`mortality-row-${r.id}`}>
                        <TableCell className="font-mono text-xs">{r.dateOfDeath}</TableCell>
                        <TableCell>{r.deceasedName}</TableCell>
                        <TableCell>{r.sex || "—"}</TableCell>
                        <TableCell>{r.ageDays !== null ? `${r.ageDays}d` : r.age !== null ? `${r.age}y` : "—"}</TableCell>
                        <TableCell className="text-xs">{r.causeOfDeath || "—"}</TableCell>
                        <TableCell className="text-xs space-x-1">
                          {r.maternalDeathCause && <Badge variant="destructive" className="text-[10px]">{r.maternalDeathCause}</Badge>}
                          {r.isFetalDeath && <Badge variant="outline" className="text-[10px]">Fetal</Badge>}
                          {r.isLiveBornEarlyNeonatal && <Badge variant="outline" className="text-[10px]">Early neonatal</Badge>}
                        </TableCell>
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
