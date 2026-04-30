import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";

type CampaignType =
  | "GARANTISADONG_PAMBATA"
  | "OPERATION_TIMBANG_PLUS"
  | "MASS_IMMUNIZATION_SIA"
  | "MASS_DEWORMING"
  | "ADULT_VACCINATION_DAY"
  | "OTHER";

const CAMPAIGN_TYPES: { v: CampaignType; l: string }[] = [
  { v: "GARANTISADONG_PAMBATA",  l: "Garantisadong Pambata" },
  { v: "OPERATION_TIMBANG_PLUS", l: "Operation Timbang Plus" },
  { v: "MASS_IMMUNIZATION_SIA",  l: "Mass immunization (SIA)" },
  { v: "MASS_DEWORMING",         l: "Mass deworming" },
  { v: "ADULT_VACCINATION_DAY",  l: "Adult vaccination day" },
  { v: "OTHER",                  l: "Other" },
];
const CAMPAIGN_LABEL: Record<CampaignType, string> = Object.fromEntries(
  CAMPAIGN_TYPES.map((t) => [t.v, t.l]),
) as Record<CampaignType, string>;

// Per-type field templates. Each "key" becomes a form input + a key in the
// tallies jsonb. "label" is what shows on the form; "kind" is just a hint.
const TALLY_FIELDS: Record<CampaignType, { key: string; label: string }[]> = {
  GARANTISADONG_PAMBATA: [
    { key: "vitA6_11mo",      label: "Vit A 6–11 mo" },
    { key: "vitA12_59mo",     label: "Vit A 12–59 mo" },
    { key: "dewormed12_59mo", label: "Dewormed 12–59 mo" },
    { key: "mnp6_23mo",       label: "MNP 6–23 mo" },
  ],
  OPERATION_TIMBANG_PLUS: [
    { key: "weighed0_59mo", label: "Weighed 0–59 mo" },
    { key: "samFound",      label: "SAM found" },
    { key: "mamFound",      label: "MAM found" },
    { key: "normal",        label: "Normal" },
  ],
  MASS_IMMUNIZATION_SIA: [
    { key: "vaccine",     label: "Vaccine (text)" },
    { key: "dosesGiven",  label: "Doses given" },
    { key: "target",      label: "Target population" },
  ],
  MASS_DEWORMING: [
    { key: "dewormed1_5y",   label: "Dewormed 1–5 y" },
    { key: "dewormed6_12y",  label: "Dewormed 6–12 y" },
  ],
  ADULT_VACCINATION_DAY: [
    { key: "vaccine",    label: "Vaccine (text)" },
    { key: "dosesGiven", label: "Doses given" },
    { key: "target",     label: "Target population" },
  ],
  OTHER: [
    { key: "served",  label: "People served" },
    { key: "note",    label: "Note (text)" },
  ],
};

interface CampaignTally {
  id: number;
  campaignType: CampaignType;
  campaignName: string;
  campaignDate: string;
  barangay: string;
  tallies: Record<string, number | string> | null;
  totalServed: number;
  notes: string | null;
  createdAt: string;
}

const newCampaignSchema = z.object({
  campaignType: z.enum(["GARANTISADONG_PAMBATA", "OPERATION_TIMBANG_PLUS", "MASS_IMMUNIZATION_SIA", "MASS_DEWORMING", "ADULT_VACCINATION_DAY", "OTHER"]),
  campaignName: z.string().min(1, "Name is required").max(120),
  campaignDate: z.string().min(1, "Date is required"),
  barangay:     z.string().min(1, "Barangay is required"),
  totalServed:  z.coerce.number().int().min(0),
  notes:        z.string().max(500).optional().or(z.literal("")),
});
type NewCampaignValues = z.infer<typeof newCampaignSchema>;

