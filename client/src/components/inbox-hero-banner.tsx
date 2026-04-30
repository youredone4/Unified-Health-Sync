import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type InboxType = "referral" | "death-review" | "aefi" | "outbreak" | "system-alert";
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
    systemAlert: number;
    total: number;
  };
}

const TYPE_LABEL: Record<InboxType, string> = {
  "referral":     "Referrals",
  "death-review": "Death Reviews",
  "aefi":         "AEFI",
  "outbreak":     "Outbreaks",
  "system-alert": "Alerts",
};

const TYPE_DOT: Record<InboxType, string> = {
  "referral":     "bg-sky-500",
  "death-review": "bg-violet-500",
  "aefi":         "bg-rose-500",
  "outbreak":     "bg-red-500",
  "system-alert": "bg-amber-500",
};

/**
 * Hero banner that surfaces the MGMT inbox at the top of /dashboards.
 * Renders nothing for non-MGMT roles. Shrinks to a quiet "all clear"
 * pill when the inbox is empty.
 */
export function InboxHeroBanner() {
  const { isMHO, isSHA, isAdmin } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;

  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ["/api/mgmt/inbox"],
    refetchInterval: 60_000,
    enabled: isMgmt,
  });

  if (!isMgmt) return null;
  if (isLoading) return null;

  const counts = data?.counts;
  const items = data?.items ?? [];
  const total = counts?.total ?? 0;

  // Empty inbox — quiet success pill so the dashboard stays the visual focus.
  if (total === 0) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-sm"
        data-testid="inbox-banner-empty"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-medium">Inbox is clear</span>
        <span className="text-muted-foreground">— no pending referrals, reviews, or alerts.</span>
        <Link href="/mgmt-inbox">
          <a className="ml-auto text-xs text-emerald-700 dark:text-emerald-400 hover:underline">Open</a>
        </Link>
      </div>
    );
  }

  const highPriorityCount = items.filter((i) => i.priority === "high").length;
  const top3 = items.slice(0, 3);

  return (
    <Card
      className="border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-rose-500/5"
      data-testid="inbox-banner"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="rounded-full p-2.5 bg-amber-500/15 shrink-0">
              <Inbox className="w-6 h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold leading-none tabular-nums" data-testid="inbox-banner-total">
                  {total}
                </span>
                <span className="font-semibold">items in MGMT Inbox</span>
              </div>
              {highPriorityCount > 0 && (
                <p className="text-sm text-red-700 dark:text-red-400 font-medium mt-0.5">
                  {highPriorityCount} high priority — review now
                </p>
              )}
            </div>
          </div>
          <Link href="/mgmt-inbox">
            <Button data-testid="inbox-banner-open">
              Open Inbox <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Type-count chip strip */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(Object.keys(TYPE_LABEL) as InboxType[]).map((t) => {
            const c =
              t === "referral"     ? counts?.referral :
              t === "death-review" ? counts?.deathReview :
              t === "aefi"         ? counts?.aefi :
              t === "outbreak"     ? counts?.outbreak ?? 0 :
                                     counts?.systemAlert;
            if (!c) return null;
            return (
              <Badge key={t} variant="outline" className="text-xs">
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${TYPE_DOT[t]}`} aria-hidden />
                {TYPE_LABEL[t]} <span className="ml-1 font-semibold tabular-nums">{c}</span>
              </Badge>
            );
          })}
        </div>

        {/* Top 3 items preview */}
        {top3.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-amber-500/20 pt-3">
            {top3.map((item) => (
              <Link key={item.id} href={item.link}>
                <a
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-background/60 cursor-pointer text-sm"
                  data-testid={`inbox-banner-item-${item.id}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[item.type]}`} aria-hidden />
                  <span className="font-medium truncate">{item.title}</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">
                    — {item.subtitle}
                  </span>
                  {item.barangay && (
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                      {item.barangay}
                    </Badge>
                  )}
                </a>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
