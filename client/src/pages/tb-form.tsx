import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import type { TBPatient, Barangay } from "@shared/schema";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, ArrowLeft, Save } from "lucide-react";
import { Term } from "@/components/term";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  age: z.coerce.number().min(0).max(120),
  barangay: z.string().min(1, "Barangay is required"),
  addressLine: z.string().optional(),
  phone: z.string().optional(),
  tbType: z.string().default("Pulmonary"),
  treatmentPhase: z.string().min(1, "Treatment phase is required"),
  treatmentStartDate: z.string().min(1, "Treatment start date is required"),
  medsRegimenName: z.string().optional(),
  outcomeStatus: z.string().default("Ongoing"),
});

type FormValues = z.infer<typeof formSchema>;

export default function TBForm() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/tb/:id/edit");
  const isEdit = match && params?.id;
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: tbPatient } = useQuery<TBPatient>({
    queryKey: ['/api/tb-patients', params?.id],
    enabled: !!isEdit,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      age: 0,
      barangay: "",
      addressLine: "",
      phone: "",
      tbType: "Pulmonary",
      treatmentPhase: "Intensive",
      treatmentStartDate: new Date().toISOString().split('T')[0],
      medsRegimenName: "",
      outcomeStatus: "Ongoing",
    },
    values: isEdit && tbPatient ? {
      firstName: tbPatient.firstName,
      lastName: tbPatient.lastName,
      age: tbPatient.age,
      barangay: tbPatient.barangay,
      addressLine: tbPatient.addressLine || "",
      phone: tbPatient.phone || "",
      tbType: tbPatient.tbType || "Pulmonary",
      treatmentPhase: tbPatient.treatmentPhase,
      treatmentStartDate: tbPatient.treatmentStartDate,
      medsRegimenName: tbPatient.medsRegimenName || "",
      outcomeStatus: tbPatient.outcomeStatus || "Ongoing",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/tb-patients", data);
    },
    onSuccess: () => {
      invalidateScopedQueries('/api/tb-patients');
      toast({ title: "TB patient registered successfully" });
      navigate("/tb/registry");
    },
    onError: () => {
      toast({ title: "Failed to register patient", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("PUT", `/api/tb-patients/${params?.id}`, data);
    },
    onSuccess: () => {
      invalidateScopedQueries('/api/tb-patients');
      toast({ title: "Patient updated successfully" });
      navigate(`/tb/${params?.id}`);
    },
    onError: () => {
      toast({ title: "Failed to update patient", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const tbTypes = ["Pulmonary", "Extra-pulmonary"];
  const phases = ["Intensive", "Continuation"];
  const outcomes = ["Ongoing", "Completed", "Transferred", "LTFU"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardList className="w-6 h-6 text-purple-500" />
            {isEdit ? "Edit TB Patient" : "Register New TB Patient"}
          </h1>
          <p className="text-muted-foreground">{isEdit ? "Update patient information" : <>Add a new <Term name="TB DOTS">TB DOTS</Term> patient</>}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age *</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={120} {...field} data-testid="input-age" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barangay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barangay *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-barangay">
                            <SelectValue placeholder="Select barangay" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {barangays.filter(b => b.name).map(b => (
                            <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact number" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressLine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tbType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TB Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tb-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tbTypes.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="treatmentPhase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment Phase *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-phase">
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {phases.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="treatmentStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment Start Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="medsRegimenName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Regimen</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2HRZE/4HR" {...field} data-testid="input-regimen" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="outcomeStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outcome Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-outcome">
                            <SelectValue placeholder="Select outcome" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {outcomes.map(o => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? "Update Patient" : "Register Patient"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
