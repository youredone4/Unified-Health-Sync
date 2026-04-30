import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, AlertCircle, Clock, Calendar, CheckCircle2 } from "lucide-react";

export interface WorklistItem {
  id: string;
  name: string;
  reason: string;
  profileHref: string;
  barangay?: string;
  badge?: string;
  severity?: "danger" | "warning" | "info";
}

export type ProgramKey = "prenatal" | "immunization" | "ncd" | "tb" | "disease";

export interface PriorityItem extends WorklistItem {
  program: ProgramKey;
}

interface PriorityListProps {
  items: PriorityItem[];
  programFilter: ProgramKey | "all";
}

const PROGRAM_LABEL: Record<ProgramKey, string> = {
  prenatal:     "Prenatal",
  immunization: "EPI",
  ncd:          "NCD",
  tb:           "TB DOTS",
  disease:      "Disease",
};

const PAGE_SIZE = 10;

export function PriorityList({ items, programFilter }: PriorityListProps) {
  const filtered = programFilter === "all"
    ? items
    : items.filter((i) => i.program === programFilter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const [page, setPage] = useState(1);

  // Reset to page 1 when the filter changes or the page would exceed totalPages
  // (e.g. items get marked done elsewhere and the list shrinks).
  useEffect(() => { setPage(1); }, [programFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const visible  = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // Sections are computed from the visible page so the urgency grouping
  // still reads correctly when paginated. Page 1 will always lead with
  // Overdue items because the input list is severity-sorted upstream.
  const overdue  = visible.filter((i) => i.severity === "danger");
  const dueToday = visible.filter((i) => i.severity === "warning");
  const upcoming = visible.filter((i) => i.severity === "info");

  if (filtered.length === 0) {
    return (
      <Card data-testid="priority-list-empty">
        <CardContent className="py-12 text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
          <p className="text-lg font-semibold">All caught up</p>
          <p className="text-sm text-muted-foreground">
            Nothing pending {programFilter === "all" ? "today" : `for ${PROGRAM_LABEL[programFilter]} today`}. Good time for a record review or home visit.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="priority-list">
      {overdue.length > 0 && (
        <Section
          title="Overdue"
          count={overdue.length}
          icon={AlertCircle}
          className="border-red-500/30 bg-red-500/5"
          iconClassName="text-red-600"
          dotClassName="bg-red-500"
          items={overdue}
          testId="section-overdue"
        />
      )}
      {dueToday.length > 0 && (
        <Section
          title="Due today"
          count={dueToday.length}
          icon={Clock}
          className="border-amber-500/30 bg-amber-500/5"
          iconClassName="text-amber-600"
          dotClassName="bg-amber-500"
          items={dueToday}
          testId="section-due-today"
        />
      )}
      {upcoming.length > 0 && (
        <Section
          title="Upcoming"
          count={upcoming.length}
          icon={Calendar}
          className="border-sky-500/30 bg-sky-500/5"
          iconClassName="text-sky-600"
          dotClassName="bg-sky-500"
          items={upcoming}
          testId="section-upcoming"
        />
      )}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 px-1" data-testid="priority-pagination">
          <span className="text-sm text-muted-foreground">
            Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="page-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <span className="text-sm font-medium tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="page-next"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title, count, icon: Icon, className, iconClassName, dotClassName, items, testId,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  className: string;
  iconClassName: string;
  dotClassName: string;
  items: PriorityItem[];
  testId: string;
}) {
  const [, navigate] = useLocation();
  return (
    <Card className={className} data-testid={testId}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-5 h-5 ${iconClassName}`} />
          <h2 className="text-base font-semibold">{title}</h2>
          <Badge variant="outline" className="ml-auto">{count}</Badge>
        </div>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(item.profileHref)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(item.profileHref);
              }}
              className="flex items-center gap-3 p-3 rounded-md bg-background/80 cursor-pointer hover-elevate"
              data-testid={`priority-item-${item.id}`}
            >
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClassName}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{item.name}</p>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {PROGRAM_LABEL[item.program]}
                  </Badge>
                  {item.badge && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {item.reason}
                  {item.barangay ? ` · ${item.barangay}` : ""}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
