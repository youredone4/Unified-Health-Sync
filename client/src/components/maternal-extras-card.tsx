import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type Mother,
  type PrenatalScreening,
  type BirthAttendanceRecord,
  DELIVERY_TYPES,
  DELIVERY_TERMS,
  type DeliveryType,
  type DeliveryTerm,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Save, Stethoscope } from "lucide-react";
import { format } from "date-fns";

interface Props {
  mother: Mother;
}

export function MaternalExtrasCard({ mother }: Props) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  // ── Prenatal screenings ─────────────────────────────────────────────
  const psQueryKey = useMemo(
    () => [`/api/prenatal-screenings?motherId=${mother.id}`],
    [mother.id],
  );
  const { data: screenings = [] } = useQuery<PrenatalScreening[]>({ queryKey: psQueryKey });

  const [psDate, setPsDate] = useState(today);
  const [hepBScreened, setHepBScreened] = useState(false);
  const [hepBPositive, setHepBPositive] = useState(false);
  const [anemiaScreened, setAnemiaScreened] = useState(false);
  const [hgb, setHgb] = useState("");
  const [gdmScreened, setGdmScreened] = useState(false);
  const [ironFolic, setIronFolic] = useState(false);
  const [mms, setMms] = useState(false);
  const [calcium, setCalcium] = useState(false);
  const [deworming, setDeworming] = useState(false);
  const [psNotes, setPsNotes] = useState("");

  const psMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prenatal-screenings", {
        motherId: mother.id,
        screeningDate: psDate,
        hepBScreened,
        hepBPositive: hepBScreened ? hepBPositive : null,
        anemiaScreened,
        hgbLevelGdl: hgb ? Number(hgb) : null,
        gdmScreened,
        ironFolicComplete: ironFolic,
        mmsGiven: mms,
        calciumGiven: calcium,
        dewormingGiven: deworming,
        notes: psNotes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Screening recorded" });
      queryClient.invalidateQueries({ queryKey: psQueryKey });
      setHepBScreened(false);
      setHepBPositive(false);
      setAnemiaScreened(false);
      setHgb("");
      setGdmScreened(false);
      setIronFolic(false);
      setMms(false);
      setCalcium(false);
      setDeworming(false);
      setPsNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  // ── Birth attendance ────────────────────────────────────────────────
  const baQueryKey = useMemo(
    () => [`/api/birth-attendance-records?motherId=${mother.id}`],
    [mother.id],
  );
  const { data: birthRecords = [] } = useQuery<BirthAttendanceRecord[]>({ queryKey: baQueryKey });

  const [baDate, setBaDate] = useState(mother.outcomeDate || today);
  const [baType, setBaType] = useState<DeliveryType>("VAGINAL");
  const [baTerm, setBaTerm] = useState<DeliveryTerm>("FULL_TERM");
  const [baNotes, setBaNotes] = useState("");

  const baMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/birth-attendance-records", {
        motherId: mother.id,
        deliveryDate: baDate,
        deliveryType: baType,
        deliveryTerm: baType === "VAGINAL" || baType === "CESAREAN" ? baTerm : null,
        notes: baNotes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Birth-attendance record saved" });
      queryClient.invalidateQueries({ queryKey: baQueryKey });
      setBaNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-maternal-extras">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Prenatal screenings &amp; supplementation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Screening date</label>
            <Input type="date" value={psDate} max={today} onChange={(e) => setPsDate(e.target.value)} data-testid="input-ps-date" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hgb (g/dL)</label>
            <Input type="number" step="0.1" value={hgb} onChange={(e) => setHgb(e.target.value)} placeholder="e.g. 12.5" data-testid="input-ps-hgb" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <Textarea rows={1} value={psNotes} onChange={(e) => setPsNotes(e.target.value)} data-testid="input-ps-notes" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={hepBScreened} onCheckedChange={(v) => setHepBScreened(!!v)} data-testid="check-hepb-screen" /> Hep-B screened</label>
          <label className={`flex items-center gap-2 ${hepBScreened ? "" : "opacity-50"}`}><Checkbox checked={hepBPositive} disabled={!hepBScreened} onCheckedChange={(v) => setHepBPositive(!!v)} data-testid="check-hepb-positive" /> Hep-B positive</label>
          <label className="flex items-center gap-2"><Checkbox checked={anemiaScreened} onCheckedChange={(v) => setAnemiaScreened(!!v)} data-testid="check-anemia-screen" /> Anemia screened</label>
          <label className="flex items-center gap-2"><Checkbox checked={gdmScreened} onCheckedChange={(v) => setGdmScreened(!!v)} data-testid="check-gdm-screen" /> GDM screened</label>
          <label className="flex items-center gap-2"><Checkbox checked={ironFolic} onCheckedChange={(v) => setIronFolic(!!v)} data-testid="check-iron-folic" /> Iron-folic complete</label>
          <label className="flex items-center gap-2"><Checkbox checked={mms} onCheckedChange={(v) => setMms(!!v)} data-testid="check-mms" /> MMS given</label>
          <label className="flex items-center gap-2"><Checkbox checked={calcium} onCheckedChange={(v) => setCalcium(!!v)} data-testid="check-calcium" /> Calcium given</label>
          <label className="flex items-center gap-2"><Checkbox checked={deworming} onCheckedChange={(v) => setDeworming(!!v)} data-testid="check-deworming" /> Dewormed</label>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {screenings.length} screening{screenings.length === 1 ? "" : "s"} on file
          </Badge>
          <Button size="sm" onClick={() => psMutation.mutate()} disabled={psMutation.isPending} className="gap-1" data-testid="button-save-screening">
            <Save className="w-4 h-4" />
            {psMutation.isPending ? "Saving…" : "Record screening"}
          </Button>
        </div>

        {/* ── Birth attendance ── */}
        {mother.outcomeDate && (
          <div className="pt-3 border-t space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-primary" /> Birth attendance &amp; type
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Delivery date</label>
                <Input type="date" value={baDate} max={today} onChange={(e) => setBaDate(e.target.value)} data-testid="input-ba-date" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Delivery type</label>
                <Select value={baType} onValueChange={(v) => setBaType(v as DeliveryType)}>
                  <SelectTrigger data-testid="select-ba-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Term</label>
                <Select value={baTerm} onValueChange={(v) => setBaTerm(v as DeliveryTerm)}>
                  <SelectTrigger data-testid="select-ba-term"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes (optional)</label>
                <Input value={baNotes} onChange={(e) => setBaNotes(e.target.value)} data-testid="input-ba-notes" />
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className="text-xs font-normal">
                {birthRecords.length} record{birthRecords.length === 1 ? "" : "s"} on file
              </Badge>
              <Button size="sm" onClick={() => baMutation.mutate()} disabled={baMutation.isPending} className="gap-1" data-testid="button-save-birth-attendance">
                <Save className="w-4 h-4" />
                {baMutation.isPending ? "Saving…" : "Record delivery type"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
