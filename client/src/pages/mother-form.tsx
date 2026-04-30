import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mother } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, UserPlus, Syringe, Calendar } from "lucide-react";

interface Barangay {
  id: number;
  name: string;
}

// ─── Zod schema ─────────────────────────────────────────────────────────────
// Single source of truth for validation. drizzle-zod is used elsewhere in the
// codebase, but a hand-written schema lives here because the form coerces a
// few fields (numbers from string inputs) before posting.
const motherFormSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName:  z.string().min(1, "Last name is required").max(100),
  age: z.coerce.number()
    .int("Age must be a whole number")
    .min(10, "Age must be at least 10")
    .max(60, "Age must be 60 or less"),
  barangay:    z.string().min(1, "Barangay is required"),
  addressLine: z.string().max(200).optional().or(z.literal("")),
  phone:       z.string().regex(/^[0-9+\-() ]*$/, "Phone may contain digits, spaces, and + - ( ) only").max(20).optional().or(z.literal("")),
  registrationDate: z.string().min(1, "Registration date is required"),
  gaWeeks: z.coerce.number()
    .int("Gestational age must be a whole number")
    .min(1, "Gestational age must be at least 1")
    .max(42, "Gestational age must be 42 weeks or less"),
  expectedDeliveryDate:  z.string().optional().or(z.literal("")),
  nextPrenatalCheckDate: z.string().optional().or(z.literal("")),
  ancVisits: z.coerce.number().int().min(0).max(20).default(0),
  bmiStatus: z.enum(["normal", "low", "high", ""]).optional(),
  tt1Date: z.string().optional().or(z.literal("")),
  tt2Date: z.string().optional().or(z.literal("")),
  tt3Date: z.string().optional().or(z.literal("")),
  tt4Date: z.string().optional().or(z.literal("")),
  tt5Date: z.string().optional().or(z.literal("")),
  status:  z.enum(["active", "delivered", "deceased"]).default("active"),
  outcome: z.enum(["", "live_birth", "stillbirth", "miscarriage", "maternal_death"]).optional(),
});

type MotherFormValues = z.infer<typeof motherFormSchema>;

const DEFAULT_VALUES: MotherFormValues = {
  firstName: "", lastName: "", age: 0,
  barangay: "", addressLine: "", phone: "",
  registrationDate: new Date().toISOString().split("T")[0],
  gaWeeks: 0,
  expectedDeliveryDate: "", nextPrenatalCheckDate: "",
  ancVisits: 0, bmiStatus: "",
  tt1Date: "", tt2Date: "", tt3Date: "", tt4Date: "", tt5Date: "",
  status: "active", outcome: "",
};

