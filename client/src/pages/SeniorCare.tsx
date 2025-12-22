import { useState } from "react";
import { Layout } from "@/components/Layout";
import { KPICard } from "@/components/KPICard";
import { useSeniors, useUpdateSenior } from "@/hooks/use-seniors";
import { DetailsDrawer } from "@/components/DetailsDrawer";
import { Button } from "@/components/ui/button";
import { Pill, Phone, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function SeniorCare() {
  const { data: seniors, isLoading } = useSeniors();
  const updateSenior = useUpdateSenior();
  const { toast } = useToast();
  const [selectedSenior, setSelectedSenior] = useState<any>(null);

  const readyForPickup = seniors?.filter(s => s.htnMedsReady && !s.pickedUp) || [];
  
  const handleNotify = async (senior: any) => {
    // In a real app, this would trigger an SMS API
    toast({
      title: "Notification Sent",
      description: `SMS sent to ${senior.phone}: "Maintenance meds are ready for pickup."`,
    });
  };

  const handlePickup = async () => {
    if (!selectedSenior) return;
    try {
      await updateSenior.mutateAsync({
        id: selectedSenior.id,
        pickedUp: true
      });
      toast({
        title: "Success",
        description: "Meds marked as picked up.",
      });
      setSelectedSenior(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update record.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout title="Senior Care" subtitle="Hypertension Maintenance Medication Tracking">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <KPICard 
          title="Ready for Pickup" 
          value={readyForPickup.length} 
          color={readyForPickup.length > 0 ? "success" : "default"}
          icon={<Pill className="w-6 h-6" />} 
        />
        <KPICard 
          title="Total Registered" 
          value={seniors?.length || 0} 
          color="default"
          icon={<Phone className="w-6 h-6" />} 
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-4">Senior Name</th>
                <th className="p-4">Last BP</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Meds Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : seniors?.map((senior) => (
                <tr 
                  key={senior.id} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedSenior(senior)}
                >
                  <td className="p-4 font-medium text-foreground">{senior.name}</td>
                  <td className="p-4">{senior.lastBP || "N/A"}</td>
                  <td className="p-4 font-mono">{senior.phone}</td>
                  <td className="p-4">
                    {senior.pickedUp ? (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground">Picked Up</Badge>
                    ) : senior.htnMedsReady ? (
                      <Badge className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/80 text-white">Ready for Pickup</Badge>
                    ) : (
                      <Badge variant="secondary">Not Scheduled</Badge>
                    )}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    {senior.htnMedsReady && !senior.pickedUp && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-primary hover:text-primary-foreground hover:bg-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotify(senior);
                        }}
                      >
                        <Phone className="w-4 h-4 mr-1" /> Notify
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailsDrawer 
        open={!!selectedSenior} 
        onOpenChange={(open) => !open && setSelectedSenior(null)}
        title={selectedSenior?.name || "Senior Details"}
        description={`Contact: ${selectedSenior?.phone}`}
      >
        {selectedSenior && (
          <div className="space-y-6 mt-6">
             <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Last Blood Pressure</p>
                <div className="text-4xl font-bold font-display">{selectedSenior.lastBP || "--/--"}</div>
                <p className="text-xs text-muted-foreground mt-1">Date: {selectedSenior.lastBPDate || "N/A"}</p>
             </div>

             {selectedSenior.htnMedsReady && !selectedSenior.pickedUp ? (
               <div className="p-6 rounded-xl bg-success/10 border border-success/20">
                 <h4 className="text-lg font-bold text-success flex items-center gap-2 mb-2">
                   <CheckCircle className="w-5 h-5" /> Meds Available
                 </h4>
                 <p className="text-sm text-muted-foreground mb-4">
                   Losartan 50mg and Amlodipine 5mg pack is ready at the Barangay Health Station.
                 </p>
                 <Button 
                   onClick={handlePickup} 
                   className="w-full bg-success hover:bg-success/90 text-white"
                   disabled={updateSenior.isPending}
                 >
                   Confirm Pick Up
                 </Button>
               </div>
             ) : selectedSenior.pickedUp ? (
                <div className="p-4 rounded-lg bg-muted border border-border text-center text-muted-foreground">
                  Meds already picked up.
                </div>
             ) : (
               <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning flex items-center gap-2">
                 <AlertCircle className="w-5 h-5" /> Meds not yet arrived.
               </div>
             )}
          </div>
        )}
      </DetailsDrawer>
    </Layout>
  );
}
