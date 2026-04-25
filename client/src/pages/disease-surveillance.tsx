import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type FilariasisRecord, type RabiesExposure, type SchistosomiasisRecord,
  type SthRecord, type LeprosyRecord,
  FIL_RESULTS, FIL_MANIFESTATIONS,
  RABIES_CATEGORIES, RABIES_CENTERS,
  STH_RESIDENCIES,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Save } from "lucide-react";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

interface PtCommon { patientName: string; dob: string; sex: "M" | "F" }
function PtFields({ v, onChange }: { v: PtCommon; onChange: (v: PtCommon) => void }) {
  return (
    <>
      <div><label className="text-xs text-muted-foreground">Patient</label>
        <Input value={v.patientName} onChange={(e) => onChange({ ...v, patientName: e.target.value })} data-testid="input-name" />
      </div>
      <div><label className="text-xs text-muted-foreground">DOB</label>
        <Input type="date" value={v.dob} max={today()} onChange={(e) => onChange({ ...v, dob: e.target.value })} data-testid="input-dob" />
      </div>
      <div><label className="text-xs text-muted-foreground">Sex</label>
        <Select value={v.sex} onValueChange={(s) => onChange({ ...v, sex: s as "M" | "F" })}>
          <SelectTrigger data-testid="select-sex"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="M">M</SelectItem>
            <SelectItem value="F">F</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export default function DiseaseSurveillancePage() {
  const { selectedBarangay } = useBarangay();

  if (!selectedBarangay) {
    return (
      <div className="space-y-4">
        <Header />
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Select a barangay to record disease surveillance data.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header />
      <Tabs defaultValue="fil" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1">
          <TabsTrigger value="fil" data-testid="tab-fil">Filariasis</TabsTrigger>
          <TabsTrigger value="rab" data-testid="tab-rab">Rabies</TabsTrigger>
          <TabsTrigger value="sch" data-testid="tab-sch">Schisto</TabsTrigger>
          <TabsTrigger value="sth" data-testid="tab-sth">STH</TabsTrigger>
          <TabsTrigger value="lep" data-testid="tab-lep">Leprosy</TabsTrigger>
        </TabsList>
        <TabsContent value="fil"><FilariasisCard barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="rab"><RabiesCard barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="sch"><SchistoCard barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="sth"><SthCard barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="lep"><LeprosyCard barangay={selectedBarangay} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="dis-title">
        <ShieldAlert className="w-5 h-5 text-primary" /> Disease surveillance
      </h1>
      <p className="text-sm text-muted-foreground">Feeds M1 Sections DIS-FIL, DIS-RAB, DIS-SCH, DIS-STH, DIS-LEP.</p>
    </div>
  );
}

function FilariasisCard({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/filariasis-records?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<FilariasisRecord[]>({ queryKey });
  const [pt, setPt] = useState<PtCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [result, setResult] = useState<"POSITIVE" | "NEGATIVE" | "">("NEGATIVE");
  const [manif, setManif] = useState<"LYMPHEDEMA" | "HYDROCELE" | "NONE">("NONE");
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/filariasis-records", {
      ...pt, barangay, examDate: date, result: result || null, manifestation: manif,
    })).json(),
    onSuccess: () => { toast({ title: "Filariasis record saved" }); queryClient.invalidateQueries({ queryKey }); setPt({ patientName: "", dob: "", sex: "M" }); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid="card-fil">
      <CardHeader className="pb-2"><CardTitle className="text-base">Filariasis exam</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PtFields v={pt} onChange={setPt} />
          <div><label className="text-xs text-muted-foreground">Exam date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-fil-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={result} onValueChange={(v) => setResult(v as any)}>
            <SelectTrigger className="w-44" data-testid="select-fil-result"><SelectValue placeholder="Result" /></SelectTrigger>
            <SelectContent>{FIL_RESULTS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={manif} onValueChange={(v) => setManif(v as any)}>
            <SelectTrigger className="w-44" data-testid="select-fil-manif"><SelectValue /></SelectTrigger>
            <SelectContent>{FIL_MANIFESTATIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-fil">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RabiesCard({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/rabies-exposures?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<RabiesExposure[]>({ queryKey });
  const [pt, setPt] = useState<PtCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [cat, setCat] = useState<"I" | "II" | "III">("I");
  const [center, setCenter] = useState<"ABTC" | "NON_ABTC" | "">("ABTC");
  const [complete, setComplete] = useState(false);
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/rabies-exposures", {
      ...pt, barangay, exposureDate: date, category: cat, treatmentCenter: center || null, completeDoses: complete,
    })).json(),
    onSuccess: () => { toast({ title: "Rabies exposure saved" }); queryClient.invalidateQueries({ queryKey }); setPt({ patientName: "", dob: "", sex: "M" }); setComplete(false); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid="card-rab">
      <CardHeader className="pb-2"><CardTitle className="text-base">Rabies exposure</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PtFields v={pt} onChange={setPt} />
          <div><label className="text-xs text-muted-foreground">Exposure date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-rab-date" />
          </div>
          <div><label className="text-xs text-muted-foreground">Category</label>
            <Select value={cat} onValueChange={(v) => setCat(v as any)}>
              <SelectTrigger data-testid="select-rab-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{RABIES_CATEGORIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Treatment center</label>
            <Select value={center} onValueChange={(v) => setCenter(v as any)}>
              <SelectTrigger data-testid="select-rab-center"><SelectValue /></SelectTrigger>
              <SelectContent>{RABIES_CENTERS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={complete} onCheckedChange={(v) => setComplete(!!v)} data-testid="check-complete" />
          Complete anti-rabies vaccine doses
        </label>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-rab">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SchistoCard({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/schistosomiasis-records?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<SchistosomiasisRecord[]>({ queryKey });
  const [pt, setPt] = useState<PtCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [suspected, setSuspected] = useState(false);
  const [treated, setTreated] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [complicated, setComplicated] = useState(false);
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/schistosomiasis-records", {
      ...pt, barangay, seenDate: date, suspected, treated, confirmed, complicated,
    })).json(),
    onSuccess: () => { toast({ title: "Schistosomiasis record saved" }); queryClient.invalidateQueries({ queryKey }); setPt({ patientName: "", dob: "", sex: "M" }); setSuspected(false); setTreated(false); setConfirmed(false); setComplicated(false); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid="card-sch">
      <CardHeader className="pb-2"><CardTitle className="text-base">Schistosomiasis</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PtFields v={pt} onChange={setPt} />
          <div><label className="text-xs text-muted-foreground">Seen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-sch-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={suspected} onCheckedChange={(v) => setSuspected(!!v)} data-testid="check-suspected" /> Suspected</label>
          <label className="flex items-center gap-2"><Checkbox checked={treated} onCheckedChange={(v) => setTreated(!!v)} data-testid="check-treated" /> Treated</label>
          <label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} data-testid="check-confirmed" /> Confirmed</label>
          <label className="flex items-center gap-2"><Checkbox checked={complicated} onCheckedChange={(v) => setComplicated(!!v)} data-testid="check-complicated" /> Complicated</label>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-sch">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SthCard({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/sth-records?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<SthRecord[]>({ queryKey });
  const [pt, setPt] = useState<PtCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [confirmed, setConfirmed] = useState(false);
  const [residency, setResidency] = useState<"RESIDENT" | "NON_RESIDENT">("RESIDENT");
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/sth-records", {
      ...pt, barangay, screenDate: date, confirmed, residency,
    })).json(),
    onSuccess: () => { toast({ title: "STH record saved" }); queryClient.invalidateQueries({ queryKey }); setPt({ patientName: "", dob: "", sex: "M" }); setConfirmed(false); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid="card-sth">
      <CardHeader className="pb-2"><CardTitle className="text-base">Soil-transmitted helminth (STH)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PtFields v={pt} onChange={setPt} />
          <div><label className="text-xs text-muted-foreground">Screen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-sth-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} data-testid="check-sth-confirmed" /> Confirmed</label>
          <Select value={residency} onValueChange={(v) => setResidency(v as any)}>
            <SelectTrigger className="w-44" data-testid="select-sth-residency"><SelectValue /></SelectTrigger>
            <SelectContent>{STH_RESIDENCIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-sth">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeprosyCard({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/leprosy-records?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<LeprosyRecord[]>({ queryKey });
  const [pt, setPt] = useState<PtCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [newCase, setNewCase] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/leprosy-records", {
      ...pt, barangay, registeredDate: date, newCase, confirmed,
    })).json(),
    onSuccess: () => { toast({ title: "Leprosy record saved" }); queryClient.invalidateQueries({ queryKey }); setPt({ patientName: "", dob: "", sex: "M" }); setNewCase(false); setConfirmed(false); },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid="card-lep">
      <CardHeader className="pb-2"><CardTitle className="text-base">Leprosy</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PtFields v={pt} onChange={setPt} />
          <div><label className="text-xs text-muted-foreground">Registered date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-lep-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={newCase} onCheckedChange={(v) => setNewCase(!!v)} data-testid="check-new-case" /> New case</label>
          <label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} data-testid="check-lep-confirmed" /> Confirmed</label>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-lep">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
