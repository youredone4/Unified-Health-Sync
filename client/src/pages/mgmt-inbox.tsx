import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inbox, ArrowRight, Clock, CheckCircle2, Search } from "lucide-react";
import { severityBadge, severityDot, type Severity } from "@/lib/severity";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import { useAuth } from "@/hooks/use-auth";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

type InboxType = "referral" | "death-review" | "aefi" | "outbreak" | "restock" | "md-review" | "system-alert";
type InboxPriority = "high" | "medium" | "low";

interface InboxItem {
  id: string;
  type: InboxType;
  priority: InboxPriority;
  title: string;
  subtitle: string;
  barangay?: string;
  createdAt: string;
  link: string;
}

interface InboxResponse {
  items: InboxItem[];
  counts: {
    referral: number;
    deathReview: number;
    aefi: number;
    outbreak?: number;
    restock?: number;
    mdReview?: number;
    systemAlert: number;
    total: number;
  };
}

const TYPE_LABEL: Record<InboxType, string> = {
  "referral":     "Referral",
  "death-review": "Death Review",
  "aefi":         "AEFI",
  "outbreak":     "Outbreak",
  "restock":      "Restock",
  "md-review":    "MD Review",
  "system-alert": "Alert",
};

// Type → severity for the priority dot. Severity tokens carry the colours.
const PRIORITY_TO_SEVERITY: Record<InboxPriority, Severity> = {
  high: "high",
  medium: "medium",
  low: "low",
};

export default function MgmtInboxPage() {
  const [filter, setFilter] = useState<"all" | InboxType>("all");
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  // System alerts are admin-only; backend already filters them out
  // for MHO/SHA, so the filter chip is hidden too (no value showing
  // a chip that always reads 0).
  const { isAdmin } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<InboxResponse>({
    queryKey: ["/api/mgmt/inbox"],
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const counts = data?.counts;
  const byType = filter === "all" ? items : items.filter((i) => i.type === filter);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? byType.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        (i.barangay?.toLowerCase().includes(q) ?? false)
      )
    : byType;

  const pagination = usePagination(filtered, 10);
  const { pagedItems, resetPage } = pagination;

  // Reset to page 1 whenever the filter chip or search query changes so
  // users don't land on an empty page after narrowing the list.
  useEffect(() => {
    resetPage();
  }, [filter, q, resetPage]);

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="text-2xl font-semibold flex items-center gap-2"
          data-testid="mgmt-inbox-title"
        >
          <Inbox className="w-5 h-5 text-primary" aria-hidden /> MGMT Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Every actionable signal from across HealthSync — pending referrals, open death reviews,
          unreported AEFIs, outbreaks, and recent system alerts — in one prioritized list.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search title, details, or barangay…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search inbox"
          data-testid="input-inbox-search"
        />
      </div>

      {/* Filter chips. role="group" + aria-label tell screen readers this is a related set. */}
      <div
        role="group"
        aria-label="Filter inbox by type"
        className="flex flex-wrap gap-2"
      >
        <FilterButton active={filter === "all"}          onClick={() => setFilter("all")}          label="All"           count={counts?.total} />
        <FilterButton active={filter === "referral"}     onClick={() => setFilter("referral")}     label="Referrals"     count={counts?.referral} />
        <FilterButton active={filter === "death-review"} onClick={() => setFilter("death-review")} label="Death Reviews" count={counts?.deathReview} />
        <FilterButton active={filter === "aefi"}         onClick={() => setFilter("aefi")}         label="AEFI"          count={counts?.aefi} />
        <FilterButton active={filter === "outbreak"}     onClick={() => setFilter("outbreak")}     label="Outbreaks"     count={counts?.outbreak} />
        <FilterButton active={filter === "md-review"}    onClick={() => setFilter("md-review")}    label="MD Reviews"    count={counts?.mdReview} />
        <FilterButton active={filter === "restock"}      onClick={() => setFilter("restock")}      label="Restock"       count={counts?.restock} />
        {isAdmin ? (
          <FilterButton active={filter === "system-alert"} onClick={() => setFilter("system-alert")} label="Alerts"        count={counts?.systemAlert} />
        ) : null}
      </div>

      {/* Three explicit states: error → loading → empty → list. */}
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={q ? "No matches" : "Inbox zero"}
          description={
            q
              ? `No items match "${search.trim()}". Try a different keyword or clear the search.`
              : filter === "all"
                ? "No pending referrals, reviews, AEFIs, or alerts. Good time for a record review."
                : `No ${TYPE_LABEL[filter as InboxType].toLowerCase()} items pending.`
          }
          testId="inbox-empty"
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Inbox items">
          {pagedItems.map((item) => {
            const severity = PRIORITY_TO_SEVERITY[item.priority];
            return (
              <li key={item.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  aria-label={`${TYPE_LABEL[item.type]}: ${item.title}. Priority ${item.priority}. ${item.barangay ?? ""}`}
                  onClick={() => navigate(item.link)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(item.link);
                    }
                  }}
                  className="cursor-pointer hover-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid={`inbox-item-${item.type}`}
                >
                  <CardContent className="py-4 flex items-start gap-3">
                    <span className={severityDot({ severity, size: "lg" })} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABEL[item.type]}
                        </Badge>
                        <span className={severityBadge({ severity })}>{item.priority}</span>
                        {item.barangay ? (
                          <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden />
                          <time dateTime={item.createdAt}>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </time>
                        </span>
                      </div>
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" aria-hidden />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > 10 ? (
        <TablePagination pagination={pagination} />
      ) : null}
    </div>
  );
}

function FilterButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}${typeof count === "number" ? ` (${count})` : ""}`}
      data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs ${active ? "bg-white/20" : "bg-muted"}`}
          aria-hidden
        >
          {count}
        </span>
      ) : null}
    </Button>
  );
}
