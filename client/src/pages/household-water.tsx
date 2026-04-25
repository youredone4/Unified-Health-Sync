import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type HouseholdWaterRecord,
  WATER_LEVELS, type WaterLevel,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Droplet, Save } from "lucide-react";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

export default function HouseholdWaterPage() {
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();

  const queryKey = useMemo(
    () => [`/api/household-water-records?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    [selectedBarangay],
  );
  const { data: rows = [] } = useQuery<HouseholdWaterRecord[]>({ queryKey, enabled: !!selectedBarangay });

  const [householdId, setHouseholdId] = useState("");
  const [householdHead, setHouseholdHead] = useState("");
  const [surveyDate, setSurveyDate] = useState(today());
  const [waterLevel, setWaterLevel] = useState<WaterLevel | "">("");
  const [safelyManaged, setSafelyManaged] = useState(false);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/household-water-records", {
      barangay: selectedBarangay, surveyDate,
      householdId: householdId || null, householdHead: householdHead || null,
      waterLevel: waterLevel || null, safelyManaged,
      notes: notes || null,
    })).json(),
    onSuccess: () => {
      toast({ title: "Household water record saved" });
      queryClient.invalidateQueries({ queryKey });
      setHouseholdId(""); setHouseholdHead(""); setWaterLevel("");
      setSafelyManaged(false); setNotes("");
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="water-title">
          <Droplet className="w-5 h-5 text-primary" /> Household water survey
        </h1>
        <p className="text-sm text-muted-foreground">Feeds M1 Section W (water &amp; sanitation).</p>
      </div>

      {!selectedBarangay ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Select a barangay to record household water survey data.
        </CardContent></Card>
      ) : (
        <>
          <Card data-testid="card-water-form">
            <CardHeader className="pb-2"><CardTitle className="text-base">Record household</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Household ID (optional)</label>
                  <Input value={householdId} onChange={(e) => setHouseholdId(e.target.value)} data-testid="input-hh-id" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Household head</label>
                  <Input value={householdHead} onChange={(e) => setHouseholdHead(e.target.value)} data-testid="input-hh-head" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Survey date</label>
                  <Input type="date" value={surveyDate} max={today()} onChange={(e) => setSurveyDate(e.target.value)} data-testid="input-survey-date" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Water level</label>
                  <Select value={waterLevel} onValueChange={(v) => setWaterLevel(v as WaterLevel)}>
                    <SelectTrigger data-testid="select-water-level"><SelectValue placeholder="None / unknown" /></SelectTrigger>
                    <SelectContent>{WATER_LEVELS.map((l) => <SelectItem key={l} value={l}>Level {l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={safelyManaged} onCheckedChange={(v) => setSafelyManaged(!!v)} data-testid="check-safely-managed" />
                    Safely-managed drinking water
                  </label>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notes (optional)</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-water-notes" />
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-1" data-testid="button-save-water">
                  <Save className="w-4 h-4" />
                  {create.isPending ? "Saving…" : "Save record"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-water-history">
            <CardHeader className="pb-2"><CardTitle className="text-base">Records — {selectedBarangay}</CardTitle></CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No household water records yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Household</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Safely managed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} data-testid={`water-row-${r.id}`}>
                        <TableCell className="font-mono text-xs">{r.surveyDate}</TableCell>
                        <TableCell>{r.householdHead || r.householdId || "—"}</TableCell>
                        <TableCell>{r.waterLevel ? <Badge variant="outline">Level {r.waterLevel}</Badge> : "—"}</TableCell>
                        <TableCell>{r.safelyManaged ? "Yes" : "—"}</TableCell>
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
