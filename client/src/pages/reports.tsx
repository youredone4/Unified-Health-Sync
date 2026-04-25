import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, ArrowRight, ClipboardList, Activity, ShieldAlert, BarChart3,
} from "lucide-react";

interface ReportDef {
  slug: string;
  title: string;
  description: string;
  cadence: "weekly" | "monthly" | "quarterly" | "annual";
  category: "fhsis" | "program" | "surveillance" | "performance";
  source: string | null;
}

const CATEGORY_LABELS: Record<ReportDef["category"], string> = {
  fhsis: "FHSIS Family",
  program: "Program-Specific",
  surveillance: "Surveillance",
  performance: "LGU Performance",
};

const CATEGORY_ICONS: Record<ReportDef["category"], typeof ClipboardList> = {
  fhsis: ClipboardList,
  program: Activity,
  surveillance: ShieldAlert,
  performance: BarChart3,
};

const CADENCE_TONE: Record<ReportDef["cadence"], string> = {
  weekly: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  monthly: "bg-primary/15 text-primary",
  quarterly: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  annual: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function ReportsPage() {
  const [, navigate] = useLocation();
  const { data: reports = [], isLoading } = useQuery<ReportDef[]>({
    queryKey: ["/api/reports"],
  });

  const grouped = reports.reduce<Record<ReportDef["category"], ReportDef[]>>(
    (acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    },
    { fhsis: [], program: [], surveillance: [], performance: [] },
  );

  const orderedCategories: ReportDef["category"][] = ["fhsis", "program", "surveillance", "performance"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="reports-title">
          <FileText className="w-5 h-5 text-primary" /> Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          DOH-mandated reports drawn from operational data. Generate, preview, and export by period.
        </p>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading reports…</CardContent></Card>
      ) : (
        orderedCategories.map((cat) => {
          const list = grouped[cat] ?? [];
          if (list.length === 0) return null;
          const Icon = CATEGORY_ICONS[cat];
          return (
            <section key={cat} className="space-y-3" data-testid={`reports-section-${cat}`}>
              <h2 className="text-base font-medium flex items-center gap-2 text-muted-foreground">
                <Icon className="w-4 h-4" /> {CATEGORY_LABELS[cat]}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((r) => (
                  <Card
                    key={r.slug}
                    className="hover-elevate cursor-pointer"
                    onClick={() => navigate(`/reports/${r.slug}`)}
                    data-testid={`report-tile-${r.slug}`}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-start gap-2">
                        <span className="flex-1">{r.title}</span>
                        <Badge variant="outline" className={`text-[10px] font-normal ${CADENCE_TONE[r.cadence]}`}>
                          {r.cadence}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
                      {r.source && (
                        <p className="text-[10px] text-muted-foreground italic mb-3">{r.source}</p>
                      )}
                      <Button size="sm" variant="outline" className="gap-1 w-full" data-testid={`report-open-${r.slug}`}>
                        Open <ArrowRight className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
