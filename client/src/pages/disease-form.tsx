import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import type { DiseaseCase, Barangay } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, ArrowLeft, Save } from "lucide-react";

const formSchema = z.object({
  patientName: z.string().min(1, "Patient name is required"),
  age: z.coerce.number().min(0).max(120),
  barangay: z.string().min(1, "Barangay is required"),
  addressLine: z.string().optional(),
  phone: z.string().optional(),
  condition: z.string().min(1, "Condition is required"),
  dateReported: z.string().min(1, "Date reported is required"),
  status: z.string().default("New"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function DiseaseForm() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/disease/:id/edit");
  const isEdit = match && params?.id;
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: diseaseCase } = useQuery<DiseaseCase>({
    queryKey: ['/api/disease-cases', params?.id],
    enabled: !!isEdit,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: "",
      age: 0,
      barangay: "",
      addressLine: "",
      phone: "",
      condition: "",
      dateReported: new Date().toISOString().split('T')[0],
      status: "New",
      notes: "",
    },
    values: isEdit && diseaseCase ? {
      patientName: diseaseCase.patientName,
      age: diseaseCase.age,
      barangay: diseaseCase.barangay,
      addressLine: diseaseCase.addressLine || "",
      phone: diseaseCase.phone || "",
      condition: diseaseCase.condition,
      dateReported: diseaseCase.dateReported,
      status: diseaseCase.status || "New",
      notes: diseaseCase.notes || "",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/disease-cases", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/disease-cases'] });
      toast({ title: "Case created successfully" });
      navigate("/disease/registry");
    },
    onError: () => {
      toast({ title: "Failed to create case", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("PUT", `/api/disease-cases/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/disease-cases'] });
      toast({ title: "Case updated successfully" });
      navigate(`/disease/${params?.id}`);
    },
    onError: () => {
      toast({ title: "Failed to update case", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const conditions = ["Diarrhea", "Chickenpox", "ARI", "Dengue suspected", "Measles suspected", "COVID-19 suspected", "Other"];
  const statuses = ["New", "Monitoring", "Referred", "Closed"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardList className="w-6 h-6 text-orange-500" />
            {isEdit ? "Edit Disease Case" : "Report New Case"}
          </h1>
          <p className="text-muted-foreground">{isEdit ? "Update case information" : "Add a new disease case report"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="patientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" {...field} data-testid="input-patient-name" />
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
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateReported"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Reported *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date-reported" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes about the case..." {...field} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? "Update Case" : "Save Case"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
