import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type PhilpenAssessment, type NcdScreening, type VisionScreening,
  type CervicalCancerScreening, type MentalHealthScreening,
  BMI_CATEGORIES, type BmiCategory,
  NCD_CONDITIONS, type NcdCondition,
  NCD_MEDS_SOURCES, type NcdMedsSource,
  CERVICAL_SCREEN_METHODS, type CervicalScreenMethod,
  CARE_OUTCOMES, type CareOutcome,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeartPulse, Save } from "lucide-react";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

interface BasicCommon {
  patientName: string;
  dob: string;
  sex: "M" | "F";
}

function CommonFields({
  v, onChange, includeSex = true,
}: { v: BasicCommon; onChange: (v: BasicCommon) => void; includeSex?: boolean }) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">Patient name</label>
        <Input value={v.patientName} onChange={(e) => onChange({ ...v, patientName: e.target.value })} data-testid="input-patient-name" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">DOB</label>
        <Input type="date" value={v.dob} max={today()} onChange={(e) => onChange({ ...v, dob: e.target.value })} data-testid="input-dob" />
      </div>
      {includeSex && (
        <div>
          <label className="text-xs text-muted-foreground">Sex</label>
          <Select value={v.sex} onValueChange={(s) => onChange({ ...v, sex: s as "M" | "F" })}>
            <SelectTrigger data-testid="select-sex"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="F">F</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

export default function NcdScreeningsPage() {
  const { selectedBarangay } = useBarangay();

  if (!selectedBarangay) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Select a barangay to record NCD screenings.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader />
      <Tabs defaultValue="philpen" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1">
          <TabsTrigger value="philpen" data-testid="tab-philpen">PhilPEN (G1)</TabsTrigger>
          <TabsTrigger value="ncd" data-testid="tab-ncd">CV / HTN (G2)</TabsTrigger>
          <TabsTrigger value="vision" data-testid="tab-vision">Vision (G4)</TabsTrigger>
          <TabsTrigger value="cervical" data-testid="tab-cervical">Cervical (G6)</TabsTrigger>
          <TabsTrigger value="mental" data-testid="tab-mental">Mental (G8)</TabsTrigger>
        </TabsList>
        <TabsContent value="philpen"><PhilpenSection barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="ncd"><NcdSection barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="vision"><VisionSection barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="cervical"><CervicalSection barangay={selectedBarangay} /></TabsContent>
        <TabsContent value="mental"><MentalSection barangay={selectedBarangay} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="ncd-title">
        <HeartPulse className="w-5 h-5 text-primary" /> NCD &amp; Lifestyle screenings
      </h1>
      <p className="text-sm text-muted-foreground">Feeds M1 Sections G1, G2, G4, G6, G8.</p>
    </div>
  );
}

function PhilpenSection({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/philpen-assessments?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<PhilpenAssessment[]>({ queryKey });

  const [common, setCommon] = useState<BasicCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [smoking, setSmoking] = useState(false);
  const [drinker, setDrinker] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const [unhealthy, setUnhealthy] = useState(false);
  const [bmi, setBmi] = useState<BmiCategory | "">("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/philpen-assessments", {
        ...common, barangay, assessmentDate: date,
        smokingHistory: smoking, bingeDrinker: drinker,
        insufficientActivity: insufficient, unhealthyDiet: unhealthy,
        bmiCategory: bmi || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "PhilPEN assessment recorded" });
      queryClient.invalidateQueries({ queryKey });
      setCommon({ patientName: "", dob: "", sex: "M" });
      setSmoking(false); setDrinker(false); setInsufficient(false); setUnhealthy(false); setBmi("");
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-philpen">
      <CardHeader className="pb-2"><CardTitle className="text-base">PhilPEN assessment</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CommonFields v={common} onChange={setCommon} />
          <div>
            <label className="text-xs text-muted-foreground">Assessment date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-pp-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={smoking} onCheckedChange={(v) => setSmoking(!!v)} data-testid="check-smoking" /> Smoking history</label>
          <label className="flex items-center gap-2"><Checkbox checked={drinker} onCheckedChange={(v) => setDrinker(!!v)} data-testid="check-drinker" /> Binge drinker</label>
          <label className="flex items-center gap-2"><Checkbox checked={insufficient} onCheckedChange={(v) => setInsufficient(!!v)} data-testid="check-insufficient" /> Insufficient activity</label>
          <label className="flex items-center gap-2"><Checkbox checked={unhealthy} onCheckedChange={(v) => setUnhealthy(!!v)} data-testid="check-unhealthy" /> Unhealthy diet</label>
          <Select value={bmi} onValueChange={(v) => setBmi(v as BmiCategory)}>
            <SelectTrigger className="w-44" data-testid="select-bmi"><SelectValue placeholder="BMI category" /></SelectTrigger>
            <SelectContent>
              {BMI_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!common.patientName || !common.dob || create.isPending} className="gap-1" data-testid="button-save-pp">
            <Save className="w-4 h-4" /> {create.isPending ? "Saving…" : "Save assessment"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NcdSection({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/ncd-screenings?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<NcdScreening[]>({ queryKey });

  const [common, setCommon] = useState<BasicCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [condition, setCondition] = useState<NcdCondition>("HTN");
  const [diagnosed, setDiagnosed] = useState(false);
  const [meds, setMeds] = useState(false);
  const [source, setSource] = useState<NcdMedsSource | "">("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ncd-screenings", {
        ...common, barangay, screenDate: date, condition,
        diagnosed, medsProvided: meds, medsSource: source || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "NCD screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setCommon({ patientName: "", dob: "", sex: "M" });
      setDiagnosed(false); setMeds(false); setSource("");
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-ncd">
      <CardHeader className="pb-2"><CardTitle className="text-base">CV / HTN screening</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CommonFields v={common} onChange={setCommon} />
          <div>
            <label className="text-xs text-muted-foreground">Screen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-ncd-date" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Condition</label>
            <Select value={condition} onValueChange={(v) => setCondition(v as NcdCondition)}>
              <SelectTrigger data-testid="select-condition"><SelectValue /></SelectTrigger>
              <SelectContent>{NCD_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={diagnosed} onCheckedChange={(v) => setDiagnosed(!!v)} data-testid="check-diagnosed" /> Diagnosed</label>
          <label className="flex items-center gap-2"><Checkbox checked={meds} onCheckedChange={(v) => setMeds(!!v)} data-testid="check-meds" /> Meds provided</label>
          <Select value={source} onValueChange={(v) => setSource(v as NcdMedsSource)}>
            <SelectTrigger className="w-44" data-testid="select-source"><SelectValue placeholder="Meds source" /></SelectTrigger>
            <SelectContent>{NCD_MEDS_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!common.patientName || !common.dob || create.isPending} className="gap-1" data-testid="button-save-ncd">
            <Save className="w-4 h-4" /> {create.isPending ? "Saving…" : "Save screening"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VisionSection({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/vision-screenings?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<VisionScreening[]>({ queryKey });

  const [common, setCommon] = useState<BasicCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [eyeDisease, setEyeDisease] = useState(false);
  const [referred, setReferred] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vision-screenings", {
        ...common, barangay, screenDate: date,
        eyeDiseaseFound: eyeDisease, referredToEyeCare: referred,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vision screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setCommon({ patientName: "", dob: "", sex: "M" });
      setEyeDisease(false); setReferred(false);
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-vision">
      <CardHeader className="pb-2"><CardTitle className="text-base">Vision screening (60+)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CommonFields v={common} onChange={setCommon} />
          <div>
            <label className="text-xs text-muted-foreground">Screen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-vision-date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={eyeDisease} onCheckedChange={(v) => setEyeDisease(!!v)} data-testid="check-eye-disease" /> Eye disease found</label>
          <label className="flex items-center gap-2"><Checkbox checked={referred} onCheckedChange={(v) => setReferred(!!v)} data-testid="check-eye-ref" /> Referred to eye care</label>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!common.patientName || !common.dob || create.isPending} className="gap-1" data-testid="button-save-vision">
            <Save className="w-4 h-4" /> {create.isPending ? "Saving…" : "Save screening"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CervicalSection({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/cervical-cancer-screenings?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<CervicalCancerScreening[]>({ queryKey });

  const [common, setCommon] = useState<BasicCommon>({ patientName: "", dob: "", sex: "F" });
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<CervicalScreenMethod | "">("VIA");
  const [suspicious, setSuspicious] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linkedOutcome, setLinkedOutcome] = useState<CareOutcome | "">("");
  const [precancer, setPrecancer] = useState(false);
  const [precancerOutcome, setPrecancerOutcome] = useState<CareOutcome | "">("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cervical-cancer-screenings", {
        patientName: common.patientName, barangay, dob: common.dob, screenDate: date,
        screenMethod: method || null,
        suspicious, linkedToCare: linked, linkedOutcome: linkedOutcome || null,
        precancerous: precancer, precancerousOutcome: precancerOutcome || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cervical cancer screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setCommon({ patientName: "", dob: "", sex: "F" });
      setSuspicious(false); setLinked(false); setLinkedOutcome("");
      setPrecancer(false); setPrecancerOutcome("");
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-cervical">
      <CardHeader className="pb-2"><CardTitle className="text-base">Cervical cancer screening (women 30–65)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CommonFields v={common} onChange={setCommon} includeSex={false} />
          <div>
            <label className="text-xs text-muted-foreground">Screen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-cervical-date" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Method</label>
            <Select value={method} onValueChange={(v) => setMethod(v as CervicalScreenMethod)}>
              <SelectTrigger data-testid="select-method"><SelectValue /></SelectTrigger>
              <SelectContent>{CERVICAL_SCREEN_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={suspicious} onCheckedChange={(v) => setSuspicious(!!v)} data-testid="check-suspicious" /> Suspicious</label>
          <label className="flex items-center gap-2"><Checkbox checked={linked} onCheckedChange={(v) => setLinked(!!v)} data-testid="check-linked" /> Linked to care</label>
          <Select value={linkedOutcome} onValueChange={(v) => setLinkedOutcome(v as CareOutcome)}>
            <SelectTrigger className="w-40" data-testid="select-linked-outcome"><SelectValue placeholder="Linked outcome" /></SelectTrigger>
            <SelectContent>{CARE_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex items-center gap-2"><Checkbox checked={precancer} onCheckedChange={(v) => setPrecancer(!!v)} data-testid="check-precancer" /> Precancerous</label>
          <Select value={precancerOutcome} onValueChange={(v) => setPrecancerOutcome(v as CareOutcome)}>
            <SelectTrigger className="w-40" data-testid="select-precancer-outcome"><SelectValue placeholder="Precancer outcome" /></SelectTrigger>
            <SelectContent>{CARE_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!common.patientName || !common.dob || create.isPending} className="gap-1" data-testid="button-save-cervical">
            <Save className="w-4 h-4" /> {create.isPending ? "Saving…" : "Save screening"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MentalSection({ barangay }: { barangay: string }) {
  const { toast } = useToast();
  const queryKey = useMemo(() => [`/api/mental-health-screenings?barangay=${encodeURIComponent(barangay)}`], [barangay]);
  const { data: rows = [] } = useQuery<MentalHealthScreening[]>({ queryKey });

  const [common, setCommon] = useState<BasicCommon>({ patientName: "", dob: "", sex: "M" });
  const [date, setDate] = useState(today());
  const [positive, setPositive] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mental-health-screenings", {
        ...common, barangay, screenDate: date, tool: "mhGAP", positive,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "mhGAP screening recorded" });
      queryClient.invalidateQueries({ queryKey });
      setCommon({ patientName: "", dob: "", sex: "M" });
      setPositive(false);
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-mental">
      <CardHeader className="pb-2"><CardTitle className="text-base">mhGAP screening</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <CommonFields v={common} onChange={setCommon} />
          <div>
            <label className="text-xs text-muted-foreground">Screen date</label>
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="input-mental-date" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={positive} onCheckedChange={(v) => setPositive(!!v)} data-testid="check-positive" />
          Positive (mental-health concern identified)
        </label>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">{rows.length} recorded</Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={!common.patientName || !common.dob || create.isPending} className="gap-1" data-testid="button-save-mental">
            <Save className="w-4 h-4" /> {create.isPending ? "Saving…" : "Save screening"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
