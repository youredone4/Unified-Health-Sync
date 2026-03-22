import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  ClipboardPlus, Plus, Search, Calendar, User, Stethoscope, MapPin, Activity,
  ChevronDown, ChevronUp, HeartPulse, FileText, History,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import type { Consult } from "@shared/schema";
import { TODAY_STR } from "@/lib/healthLogic";

const BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

const dispositionColors: Record<string, string> = {
  Treated: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Referred: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Admitted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Other: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const EMPTY_CONSULT = {
  patientName: "",
  age: "",
  sex: "M",
  barangay: "",
  addressLine: "",
  consultDate: TODAY_STR,
  chiefComplaint: "",
  diagnosis: "",
  treatment: "",
  disposition: "Treated",
  referredTo: "",
  dispositionNotes: "",
  consultType: "General",
  notes: "",
  bloodPressure: "",
  weightKg: "",
  temperatureC: "",
  pulseRate: "",
  heightCm: "",
};

function calcBmi(weightKg?: string | null, heightCm?: string | null): string {
  const w = parseFloat(weightKg ?? "");
  const h = parseFloat(heightCm ?? "") / 100;
  if (!w || !h || h <= 0) return "";
  return (w / (h * h)).toFixed(1);
}

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

function VitalsRow({ consult }: { consult: Consult }) {
  const bmi = calcBmi(consult.weightKg, consult.heightCm);
  const parts: string[] = [];
  if (consult.bloodPressure) parts.push(`BP ${consult.bloodPressure}`);
  if (consult.weightKg) parts.push(`Wt ${consult.weightKg} kg`);
  if (consult.temperatureC) parts.push(`Temp ${consult.temperatureC}°C`);
  if (consult.pulseRate) parts.push(`PR ${consult.pulseRate} bpm`);
  if (consult.heightCm) parts.push(`Ht ${consult.heightCm} cm`);
  if (bmi) parts.push(`BMI ${bmi}`);
  if (!parts.length) return null;
  return <p className="text-xs text-muted-foreground mt-0.5">{parts.join(" · ")}</p>;
}

function HistoryCard({ consult, defaultExpanded = false }: { consult: Consult; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bmi = calcBmi(consult.weightKg, consult.heightCm);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`history-card-${consult.id}`}>
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            {fmtDate(consult.consultDate)}
          </div>
          <p className="text-sm font-medium truncate">{consult.diagnosis}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Badge className={`text-xs ${dispositionColors[consult.disposition || "Treated"]}`}>
            {consult.disposition}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          {consult.chiefComplaint && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground">Chief Complaint</p>
              <p className="text-sm">{consult.chiefComplaint}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
            <p className="text-sm">{consult.diagnosis}</p>
          </div>
          {consult.treatment && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Treatment</p>
              <p className="text-sm">{consult.treatment}</p>
            </div>
          )}
          {(consult.bloodPressure || consult.weightKg || consult.temperatureC || consult.pulseRate || consult.heightCm) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Vital Signs</p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 mt-1">
                {consult.bloodPressure && <p className="text-sm">BP: {consult.bloodPressure}</p>}
                {consult.weightKg && <p className="text-sm">Wt: {consult.weightKg} kg</p>}
                {consult.temperatureC && <p className="text-sm">Temp: {consult.temperatureC}°C</p>}
                {consult.pulseRate && <p className="text-sm">PR: {consult.pulseRate} bpm</p>}
                {consult.heightCm && <p className="text-sm">Ht: {consult.heightCm} cm</p>}
                {bmi && <p className="text-sm">BMI: {bmi}</p>}
              </div>
            </div>
          )}
          {consult.disposition === "Other" && consult.dispositionNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Disposition Notes</p>
              <p className="text-sm">{consult.dispositionNotes}</p>
            </div>
          )}
          {consult.disposition === "Referred" && consult.referredTo && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Referred To</p>
              <p className="text-sm">{consult.referredTo}</p>
            </div>
          )}
          {consult.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Additional Notes</p>
              <p className="text-sm">{consult.notes}</p>
            </div>
          )}
          {consult.createdBy && (
            <p className="text-xs text-muted-foreground">Recorded by: {consult.createdBy}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PatientCheckupPage() {
  const { canAccessPatientCheckup } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newConsult, setNewConsult] = useState(EMPTY_CONSULT);

  // Sheet state
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ name: string; barangay: string } | null>(null);

  const bmi = calcBmi(newConsult.weightKg, newConsult.heightCm);

  const { data: consults = [], isLoading } = useQuery<Consult[]>({
    queryKey: ["/api/consults"],
    enabled: canAccessPatientCheckup,
  });

  const { data: patientHistory = [], isLoading: historyLoading } = useQuery<Consult[]>({
    queryKey: ["/api/consults/by-patient", selectedPatient?.name, selectedPatient?.barangay],
    enabled: !!selectedPatient && historySheetOpen,
    queryFn: async () => {
      if (!selectedPatient) return [];
      const params = new URLSearchParams({ name: selectedPatient.name, barangay: selectedPatient.barangay });
      const res = await fetch(`/api/consults/by-patient?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load patient history");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newConsult) => {
      return apiRequest("POST", "/api/consults", {
        ...data,
        age: Number(data.age),
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consults"] });
      toast({ title: "Consult recorded successfully" });
      setIsAddDialogOpen(false);
      setNewConsult(EMPTY_CONSULT);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to record consult", description: error.message, variant: "destructive" });
    },
  });

  const filteredConsults = consults.filter(consult => {
    const matchesSearch = consult.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consult.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBarangay = filterBarangay === "all" || consult.barangay === filterBarangay;
    return matchesSearch && matchesBarangay;
  });

  if (!canAccessPatientCheckup) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You don't have permission to access the Patient Check-up module.</p>
            <p className="text-sm text-muted-foreground mt-2">This feature is only available to System Administrators and Municipal Health Officers.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsult.patientName || !newConsult.age || !newConsult.barangay || !newConsult.diagnosis) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!newConsult.bloodPressure) {
      toast({ title: "Blood pressure is required", variant: "destructive" });
      return;
    }
    if (!newConsult.weightKg) {
      toast({ title: "Weight is required", variant: "destructive" });
      return;
    }
    if (newConsult.disposition === "Other" && !newConsult.dispositionNotes.trim()) {
      toast({ title: "Disposition notes are required when selecting 'Other'", variant: "destructive" });
      return;
    }
    createMutation.mutate(newConsult);
  };

  const handleRowClick = (consult: Consult) => {
    setSelectedPatient({ name: consult.patientName, barangay: consult.barangay });
    setHistorySheetOpen(true);
  };

  const handleNewConsultForPatient = () => {
    if (!selectedPatient) return;
    const latest = patientHistory[0];
    setNewConsult({
      ...EMPTY_CONSULT,
      patientName: selectedPatient.name,
      barangay: selectedPatient.barangay,
      age: latest ? String(latest.age) : "",
      sex: latest?.sex ?? "M",
      addressLine: latest?.addressLine ?? "",
    });
    setHistorySheetOpen(false);
    setIsAddDialogOpen(true);
  };

  const stats = {
    total: consults.length,
    treated: consults.filter(c => c.disposition === "Treated").length,
    referred: consults.filter(c => c.disposition === "Referred").length,
    admitted: consults.filter(c => c.disposition === "Admitted").length,
  };

  const set = (field: keyof typeof EMPTY_CONSULT) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setNewConsult(prev => ({ ...prev, [field]: e.target.value }));

  const latestConsult = patientHistory[0] ?? null;
  const olderConsults = patientHistory.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardPlus className="w-6 h-6 text-primary" />
            Patient Check-up
          </h1>
          <p className="text-muted-foreground">Search and view all patient information across all modules</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-consult">
              <Plus className="w-4 h-4 mr-2" />
              New Consult
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Consultation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">

              {/* Patient Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patient Name *</Label>
                  <Input
                    value={newConsult.patientName}
                    onChange={set("patientName")}
                    placeholder="Full name"
                    data-testid="input-patient-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Age *</Label>
                    <Input
                      type="number"
                      value={newConsult.age}
                      onChange={set("age")}
                      placeholder="Age"
                      data-testid="input-age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sex *</Label>
                    <Select value={newConsult.sex} onValueChange={(v) => setNewConsult(prev => ({ ...prev, sex: v }))}>
                      <SelectTrigger data-testid="select-sex">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Barangay *</Label>
                  <Select value={newConsult.barangay} onValueChange={(v) => setNewConsult(prev => ({ ...prev, barangay: v }))}>
                    <SelectTrigger data-testid="select-barangay">
                      <SelectValue placeholder="Select barangay" />
                    </SelectTrigger>
                    <SelectContent>
                      {BARANGAYS.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consult Date</Label>
                  <Input
                    type="date"
                    value={newConsult.consultDate}
                    onChange={set("consultDate")}
                    data-testid="input-consult-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chief Complaint *</Label>
                <Textarea
                  value={newConsult.chiefComplaint}
                  onChange={set("chiefComplaint")}
                  placeholder="Patient's main complaint"
                  data-testid="input-chief-complaint"
                />
              </div>

              <div className="space-y-2">
                <Label>Diagnosis *</Label>
                <Textarea
                  value={newConsult.diagnosis}
                  onChange={set("diagnosis")}
                  placeholder="Type diagnosis freely (e.g. Acute Upper Respiratory Infection)"
                  rows={2}
                  data-testid="input-diagnosis"
                />
              </div>

              <div className="space-y-2">
                <Label>Treatment Given</Label>
                <Textarea
                  value={newConsult.treatment}
                  onChange={set("treatment")}
                  placeholder="Medications and instructions given"
                  data-testid="input-treatment"
                />
              </div>

              {/* Disposition */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Disposition</Label>
                    <Select value={newConsult.disposition} onValueChange={(v) => setNewConsult(prev => ({ ...prev, disposition: v, dispositionNotes: "" }))}>
                      <SelectTrigger data-testid="select-disposition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Treated">Treated (sent home)</SelectItem>
                        <SelectItem value="Referred">Referred to RHU/Hospital</SelectItem>
                        <SelectItem value="Admitted">Admitted</SelectItem>
                        <SelectItem value="Other">Other (specify)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newConsult.disposition === "Referred" && (
                    <div className="space-y-2">
                      <Label>Referred To</Label>
                      <Input
                        value={newConsult.referredTo}
                        onChange={set("referredTo")}
                        placeholder="Facility name"
                        data-testid="input-referred-to"
                      />
                    </div>
                  )}
                </div>
                {newConsult.disposition === "Other" && (
                  <div className="space-y-2">
                    <Label>Disposition Notes *</Label>
                    <Textarea
                      value={newConsult.dispositionNotes}
                      onChange={set("dispositionNotes")}
                      placeholder="Describe the disposition in detail"
                      rows={2}
                      data-testid="input-disposition-notes"
                    />
                  </div>
                )}
              </div>

              {/* Vital Signs */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-sm">Vital Signs</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Blood Pressure * <span className="text-muted-foreground font-normal">(mmHg)</span></Label>
                    <Input
                      value={newConsult.bloodPressure}
                      onChange={set("bloodPressure")}
                      placeholder="e.g. 120/80"
                      data-testid="input-blood-pressure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight * <span className="text-muted-foreground font-normal">(kg)</span></Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newConsult.weightKg}
                      onChange={set("weightKg")}
                      placeholder="e.g. 65.5"
                      data-testid="input-weight"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperature <span className="text-muted-foreground font-normal">(°C)</span></Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newConsult.temperatureC}
                      onChange={set("temperatureC")}
                      placeholder="e.g. 37.0"
                      data-testid="input-temperature"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pulse Rate <span className="text-muted-foreground font-normal">(bpm)</span></Label>
                    <Input
                      type="number"
                      value={newConsult.pulseRate}
                      onChange={set("pulseRate")}
                      placeholder="e.g. 80"
                      data-testid="input-pulse-rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height <span className="text-muted-foreground font-normal">(cm)</span></Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newConsult.heightCm}
                      onChange={set("heightCm")}
                      placeholder="e.g. 160"
                      data-testid="input-height"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BMI <span className="text-muted-foreground font-normal">(auto-calculated)</span></Label>
                    <Input
                      value={bmi ? `${bmi} kg/m²` : "—"}
                      disabled
                      className="bg-muted cursor-default"
                      data-testid="text-bmi"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={newConsult.notes}
                  onChange={set("notes")}
                  placeholder="Any other observations"
                  data-testid="input-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-consult">
                  {createMutation.isPending ? "Saving..." : "Save Consult"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Consults</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.treated}</div>
            <p className="text-sm text-muted-foreground">Treated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.referred}</div>
            <p className="text-sm text-muted-foreground">Referred</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.admitted}</div>
            <p className="text-sm text-muted-foreground">Admitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Consult list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              Consultation Records
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-consults"
                />
              </div>
              <Select value={filterBarangay} onValueChange={setFilterBarangay}>
                <SelectTrigger className="w-40" data-testid="select-filter-barangay">
                  <SelectValue placeholder="All barangays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All barangays</SelectItem>
                  {BARANGAYS.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading consults...</p>
          ) : filteredConsults.length === 0 ? (
            <p className="text-muted-foreground">No consultation records found</p>
          ) : (
            <div className="space-y-2">
              {filteredConsults.map((consult) => (
                <div
                  key={consult.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 hover:border-primary/30 transition-colors"
                  onClick={() => handleRowClick(consult)}
                  data-testid={`consult-row-${consult.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleRowClick(consult)}
                  aria-label={`View consultation history for ${consult.patientName}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {consult.patientName}
                        <span className="text-muted-foreground ml-2">({consult.age} {consult.sex})</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{consult.diagnosis}</p>
                      {(consult.bloodPressure || consult.weightKg) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {consult.bloodPressure && <span>BP: {consult.bloodPressure}</span>}
                          {consult.bloodPressure && consult.weightKg && <span className="mx-1">·</span>}
                          {consult.weightKg && <span>Wt: {consult.weightKg} kg</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {consult.barangay}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {fmtDate(consult.consultDate)}
                    </div>
                    <Badge className={dispositionColors[consult.disposition || "Treated"]}>
                      {consult.disposition}
                    </Badge>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1 pl-1">Click any record to view patient consultation history.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient History Sheet */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Patient Consultation History
            </SheetTitle>
          </SheetHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">Loading history...</p>
            </div>
          ) : !latestConsult ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">No records found.</p>
            </div>
          ) : (
            <div className="space-y-5 mt-4">

              {/* Patient Summary */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate" data-testid="text-history-patient-name">{latestConsult.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {latestConsult.age} yrs · {latestConsult.sex === "M" ? "Male" : "Female"} · {latestConsult.barangay}
                  </p>
                  {latestConsult.addressLine && (
                    <p className="text-xs text-muted-foreground">{latestConsult.addressLine}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5" />
                      {patientHistory.length} consult{patientHistory.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Last seen: {fmtDate(latestConsult.consultDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest Consult */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Latest Consultation</h3>
                  <Badge variant="secondary" className="text-xs">{fmtDate(latestConsult.consultDate)}</Badge>
                </div>

                <Card>
                  <CardContent className="pt-4 space-y-3">
                    {latestConsult.chiefComplaint && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Chief Complaint</p>
                        <p className="text-sm">{latestConsult.chiefComplaint}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                      <p className="text-sm font-medium">{latestConsult.diagnosis}</p>
                    </div>
                    {latestConsult.treatment && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Treatment Given</p>
                        <p className="text-sm">{latestConsult.treatment}</p>
                      </div>
                    )}

                    {/* Vitals */}
                    {(latestConsult.bloodPressure || latestConsult.weightKg || latestConsult.temperatureC || latestConsult.pulseRate || latestConsult.heightCm) && (
                      <>
                        <Separator />
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">Vital Signs</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {latestConsult.bloodPressure && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">Blood Pressure</p>
                                <p className="text-sm font-semibold">{latestConsult.bloodPressure}</p>
                                <p className="text-xs text-muted-foreground">mmHg</p>
                              </div>
                            )}
                            {latestConsult.weightKg && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">Weight</p>
                                <p className="text-sm font-semibold">{latestConsult.weightKg}</p>
                                <p className="text-xs text-muted-foreground">kg</p>
                              </div>
                            )}
                            {latestConsult.temperatureC && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">Temperature</p>
                                <p className="text-sm font-semibold">{latestConsult.temperatureC}</p>
                                <p className="text-xs text-muted-foreground">°C</p>
                              </div>
                            )}
                            {latestConsult.pulseRate && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">Pulse Rate</p>
                                <p className="text-sm font-semibold">{latestConsult.pulseRate}</p>
                                <p className="text-xs text-muted-foreground">bpm</p>
                              </div>
                            )}
                            {latestConsult.heightCm && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">Height</p>
                                <p className="text-sm font-semibold">{latestConsult.heightCm}</p>
                                <p className="text-xs text-muted-foreground">cm</p>
                              </div>
                            )}
                            {calcBmi(latestConsult.weightKg, latestConsult.heightCm) && (
                              <div className="bg-muted/40 rounded p-2 text-center">
                                <p className="text-xs text-muted-foreground">BMI</p>
                                <p className="text-sm font-semibold">{calcBmi(latestConsult.weightKg, latestConsult.heightCm)}</p>
                                <p className="text-xs text-muted-foreground">kg/m²</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Disposition</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={dispositionColors[latestConsult.disposition || "Treated"]}>
                            {latestConsult.disposition}
                          </Badge>
                          {latestConsult.disposition === "Referred" && latestConsult.referredTo && (
                            <span className="text-xs text-muted-foreground">→ {latestConsult.referredTo}</span>
                          )}
                        </div>
                        {latestConsult.disposition === "Other" && latestConsult.dispositionNotes && (
                          <p className="text-xs text-muted-foreground mt-1">{latestConsult.dispositionNotes}</p>
                        )}
                      </div>
                      {latestConsult.createdBy && (
                        <p className="text-xs text-muted-foreground">By: {latestConsult.createdBy}</p>
                      )}
                    </div>

                    {latestConsult.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Additional Notes</p>
                          <p className="text-sm">{latestConsult.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* History Timeline */}
              {olderConsults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Previous Consultations</h3>
                    <Badge variant="outline" className="text-xs">{olderConsults.length} record{olderConsults.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="space-y-2">
                    {olderConsults.map((c) => (
                      <HistoryCard key={c.id} consult={c} />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer action */}
              <Separator />
              <div className="flex justify-between items-center pb-4">
                <p className="text-xs text-muted-foreground">
                  {patientHistory.length} total consult{patientHistory.length !== 1 ? "s" : ""} for this patient
                </p>
                <Button
                  onClick={handleNewConsultForPatient}
                  data-testid="button-new-consult-for-patient"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Consult for This Patient
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
