import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Calendar, ChevronDown, ChevronUp, Plus, User } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PrenatalVisit, ChildVisit, SeniorVisit } from "@shared/schema";

type ProfileType = "Mother" | "Child" | "Senior";
type AnyVisit = PrenatalVisit | ChildVisit | SeniorVisit;

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return format(d, "MMM d, yyyy");
    const d2 = new Date(dateStr);
    if (isValid(d2)) return format(d2, "MMM d, yyyy");
    return dateStr;
  } catch {
    return dateStr;
  }
}

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// ── Row renderers per module ───────────────────────────────────────────────────

function PrenatalVisitRow({ visit }: { visit: PrenatalVisit }) {
  const [expanded, setExpanded] = useState(false);
  const v = visit;
  const summaryParts: string[] = [];
  if (v.bloodPressure) summaryParts.push(`BP ${v.bloodPressure}`);
  if (v.weightKg) summaryParts.push(`Wt ${v.weightKg} kg`);
  if (v.gaWeeks) summaryParts.push(`GA ${v.gaWeeks} wks`);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`visit-row-prenatal-${v.id}`}>
      <button
        className="w-full flex items-start justify-between p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(x => !x)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="shrink-0 text-xs">Visit {v.visitNumber}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Calendar className="w-3.5 h-3.5" />{fmtDate(v.visitDate)}
            </span>
            {summaryParts.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">{summaryParts.join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {v.riskStatus && (
            <Badge className={`text-xs ${riskColors[v.riskStatus] || ""}`}>{v.riskStatus}</Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-sm">
            {v.gaWeeks && <p><span className="text-muted-foreground">GA:</span> {v.gaWeeks} weeks</p>}
            {v.weightKg && <p><span className="text-muted-foreground">Weight:</span> {v.weightKg} kg</p>}
            {v.bloodPressure && <p><span className="text-muted-foreground">BP:</span> {v.bloodPressure}</p>}
            {v.fundalHeight && <p><span className="text-muted-foreground">Fundal Height:</span> {v.fundalHeight} cm</p>}
            {v.fetalHeartTone && <p><span className="text-muted-foreground">FHT:</span> {v.fetalHeartTone} bpm</p>}
          </div>
          {v.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="text-sm">{v.notes}</p>
            </div>
          )}
          {v.nextScheduledVisit && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <p className="text-sm"><span className="text-muted-foreground font-medium">Next Scheduled Visit:</span> {fmtDate(v.nextScheduledVisit)}</p>
            </div>
          )}
          {v.recordedBy && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />Recorded by: {v.recordedBy}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ChildVisitRow({ visit }: { visit: ChildVisit }) {
  const [expanded, setExpanded] = useState(false);
  const v = visit;
  const summaryParts: string[] = [];
  if (v.weightKg) summaryParts.push(`Wt ${v.weightKg} kg`);
  if (v.heightCm) summaryParts.push(`Ht ${v.heightCm} cm`);
  if (v.muac) summaryParts.push(`MUAC ${v.muac}`);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`visit-row-child-${v.id}`}>
      <button
        className="w-full flex items-start justify-between p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(x => !x)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="shrink-0 text-xs">Visit {v.visitNumber}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Calendar className="w-3.5 h-3.5" />{fmtDate(v.visitDate)}
            </span>
            {summaryParts.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">{summaryParts.join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-sm">
            {v.weightKg && <p><span className="text-muted-foreground">Weight:</span> {v.weightKg} kg</p>}
            {v.heightCm && <p><span className="text-muted-foreground">Height:</span> {v.heightCm} cm</p>}
            {v.muac && <p><span className="text-muted-foreground">MUAC:</span> {v.muac} cm</p>}
          </div>
          {v.nutritionNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Nutrition Notes</p>
              <p className="text-sm">{v.nutritionNotes}</p>
            </div>
          )}
          {v.immunizationNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Immunization Notes</p>
              <p className="text-sm">{v.immunizationNotes}</p>
            </div>
          )}
          {v.monitoringNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Monitoring Notes</p>
              <p className="text-sm">{v.monitoringNotes}</p>
            </div>
          )}
          {v.recordedBy && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />Recorded by: {v.recordedBy}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SeniorVisitRow({ visit }: { visit: SeniorVisit }) {
  const [expanded, setExpanded] = useState(false);
  const v = visit;
  const summaryParts: string[] = [];
  if (v.bloodPressure) summaryParts.push(`BP ${v.bloodPressure}`);
  if (v.weightKg) summaryParts.push(`Wt ${v.weightKg} kg`);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`visit-row-senior-${v.id}`}>
      <button
        className="w-full flex items-start justify-between p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(x => !x)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="shrink-0 text-xs">Visit {v.visitNumber}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Calendar className="w-3.5 h-3.5" />{fmtDate(v.visitDate)}
            </span>
            {summaryParts.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">{summaryParts.join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-sm">
            {v.bloodPressure && <p><span className="text-muted-foreground">BP:</span> {v.bloodPressure}</p>}
            {v.weightKg && <p><span className="text-muted-foreground">Weight:</span> {v.weightKg} kg</p>}
          </div>
          {v.medicationPickupNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Medication Note</p>
              <p className="text-sm">{v.medicationPickupNote}</p>
            </div>
          )}
          {v.symptomsRemarks && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Symptoms / Remarks</p>
              <p className="text-sm">{v.symptomsRemarks}</p>
            </div>
          )}
          {v.followUpNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Follow-up Notes</p>
              <p className="text-sm">{v.followUpNotes}</p>
            </div>
          )}
          {v.recordedBy && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />Recorded by: {v.recordedBy}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Visit Dialog ───────────────────────────────────────────────────────────

type FormState = Record<string, string>;

function emptyForm(profileType: ProfileType, prev: AnyVisit | null): FormState {
  const today = new Date().toISOString().split("T")[0];
  if (profileType === "Mother") {
    const p = prev as PrenatalVisit | null;
    return {
      visitDate: today,
      gaWeeks: p?.gaWeeks ? String(p.gaWeeks) : "",
      weightKg: p?.weightKg ?? "",
      bloodPressure: p?.bloodPressure ?? "",
      fundalHeight: p?.fundalHeight ?? "",
      fetalHeartTone: p?.fetalHeartTone ?? "",
      riskStatus: p?.riskStatus ?? "",
      notes: "",
      nextScheduledVisit: "",
    };
  }
  if (profileType === "Child") {
    const p = prev as ChildVisit | null;
    return {
      visitDate: today,
      weightKg: p?.weightKg ?? "",
      heightCm: p?.heightCm ?? "",
      muac: p?.muac ?? "",
      nutritionNotes: "",
      immunizationNotes: "",
      monitoringNotes: "",
    };
  }
  // Senior
  const p = prev as SeniorVisit | null;
  return {
    visitDate: today,
    bloodPressure: p?.bloodPressure ?? "",
    weightKg: p?.weightKg ?? "",
    medicationPickupNote: "",
    symptomsRemarks: "",
    followUpNotes: "",
  };
}

function AddVisitDialog({
  open,
  onOpenChange,
  profileType,
  profileId,
  prevVisit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileType: ProfileType;
  profileId: number;
  prevVisit: AnyVisit | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => emptyForm(profileType, prevVisit));

  const endpoint = `/api/nurse-visits/${profileType.toLowerCase()}/${profileId}`;

  const mutation = useMutation({
    mutationFn: async (body: FormState) => {
      return apiRequest("POST", endpoint, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nurse-visits", profileType.toLowerCase(), String(profileId)] });
      // Refresh mother profile so Next Prenatal Check card shows updated date
      if (profileType === "Mother") {
        queryClient.invalidateQueries({ queryKey: ["/api/mothers"] });
      }
      toast({ title: "Visit recorded", description: "The monitoring visit has been saved." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save visit. Please try again.", variant: "destructive" });
    },
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.visitDate) return;
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Nurse Visit — {profileType}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nv-visitDate">Visit Date *</Label>
            <Input
              id="nv-visitDate"
              type="date"
              value={form.visitDate}
              onChange={e => set("visitDate", e.target.value)}
              required
              data-testid="input-visit-date"
            />
            {prevVisit && (
              <p className="text-xs text-muted-foreground mt-1">
                Previous values pre-filled as reference — update as needed.
              </p>
            )}
          </div>

          {profileType === "Mother" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nv-gaWeeks">GA (weeks)</Label>
                  <Input id="nv-gaWeeks" type="number" min="1" max="45" value={form.gaWeeks} onChange={e => set("gaWeeks", e.target.value)} data-testid="input-ga-weeks" />
                </div>
                <div>
                  <Label htmlFor="nv-weightKg">Weight (kg)</Label>
                  <Input id="nv-weightKg" type="text" placeholder="e.g. 58.5" value={form.weightKg} onChange={e => set("weightKg", e.target.value)} data-testid="input-weight-kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nv-bp">Blood Pressure</Label>
                  <Input id="nv-bp" type="text" placeholder="e.g. 120/80" value={form.bloodPressure} onChange={e => set("bloodPressure", e.target.value)} data-testid="input-blood-pressure" />
                </div>
                <div>
                  <Label htmlFor="nv-fh">Fundal Height (cm)</Label>
                  <Input id="nv-fh" type="text" value={form.fundalHeight} onChange={e => set("fundalHeight", e.target.value)} data-testid="input-fundal-height" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nv-fht">Fetal Heart Tone (bpm)</Label>
                  <Input id="nv-fht" type="text" value={form.fetalHeartTone} onChange={e => set("fetalHeartTone", e.target.value)} data-testid="input-fetal-heart-tone" />
                </div>
                <div>
                  <Label htmlFor="nv-risk">Risk Status</Label>
                  <Select value={form.riskStatus || "none"} onValueChange={v => set("riskStatus", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-risk-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="nv-notes">Notes</Label>
                <Textarea id="nv-notes" rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} data-testid="textarea-notes" />
              </div>
              <div>
                <Label htmlFor="nv-nextVisit">Next Scheduled Visit</Label>
                <Input
                  id="nv-nextVisit"
                  type="date"
                  value={form.nextScheduledVisit}
                  onChange={e => set("nextScheduledVisit", e.target.value)}
                  data-testid="input-next-scheduled-visit"
                />
                <p className="text-xs text-muted-foreground mt-1">Optional — sets the Next Prenatal Check date on the profile.</p>
              </div>
            </>
          )}

          {profileType === "Child" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="nv-wt">Weight (kg)</Label>
                  <Input id="nv-wt" type="text" placeholder="e.g. 12.4" value={form.weightKg} onChange={e => set("weightKg", e.target.value)} data-testid="input-weight-kg" />
                </div>
                <div>
                  <Label htmlFor="nv-ht">Height (cm)</Label>
                  <Input id="nv-ht" type="text" placeholder="e.g. 90" value={form.heightCm} onChange={e => set("heightCm", e.target.value)} data-testid="input-height-cm" />
                </div>
                <div>
                  <Label htmlFor="nv-muac">MUAC (cm)</Label>
                  <Input id="nv-muac" type="text" placeholder="e.g. 13.5" value={form.muac} onChange={e => set("muac", e.target.value)} data-testid="input-muac" />
                </div>
              </div>
              <div>
                <Label htmlFor="nv-nutri">Nutrition Notes</Label>
                <Textarea id="nv-nutri" rows={2} value={form.nutritionNotes} onChange={e => set("nutritionNotes", e.target.value)} data-testid="textarea-nutrition-notes" />
              </div>
              <div>
                <Label htmlFor="nv-immuno">Immunization Notes</Label>
                <Textarea id="nv-immuno" rows={2} value={form.immunizationNotes} onChange={e => set("immunizationNotes", e.target.value)} data-testid="textarea-immunization-notes" />
              </div>
              <div>
                <Label htmlFor="nv-monitor">Monitoring Notes</Label>
                <Textarea id="nv-monitor" rows={2} value={form.monitoringNotes} onChange={e => set("monitoringNotes", e.target.value)} data-testid="textarea-monitoring-notes" />
              </div>
            </>
          )}

          {profileType === "Senior" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nv-bp">Blood Pressure</Label>
                  <Input id="nv-bp" type="text" placeholder="e.g. 140/90" value={form.bloodPressure} onChange={e => set("bloodPressure", e.target.value)} data-testid="input-blood-pressure" />
                </div>
                <div>
                  <Label htmlFor="nv-wt">Weight (kg)</Label>
                  <Input id="nv-wt" type="text" placeholder="e.g. 62" value={form.weightKg} onChange={e => set("weightKg", e.target.value)} data-testid="input-weight-kg" />
                </div>
              </div>
              <div>
                <Label htmlFor="nv-medpickup">Medication Pickup Note</Label>
                <Textarea id="nv-medpickup" rows={2} value={form.medicationPickupNote} onChange={e => set("medicationPickupNote", e.target.value)} data-testid="textarea-medication-note" />
              </div>
              <div>
                <Label htmlFor="nv-symptoms">Symptoms / Remarks</Label>
                <Textarea id="nv-symptoms" rows={2} value={form.symptomsRemarks} onChange={e => set("symptomsRemarks", e.target.value)} data-testid="textarea-symptoms" />
              </div>
              <div>
                <Label htmlFor="nv-followup">Follow-up Notes</Label>
                <Textarea id="nv-followup" rows={2} value={form.followUpNotes} onChange={e => set("followUpNotes", e.target.value)} data-testid="textarea-followup-notes" />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.visitDate} data-testid="button-save-visit">
              {mutation.isPending ? "Saving…" : "Save Visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Latest visit summary banner ───────────────────────────────────────────────

function LatestVisitSummary({ profileType, visit }: { profileType: ProfileType; visit: AnyVisit }) {
  const parts: string[] = [];
  if (profileType === "Mother") {
    const v = visit as PrenatalVisit;
    if (v.bloodPressure) parts.push(`BP ${v.bloodPressure}`);
    if (v.weightKg) parts.push(`Wt ${v.weightKg} kg`);
    if (v.gaWeeks) parts.push(`GA ${v.gaWeeks} wks`);
  } else if (profileType === "Child") {
    const v = visit as ChildVisit;
    if (v.weightKg) parts.push(`Wt ${v.weightKg} kg`);
    if (v.heightCm) parts.push(`Ht ${v.heightCm} cm`);
    if (v.muac) parts.push(`MUAC ${v.muac}`);
  } else {
    const v = visit as SeniorVisit;
    if (v.bloodPressure) parts.push(`BP ${v.bloodPressure}`);
    if (v.weightKg) parts.push(`Wt ${v.weightKg} kg`);
  }
  if (parts.length === 0) return null;

  return (
    <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5 flex items-center gap-2">
      <span className="font-medium">Latest Visit:</span>
      <span>{fmtDate(visit.visitDate)}</span>
      {parts.length > 0 && <span>·</span>}
      <span>{parts.join(" · ")}</span>
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

interface Props {
  profileType: ProfileType;
  profileId: number;
}

export default function VisitHistoryCard({ profileType, profileId }: Props) {
  const { user, isTL, isAdmin } = useAuth();
  const canAddVisit = isTL || isAdmin;
  const [addOpen, setAddOpen] = useState(false);

  const qKey = ["/api/nurse-visits", profileType.toLowerCase(), String(profileId)];
  const endpoint = `/api/nurse-visits/${profileType.toLowerCase()}/${profileId}`;

  const { data: visits = [], isLoading } = useQuery<AnyVisit[]>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load visit history");
      return res.json();
    },
    enabled: !!profileId,
  });

  const latestVisit = visits.length > 0 ? visits[0] : null;

  return (
    <>
      <Card data-testid={`visit-history-card-${profileType.toLowerCase()}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Nurse Monitoring Visits
              {visits.length > 0 && (
                <Badge variant="secondary" className="ml-1">{visits.length}</Badge>
              )}
            </span>
            {canAddVisit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setAddOpen(true)}
                data-testid="button-add-visit"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Visit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestVisit && (
            <LatestVisitSummary profileType={profileType} visit={latestVisit} />
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading visit history…</p>
          ) : visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canAddVisit
                ? "No monitoring visits yet. Click \"Add Visit\" to record the first one."
                : "No monitoring visits recorded yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {profileType === "Mother" && (visits as PrenatalVisit[]).map(v => (
                <PrenatalVisitRow key={v.id} visit={v} />
              ))}
              {profileType === "Child" && (visits as ChildVisit[]).map(v => (
                <ChildVisitRow key={v.id} visit={v} />
              ))}
              {profileType === "Senior" && (visits as SeniorVisit[]).map(v => (
                <SeniorVisitRow key={v.id} visit={v} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {addOpen && (
        <AddVisitDialog
          open={addOpen}
          onOpenChange={(v) => {
            setAddOpen(v);
          }}
          profileType={profileType}
          profileId={profileId}
          prevVisit={latestVisit}
        />
      )}
    </>
  );
}
