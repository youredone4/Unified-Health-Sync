import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { queryClient, apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Child, Mother } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Baby, Syringe, Scale } from "lucide-react";

interface Barangay {
  id: number;
  name: string;
}

const vaccineList = [
  { key: "bcg", label: "BCG" },
  { key: "hepB", label: "Hepatitis B" },
  { key: "penta1", label: "Penta 1" },
  { key: "penta2", label: "Penta 2" },
  { key: "penta3", label: "Penta 3" },
  { key: "opv1", label: "OPV 1" },
  { key: "opv2", label: "OPV 2" },
  { key: "opv3", label: "OPV 3" },
  { key: "ipv1", label: "IPV 1" },
  { key: "ipv2", label: "IPV 2" },
  { key: "pcv1", label: "PCV 1" },
  { key: "pcv2", label: "PCV 2" },
  { key: "pcv3", label: "PCV 3" },
  { key: "mcv1", label: "Measles 1" },
  { key: "mcv2", label: "Measles 2" },
];

export default function ChildForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = params.id && params.id !== "new";
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: existingChild } = useQuery<Child>({
    queryKey: ['/api/children', params.id],
    enabled: !!isEditing,
  });

  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    sex: "",
    barangay: "",
    addressLine: "",
    motherId: "",
    nextVisitDate: "",
    birthWeightKg: "",
    birthWeightCategory: "",
  });

  const [vaccines, setVaccines] = useState<Record<string, string>>({});
  const [newGrowth, setNewGrowth] = useState({ date: "", weightKg: "", heightCm: "" });

  useEffect(() => {
    if (existingChild) {
      setFormData({
        name: existingChild.name || "",
        dob: existingChild.dob || "",
        sex: existingChild.sex || "",
        barangay: existingChild.barangay || "",
        addressLine: existingChild.addressLine || "",
        motherId: existingChild.motherId?.toString() || "",
        nextVisitDate: existingChild.nextVisitDate || "",
        birthWeightKg: existingChild.birthWeightKg || "",
        birthWeightCategory: existingChild.birthWeightCategory || "",
      });
      if (existingChild.vaccines) {
        setVaccines(existingChild.vaccines as Record<string, string>);
      }
    }
  }, [existingChild]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/children", data),
    onSuccess: () => {
      invalidateScopedQueries('/api/children');
      toast({ title: "Success", description: "Child registered successfully" });
      navigate("/child/registry");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to register child", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/children/${params.id}`, data),
    onSuccess: () => {
      invalidateScopedQueries('/api/children');
      toast({ title: "Success", description: "Child updated successfully" });
      navigate(`/child/${params.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update child", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const existingGrowth = existingChild?.growth || [];
    let growthArray = [...existingGrowth];
    
    if (newGrowth.date && newGrowth.weightKg) {
      growthArray.push({
        date: newGrowth.date,
        weightKg: parseFloat(newGrowth.weightKg),
        heightCm: newGrowth.heightCm ? parseFloat(newGrowth.heightCm) : undefined,
      });
    }

    const payload = {
      name: formData.name,
      dob: formData.dob,
      sex: formData.sex || null,
      barangay: formData.barangay,
      addressLine: formData.addressLine || null,
      motherId: formData.motherId && formData.motherId !== "none" ? parseInt(formData.motherId) : null,
      nextVisitDate: formData.nextVisitDate || null,
      birthWeightKg: formData.birthWeightKg || null,
      birthWeightCategory: formData.birthWeightCategory || null,
      vaccines: Object.keys(vaccines).length > 0 ? vaccines : null,
      growth: growthArray.length > 0 ? growthArray : null,
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

  const handleVaccineDate = (key: string, date: string) => {
    if (date) {
      setVaccines(prev => ({ ...prev, [key]: date }));
    } else {
      setVaccines(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
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
            <Baby className="w-6 h-6 text-blue-400" />
            {isEditing ? "Edit Child" : "Register New Child"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update child information and growth records" : "Add a new child to the immunization registry"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Child Information</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange("dob", e.target.value)}
                required
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
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barangay">Barangay *</Label>
              <Select value={formData.barangay} onValueChange={(v) => handleChange("barangay", v)}>
                <SelectTrigger data-testid="select-barangay">
                  <SelectValue placeholder="Select barangay" />
                </SelectTrigger>
                <SelectContent>
                  {barangays.filter(b => b.name).map(b => (
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
              <Label htmlFor="motherId">Mother (if registered)</Label>
              <Select value={formData.motherId} onValueChange={(v) => handleChange("motherId", v)}>
                <SelectTrigger data-testid="select-mother">
                  <SelectValue placeholder="Link to mother" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mothers.filter(m => m.id).map(m => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.firstName} {m.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Birth Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthWeightKg">Birth Weight (kg)</Label>
              <Input
                id="birthWeightKg"
                type="number"
                step="0.01"
                min="0.5"
                max="6"
                value={formData.birthWeightKg}
                onChange={(e) => handleChange("birthWeightKg", e.target.value)}
                data-testid="input-birth-weight"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthWeightCategory">Weight Category</Label>
              <Select value={formData.birthWeightCategory} onValueChange={(v) => handleChange("birthWeightCategory", v)}>
                <SelectTrigger data-testid="select-weight-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal (≥2.5kg)</SelectItem>
                  <SelectItem value="low">Low Birth Weight (&lt;2.5kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextVisitDate">Next Visit Date</Label>
              <Input
                id="nextVisitDate"
                type="date"
                value={formData.nextVisitDate}
                onChange={(e) => handleChange("nextVisitDate", e.target.value)}
                data-testid="input-next-visit"
              />
            </div>
          </CardContent>
        </Card>

        {isEditing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Add Growth Measurement
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="growthDate">Measurement Date</Label>
                <Input
                  id="growthDate"
                  type="date"
                  value={newGrowth.date}
                  onChange={(e) => setNewGrowth(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-growth-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="growthWeight">Weight (kg)</Label>
                <Input
                  id="growthWeight"
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="50"
                  value={newGrowth.weightKg}
                  onChange={(e) => setNewGrowth(prev => ({ ...prev, weightKg: e.target.value }))}
                  data-testid="input-growth-weight"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="growthHeight">Height (cm)</Label>
                <Input
                  id="growthHeight"
                  type="number"
                  step="0.1"
                  min="30"
                  max="150"
                  value={newGrowth.heightCm}
                  onChange={(e) => setNewGrowth(prev => ({ ...prev, heightCm: e.target.value }))}
                  data-testid="input-growth-height"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Syringe className="w-4 h-4" />
              Immunization Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
              {vaccineList.map(v => (
                <div key={v.key} className="space-y-2">
                  <Label htmlFor={`vaccine-${v.key}`}>{v.label}</Label>
                  <Input
                    id={`vaccine-${v.key}`}
                    type="date"
                    value={vaccines[v.key] || ""}
                    onChange={(e) => handleVaccineDate(v.key, e.target.value)}
                    data-testid={`input-vaccine-${v.key}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-save">
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "Saving..." : (isEditing ? "Save Changes" : "Register Child")}
          </Button>
        </div>
      </form>
    </div>
  );
}
