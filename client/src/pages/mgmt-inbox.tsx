import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ArrowRight, Clock } from "lucide-react";

type InboxType = "referral" | "death-review" | "aefi" | "system-alert";
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
    systemAlert: number;
    total: number;
  };
}

const TYPE_LABEL: Record<InboxType, string> = {
  "referral": "Referral",
  "death-review": "Death Review",
  "aefi": "AEFI",
  "system-alert": "Alert",
};

const TYPE_BADGE: Record<InboxType, string> = {
  "referral":     "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "death-review": "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "aefi":         "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "system-alert": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const PRIORITY_BADGE: Record<InboxPriority, string> = {
  high:   "bg-red-500/15 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low:    "bg-muted text-muted-foreground",
};

export default function MgmtInboxPage() {
  const [filter, setFilter] = useState<"all" | InboxType>("all");

  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ["/api/mgmt/inbox"],
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const counts = data?.counts;
  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="mgmt-inbox-title">
          <Inbox className="w-5 h-5 text-primary" /> MGMT Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Every actionable signal from across HealthSync — pending referrals, open death reviews,
          unreported AEFIs, and recent system alerts — in one prioritized list.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts?.total} />
        <FilterButton active={filter === "referral"} onClick={() => setFilter("referral")} label="Referrals" count={counts?.referral} />
        <FilterButton active={filter === "death-review"} onClick={() => setFilter("death-review")} label="Death Reviews" count={counts?.deathReview} />
        <FilterButton active={filter === "aefi"} onClick={() => setFilter("aefi")} label="AEFI" count={counts?.aefi} />
        <FilterButton active={filter === "system-alert"} onClick={() => setFilter("system-alert")} label="Alerts" count={counts?.systemAlert} />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading inbox…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No {filter === "all" ? "" : TYPE_LABEL[filter as InboxType].toLowerCase() + " "}items pending. Inbox zero.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} data-testid={`inbox-item-${item.type}`}>
              <CardContent className="py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className={TYPE_BADGE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
                    <Badge className={PRIORITY_BADGE[item.priority]}>{item.priority}</Badge>
                    {item.barangay ? (
                      <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-sm text-muted-foreground truncate">{item.subtitle}</div>
                </div>
                <Link href={item.link}>
                  <Button size="sm" variant="ghost" className="shrink-0">
                    Open <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
      data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
      {typeof count === "number" ? (
        <span className={`ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs ${active ? "bg-white/20" : "bg-muted"}`}>
          {count}
        </span>
      ) : null}
    </Button>
  );
}