export default function MotherForm() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = !!params.id && params.id !== "new";
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ["/api/barangays"] });
  const { data: existingMother } = useQuery<Mother>({
    queryKey: ["/api/mothers", params.id],
    enabled: isEditing,
  });

  const form = useForm<MotherFormValues>({
    resolver: zodResolver(motherFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  // Hydrate the form when editing — runs once existingMother resolves.
  useEffect(() => {
    if (!existingMother) return;
    form.reset({
      firstName: existingMother.firstName ?? "",
      lastName:  existingMother.lastName  ?? "",
      age:       existingMother.age ?? 0,
      barangay:  existingMother.barangay ?? "",
      addressLine: existingMother.addressLine ?? "",
      phone:       existingMother.phone ?? "",
      registrationDate: existingMother.registrationDate ?? "",
      gaWeeks:          existingMother.gaWeeks ?? 0,
      expectedDeliveryDate:  existingMother.expectedDeliveryDate ?? "",
      nextPrenatalCheckDate: existingMother.nextPrenatalCheckDate ?? "",
      ancVisits: existingMother.ancVisits ?? 0,
      bmiStatus: (existingMother.bmiStatus as MotherFormValues["bmiStatus"]) ?? "",
      tt1Date: existingMother.tt1Date ?? "",
      tt2Date: existingMother.tt2Date ?? "",
      tt3Date: existingMother.tt3Date ?? "",
      tt4Date: existingMother.tt4Date ?? "",
      tt5Date: existingMother.tt5Date ?? "",
      status:  (existingMother.status as MotherFormValues["status"]) ?? "active",
      outcome: (existingMother.outcome as MotherFormValues["outcome"]) ?? "",
    });
  }, [existingMother, form]);

  const createMutation = useMutation({
    mutationFn: (data: MotherFormValues) => apiRequest("POST", "/api/mothers", normalizeForApi(data)),
    onSuccess: () => {
      invalidateScopedQueries("/api/mothers");
      toast({ title: "Success", description: "Mother registered successfully" });
      navigate("/prenatal/registry");
    },
    onError: () => toast({ title: "Error", description: "Failed to register mother", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: MotherFormValues) => apiRequest("PUT", `/api/mothers/${params.id}`, normalizeForApi(data)),
    onSuccess: () => {
      invalidateScopedQueries("/api/mothers");
      toast({ title: "Success", description: "Mother updated successfully" });
      navigate(`/mother/${params.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to update mother", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const onSubmit = (data: MotherFormValues) =>
    isEditing ? updateMutation.mutate(data) : createMutation.mutate(data);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} aria-label="Go back" data-testid="button-back">
          <ArrowLeft className="w-5 h-5" aria-hidden />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <UserPlus className="w-6 h-6 text-pink-400" aria-hidden />
            {isEditing ? "Edit Mother" : "Register New Mother"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update patient information and visit records" : "Add a new prenatal patient to the registry"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <TextField  control={form.control} name="firstName"   label="First Name" required testId="input-first-name" />
              <TextField  control={form.control} name="lastName"    label="Last Name"  required testId="input-last-name" />
              <TextField  control={form.control} name="age"         label="Age" type="number" required testId="input-age" />
              <TextField  control={form.control} name="phone"       label="Phone Number" type="tel" testId="input-phone" />
              <FormField
                control={form.control}
                name="barangay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barangay <span aria-hidden className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-barangay">
                          <SelectValue placeholder="Select barangay" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {barangays.map((b) => (
                          <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField control={form.control} name="addressLine" label="Address (Purok/Sitio)" testId="input-address" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" aria-hidden /> Pregnancy Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <TextField control={form.control} name="registrationDate"      label="Registration Date" type="date" required testId="input-registration-date" />
              <TextField control={form.control} name="gaWeeks"                label="Gestational Age (weeks)" type="number" required testId="input-ga-weeks" />
              <TextField control={form.control} name="expectedDeliveryDate"  label="Expected Delivery Date" type="date" testId="input-edd" />
              <TextField control={form.control} name="nextPrenatalCheckDate" label="Next Prenatal Check"    type="date" testId="input-next-check" />
              <TextField control={form.control} name="ancVisits"             label="ANC Visits Completed"   type="number" testId="input-anc-visits" />
              <SelectField
                control={form.control} name="bmiStatus" label="BMI Status" placeholder="Select BMI status"
                options={[{ v: "normal", l: "Normal" }, { v: "low", l: "Low" }, { v: "high", l: "High" }]}
                testId="select-bmi-status"
              />
              <SelectField
                control={form.control} name="status" label="Status"
                options={[{ v: "active", l: "Active" }, { v: "delivered", l: "Delivered" }, { v: "deceased", l: "Deceased" }]}
                testId="select-status"
              />
              <SelectField
                control={form.control} name="outcome" label="Outcome" placeholder="Select outcome"
                options={[
                  { v: "live_birth", l: "Live Birth" },
                  { v: "stillbirth", l: "Stillbirth" },
                  { v: "miscarriage", l: "Miscarriage" },
                  { v: "maternal_death", l: "Maternal Death" },
                ]}
                testId="select-outcome"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Syringe className="w-4 h-4" aria-hidden /> Tetanus Toxoid (TT) Vaccination
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-5 gap-4">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <TextField
                  key={n}
                  control={form.control}
                  name={`tt${n}Date` as keyof MotherFormValues}
                  label={`TT${n} Date`}
                  type="date"
                  testId={`input-tt${n}`}
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save">
              <Save className="w-4 h-4 mr-2" aria-hidden />
              {isPending ? "Saving…" : (isEditing ? "Save Changes" : "Register Mother")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// API expects nullable strings for optional dates / enums; coerce empty strings.
function normalizeForApi(data: MotherFormValues) {
  return {
    ...data,
    addressLine: data.addressLine || null,
    phone: data.phone || null,
    expectedDeliveryDate:  data.expectedDeliveryDate  || null,
    nextPrenatalCheckDate: data.nextPrenatalCheckDate || null,
    bmiStatus: data.bmiStatus || null,
    tt1Date: data.tt1Date || null,
    tt2Date: data.tt2Date || null,
    tt3Date: data.tt3Date || null,
    tt4Date: data.tt4Date || null,
    tt5Date: data.tt5Date || null,
    outcome: data.outcome || null,
  };
}

// ─── Reusable field primitives ─────────────────────────────────────────────
// Eliminates the 13× copy-pasted FormField/Input pattern that bloated the
// previous file. Validation messages now appear inline under each input on
// blur — the standard NN/g "error prevention" pattern for clinical data.

interface TextFieldProps {
  control: any;
  name: keyof MotherFormValues | `tt${1 | 2 | 3 | 4 | 5}Date`;
  label: string;
  type?: string;
  required?: boolean;
  testId?: string;
}

function TextField({ control, name, label, type = "text", required, testId }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span aria-hidden className="text-destructive ml-0.5">*</span> : null}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={type}
              aria-required={required || undefined}
              data-testid={testId}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface SelectFieldProps {
  control: any;
  name: keyof MotherFormValues;
  label: string;
  placeholder?: string;
  options: { v: string; l: string }[];
  testId?: string;
}

function SelectField({ control, name, label, placeholder, options, testId }: SelectFieldProps) {
  return (
    <FormField
      control={control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={String(field.value ?? "")} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger data-testid={testId}>
                <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
