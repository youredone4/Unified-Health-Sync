import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Apple, Save } from "lucide-react";
import type { Child } from "@shared/schema";

interface Props {
  child: Child;
}

/**
 * Surfaces three M1 Section E inputs that previously had no UI:
 *   E-02   children.iron_supp_complete   (LBW infants given complete iron)
 *   E-03a  children.vitamin_a1_date      (6-11mo Vit-A 1st dose)
 *   E-03b  children.vitamin_a2_date      (12-59mo Vit-A 2nd dose)
 *
 * Persists via PUT /api/children/:id with a partial body. The server
 * route uses insertChildSchema.partial(), so we only send the three
 * fields we manage here.
 *
 * Edit affordances are TL-only (canEnterRecords); MGMT roles see
 * read-only values.
 */
export default function ChildNutritionCard({ child }: Props) {
  const { canEnterRecords } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vit1, setVit1] = useState(child.vitaminA1Date ?? "");
  const [vit2, setVit2] = useState(child.vitaminA2Date ?? "");
  const [iron, setIron] = useState(!!child.ironSuppComplete);

  const dirty =
    (vit1 || null) !== (child.vitaminA1Date ?? null) ||
    (vit2 || null) !== (child.vitaminA2Date ?? null) ||
    iron !== !!child.ironSuppComplete;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        vitaminA1Date: vit1 || null,
        vitaminA2Date: vit2 || null,
        ironSuppComplete: iron,
      };
      return (await apiRequest("PUT", `/api/children/${child.id}`, body)).json();
    },
    onSuccess: () => {
      toast({ title: "Nutrition fields saved" });
      // Bump every child cache so list pages and the profile re-render.
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: [`/api/children/${child.id}`] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-child-nutrition">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Apple className="w-4 h-4 text-primary" aria-hidden /> Nutrition (M1 Section E)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cn-vit1" className="text-xs text-muted-foreground">
              Vit-A 1st dose (6–11 mo) — feeds E-03a
            </Label>
            <Input
              id="cn-vit1"
              type="date"
              value={vit1}
              onChange={(e) => setVit1(e.target.value)}
              disabled={!canEnterRecords}
              data-testid="cn-vit1"
            />
          </div>
          <div>
            <Label htmlFor="cn-vit2" className="text-xs text-muted-foreground">
              Vit-A 2nd dose (12–59 mo) — feeds E-03b
            </Label>
            <Input
              id="cn-vit2"
              type="date"
              value={vit2}
              onChange={(e) => setVit2(e.target.value)}
              disabled={!canEnterRecords}
              data-testid="cn-vit2"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="cn-iron"
            checked={iron}
            onCheckedChange={(v) => setIron(!!v)}
            disabled={!canEnterRecords}
            data-testid="cn-iron"
          />
          <Label htmlFor="cn-iron" className="font-normal text-sm">
            Complete iron supplementation (LBW infants) — feeds E-02
          </Label>
        </div>

        {canEnterRecords && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
              data-testid="cn-save"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
