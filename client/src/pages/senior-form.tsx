import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient, apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Senior } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Heart, Activity, Pill } from "lucide-react";

interface Barangay {
  id: number;
  name: string;
}

export default function SeniorForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = params.id && params.id !== "new";
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: existingSenior } = useQuery<Senior>({
    queryKey: ['/api/seniors', params.id],
    enabled: !!isEditing,
  });

  const [formData, setFormData] = useState({
    seniorUniqueId: "",
    seniorCitizenId: "",
    firstName: "",
    lastName: "",
    dob: "",
    sex: "",
    civilStatus: "",
    age: "",
    barangay: "",
    addressLine: "",
    phone: "",
    lastBP: "",
    lastBPDate: "",
    lastMedicationName: "",
    lastMedicationDoseMg: "",
    lastMedicationQuantity: "",
    lastMedicationGivenDate: "",
    nextPickupDate: "",
    htnMedsReady: false,
    pickedUp: false,
  });

  useEffect(() => {
    if (existingSenior) {
      setFormData({
        seniorUniqueId: existingSenior.seniorUniqueId || "",
        seniorCitizenId: existingSenior.seniorCitizenId || "",
        firstName: existingSenior.firstName || "",
        lastName: existingSenior.lastName || "",
        dob: existingSenior.dob || "",
        sex: existingSenior.sex || "",
        civilStatus: existingSenior.civilStatus || "",
        age: existingSenior.age?.toString() || "",
        barangay: existingSenior.barangay || "",
        addressLine: existingSenior.addressLine || "",
        phone: existingSenior.phone || "",
        lastBP: existingSenior.lastBP || "",
        lastBPDate: existingSenior.lastBPDate || "",
        lastMedicationName: existingSenior.lastMedicationName || "",
        lastMedicationDoseMg: existingSenior.lastMedicationDoseMg?.toString() || "",
        lastMedicationQuantity: existingSenior.lastMedicationQuantity?.toString() || "",
        lastMedicationGivenDate: existingSenior.lastMedicationGivenDate || "",
        nextPickupDate: existingSenior.nextPickupDate || "",
        htnMedsReady: existingSenior.htnMedsReady || false,
        pickedUp: existingSenior.pickedUp || false,
      });
    }
  }, [existingSenior]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/seniors", data),
    onSuccess: () => {
      invalidateScopedQueries('/api/seniors');
      toast({ title: "Success", description: "Senior registered successfully" });
      navigate("/senior/registry");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to register senior", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/seniors/${params.id}`, data),
    onSuccess: () => {
      invalidateScopedQueries('/api/seniors');
      toast({ title: "Success", description: "Senior updated successfully" });
      navigate(`/senior/${params.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update senior", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      seniorUniqueId: formData.seniorUniqueId || null,
      seniorCitizenId: formData.seniorCitizenId || null,
      firstName: formData.firstName,
      lastName: formData.lastName,
      dob: formData.dob || null,
      sex: formData.sex || null,
      civilStatus: formData.civilStatus || null,
      age: parseInt(formData.age) || 60,
      barangay: formData.barangay,
      addressLine: formData.addressLine || null,
      phone: formData.phone || null,
      lastBP: formData.lastBP || null,
      lastBPDate: formData.lastBPDate || null,
      lastMedicationName: formData.lastMedicationName || null,
      lastMedicationDoseMg: formData.lastMedicationDoseMg ? parseInt(formData.lastMedicationDoseMg) : null,
      lastMedicationQuantity: formData.lastMedicationQuantity ? parseInt(formData.lastMedicationQuantity) : null,
      lastMedicationGivenDate: formData.lastMedicationGivenDate || null,
      nextPickupDate: formData.nextPickupDate || null,
      htnMedsReady: formData.htnMedsReady,
      pickedUp: formData.pickedUp,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
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
            <Heart className="w-6 h-6 text-green-400" />
            {isEditing ? "Edit Senior" : "Register New Senior"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update senior information and health records" : "Add a new senior to the HTN medication program"}
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
                min="60"
                max="120"
                value={formData.age}
                onChange={(e) => handleChange("age", e.target.value)}
                required
                data-testid="input-age"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange("dob", e.target.value)}
                data-testid="input-dob"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sex</Label>
              <Select value={formData.sex} onValueChange={(v) => handleChange("sex", v)}>
                <SelectTrigger data-testid="select-sex">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="civilStatus">Civil Status</Label>
              <Select value={formData.civilStatus} onValueChange={(v) => handleChange("civilStatus", v)}>
                <SelectTrigger data-testid="select-civil-status">
                  <SelectValue placeholder="Select civil status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Widow">Widow</SelectItem>
                  <SelectItem value="Widower">Widower</SelectItem>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Separated">Separated</SelectItem>
                  <SelectItem value="Annulled">Annulled</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label htmlFor="seniorUniqueId">Senior Unique ID (for cross-barangay tracking)</Label>
              <Input
                id="seniorUniqueId"
                value={formData.seniorUniqueId}
                onChange={(e) => handleChange("seniorUniqueId", e.target.value)}
                placeholder="e.g., DOB-LASTNAME-INITIALS"
                data-testid="input-senior-unique-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seniorCitizenId">Senior Citizen ID</Label>
              <Input
                id="seniorCitizenId"
                value={formData.seniorCitizenId}
                onChange={(e) => handleChange("seniorCitizenId", e.target.value)}
                data-testid="input-senior-citizen-id"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Blood Pressure Reading
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastBP">Last BP Reading (e.g., 140/90)</Label>
              <Input
                id="lastBP"
                value={formData.lastBP}
                onChange={(e) => handleChange("lastBP", e.target.value)}
                placeholder="120/80"
                pattern="\d{2,3}/\d{2,3}"
                data-testid="input-last-bp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastBPDate">BP Reading Date</Label>
              <Input
                id="lastBPDate"
                type="date"
                value={formData.lastBPDate}
                onChange={(e) => handleChange("lastBPDate", e.target.value)}
                data-testid="input-last-bp-date"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Medication Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastMedicationName">Medication Name</Label>
                <Select value={formData.lastMedicationName} onValueChange={(v) => handleChange("lastMedicationName", v)}>
                  <SelectTrigger data-testid="select-medication">
                    <SelectValue placeholder="Select medication" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Amlodipine">Amlodipine</SelectItem>
                    <SelectItem value="Losartan">Losartan</SelectItem>
                    <SelectItem value="Metoprolol">Metoprolol</SelectItem>
                    <SelectItem value="Lisinopril">Lisinopril</SelectItem>
                    <SelectItem value="Atenolol">Atenolol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastMedicationDoseMg">Dose (mg)</Label>
                <Input
                  id="lastMedicationDoseMg"
                  type="number"
                  value={formData.lastMedicationDoseMg}
                  onChange={(e) => handleChange("lastMedicationDoseMg", e.target.value)}
                  data-testid="input-dose"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastMedicationQuantity">Quantity Given</Label>
                <Input
                  id="lastMedicationQuantity"
                  type="number"
                  value={formData.lastMedicationQuantity}
                  onChange={(e) => handleChange("lastMedicationQuantity", e.target.value)}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastMedicationGivenDate">Date Given</Label>
                <Input
                  id="lastMedicationGivenDate"
                  type="date"
                  value={formData.lastMedicationGivenDate}
                  onChange={(e) => handleChange("lastMedicationGivenDate", e.target.value)}
                  data-testid="input-date-given"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextPickupDate">Next Pickup Date</Label>
                <Input
                  id="nextPickupDate"
                  type="date"
                  value={formData.nextPickupDate}
                  onChange={(e) => handleChange("nextPickupDate", e.target.value)}
                  data-testid="input-next-pickup"
                />
              </div>
            </div>
            
            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="htnMedsReady"
                  checked={formData.htnMedsReady}
                  onCheckedChange={(checked) => handleChange("htnMedsReady", !!checked)}
                  data-testid="checkbox-meds-ready"
                />
                <Label htmlFor="htnMedsReady" className="cursor-pointer">Medications Ready for Pickup</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pickedUp"
                  checked={formData.pickedUp}
                  onCheckedChange={(checked) => handleChange("pickedUp", !!checked)}
                  data-testid="checkbox-picked-up"
                />
                <Label htmlFor="pickedUp" className="cursor-pointer">Already Picked Up</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Saving..." : (isEditing ? "Save Changes" : "Register Senior")}
          </Button>
        </div>
      </form>
    </div>
  );
}
