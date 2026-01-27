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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardPlus, Plus, Search, Calendar, User, Stethoscope, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { Consult } from "@shared/schema";
import { TODAY_STR } from "@/lib/healthLogic";

const BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

const COMMON_DIAGNOSES = [
  "Acute Upper Respiratory Infection",
  "Acute Gastroenteritis",
  "Urinary Tract Infection",
  "Hypertension",
  "Diabetes Mellitus Type 2",
  "Pneumonia",
  "Bronchitis",
  "Skin Infection",
  "Dengue Fever",
  "Other"
];

const dispositionColors: Record<string, string> = {
  Treated: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Referred: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Admitted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function PatientCheckupPage() {
  const { canAccessPatientCheckup } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newConsult, setNewConsult] = useState({
    patientName: "",
    age: "",
    sex: "M",
    barangay: "",
    addressLine: "",
    consultDate: TODAY_STR,
    chiefComplaint: "",
    diagnosis: "",
    icdCode: "",
    treatment: "",
    disposition: "Treated",
    referredTo: "",
    consultType: "General",
    notes: "",
  });

  const { data: consults = [], isLoading } = useQuery<Consult[]>({
    queryKey: ["/api/consults"],
    enabled: canAccessPatientCheckup,
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
      setNewConsult({
        patientName: "",
        age: "",
        sex: "M",
        barangay: "",
        addressLine: "",
        consultDate: TODAY_STR,
        chiefComplaint: "",
        diagnosis: "",
        icdCode: "",
        treatment: "",
        disposition: "Treated",
        referredTo: "",
        consultType: "General",
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to record consult", description: error.message, variant: "destructive" });
    },
  });

  const filteredConsults = consults.filter(consult => {
    const matchesSearch = consult.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consult.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBarangay = !filterBarangay || consult.barangay === filterBarangay;
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
    createMutation.mutate(newConsult);
  };

  const stats = {
    total: consults.length,
    treated: consults.filter(c => c.disposition === "Treated").length,
    referred: consults.filter(c => c.disposition === "Referred").length,
    admitted: consults.filter(c => c.disposition === "Admitted").length,
  };

  return (
    <div className="space-y-6">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patient Name *</Label>
                  <Input
                    value={newConsult.patientName}
                    onChange={(e) => setNewConsult(prev => ({ ...prev, patientName: e.target.value }))}
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
                      onChange={(e) => setNewConsult(prev => ({ ...prev, age: e.target.value }))}
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
                    onChange={(e) => setNewConsult(prev => ({ ...prev, consultDate: e.target.value }))}
                    data-testid="input-consult-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chief Complaint *</Label>
                <Textarea
                  value={newConsult.chiefComplaint}
                  onChange={(e) => setNewConsult(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  placeholder="Patient's main complaint"
                  data-testid="input-chief-complaint"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Diagnosis *</Label>
                  <Select value={newConsult.diagnosis} onValueChange={(v) => setNewConsult(prev => ({ ...prev, diagnosis: v }))}>
                    <SelectTrigger data-testid="select-diagnosis">
                      <SelectValue placeholder="Select diagnosis" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_DIAGNOSES.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ICD-10 Code</Label>
                  <Input
                    value={newConsult.icdCode}
                    onChange={(e) => setNewConsult(prev => ({ ...prev, icdCode: e.target.value }))}
                    placeholder="e.g. J06.9"
                    data-testid="input-icd-code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Treatment Given</Label>
                <Textarea
                  value={newConsult.treatment}
                  onChange={(e) => setNewConsult(prev => ({ ...prev, treatment: e.target.value }))}
                  placeholder="Medications and instructions given"
                  data-testid="input-treatment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Disposition</Label>
                  <Select value={newConsult.disposition} onValueChange={(v) => setNewConsult(prev => ({ ...prev, disposition: v }))}>
                    <SelectTrigger data-testid="select-disposition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Treated">Treated (sent home)</SelectItem>
                      <SelectItem value="Referred">Referred to RHU/Hospital</SelectItem>
                      <SelectItem value="Admitted">Admitted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newConsult.disposition === "Referred" && (
                  <div className="space-y-2">
                    <Label>Referred To</Label>
                    <Input
                      value={newConsult.referredTo}
                      onChange={(e) => setNewConsult(prev => ({ ...prev, referredTo: e.target.value }))}
                      placeholder="Facility name"
                      data-testid="input-referred-to"
                    />
                  </div>
                )}
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
                  <SelectItem value="">All barangays</SelectItem>
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
            <div className="space-y-3">
              {filteredConsults.map((consult) => (
                <div
                  key={consult.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`consult-row-${consult.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {consult.patientName}
                        <span className="text-muted-foreground ml-2">({consult.age} {consult.sex})</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{consult.diagnosis}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {consult.barangay}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(consult.consultDate), "MMM d, yyyy")}
                    </div>
                    <Badge className={dispositionColors[consult.disposition || "Treated"]}>
                      {consult.disposition}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
