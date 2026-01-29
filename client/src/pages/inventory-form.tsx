import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import type { InventoryItem, Barangay } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, ArrowLeft, Save } from "lucide-react";

const formSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  bcgQty: z.coerce.number().min(0).default(0),
  hepBQty: z.coerce.number().min(0).default(0),
  pentaQty: z.coerce.number().min(0).default(0),
  opvQty: z.coerce.number().min(0).default(0),
  mrQty: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.coerce.number().min(0).default(10),
  surplusThreshold: z.coerce.number().min(0).default(100),
});

type FormValues = z.infer<typeof formSchema>;

export default function InventoryForm() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/inventory/:id/edit");
  const isEdit = match && params?.id;
  const { toast } = useToast();

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: inventoryItem } = useQuery<InventoryItem>({
    queryKey: ['/api/inventory', params?.id],
    enabled: !!isEdit,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      barangay: "",
      bcgQty: 0,
      hepBQty: 0,
      pentaQty: 0,
      opvQty: 0,
      mrQty: 0,
      lowStockThreshold: 10,
      surplusThreshold: 100,
    },
    values: isEdit && inventoryItem ? {
      barangay: inventoryItem.barangay,
      bcgQty: (inventoryItem.vaccines as any)?.bcgQty || 0,
      hepBQty: (inventoryItem.vaccines as any)?.hepBQty || 0,
      pentaQty: (inventoryItem.vaccines as any)?.pentaQty || 0,
      opvQty: (inventoryItem.vaccines as any)?.opvQty || 0,
      mrQty: (inventoryItem.vaccines as any)?.mrQty || 0,
      lowStockThreshold: inventoryItem.lowStockThreshold || 10,
      surplusThreshold: inventoryItem.surplusThreshold || 100,
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        barangay: data.barangay,
        vaccines: {
          bcgQty: data.bcgQty,
          hepBQty: data.hepBQty,
          pentaQty: data.pentaQty,
          opvQty: data.opvQty,
          mrQty: data.mrQty,
        },
        htnMeds: [],
        lowStockThreshold: data.lowStockThreshold,
        surplusThreshold: data.surplusThreshold,
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      return apiRequest("POST", "/api/inventory", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({ title: "Inventory record created successfully" });
      navigate("/inventory");
    },
    onError: () => {
      toast({ title: "Failed to create inventory record", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        barangay: data.barangay,
        vaccines: {
          bcgQty: data.bcgQty,
          hepBQty: data.hepBQty,
          pentaQty: data.pentaQty,
          opvQty: data.opvQty,
          mrQty: data.mrQty,
        },
        lowStockThreshold: data.lowStockThreshold,
        surplusThreshold: data.surplusThreshold,
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      return apiRequest("PUT", `/api/inventory/${params?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({ title: "Inventory updated successfully" });
      navigate("/inventory");
    },
    onError: () => {
      toast({ title: "Failed to update inventory", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Package className="w-6 h-6 text-green-400" />
            {isEdit ? "Edit Inventory" : "Add New Inventory"}
          </h1>
          <p className="text-muted-foreground">{isEdit ? "Update stock levels" : "Add inventory for a barangay"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barangay Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="barangay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barangay *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!isEdit}>
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
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccine Stock Quantities</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <FormField
                  control={form.control}
                  name="bcgQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BCG</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-bcg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hepBQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hep B</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-hepb" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pentaQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Penta</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-penta" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="opvQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OPV</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-opv" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mrQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MR</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-mr" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Threshold Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low Stock Threshold</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-low-threshold" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surplusThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surplus Threshold</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} data-testid="input-surplus-threshold" />
                      </FormControl>
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
                  {isEdit ? "Update Inventory" : "Save Inventory"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
