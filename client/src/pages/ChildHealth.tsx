import { useState } from "react";
import { Layout } from "@/components/Layout";
import { KPICard } from "@/components/KPICard";
import { useChildren, useUpdateChild } from "@/hooks/use-children";
import { DetailsDrawer } from "@/components/DetailsDrawer";
import { Button } from "@/components/ui/button";
import { Syringe, Calendar, CheckCircle, Clock, Baby } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ChildHealth() {
  const { data: children, isLoading } = useChildren();
  const updateChild = useUpdateChild();
  const { toast } = useToast();
  const [selectedChild, setSelectedChild] = useState<any>(null);

  // Simplified demo logic for vaccines
  const getStatus = (child: any) => {
    // Check Penta 3 completion as indicator
    if (!child.vaccines?.penta3) {
      const ageDays = differenceInDays(new Date(), parseISO(child.dob));
      if (ageDays > 98) return { status: 'overdue', label: 'Penta 3 Overdue', color: 'destructive' }; // 14 weeks
      if (ageDays > 90) return { status: 'due-soon', label: 'Penta 3 Due', color: 'warning' };
      return { status: 'ok', label: 'On Schedule', color: 'success' };
    }
    return { status: 'ok', label: 'Fully Immunized', color: 'success' };
  };

  const overdueCount = children?.filter(c => getStatus(c).status === 'overdue').length || 0;
  const dueSoonCount = children?.filter(c => getStatus(c).status === 'due-soon').length || 0;

  const handleUpdate = async (vaccineKey: string) => {
    if (!selectedChild) return;
    
    const today = new Date().toISOString().split('T')[0];
    const newVaccines = { ...selectedChild.vaccines, [vaccineKey]: today };
    
    try {
      await updateChild.mutateAsync({
        id: selectedChild.id,
        vaccines: newVaccines
      });
      toast({
        title: "Record Updated",
        description: `Successfully administered ${vaccineKey}.`,
      });
      setSelectedChild(prev => ({ ...prev, vaccines: newVaccines }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update record.",
        variant: "destructive"
      });
    }
  };

  return (
    <Layout title="Child Health" subtitle="Immunization & Growth Monitoring">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard 
          title="Missed Doses" 
          value={overdueCount} 
          color="destructive"
          icon={<Syringe className="w-6 h-6" />} 
        />
        <KPICard 
          title="Due This Week" 
          value={dueSoonCount} 
          color="warning"
          icon={<Clock className="w-6 h-6" />} 
        />
        <KPICard 
          title="Total Children" 
          value={children?.length || 0} 
          color="default"
          icon={<Baby className="w-6 h-6" />} 
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-4">Child Name</th>
                <th className="p-4">Barangay</th>
                <th className="p-4">Age (Days)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : children?.map((child) => {
                const status = getStatus(child);
                const age = differenceInDays(new Date(), parseISO(child.dob));
                return (
                  <tr 
                    key={child.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedChild(child)}
                  >
                    <td className="p-4 font-medium text-foreground">{child.name}</td>
                    <td className="p-4 text-muted-foreground">{child.barangay}</td>
                    <td className="p-4">{age} days</td>
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
                      <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80">Details</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DetailsDrawer 
        open={!!selectedChild} 
        onOpenChange={(open) => !open && setSelectedChild(null)}
        title={selectedChild?.name || "Child Details"}
        description={`DOB: ${selectedChild?.dob}`}
      >
        {selectedChild && (
          <div className="space-y-6 mt-6">
            <div>
              <h3 className="text-lg font-bold font-display uppercase tracking-wide mb-4 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-primary" />
                Vaccination Checklist
              </h3>
              
              <div className="space-y-3">
                {[
                  { key: 'bcg', label: 'BCG (At Birth)' },
                  { key: 'hepB', label: 'Hep B (At Birth)' },
                  { key: 'penta1', label: 'Penta 1 (6 Weeks)' },
                  { key: 'opv1', label: 'OPV 1 (6 Weeks)' },
                  { key: 'penta2', label: 'Penta 2 (10 Weeks)' },
                  { key: 'penta3', label: 'Penta 3 (14 Weeks)' },
                  { key: 'mr1', label: 'Measles (9 Months)' },
                ].map((vaccine) => {
                  const isDone = !!selectedChild.vaccines?.[vaccine.key];
                  return (
                    <div key={vaccine.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {isDone ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{vaccine.label}</p>
                          <p className="text-sm text-muted-foreground">{selectedChild.vaccines?.[vaccine.key] || "Pending"}</p>
                        </div>
                      </div>
                      {!isDone && (
                        <Button 
                          onClick={() => handleUpdate(vaccine.key)}
                          disabled={updateChild.isPending}
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
          </div>
        )}
      </DetailsDrawer>
    </Layout>
  );
}
