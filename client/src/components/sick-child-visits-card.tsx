import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Child, SickChildVisit } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Stethoscope, Save } from "lucide-react";
import { format } from "date-fns";

interface Props {
  child: Child;
}

export function SickChildVisitsCard({ child }: Props) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const queryKey = useMemo(() => [`/api/sick-child-visits?childId=${child.id}`], [child.id]);
  const { data: visits = [] } = useQuery<SickChildVisit[]>({ queryKey });

  const [visitDate, setVisitDate] = useState(today);
  const [vitaminA, setVitaminA] = useState(false);
  const [diarrhea, setDiarrhea] = useState(false);
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sick-child-visits", {
        childId: child.id,
        visitDate,
        vitaminAGiven: vitaminA,
        hasAcuteDiarrhea: diarrhea,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sick visit recorded" });
      queryClient.invalidateQueries({ queryKey });
      setVitaminA(false);
      setDiarrhea(false);
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-sick-child-visits">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" /> Sick visit log (IMCI)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Visit date</label>
            <Input type="date" value={visitDate} max={today} onChange={(e) => setVisitDate(e.target.value)} data-testid="input-scv-date" />
          </div>
          <label className="flex items-center gap-2 text-sm pt-5">
            <Checkbox checked={vitaminA} onCheckedChange={(v) => setVitaminA(!!v)} data-testid="check-scv-vita" />
            Vitamin A given (sick visit)
          </label>
          <label className="flex items-center gap-2 text-sm pt-5">
            <Checkbox checked={diarrhea} onCheckedChange={(v) => setDiarrhea(!!v)} data-testid="check-scv-diarrhea" />
            Acute diarrhea
          </label>
        </div>
        <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" data-testid="input-scv-notes" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {visits.length} sick visit{visits.length === 1 ? "" : "s"} on file
          </Badge>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending} className="gap-1" data-testid="button-save-scv">
            <Save className="w-4 h-4" />
            {create.isPending ? "Saving…" : "Record sick visit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
