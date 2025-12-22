import { useState } from "react";
import { Layout } from "@/components/Layout";
import { KPICard } from "@/components/KPICard";
import { useMothers, useUpdateMother } from "@/hooks/use-mothers";
import { DetailsDrawer } from "@/components/DetailsDrawer";
import { Button } from "@/components/ui/button";
import { Baby, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format, addDays, isPast, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Prenatal() {
  const { data: mothers, isLoading } = useMothers();
  const updateMother = useUpdateMother();
  const { toast } = useToast();
  const [selectedMother, setSelectedMother] = useState<any>(null);

  // Health Logic
  const getStatus = (mother: any) => {
    // Demo Logic: If TT1 is missing, it's overdue. 
    // If TT1 done, check TT2 (due 28 days after).
    // If TT2 done, check TT3 (due 180 days after).
    
    if (!mother.tt1Date) return { status: 'overdue', label: 'TT1 Pending', color: 'destructive' };
    
    const tt1 = parseISO(mother.tt1Date);
    if (!mother.tt2Date) {
      const dueDate = addDays(tt1, 28);
      const daysOverdue = differenceInDays(new Date(), dueDate);
      
      if (daysOverdue > 0) return { status: 'overdue', label: 'TT2 Overdue', color: 'destructive' };
      if (daysOverdue > -7) return { status: 'due-soon', label: 'TT2 Due Soon', color: 'warning' };
      return { status: 'ok', label: 'TT2 Scheduled', color: 'success' };
    }

    // Simplified logic for demo
    return { status: 'ok', label: 'Up to Date', color: 'success' };
  };

  const activeMothers = mothers?.filter(m => m.status === 'active') || [];
  const overdueCount = activeMothers.filter(m => getStatus(m).status === 'overdue').length;
  const dueSoonCount = activeMothers.filter(m => getStatus(m).status === 'due-soon').length;

  const handleUpdate = async (field: string) => {
    if (!selectedMother) return;
    
    const today = new Date().toISOString().split('T')[0];
    try {
      await updateMother.mutateAsync({
        id: selectedMother.id,
        [field]: today
      });
      toast({
        title: "Record Updated",
        description: `Successfully marked ${field} as done.`,
      });
      setSelectedMother(prev => ({ ...prev, [field]: today }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update record.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout title="Prenatal Care" subtitle="Tetanus Toxoid (TT) Immunization Worklist">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard 
          title="Overdue" 
          value={overdueCount} 
          color="destructive"
          icon={<AlertCircle className="w-6 h-6" />} 
        />
        <KPICard 
          title="Due This Week" 
          value={dueSoonCount} 
          color="warning"
          icon={<Clock className="w-6 h-6" />} 
        />
        <KPICard 
          title="Total Active" 
          value={activeMothers.length} 
          color="default"
          icon={<Baby className="w-6 h-6" />} 
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-4">Mother Name</th>
                <th className="p-4">Barangay</th>
                <th className="p-4">GA Weeks</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : activeMothers.map((mother) => {
                const status = getStatus(mother);
                return (
                  <tr 
                    key={mother.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedMother(mother)}
                  >
                    <td className="p-4 font-medium text-foreground">{mother.name}</td>
                    <td className="p-4 text-muted-foreground">{mother.barangay}</td>
                    <td className="p-4">{mother.gaWeeks} weeks</td>
                    <td className="p-4">
                      <Badge variant={status.color === 'destructive' ? 'destructive' : status.color === 'warning' ? 'default' : 'secondary'} 
                        className={
                          status.color === 'warning' ? 'bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/80 text-white' : 
                          status.color === 'success' ? 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/80 text-white' : ''
                        }>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80">View</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DetailsDrawer 
        open={!!selectedMother} 
        onOpenChange={(open) => !open && setSelectedMother(null)}
        title={selectedMother?.name || "Patient Details"}
        description={`Barangay ${selectedMother?.barangay} • ${selectedMother?.gaWeeks} Weeks GA`}
      >
        {selectedMother && (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Mobile</p>
                <p className="font-mono text-lg">{selectedMother.phone || "N/A"}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Registration</p>
                <p className="font-mono text-lg">{selectedMother.registrationDate}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold font-display uppercase tracking-wide mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Immunization History
              </h3>
              
              <div className="space-y-3">
                {[
                  { key: 'tt1Date', label: 'Tetanus Toxoid 1' },
                  { key: 'tt2Date', label: 'Tetanus Toxoid 2' },
                  { key: 'tt3Date', label: 'Tetanus Toxoid 3' },
                ].map((vaccine) => {
                  const isDone = !!selectedMother[vaccine.key];
                  return (
                    <div key={vaccine.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {isDone ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{vaccine.label}</p>
                          <p className="text-sm text-muted-foreground">{selectedMother[vaccine.key] || "Pending"}</p>
                        </div>
                      </div>
                      {!isDone && (
                        <Button 
                          onClick={() => handleUpdate(vaccine.key)}
                          disabled={updateMother.isPending}
                          size="sm"
                        >
                          Mark Done
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <Button variant="destructive" className="w-full mt-8">Report Emergency / High Risk</Button>
          </div>
        )}
      </DetailsDrawer>
    </Layout>
  );
}
