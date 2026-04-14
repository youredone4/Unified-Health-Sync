import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient, apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mother } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, UserPlus, Syringe, Calendar } from "lucide-react";

interface Barangay {
  id: number;
  name: string;
}

export default function MotherForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = params.id && params.id !== "new";
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: existingMother } = useQuery<Mother>({
    queryKey: ['/api/mothers', params.id],
    enabled: !!isEditing,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    age: "",
    barangay: "",
    addressLine: "",
    phone: "",
    registrationDate: new Date().toISOString().split('T')[0],
    gaWeeks: "",
    expectedDeliveryDate: "",
    nextPrenatalCheckDate: "",
    ancVisits: "0",
    bmiStatus: "",
    tt1Date: "",
    tt2Date: "",
    tt3Date: "",
    tt4Date: "",
    tt5Date: "",
    status: "active",
    outcome: "",
  });

  useEffect(() => {
    if (existingMother) {
      setFormData({
        firstName: existingMother.firstName || "",
        lastName: existingMother.lastName || "",
        age: existingMother.age?.toString() || "",
        barangay: existingMother.barangay || "",
        addressLine: existingMother.addressLine || "",
        phone: existingMother.phone || "",
        registrationDate: existingMother.registrationDate || "",
        gaWeeks: existingMother.gaWeeks?.toString() || "",
        expectedDeliveryDate: existingMother.expectedDeliveryDate || "",
        nextPrenatalCheckDate: existingMother.nextPrenatalCheckDate || "",
        ancVisits: existingMother.ancVisits?.toString() || "0",
        bmiStatus: existingMother.bmiStatus || "",
        tt1Date: existingMother.tt1Date || "",
        tt2Date: existingMother.tt2Date || "",
        tt3Date: existingMother.tt3Date || "",
        tt4Date: existingMother.tt4Date || "",
        tt5Date: existingMother.tt5Date || "",
        status: existingMother.status || "active",
        outcome: existingMother.outcome || "",
      });
    }
  }, [existingMother]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/mothers", data),
    onSuccess: () => {
      invalidateScopedQueries('/api/mothers');
      toast({ title: "Success", description: "Mother registered successfully" });
      navigate("/prenatal/registry");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to register mother", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/mothers/${params.id}`, data),
    onSuccess: () => {
      invalidateScopedQueries('/api/mothers');
      toast({ title: "Success", description: "Mother updated successfully" });
      navigate(`/mother/${params.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update mother", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      age: parseInt(formData.age) || 0,
      gaWeeks: parseInt(formData.gaWeeks) || 0,
      ancVisits: parseInt(formData.ancVisits) || 0,
      addressLine: formData.addressLine || null,
      phone: formData.phone || null,
      expectedDeliveryDate: formData.expectedDeliveryDate || null,
      nextPrenatalCheckDate: formData.nextPrenatalCheckDate || null,
      bmiStatus: formData.bmiStatus || null,
      tt1Date: formData.tt1Date || null,
      tt2Date: formData.tt2Date || null,
      tt3Date: formData.tt3Date || null,
      tt4Date: formData.tt4Date || null,
      tt5Date: formData.tt5Date || null,
      outcome: formData.outcome || null,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <UserPlus className="w-6 h-6 text-pink-400" />
            {isEditing ? "Edit Mother" : "Register New Mother"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update patient information and visit records" : "Add a new prenatal patient to the registry"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                required
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                required
                data-testid="input-last-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                min="10"
                max="60"
                value={formData.age}
                onChange={(e) => handleChange("age", e.target.value)}
                required
                data-testid="input-age"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barangay">Barangay *</Label>
              <Select value={formData.barangay} onValueChange={(v) => handleChange("barangay", v)}>
                <SelectTrigger data-testid="select-barangay">
                  <SelectValue placeholder="Select barangay" />
                </SelectTrigger>
                <SelectContent>
                  {barangays.map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine">Address (Purok/Sitio)</Label>
              <Input
                id="addressLine"
                value={formData.addressLine}
                onChange={(e) => handleChange("addressLine", e.target.value)}
                data-testid="input-address"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Pregnancy Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registrationDate">Registration Date *</Label>
              <Input
                id="registrationDate"
                type="date"
                value={formData.registrationDate}
                onChange={(e) => handleChange("registrationDate", e.target.value)}
                required
                data-testid="input-registration-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gaWeeks">Gestational Age (weeks) *</Label>
              <Input
                id="gaWeeks"
                type="number"
                min="1"
                max="42"
                value={formData.gaWeeks}
                onChange={(e) => handleChange("gaWeeks", e.target.value)}
                required
                data-testid="input-ga-weeks"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => handleChange("expectedDeliveryDate", e.target.value)}
                data-testid="input-edd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextPrenatalCheckDate">Next Prenatal Check</Label>
              <Input
                id="nextPrenatalCheckDate"
                type="date"
                value={formData.nextPrenatalCheckDate}
                onChange={(e) => handleChange("nextPrenatalCheckDate", e.target.value)}
                data-testid="input-next-check"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ancVisits">ANC Visits Completed</Label>
              <Input
                id="ancVisits"
                type="number"
                min="0"
                value={formData.ancVisits}
                onChange={(e) => handleChange("ancVisits", e.target.value)}
                data-testid="input-anc-visits"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bmiStatus">BMI Status</Label>
              <Select value={formData.bmiStatus} onValueChange={(v) => handleChange("bmiStatus", v)}>
                <SelectTrigger data-testid="select-bmi-status">
                  <SelectValue placeholder="Select BMI status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outcome">Outcome</Label>
              <Select value={formData.outcome} onValueChange={(v) => handleChange("outcome", v)}>
                <SelectTrigger data-testid="select-outcome">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live_birth">Live Birth</SelectItem>
                  <SelectItem value="stillbirth">Stillbirth</SelectItem>
                  <SelectItem value="miscarriage">Miscarriage</SelectItem>
                  <SelectItem value="maternal_death">Maternal Death</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Syringe className="w-4 h-4" />
              Tetanus Toxoid (TT) Vaccination
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tt1Date">TT1 Date</Label>
              <Input
                id="tt1Date"
                type="date"
                value={formData.tt1Date}
                onChange={(e) => handleChange("tt1Date", e.target.value)}
                data-testid="input-tt1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt2Date">TT2 Date</Label>
              <Input
                id="tt2Date"
                type="date"
                value={formData.tt2Date}
                onChange={(e) => handleChange("tt2Date", e.target.value)}
                data-testid="input-tt2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt3Date">TT3 Date</Label>
              <Input
                id="tt3Date"
                type="date"
                value={formData.tt3Date}
                onChange={(e) => handleChange("tt3Date", e.target.value)}
                data-testid="input-tt3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt4Date">TT4 Date</Label>
              <Input
                id="tt4Date"
                type="date"
                value={formData.tt4Date}
                onChange={(e) => handleChange("tt4Date", e.target.value)}
                data-testid="input-tt4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt5Date">TT5 Date</Label>
              <Input
                id="tt5Date"
                type="date"
                value={formData.tt5Date}
                onChange={(e) => handleChange("tt5Date", e.target.value)}
                data-testid="input-tt5"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Saving..." : (isEditing ? "Save Changes" : "Register Mother")}
          </Button>
        </div>
      </form>
    </div>
  );
}
