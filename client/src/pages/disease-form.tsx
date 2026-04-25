import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import type { DiseaseCase, Barangay, Mother, Child, Senior } from "@shared/schema";
import { ConditionPicker } from "@/components/condition-picker";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, ArrowLeft, Save, Search, Link2, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  linkedPersonType: z.string().optional(),
  linkedPersonId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type LinkType = "none" | "Mother" | "Child" | "Senior";

interface SearchCandidate {
  id: number;
  name: string;
  barangay: string;
  type: string;
}

export default function DiseaseForm() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/disease/:id/edit");
  const isEdit = match && params?.id;
  const { toast } = useToast();
  const { scopedPath } = useBarangay();

  const [linkType, setLinkType] = useState<LinkType>("none");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkedPerson, setLinkedPerson] = useState<SearchCandidate | null>(null);

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: diseaseCase } = useQuery<DiseaseCase>({
    queryKey: ['/api/disease-cases', params?.id],
    enabled: !!isEdit,
  });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath('/api/mothers')] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath('/api/children')] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath('/api/seniors')] });

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
      linkedPersonType: undefined,
      linkedPersonId: undefined,
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
      linkedPersonType: diseaseCase.linkedPersonType || undefined,
      linkedPersonId: diseaseCase.linkedPersonId || undefined,
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/disease-cases", data);
    },
    onSuccess: () => {
      invalidateScopedQueries('/api/disease-cases');
      toast({ title: "Case created successfully" });
      navigate("/disease/registry");
    },
    onError: () => {
      toast({ title: "Failed to create case", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // eslint-disable-next-line no-console
      console.log("[disease-form PUT request]", `/api/disease-cases/${params?.id}`, "body=", data);
      const res = await apiRequest("PUT", `/api/disease-cases/${params?.id}`, data);
      const json = await res.clone().json().catch(() => null);
      // eslint-disable-next-line no-console
      console.log("[disease-form PUT response]", res.status, "body=", json);
      return res;
    },
    onSuccess: () => {
      invalidateScopedQueries('/api/disease-cases');
      toast({ title: "Case updated successfully" });
      navigate(`/disease/${params?.id}`);
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[disease-form PUT error]", err);
      toast({ title: "Failed to update case", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    // ONE case row holds the primary condition + an additional_conditions
    // array. Reports/aggregators unfold each row into 1 + N counts so
    // per-disease morbidity tallies (M2, PIDSR Cat-II, M1 Section I)
    // stay correct without duplicating the patient/case row.
    const extras = additionalConditions.map((c) => c.trim()).filter((c) => c.length > 0);
    const payload = {
      ...data,
      additionalConditions: extras,
      linkedPersonType: linkedPerson?.type || (isEdit ? data.linkedPersonType : undefined) || undefined,
      linkedPersonId: linkedPerson?.id || (isEdit ? data.linkedPersonId : undefined) || undefined,
    };
    // Browser-side diagnostic: visible in DevTools Console. Strip once
    // the multi-condition save flow is verified end-to-end.
    // eslint-disable-next-line no-console
    console.log("[disease-form submit]", {
      isEdit,
      caseId: params?.id,
      additionalConditionsState: additionalConditions,
      extras,
      payloadKeys: Object.keys(payload),
      payloadAdditionalConditions: payload.additionalConditions,
    });
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const getCandidates = (): SearchCandidate[] => {
    const q = linkSearch.toLowerCase().trim();
    if (!q || linkType === "none") return [];
    if (linkType === "Mother") {
      return mothers
        .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, barangay: m.barangay, type: "Mother" }));
    }
    if (linkType === "Child") {
      return children
        .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, barangay: c.barangay, type: "Child" }));
    }
    if (linkType === "Senior") {
      return seniors
        .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, barangay: s.barangay, type: "Senior" }));
    }
    return [];
  };

  const candidates = getCandidates();

  const handleSelectCandidate = (c: SearchCandidate) => {
    setLinkedPerson(c);
    setLinkSearch("");
    form.setValue("patientName", c.name);
    form.setValue("barangay", c.barangay);
  };

  const handleClearLink = () => {
    setLinkedPerson(null);
    setLinkType("none");
    setLinkSearch("");
    form.setValue("linkedPersonType", undefined);
    form.setValue("linkedPersonId", undefined);
  };

  // Distinct conditions from existing cases — feeds the "Previously
  // recorded" group inside ConditionPicker so user-typed "Other..."
  // values stay available next time.
  const { data: existingConditions = [] } = useQuery<string[]>({
    queryKey: ["/api/disease-conditions"],
  });
  const statuses = ["New", "Monitoring", "Referred", "Closed"];

  // Multi-condition support (new-case mode only): a patient with co-
  // infections (e.g. HIV + TB) is reported as N separate disease_cases
  // rows — one per disease, since each has its own surveillance status,
  // PIDSR tier, and M2 morbidity count. additionalConditions holds the
  // extra rows; the primary condition still lives in the form's
  // `condition` field.
  const [additionalConditions, setAdditionalConditions] = useState<string[]>([]);
  // When editing, hydrate the extras list from the existing case once
  // it loads so the user sees their previously-entered co-conditions.
  useEffect(() => {
    if (isEdit && diseaseCase?.additionalConditions && Array.isArray(diseaseCase.additionalConditions)) {
      setAdditionalConditions(diseaseCase.additionalConditions);
    }
  }, [isEdit, diseaseCase?.id]);

  const existingLink = isEdit && diseaseCase?.linkedPersonType ? `${diseaseCase.linkedPersonType} #${diseaseCase.linkedPersonId}` : null;

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

      {!isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              Link to Existing Patient Profile (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedPerson ? (
              <div className="flex items-center justify-between p-3 rounded-md bg-blue-500/10 border border-blue-500/20" data-testid="div-linked-patient">
                <div>
                  <p className="font-medium text-sm">{linkedPerson.name}</p>
                  <p className="text-xs text-muted-foreground">{linkedPerson.type} — {linkedPerson.barangay}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearLink} data-testid="button-clear-link">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Select value={linkType} onValueChange={(v: LinkType) => { setLinkType(v); setLinkSearch(""); }}>
                    <SelectTrigger className="w-36" data-testid="select-link-type">
                      <SelectValue placeholder="Person type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No link</SelectItem>
                      <SelectItem value="Mother">Mother</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                  {linkType !== "none" && (
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder={`Search ${linkType} by name...`}
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        data-testid="input-link-search"
                      />
                    </div>
                  )}
                </div>
                {candidates.length > 0 && (
                  <div className="border border-border rounded-md overflow-hidden" data-testid="div-link-candidates">
                    {candidates.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 border-border flex items-center justify-between text-sm"
                        onClick={() => handleSelectCandidate(c)}
                        data-testid={`button-candidate-${c.id}`}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.type} — {c.barangay}</span>
                      </button>
                    ))}
                  </div>
                )}
                {linkType !== "none" && linkSearch.length > 1 && candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No matching {linkType} found. Fill in the form manually below.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isEdit && existingLink && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-blue-400" />
              <span className="text-muted-foreground">Linked profile:</span>
              <Badge variant="outline">{existingLink}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <FormControl>
                        <ConditionPicker
                          value={field.value || ""}
                          onChange={field.onChange}
                          existingConditions={existingConditions}
                          testIdPrefix="condition"
                        />
                      </FormControl>
                      <FormMessage />
                      {additionalConditions.map((extra, idx) => (
                        <div key={idx} className="mt-3 flex items-start gap-2" data-testid={`extra-condition-row-${idx}`}>
                          <div className="flex-1">
                            <FormLabel className="text-xs text-muted-foreground">
                              Additional condition {idx + 2}
                            </FormLabel>
                            <ConditionPicker
                              value={extra}
                              onChange={(next) => {
                                const copy = [...additionalConditions];
                                copy[idx] = next;
                                setAdditionalConditions(copy);
                              }}
                              existingConditions={existingConditions}
                              testIdPrefix={`extra-condition-${idx}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-6 h-8 w-8 shrink-0"
                            onClick={() => {
                              setAdditionalConditions(additionalConditions.filter((_, i) => i !== idx));
                            }}
                            data-testid={`remove-extra-condition-${idx}`}
                            aria-label={`Remove condition ${idx + 2}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 gap-1 text-xs"
                        onClick={() => setAdditionalConditions([...additionalConditions, ""])}
                        data-testid="button-add-condition"
                      >
                        <Plus className="w-3 h-3" /> Add another condition (co-infection)
                      </Button>
                      {additionalConditions.length > 0 && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          {isEdit
                            ? "The current case keeps its existing condition; each additional row is filed as a NEW case row sharing this patient's details."
                            : "Each condition is filed as a separate case row, sharing this patient's details."}
                          {" "}Required by DOH PIDSR/M2 — each disease has its own surveillance status.
                        </p>
                      )}
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
