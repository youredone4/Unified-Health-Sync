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
import { useAuth, permissions } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const { role } = useAuth();
  const canEnter = permissions.canEnterRecords(role);

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
        <TabsContent value="fil"><FilariasisCard barangay={selectedBarangay} canEnter={canEnter} /></TabsContent>
        <TabsContent value="rab"><RabiesCard barangay={selectedBarangay} canEnter={canEnter} /></TabsContent>
        <TabsContent value="sch"><SchistoCard barangay={selectedBarangay} canEnter={canEnter} /></TabsContent>
        <TabsContent value="sth"><SthCard barangay={selectedBarangay} canEnter={canEnter} /></TabsContent>
        <TabsContent value="lep"><LeprosyCard barangay={selectedBarangay} canEnter={canEnter} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="dis-title">
        <ShieldAlert className="w-5 h-5 text-primary" /> Disease Programs
      </h1>
      <p className="text-sm text-muted-foreground">
        Vertical-program registers for Filariasis, Rabies, Schistosomiasis, STH, and Leprosy
        — each captures program-specific fields (e.g. Rabies Category I/II/III + ABTC center)
        that the generic Disease Cases tracker can&rsquo;t hold. Feeds M1 Sections DIS-FIL,
        DIS-RAB, DIS-SCH, DIS-STH, DIS-LEP.
      </p>
      <p className="text-xs text-muted-foreground italic mt-1">
        For general communicable-disease case reporting (PIDSR Cat-I / Cat-II), use{" "}
        <span className="font-mono">/disease</span> instead.
      </p>
    </div>
  );
}

function FilariasisCard({ barangay, canEnter }: { barangay: string | null; canEnter: boolean }) {
  const { toast } = useToast();
  const queryKey = useMemo(
    () => [barangay ? `/api/filariasis-records?barangay=${encodeURIComponent(barangay)}` : "/api/filariasis-records"],
    [barangay],
  );
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
    <div className="space-y-4">
      {canEnter && barangay && (
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
            <div className="flex items-center justify-end flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-fil">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card data-testid="card-fil-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {barangay ? `— ${barangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No filariasis records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!barangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Manifestation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`fil-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.examDate}</TableCell>
                    {!barangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell>{r.result || "—"}</TableCell>
                    <TableCell>{r.manifestation}</TableCell>
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

function RabiesCard({ barangay, canEnter }: { barangay: string | null; canEnter: boolean }) {
  const { toast } = useToast();
  const queryKey = useMemo(
    () => [barangay ? `/api/rabies-exposures?barangay=${encodeURIComponent(barangay)}` : "/api/rabies-exposures"],
    [barangay],
  );
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
    <div className="space-y-4">
      {canEnter && barangay && (
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
            <div className="flex items-center justify-end flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-rab">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card data-testid="card-rab-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {barangay ? `— ${barangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No rabies exposures yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!barangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Center</TableHead>
                  <TableHead>Complete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`rab-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.exposureDate}</TableCell>
                    {!barangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{r.treatmentCenter || "—"}</TableCell>
                    <TableCell>{r.completeDoses ? "Yes" : "—"}</TableCell>
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

function SchistoCard({ barangay, canEnter }: { barangay: string | null; canEnter: boolean }) {
  const { toast } = useToast();
  const queryKey = useMemo(
    () => [barangay ? `/api/schistosomiasis-records?barangay=${encodeURIComponent(barangay)}` : "/api/schistosomiasis-records"],
    [barangay],
  );
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
    <div className="space-y-4">
      {canEnter && barangay && (
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
            <div className="flex items-center justify-end flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-sch">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card data-testid="card-sch-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {barangay ? `— ${barangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No schistosomiasis records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!barangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`sch-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.seenDate}</TableCell>
                    {!barangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell className="text-xs space-x-1">
                      {r.suspected && <Badge variant="outline" className="text-[10px]">Suspected</Badge>}
                      {r.treated && <Badge variant="outline" className="text-[10px]">Treated</Badge>}
                      {r.confirmed && <Badge variant="outline" className="text-[10px]">Confirmed</Badge>}
                      {r.complicated && <Badge variant="destructive" className="text-[10px]">Complicated</Badge>}
                    </TableCell>
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

function SthCard({ barangay, canEnter }: { barangay: string | null; canEnter: boolean }) {
  const { toast } = useToast();
  const queryKey = useMemo(
    () => [barangay ? `/api/sth-records?barangay=${encodeURIComponent(barangay)}` : "/api/sth-records"],
    [barangay],
  );
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
    <div className="space-y-4">
      {canEnter && barangay && (
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
            <div className="flex items-center justify-end flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-sth">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card data-testid="card-sth-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {barangay ? `— ${barangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No STH records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!barangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Confirmed</TableHead>
                  <TableHead>Residency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`sth-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.screenDate}</TableCell>
                    {!barangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell>{r.confirmed ? "Yes" : "—"}</TableCell>
                    <TableCell className="text-xs">{r.residency}</TableCell>
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

function LeprosyCard({ barangay, canEnter }: { barangay: string | null; canEnter: boolean }) {
  const { toast } = useToast();
  const queryKey = useMemo(
    () => [barangay ? `/api/leprosy-records?barangay=${encodeURIComponent(barangay)}` : "/api/leprosy-records"],
    [barangay],
  );
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
    <div className="space-y-4">
      {canEnter && barangay && (
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
            <div className="flex items-center justify-end flex-wrap gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!pt.patientName || !pt.dob} className="gap-1" data-testid="button-save-lep">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card data-testid="card-lep-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Records {barangay ? `— ${barangay}` : "(consolidated, all barangays)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No leprosy records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!barangay && <TableHead>Barangay</TableHead>}
                  <TableHead>Patient</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid={`lep-row-${r.id}`}>
                    <TableCell className="font-mono text-xs">{r.registeredDate}</TableCell>
                    {!barangay && <TableCell className="text-xs">{r.barangay}</TableCell>}
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.sex}</TableCell>
                    <TableCell className="text-xs space-x-1">
                      {r.newCase && <Badge variant="outline" className="text-[10px]">New</Badge>}
                      {r.confirmed && <Badge variant="outline" className="text-[10px]">Confirmed</Badge>}
                    </TableCell>
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