export default function CampaignsPage() {
  const { isTL, user } = useAuth();
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading, error, refetch } = useQuery<CampaignTally[]>({
    queryKey: ["/api/campaigns"],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="campaigns-title">
            <Megaphone className="w-5 h-5 text-primary" aria-hidden /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Tally sheets for Garantisadong Pambata, Operation Timbang Plus, mass immunization (SIA), and other event-based campaigns.
          </p>
        </div>
        {isTL ? (
          <Button onClick={() => setOpen(true)} data-testid="campaign-new">
            <Plus className="w-4 h-4 mr-1.5" aria-hidden /> Log Campaign
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns logged"
          description={isTL
            ? "Tap 'Log Campaign' after a Garantisadong Pambata round, Operation Timbang day, or other mass campaign."
            : "Campaign tally sheets captured by TLs will appear here."}
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Campaign tallies">
          {rows.map((c) => <CampaignRow key={c.id} item={c} />)}
        </ul>
      )}

      <NewCampaignDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function CampaignRow({ item }: { item: CampaignTally }) {
  const tallies = item.tallies ?? {};
  const visibleTallies = Object.entries(tallies).filter(([, v]) => v !== "" && v !== 0 && v !== null);
  return (
    <li>
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">{CAMPAIGN_LABEL[item.campaignType]}</Badge>
            <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
            <span className="text-xs text-muted-foreground">{item.campaignDate}</span>
            <span className="ml-auto font-bold tabular-nums">{item.totalServed} served</span>
          </div>
          <div className="font-semibold">{item.campaignName}</div>
          {visibleTallies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {visibleTallies.map(([k, v]) => (
                <div key={k} className="px-2 py-1 rounded bg-muted/40 text-xs">
                  <span className="text-muted-foreground">{k}:</span>{" "}
                  <span className="font-semibold">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {item.notes ? <div className="text-xs text-muted-foreground italic">{item.notes}</div> : null}
        </CardContent>
      </Card>
    </li>
  );
}

function NewCampaignDialog({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [tallies, setTallies] = useState<Record<string, string>>({});

  const form = useForm<NewCampaignValues>({
    resolver: zodResolver(newCampaignSchema),
    mode: "onBlur",
    defaultValues: {
      campaignType: "GARANTISADONG_PAMBATA",
      campaignName: "",
      campaignDate: today,
      barangay: defaultBarangay,
      totalServed: 0,
      notes: "",
    },
  });

  const campaignType = form.watch("campaignType") as CampaignType;
  const fields = TALLY_FIELDS[campaignType] ?? [];

  const create = useMutation({
    mutationFn: async (data: NewCampaignValues) => {
      // Coerce numeric tallies; pass through text for keys like "vaccine".
      const tallyPayload: Record<string, number | string> = {};
      for (const f of fields) {
        const raw = (tallies[f.key] ?? "").trim();
        if (!raw) continue;
        const n = Number(raw);
        tallyPayload[f.key] = Number.isFinite(n) && raw === String(n) ? n : raw;
      }
      return (await apiRequest("POST", "/api/campaigns", { ...data, tallies: tallyPayload })).json();
    },
    onSuccess: () => {
      toast({ title: "Campaign logged" });
      onCreated();
      form.reset();
      setTallies({});
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Campaign</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
            <FormField control={form.control} name="campaignType" render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign type *</FormLabel>
                <Select value={field.value} onValueChange={(v) => { field.onChange(v); setTallies({}); }}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="campaignName" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Campaign name *</FormLabel><FormControl><Input {...field} placeholder="e.g. April 2026 GP Round 1" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="campaignDate" render={({ field }) => (
                <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="totalServed" render={({ field }) => (
                <FormItem><FormLabel>Total served *</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {fields.length > 0 ? (
              <div className="border-t pt-3">
                <Label className="text-sm font-semibold">{CAMPAIGN_LABEL[campaignType]} tally</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs" htmlFor={`tally-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`tally-${f.key}`}
                        value={tallies[f.key] ?? ""}
                        onChange={(e) => setTallies({ ...tallies, [f.key]: e.target.value })}
                        data-testid={`tally-${f.key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
