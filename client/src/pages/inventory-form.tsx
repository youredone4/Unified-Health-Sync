import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import type { InventoryItem, MedicineInventoryItem, Barangay } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, ArrowLeft, Save, Pill, Syringe } from "lucide-react";

const vaccineFormSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  bcgQty: z.coerce.number().min(0).default(0),
  hepBQty: z.coerce.number().min(0).default(0),
  pentaQty: z.coerce.number().min(0).default(0),
  opvQty: z.coerce.number().min(0).default(0),
  mrQty: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.coerce.number().min(0).default(10),
  surplusThreshold: z.coerce.number().min(0).default(100),
});

const medicineFormSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  medicineName: z.string().min(1, "Medicine name is required"),
  strength: z.string().optional(),
  unit: z.string().optional(),
  qty: z.coerce.number().min(0).default(0),
  expirationDate: z.string().optional(),
  // Lot tracking — required only for vaccines (validated in submit
  // handler, not here, so non-vaccine items can leave them blank). Per
  // issue #137 Phase 2.
  lotNumber: z.string().optional(),
  sourceSupplier: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  lowStockThreshold: z.coerce.number().min(0).default(10),
});

type VaccineFormValues = z.infer<typeof vaccineFormSchema>;
type MedicineFormValues = z.infer<typeof medicineFormSchema>;

