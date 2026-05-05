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
import { Package, Plus, Check, X } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import { severityBadge } from "@/lib/severity";
import { Term } from "@/components/term";

type Status = "PENDING" | "FULFILLED" | "REJECTED";

interface RestockRequest {
  id: number;
  barangay: string;
  itemType: "vaccine" | "medicine";
  itemName: string;
  quantityRequested: number;
  urgency: "NORMAL" | "URGENT";
  status: Status;
  requestedAt: string;
  fulfilledAt: string | null;
  notes: string | null;
  fulfillmentNotes: string | null;
}

const newReqSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  itemType: z.enum(["vaccine", "medicine"]),
  itemName: z.string().min(1, "Item name is required").max(100),
  quantityRequested: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  urgency: z.enum(["NORMAL", "URGENT"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
type NewReqValues = z.infer<typeof newReqSchema>;

export default function RestockRequestsPage() {
  const { isTL, isMHO, isSHA, isAdmin } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("PENDING");
  const [open, setOpen] = useState(false);

  const queryKey = [`/api/inventory-requests${statusFilter === "all" ? "" : `?status=${statusFilter}`}`];
  const { data: rows = [], isLoading, error, refetch } = useQuery<RestockRequest[]>({ queryKey });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="restock-title">
            <Package className="w-5 h-5 text-primary" aria-hidden /> Restock Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            <Term name="BHS">BHS</Term>-side requests for vaccine and medicine restocking. <Term name="RHU">RHU</Term> MGMT fulfills.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {isTL ? (
            <Button onClick={() => setOpen(true)} data-testid="restock-new">
              <Plus className="w-4 h-4 mr-1.5" aria-hidden /> New Request
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={statusFilter === "PENDING" ? "No pending requests" : "No requests"}
          description={
            isTL
              ? "Tap 'New Request' to ask the RHU to restock a medicine or vaccine."
              : "Open requests from BHS team leaders will appear here."
          }
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Restock requests">
          {rows.map((r) => (
            <RestockRow
              key={r.id}
              item={r}
              canFulfill={isMgmt}
              onChanged={() => queryClient.invalidateQueries({ queryKey })}
            />
          ))}
        </ul>
      )}

      <NewRequestDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey });
          setOpen(false);
        }}
      />
    </div>
  );
}

function RestockRow({
  item, canFulfill, onChanged,
}: {
  item: RestockRequest;
  canFulfill: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");

  const setStatus = useMutation({
    mutationFn: async (next: Status) =>
      (await apiRequest("PATCH", `/api/inventory-requests/${item.id}`, {
        status: next,
        fulfillmentNotes: note || undefined,
      })).json(),
    onSuccess: () => {
      toast({ title: "Request updated" });
      onChanged();
    },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <li>
      <Card>
        <CardContent className="py-4 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold">{item.itemName}</span>
              <Badge variant="outline" className="text-xs">{item.itemType}</Badge>
              <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
              <span className={severityBadge({ severity: item.urgency === "URGENT" ? "high" : "medium" })}>
                {item.urgency}
              </span>
              <span className={severityBadge({
                severity:
                  item.status === "PENDING"   ? "medium" :
                  item.status === "FULFILLED" ? "ok"     :
                                                "low",
              })}>{item.status}</span>
            </div>
            <div className="text-sm">Quantity requested: {item.quantityRequested}</div>
            {item.notes ? <div className="text-sm text-muted-foreground">{item.notes}</div> : null}
            {item.fulfillmentNotes ? (
              <div className="text-xs text-muted-foreground mt-1 italic">RHU: {item.fulfillmentNotes}</div>
            ) : null}
            <div className="text-xs text-muted-foreground mt-1">
              Requested {new Date(item.requestedAt).toLocaleString()}
              {item.fulfilledAt ? ` · Closed ${new Date(item.fulfilledAt).toLocaleString()}` : ""}
            </div>
          </div>
          {canFulfill && item.status === "PENDING" ? (
            <div className="flex flex-col gap-2 w-full md:w-72">
              <Textarea
                rows={2}
                placeholder="Fulfillment / rejection note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setStatus.mutate("FULFILLED")} disabled={setStatus.isPending}>
                  <Check className="w-3.5 h-3.5 mr-1" aria-hidden /> Fulfill
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate("REJECTED")} disabled={setStatus.isPending}>
                  <X className="w-3.5 h-3.5 mr-1" aria-hidden /> Reject
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

function NewRequestDialog({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<NewReqValues>({
    resolver: zodResolver(newReqSchema),
    defaultValues: {
      barangay: defaultBarangay,
      itemType: "medicine",
      itemName: "",
      quantityRequested: 1,
      urgency: "NORMAL",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: NewReqValues) =>
      (await apiRequest("POST", "/api/inventory-requests", data)).json(),
    onSuccess: () => {
      toast({ title: "Restock request submitted" });
      onCreated();
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Could not submit", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Restock Request</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
            <FormField control={form.control} name="itemType" render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="medicine">Medicine</SelectItem>
                    <SelectItem value="vaccine">Vaccine</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="itemName" render={({ field }) => (
              <FormItem>
                <FormLabel>Item *</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Amoxicillin 500mg" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="quantityRequested" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity *</FormLabel>
                <FormControl><Input type="number" min="1" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="urgency" render={({ field }) => (
              <FormItem>
                <FormLabel>Urgency *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgent (out of stock)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Submitting…" : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
