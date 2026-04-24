import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ArrowRight } from "lucide-react";

interface M1ReportInstance {
  id: number;
  barangayId: number | null;
  month: number;
  year: number;
  status: string;
}

interface M1ProgressStripProps {
  daysRemaining: number;
}

export function M1ProgressStrip({ daysRemaining }: M1ProgressStripProps) {
  const [, navigate] = useLocation();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: reports = [], isLoading } = useQuery<M1ReportInstance[]>({
    queryKey: [`/api/m1/reports?month=${month}&year=${year}`],
  });

  const reportForPeriod = reports[0];
  const status = reportForPeriod?.status?.toLowerCase() ?? null;
  const statusLabel =
    status === "submitted"
      ? "Submitted"
      : status === "draft"
      ? "Draft in progress"
      : status === "approved"
      ? "Approved"
      : "Not started";
  const statusTone =
    status === "submitted" || status === "approved"
      ? "default"
      : status === "draft"
      ? "secondary"
      : "destructive";

  const monthName = now.toLocaleString(undefined, { month: "long" });

  const isReadOnly = status === "submitted" || status === "approved";
  const ctaLabel = !reportForPeriod
    ? "Start M1 report"
    : isReadOnly
    ? "Open M1 summary"
    : "Continue M1 report";
  const ctaHref = isReadOnly ? "/reports/m1" : "/m1/encode";

  return (
    <Card data-testid="card-m1-progress">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 flex-wrap">
          <ClipboardList className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {monthName} {year} M1/M2 report
            </p>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Checking status…"
                : daysRemaining === 0
                ? "Submission deadline is today"
                : `Submission deadline in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`}
            </p>
          </div>
          <Badge variant={statusTone as "default" | "secondary" | "destructive"} data-testid="badge-m1-status">
            {statusLabel}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigate(ctaHref)}
            data-testid="button-open-m1"
          >
            {ctaLabel} <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