export default function InventoryForm() {
  const [, navigate] = useLocation();
  const [vaccineMatch, vaccineParams] = useRoute("/inventory/:id/edit");
  const [medMatch, medParams] = useRoute("/inventory/medicine/:id/edit");
  const isVaccineEdit = vaccineMatch && vaccineParams?.id;
  const isMedicineEdit = medMatch && medParams?.id;
  const { toast } = useToast();

  const [inventoryType, setInventoryType] = useState<'vaccine' | 'medicine'>(
    isMedicineEdit ? 'medicine' : 'vaccine'
  );

  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  const { data: inventoryItem } = useQuery<InventoryItem>({
    queryKey: ['/api/inventory', vaccineParams?.id],
    enabled: !!isVaccineEdit,
  });
  const { data: medicineItem } = useQuery<MedicineInventoryItem>({
    queryKey: ['/api/medicine-inventory', medParams?.id],
    enabled: !!isMedicineEdit,
  });

  const vaccineForm = useForm<VaccineFormValues>({
    resolver: zodResolver(vaccineFormSchema),
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
    values: isVaccineEdit && inventoryItem ? {
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

  const medicineForm = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: {
      barangay: "",
      medicineName: "",
      strength: "",
      unit: "",
      qty: 0,
      expirationDate: "",
      lotNumber: "",
      sourceSupplier: "",
      category: "",
      notes: "",
      lowStockThreshold: 10,
    },
    values: isMedicineEdit && medicineItem ? {
      barangay: medicineItem.barangay,
      medicineName: medicineItem.medicineName,
      strength: medicineItem.strength || "",
      unit: medicineItem.unit || "",
      qty: medicineItem.qty,
      expirationDate: medicineItem.expirationDate || "",
      lotNumber: medicineItem.lotNumber || "",
      sourceSupplier: medicineItem.sourceSupplier || "",
      category: medicineItem.category || "",
      notes: medicineItem.notes || "",
      lowStockThreshold: medicineItem.lowStockThreshold || 10,
    } : undefined,
  });

  const createVaccineMutation = useMutation({
    mutationFn: async (data: VaccineFormValues) => {
      return apiRequest("POST", "/api/inventory", {
        barangay: data.barangay,
        vaccines: { bcgQty: data.bcgQty, hepBQty: data.hepBQty, pentaQty: data.pentaQty, opvQty: data.opvQty, mrQty: data.mrQty },
        htnMeds: [],
        lowStockThreshold: data.lowStockThreshold,
        surplusThreshold: data.surplusThreshold,
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({ title: "Vaccine inventory created successfully" });
      navigate("/inventory");
    },
    onError: () => toast({ title: "Failed to create inventory record", variant: "destructive" }),
  });

  const updateVaccineMutation = useMutation({
    mutationFn: async (data: VaccineFormValues) => {
      return apiRequest("PUT", `/api/inventory/${vaccineParams?.id}`, {
        barangay: data.barangay,
        vaccines: { bcgQty: data.bcgQty, hepBQty: data.hepBQty, pentaQty: data.pentaQty, opvQty: data.opvQty, mrQty: data.mrQty },
        lowStockThreshold: data.lowStockThreshold,
        surplusThreshold: data.surplusThreshold,
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      toast({ title: "Vaccine inventory updated successfully" });
      navigate("/inventory");
    },
    onError: () => toast({ title: "Failed to update inventory", variant: "destructive" }),
  });

  const createMedicineMutation = useMutation({
    mutationFn: async (data: MedicineFormValues) => {
      return apiRequest("POST", "/api/medicine-inventory", {
        ...data,
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medicine-inventory'] });
      toast({ title: "Medicine record created successfully" });
      navigate("/inventory");
    },
    onError: () => toast({ title: "Failed to create medicine record", variant: "destructive" }),
  });

  const updateMedicineMutation = useMutation({
    mutationFn: async (data: MedicineFormValues) => {
      return apiRequest("PUT", `/api/medicine-inventory/${medParams?.id}`, {
        ...data,
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medicine-inventory'] });
      toast({ title: "Medicine record updated successfully" });
      navigate("/inventory");
    },
    onError: () => toast({ title: "Failed to update medicine record", variant: "destructive" }),
  });

  const isEdit = isVaccineEdit || isMedicineEdit;

  const units = ["tablet", "capsule", "syrup", "vial", "ampoule", "sachet", "patch", "suppository", "other"];
  const categories = ["Senior Meds", "HTN", "Diabetes", "Antibiotic", "Analgesic", "Vitamins", "Other"];

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
          <p className="text-muted-foreground">{isEdit ? "Update stock record" : "Add inventory for a barangay"}</p>
        </div>
      </div>

      {!isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={inventoryType === 'vaccine' ? 'default' : 'outline'}
                onClick={() => setInventoryType('vaccine')}
                data-testid="button-type-vaccine"
                className="flex items-center gap-2"
              >
                <Syringe className="w-4 h-4" />
                Vaccine
              </Button>
              <Button
                type="button"
                variant={inventoryType === 'medicine' ? 'default' : 'outline'}
                onClick={() => setInventoryType('medicine')}
                data-testid="button-type-medicine"
                className="flex items-center gap-2"
              >
                <Pill className="w-4 h-4" />
                Medicine / Other Supply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(inventoryType === 'vaccine' || isVaccineEdit) && (
        <Form {...vaccineForm}>
          <form onSubmit={vaccineForm.handleSubmit(d => isVaccineEdit ? updateVaccineMutation.mutate(d) : createVaccineMutation.mutate(d))} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Syringe className="w-4 h-4 text-green-400" />
                  Barangay Selection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={vaccineForm.control}
                  name="barangay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barangay *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!isVaccineEdit}>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vaccine Stock Quantities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <FormField control={vaccineForm.control} name="bcgQty" render={({ field }) => (
                    <FormItem><FormLabel>BCG</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-bcg" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={vaccineForm.control} name="hepBQty" render={({ field }) => (
                    <FormItem><FormLabel>Hep B</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-hepb" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={vaccineForm.control} name="pentaQty" render={({ field }) => (
                    <FormItem><FormLabel>Penta</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-penta" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={vaccineForm.control} name="opvQty" render={({ field }) => (
                    <FormItem><FormLabel>OPV</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-opv" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={vaccineForm.control} name="mrQty" render={({ field }) => (
                    <FormItem><FormLabel>MR</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-mr" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Threshold Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={vaccineForm.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem><FormLabel>Low Stock Threshold</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-low-threshold" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={vaccineForm.control} name="surplusThreshold" render={({ field }) => (
                    <FormItem><FormLabel>Surplus Threshold</FormLabel><FormControl><Input type="number" min={0} {...field} data-testid="input-surplus-threshold" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel">Cancel</Button>
                  <Button type="submit" disabled={createVaccineMutation.isPending || updateVaccineMutation.isPending} data-testid="button-save">
                    <Save className="w-4 h-4 mr-2" />
                    {isVaccineEdit ? "Update Inventory" : "Save Inventory"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}

      {(inventoryType === 'medicine' || isMedicineEdit) && (
        <Form {...medicineForm}>
          <form onSubmit={medicineForm.handleSubmit(d => isMedicineEdit ? updateMedicineMutation.mutate(d) : createMedicineMutation.mutate(d))} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-400" />
                  Medicine Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={medicineForm.control} name="barangay" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barangay *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!!isMedicineEdit}>
                        <FormControl>
                          <SelectTrigger data-testid="select-med-barangay">
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
                  )} />

                  <FormField control={medicineForm.control} name="medicineName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medicine Name *</FormLabel>
                      <FormControl><Input placeholder="e.g. Amlodipine, Metformin" {...field} data-testid="input-medicine-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="strength" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strength / Dosage</FormLabel>
                      <FormControl><Input placeholder="e.g. 5mg, 500mg" {...field} data-testid="input-strength" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form / Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-unit">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="qty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} data-testid="input-med-qty" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="expirationDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-expiry" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Lot tracking — primarily for vaccines (issue #137 Phase 2)
                      so each dose can be traced back to its lot for AEFI
                      cluster detection. Optional for non-vaccine items. */}
                  <FormField control={medicineForm.control} name="lotNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lot / Batch Number</FormLabel>
                      <FormControl><Input placeholder="e.g. ABC123" {...field} data-testid="input-lot" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="sourceSupplier" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source / Supplier</FormLabel>
                      <FormControl><Input placeholder="e.g. DOH-CHD, manufacturer" {...field} data-testid="input-supplier" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={medicineForm.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low Stock Threshold</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} data-testid="input-med-threshold" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={medicineForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl><Textarea placeholder="Additional notes..." {...field} data-testid="input-med-notes" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()} data-testid="button-cancel-med">Cancel</Button>
              <Button type="submit" disabled={createMedicineMutation.isPending || updateMedicineMutation.isPending} data-testid="button-save-med">
                <Save className="w-4 h-4 mr-2" />
                {isMedicineEdit ? "Update Medicine Record" : "Save Medicine Record"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
